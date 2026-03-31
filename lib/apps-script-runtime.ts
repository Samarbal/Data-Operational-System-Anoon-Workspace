import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { cache } from "@/lib/cache";
import { getSheetsClient } from "@/lib/sheets";
import type { SheetOperation } from "@/lib/sheets";

type Scalar = string | number | boolean | Date | null | undefined;
type Row = Scalar[];
type Matrix = Row[];

function deepCloneMatrix(values: Matrix): Matrix {
  return values.map((row) => row.slice());
}

function isCellNonEmpty(value: Scalar): boolean {
  return !(value === "" || value === null || value === undefined);
}

class RangeEmulator {
  constructor(
    private readonly sheet: SheetEmulator,
    private readonly row: number,
    private readonly col: number,
    private readonly numRows: number,
    private readonly numCols: number
  ) {}

  getValues(): Matrix {
    const out: Matrix = [];
    for (let r = 0; r < this.numRows; r += 1) {
      const source = this.sheet.getRow(this.row + r);
      const target: Row = [];
      for (let c = 0; c < this.numCols; c += 1) {
        target.push(source[this.col + c - 1] ?? "");
      }
      out.push(target);
    }
    return out;
  }

  setValues(values: Matrix): this {
    const written: Matrix = [];
    for (let r = 0; r < this.numRows; r += 1) {
      const incoming = values[r] ?? [];
      const rowRef = this.sheet.ensureRow(this.row + r);
      const outRow: Row = [];
      for (let c = 0; c < this.numCols; c += 1) {
        const value = incoming[c] ?? "";
        rowRef[this.col + c - 1] = value;
        outRow.push(value);
      }
      written.push(outRow);
    }
    this.sheet.recordUpdate(this.row, this.col, written);
    return this;
  }

  setBackground(_color: string): this {
    return this;
  }

  setFontColor(_color: string): this {
    return this;
  }

  setFontWeight(_weight: string): this {
    return this;
  }
}

class SheetEmulator {
  private rows: Matrix;
  private dirty = false;
  private created = false;
  private operations: SheetOperation[] = [];

  constructor(
    private readonly name: string,
    initialRows: Matrix,
    created = false
  ) {
    this.rows = deepCloneMatrix(initialRows);
    this.created = created;
  }

  getName(): string {
    return this.name;
  }

  markDirty(): void {
    this.dirty = true;
  }

  clearDirty(): void {
    this.dirty = false;
  }

  isDirty(): boolean {
    return this.dirty || this.created;
  }

  isCreated(): boolean {
    return this.created;
  }

  clearCreatedFlag(): void {
    this.created = false;
  }

  getOperations(): SheetOperation[] {
    return this.operations.slice();
  }

  clearOperations(): void {
    this.operations = [];
  }

  recordUpdate(row: number, col: number, values: Matrix): void {
    this.operations.push({
      type: "update",
      row,
      col,
      values: values as (string | number | boolean)[][]
    });
    this.markDirty();
  }

  getLastRow(): number {
    for (let i = this.rows.length - 1; i >= 0; i -= 1) {
      if ((this.rows[i] ?? []).some((cell) => isCellNonEmpty(cell))) {
        return i + 1;
      }
    }
    return 0;
  }

  getLastColumn(): number {
    let max = 0;
    for (const row of this.rows) {
      for (let i = row.length - 1; i >= 0; i -= 1) {
        if (isCellNonEmpty(row[i])) {
          max = Math.max(max, i + 1);
          break;
        }
      }
    }
    return max;
  }

  getRange(row: number, col: number, numRows = 1, numCols = 1): RangeEmulator {
    return new RangeEmulator(this, row, col, numRows, numCols);
  }

  deleteRow(rowIndex: number): void {
    if (rowIndex < 1 || rowIndex > this.rows.length) return;
    this.rows.splice(rowIndex - 1, 1);
    this.operations.push({
      type: "deleteRow",
      rowIndex
    });
    this.markDirty();
  }

  getRow(rowIndex: number): Row {
    return this.rows[rowIndex - 1] ?? [];
  }

  ensureRow(rowIndex: number): Row {
    while (this.rows.length < rowIndex) {
      this.rows.push([]);
    }
    return this.rows[rowIndex - 1];
  }

  toWritableValues(): Matrix {
    const lastRow = this.getLastRow();
    if (lastRow <= 0) return [];
    const slice = this.rows.slice(0, lastRow).map((row) => row.slice());
    const maxCols = this.getLastColumn();
    return slice.map((row) => {
      const next = row.slice();
      while (next.length < maxCols) next.push("");
      return next;
    });
  }
}

class SpreadsheetEmulator {
  private readonly sheets = new Map<string, SheetEmulator>();

  constructor(initial: Record<string, Matrix>) {
    for (const [name, values] of Object.entries(initial)) {
      this.sheets.set(name, new SheetEmulator(name, values));
    }
  }

  getSheetByName(name: string): SheetEmulator | null {
    return this.sheets.get(name) ?? null;
  }

  insertSheet(name: string): SheetEmulator {
    const existing = this.sheets.get(name);
    if (existing) return existing;
    const created = new SheetEmulator(name, [], true);
    this.sheets.set(name, created);
    return created;
  }

  getAllSheets(): SheetEmulator[] {
    return Array.from(this.sheets.values());
  }
}

type ScriptCache = {
  get: (key: string) => string | null;
  put: (key: string, value: string, ttlSeconds: number) => void;
  remove: (key: string) => void;
};

function createScriptCache(): ScriptCache {
  return {
    get(key: string) {
      return cache.get<string>(`gas:${key}`);
    },
    put(key: string, value: string, ttlSeconds: number) {
      cache.set(`gas:${key}`, value, ttlSeconds);
    },
    remove(key: string) {
      cache.delete(`gas:${key}`);
    }
  };
}

const LEGACY_DIR = path.join(process.cwd(), "v3 - Operational data system");
const CODE_PATH = path.join(LEGACY_DIR, "Code.gs.txt");
const AUTH_PATH = path.join(LEGACY_DIR, "Auth_Code.gs.txt");

type CompiledLegacyScript = {
  compiled: vm.Script;
  codeMtimeMs: number;
  authMtimeMs: number;
};

let compiledLegacyScript: CompiledLegacyScript | null = null;

function getCompiledLegacyScript(): vm.Script {
  const codeStat = fs.statSync(CODE_PATH);
  const authStat = fs.statSync(AUTH_PATH);
  const codeMtimeMs = codeStat.mtimeMs;
  const authMtimeMs = authStat.mtimeMs;

  if (
    compiledLegacyScript &&
    compiledLegacyScript.codeMtimeMs === codeMtimeMs &&
    compiledLegacyScript.authMtimeMs === authMtimeMs
  ) {
    return compiledLegacyScript.compiled;
  }

  const source = `${fs.readFileSync(CODE_PATH, "utf8")}\n${fs.readFileSync(AUTH_PATH, "utf8")}`;
  const compiled = new vm.Script(source, { filename: "legacy-apps-script.gs" });
  compiledLegacyScript = { compiled, codeMtimeMs, authMtimeMs };
  return compiled;
}

const SNAPSHOT_TTL_SECONDS = 90;

const SHEETS = {
  VISITORS: "سجل الزوار",
  ROOMS: "حجز قاعات",
  ARCHIVE: "أرشيف الزبائن",
  TAMKEEN: "طلاب تمكين",
  SUBS: "اشتراكات",
  FUTURE: "حجوزات مسبقة",
  USERS: "المستخدمون"
} as const;

function snapshotKeyFor(requiredSheets?: string[]): string {
  if (requiredSheets === undefined) {
    return "sheets:snapshot:all";
  }
  if (requiredSheets.length === 0) {
    return "sheets:snapshot:none";
  }
  const normalized = requiredSheets.slice().sort().join("|");
  return `sheets:snapshot:${normalized}`;
}

async function loadSpreadsheet(readOnly: boolean, requiredSheets?: string[]): Promise<SpreadsheetEmulator> {
  const snapshotKey = snapshotKeyFor(requiredSheets);
  if (readOnly) {
    const cached = cache.get<Record<string, Matrix>>(snapshotKey);
    if (cached) {
      return new SpreadsheetEmulator(cached);
    }
  }

  const client = getSheetsClient();
  const allNames = await client.getSheetNames();
  const namesToLoad =
    requiredSheets === undefined
      ? allNames
      : requiredSheets.filter((name) => allNames.includes(name));

  const valuesBySheet = await client.batchGetSheetValues(namesToLoad);
  const normalized: Record<string, Matrix> = {};

  for (const [name, rows] of Object.entries(valuesBySheet)) {
    normalized[name] = rows.map((row) =>
      row.map((cell) => {
        if (
          typeof cell === "string" ||
          typeof cell === "number" ||
          typeof cell === "boolean" ||
          cell instanceof Date ||
          cell === null ||
          cell === undefined
        ) {
          return cell;
        }
        return String(cell);
      })
    );
  }

  if (readOnly) {
    cache.set(snapshotKey, normalized, SNAPSHOT_TTL_SECONDS);
  }

  return new SpreadsheetEmulator(normalized);
}

async function flushSpreadsheet(spreadsheet: SpreadsheetEmulator): Promise<void> {
  const client = getSheetsClient();
  const dirtySheets = spreadsheet.getAllSheets().filter((sheet) => sheet.isDirty());

  for (const sheet of dirtySheets) {
    await client.applyOperations(sheet.getName(), sheet.getOperations());
    sheet.clearOperations();
    sheet.clearDirty();
    sheet.clearCreatedFlag();
  }
}

async function runLegacy<T>(
  runner: (ctx: Record<string, unknown>) => T,
  readOnly = false,
  requiredSheets?: string[]
): Promise<T> {
  const spreadsheet = await loadSpreadsheet(readOnly, requiredSheets);
  const scriptCache = createScriptCache();

  const context = vm.createContext({
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet
    },
    CacheService: {
      getScriptCache: () => scriptCache
    },
    Logger: {
      log: (...args: unknown[]) => {
        if (process.env.NODE_ENV !== "production") {
          console.log("[AppsScript]", ...args);
        }
      }
    },
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: "ALLOWALL" },
      createTemplateFromFile: () => ({
        evaluate: () => ({
          getContent: () => "",
          setTitle: () => ({
            addMetaTag: () => ({
              setXFrameOptionsMode: () => null
            })
          })
        })
      }),
      createHtmlOutputFromFile: () => ({
        getContent: () => ""
      })
    }
  });

  getCompiledLegacyScript().runInContext(context);
  const result = runner(context as Record<string, unknown>);
  await flushSpreadsheet(spreadsheet);
  if (!readOnly) {
    cache.clearByPrefix("sheets:snapshot:");
  }
  return result;
}

function ensureFunction(ctx: Record<string, unknown>, name: string): (...args: unknown[]) => unknown {
  const fn = ctx[name];
  if (typeof fn !== "function") {
    throw new Error(`Legacy function not found: ${name}`);
  }
  return fn as (...args: unknown[]) => unknown;
}

export async function callProcessRequest(action: string, data: unknown): Promise<unknown> {
  const mutatingActions = new Set([
    "checkin",
    "checkout",
    "updateVisitor",
    "freezeTime",
    "unfreezeTime",
    "updatePayment",
    "addFutureBooking",
    "checkinFromFuture",
    "cancelFutureBooking",
    "updateFutureBooking",
    "addSub",
    "subCheckin",
    "subCheckout",
    "updateSub",
    "updateSubVisitorTimes",
    "addBooking",
    "updateRoom",
    "deleteRoom",
    "deleteBooking",
    "tamkeenCheckin",
    "tamkeenCheckout",
    "updateTamkeen",
    "updateTamkeenAttendance",
    "freezeTamkeenTime",
    "unfreezeTamkeenTime",
    "deleteVisitor",
    "addSnackToVisitor",
    "addSnackToSubscription",
    "addSnackToTamkeen",
    "payTamkeenSnack",
    "social_checkin",
    "social_addFuture",
    "social_addBooking"
  ]);

  const readOnly = !mutatingActions.has(action);
  const requiredSheets = getRequiredSheetsForProcessAction(action, readOnly);
  return runLegacy((ctx) => {
    const fn = ensureFunction(ctx, "processRequest");
    return fn(action, data ?? {});
  }, readOnly, requiredSheets);
}

export async function callSocialProcessRequest(action: string, data: unknown): Promise<unknown> {
  const prefixed = action.startsWith("social_") ? action : `social_${action}`;
  const readOnly = prefixed === "social_getHallBookings" || prefixed === "social_getDashboard";
  const requiredSheets = getRequiredSheetsForSocialAction(prefixed, readOnly);
  return runLegacy((ctx) => {
    const fn = ensureFunction(ctx, "processRequest");
    return fn(prefixed, data ?? {});
  }, readOnly, requiredSheets);
}

export async function callLegacyMethod(method: string, ...args: unknown[]): Promise<unknown> {
  const readOnly = method === "getAvailabilityData" || method === "getBootData" || method === "getSecondaryData";
  let requiredSheets: string[] | undefined;
  if (method === "getAvailabilityData") {
    requiredSheets = [SHEETS.VISITORS, SHEETS.ROOMS, SHEETS.SUBS];
  } else if (method === "getBootData") {
    requiredSheets = [SHEETS.VISITORS, SHEETS.SUBS, SHEETS.TAMKEEN, SHEETS.ROOMS];
  } else if (method === "getSecondaryData") {
    requiredSheets = [SHEETS.SUBS, SHEETS.TAMKEEN];
  }
  return runLegacy((ctx) => {
    const fn = ensureFunction(ctx, method);
    return fn(...args);
  }, readOnly, requiredSheets);
}

function getRequiredSheetsForProcessAction(action: string, readOnly: boolean): string[] | undefined {
  if (!readOnly) return undefined;

  const map: Record<string, string[]> = {
    getInitialData: [SHEETS.VISITORS, SHEETS.SUBS, SHEETS.TAMKEEN, SHEETS.ROOMS, SHEETS.FUTURE],
    getDashboard: [SHEETS.VISITORS, SHEETS.SUBS, SHEETS.TAMKEEN, SHEETS.ROOMS],
    getHallBookings: [SHEETS.ROOMS],
    getFutureHallBookings: [SHEETS.ROOMS],
    getVisitors: [SHEETS.VISITORS],
    getSubs: [SHEETS.SUBS],
    getTamkeen: [SHEETS.TAMKEEN],
    getFutureBookings: [SHEETS.FUTURE],
    getArchive: [SHEETS.ARCHIVE],
    getOptions: []
  };

  return map[action];
}

function getRequiredSheetsForSocialAction(action: string, readOnly: boolean): string[] | undefined {
  if (!readOnly) return undefined;
  if (action === "social_getHallBookings") return [SHEETS.ROOMS];
  if (action === "social_getDashboard") return [SHEETS.VISITORS, SHEETS.ROOMS, SHEETS.FUTURE];
  return undefined;
}
