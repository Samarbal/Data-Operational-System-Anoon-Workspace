import { google, sheets_v4 } from "googleapis";
import { cache } from "@/lib/cache";

function assertEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

type ServiceAccountConfig = {
  sheetId: string;
  email: string;
  privateKey: string;
};

function getServiceAccountConfig(): ServiceAccountConfig {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const jsonKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (jsonKey) {
    try {
      const parsed = JSON.parse(jsonKey) as {
        client_email?: string;
        private_key?: string;
      };
      email = parsed.client_email || email;
      privateKey = parsed.private_key || privateKey;
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON");
    }
  }

  assertEnv("GOOGLE_SHEET_ID", sheetId);
  assertEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", email);
  assertEnv("GOOGLE_PRIVATE_KEY", privateKey);

  return {
    sheetId: sheetId as string,
    email: email as string,
    privateKey: (privateKey as string).replace(/\\n/g, "\n")
  };
}

function toRange(sheetName: string, suffix = "A:ZZ"): string {
  const escaped = sheetName.replace(/'/g, "''");
  return `'${escaped}'!${suffix}`;
}

function normalizeValues(values: unknown[][]): (string | number | boolean)[][] {
  return values.map((row) =>
    row.map((cell) => {
      if (cell === null || cell === undefined) return "";
      if (typeof cell === "number" || typeof cell === "boolean") return cell;
      return String(cell);
    })
  );
}

class SheetsClient {
  private api: sheets_v4.Sheets;
  private config: ServiceAccountConfig;

  constructor() {
    this.config = getServiceAccountConfig();

    const auth = new google.auth.JWT({
      email: this.config.email,
      key: this.config.privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    this.api = google.sheets({ version: "v4", auth });
  }

  async getSheetNames(): Promise<string[]> {
    const cacheKey = "sheets:meta:names";
    const cached = cache.get<string[]>(cacheKey);
    if (cached && cached.length) {
      return cached;
    }

    const res = await this.api.spreadsheets.get({
      spreadsheetId: this.config.sheetId,
      fields: "sheets.properties.title"
    });

    const names = (res.data.sheets ?? [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title));
    cache.set(cacheKey, names, 600);
    return names;
  }

  async getSheetValues(sheetName: string): Promise<unknown[][]> {
    const res = await this.api.spreadsheets.values.get({
      spreadsheetId: this.config.sheetId,
      range: toRange(sheetName),
      majorDimension: "ROWS",
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING"
    });
    return res.data.values ?? [];
  }

  async getSheetRangeValues(sheetName: string, rangeA1: string): Promise<unknown[][]> {
    const res = await this.api.spreadsheets.values.get({
      spreadsheetId: this.config.sheetId,
      range: toRange(sheetName, rangeA1),
      majorDimension: "ROWS",
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING"
    });
    return res.data.values ?? [];
  }

  async batchGetSheetValues(sheetNames: string[]): Promise<Record<string, unknown[][]>> {
    if (sheetNames.length === 0) return {};
    const res = await this.api.spreadsheets.values.batchGet({
      spreadsheetId: this.config.sheetId,
      ranges: sheetNames.map((name) => toRange(name)),
      majorDimension: "ROWS",
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING"
    });

    const bySheet: Record<string, unknown[][]> = {};
    for (const valueRange of res.data.valueRanges ?? []) {
      const rawRange = valueRange.range ?? "";
      const match = rawRange.match(/^'?(.*?)'?!/);
      const sheetName = match?.[1]?.replace(/''/g, "'");
      if (sheetName) {
        bySheet[sheetName] = valueRange.values ?? [];
      }
    }
    return bySheet;
  }

  async ensureSheetExists(sheetName: string): Promise<void> {
    const names = await this.getSheetNames();
    if (names.includes(sheetName)) return;
    await this.api.spreadsheets.batchUpdate({
      spreadsheetId: this.config.sheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }
        ]
      }
    });
    cache.delete("sheets:meta:names");
  }

  async clearAndWriteSheet(sheetName: string, values: unknown[][]): Promise<void> {
    await this.ensureSheetExists(sheetName);
    await this.api.spreadsheets.values.clear({
      spreadsheetId: this.config.sheetId,
      range: toRange(sheetName)
    });

    if (!values.length) {
      return;
    }

    const normalized = normalizeValues(values);
    const maxCols = normalized.reduce((max, row) => Math.max(max, row.length), 0);
    const padded = normalized.map((row) => {
      const next = row.slice();
      while (next.length < maxCols) next.push("");
      return next;
    });

    await this.api.spreadsheets.values.update({
      spreadsheetId: this.config.sheetId,
      range: toRange(sheetName, "A1"),
      valueInputOption: "RAW",
      requestBody: {
        majorDimension: "ROWS",
        values: padded
      }
    });
  }
}

let singleton: SheetsClient | null = null;

export function getSheetsClient(): SheetsClient {
  singleton ??= new SheetsClient();
  return singleton;
}
