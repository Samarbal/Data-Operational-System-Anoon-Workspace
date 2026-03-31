import { google, sheets_v4 } from "googleapis";
import { cache } from "@/lib/cache";

export type SheetOperation =
  | {
      type: "update";
      row: number;
      col: number;
      values: (string | number | boolean)[][];
    }
  | {
      type: "deleteRow";
      rowIndex: number;
    };

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

function columnToA1(col: number): string {
  let n = col;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function buildA1Range(sheetName: string, row: number, col: number, numRows: number, numCols: number): string {
  const start = `${columnToA1(col)}${row}`;
  const end = `${columnToA1(col + numCols - 1)}${row + numRows - 1}`;
  return toRange(sheetName, `${start}:${end}`);
}

class SheetsClient {
  private api: sheets_v4.Sheets;
  private config: ServiceAccountConfig;
  private writeLocks = new Map<string, Promise<void>>();

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

  private async getSheetId(sheetName: string): Promise<number> {
    const cacheKey = `sheets:meta:id:${sheetName}`;
    const cached = cache.get<number>(cacheKey);
    if (cached !== null) return cached;

    const res = await this.api.spreadsheets.get({
      spreadsheetId: this.config.sheetId,
      fields: "sheets.properties.sheetId,sheets.properties.title"
    });
    const sheet = (res.data.sheets ?? []).find((s) => s.properties?.title === sheetName);
    const sheetId = sheet?.properties?.sheetId;
    if (typeof sheetId !== "number") {
      throw new Error(`Sheet not found: ${sheetName}`);
    }
    cache.set(cacheKey, sheetId, 600);
    return sheetId;
  }

  private async withWriteLock(sheetName: string, task: () => Promise<void>): Promise<void> {
    const previous = this.writeLocks.get(sheetName) ?? Promise.resolve();
    const next = previous.then(task, task);
    this.writeLocks.set(sheetName, next.catch(() => {}));
    await next;
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
    cache.delete(`sheets:meta:id:${sheetName}`);
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

  async updateRange(
    sheetName: string,
    row: number,
    col: number,
    values: unknown[][]
  ): Promise<void> {
    if (!values.length) return;
    const normalized = normalizeValues(values);
    const width = normalized.reduce((max, r) => Math.max(max, r.length), 0);
    if (width <= 0) return;
    const padded = normalized.map((r) => {
      const next = r.slice();
      while (next.length < width) next.push("");
      return next;
    });
    const range = buildA1Range(sheetName, row, col, padded.length, width);
    await this.api.spreadsheets.values.update({
      spreadsheetId: this.config.sheetId,
      range,
      valueInputOption: "RAW",
      requestBody: {
        majorDimension: "ROWS",
        values: padded
      }
    });
  }

  async appendRow(sheetName: string, row: unknown[]): Promise<void> {
    await this.api.spreadsheets.values.append({
      spreadsheetId: this.config.sheetId,
      range: toRange(sheetName, "A:ZZ"),
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        majorDimension: "ROWS",
        values: [normalizeValues([row])[0] ?? []]
      }
    });
  }

  async deleteRow(sheetName: string, rowIndex: number): Promise<void> {
    const sheetId = await this.getSheetId(sheetName);
    await this.api.spreadsheets.batchUpdate({
      spreadsheetId: this.config.sheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowIndex - 1,
                endIndex: rowIndex
              }
            }
          }
        ]
      }
    });
  }

  async applyOperations(sheetName: string, operations: SheetOperation[]): Promise<void> {
    if (!operations.length) return;
    await this.ensureSheetExists(sheetName);
    await this.withWriteLock(sheetName, async () => {
      for (const op of operations) {
        if (op.type === "update") {
          await this.updateRange(sheetName, op.row, op.col, op.values);
        } else if (op.type === "deleteRow") {
          await this.deleteRow(sheetName, op.rowIndex);
        }
      }
    });
  }
}

let singleton: SheetsClient | null = null;

export function getSheetsClient(): SheetsClient {
  singleton ??= new SheetsClient();
  return singleton;
}
