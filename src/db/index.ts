import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { SCHEMA_SQL } from "./schema";
import { seedDatabase } from "./seed-data";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "aura.db");

declare global {
  // eslint-disable-next-line no-var
  var __auraDb: DatabaseSync | undefined;
  // eslint-disable-next-line no-var
  var __auraDbInitialized: boolean | undefined;
}

function createConnection(): DatabaseSync {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA_SQL);
  return db;
}

export function getDb(): DatabaseSync {
  if (!globalThis.__auraDb) {
    globalThis.__auraDb = createConnection();
  }
  if (!globalThis.__auraDbInitialized) {
    globalThis.__auraDbInitialized = true;
    const row = globalThis.__auraDb
      .prepare("SELECT COUNT(*) as c FROM genders")
      .get() as { c: number } | undefined;
    if (!row || row.c === 0) {
      seedDatabase(globalThis.__auraDb);
    }
  }
  return globalThis.__auraDb;
}

export function toPlain<T>(row: unknown): T {
  if (row === null || row === undefined) return row as T;
  if (Array.isArray(row)) {
    return row.map((item) => toPlain(item)) as unknown as T;
  }
  if (typeof row === "object") {
    return { ...(row as Record<string, unknown>) } as T;
  }
  return row as T;
}

export function queryAll<T = Record<string, unknown>>(
  sql: string,
  ...params: SQLInputValue[]
): T[] {
  const db = getDb();
  const rows = db.prepare(sql).all(...params);
  return rows.map((r) => ({ ...(r as Record<string, unknown>) }) as T);
}

export function queryOne<T = Record<string, unknown>>(
  sql: string,
  ...params: SQLInputValue[]
): T | null {
  const db = getDb();
  const row = db.prepare(sql).get(...params);
  if (!row) return null;
  return { ...(row as Record<string, unknown>) } as T;
}

export function execute(
  sql: string,
  ...params: SQLInputValue[]
): { lastInsertRowid: number; changes: number } {
  const db = getDb();
  const res = db.prepare(sql).run(...params);
  return {
    lastInsertRowid: Number(res.lastInsertRowid),
    changes: Number(res.changes),
  };
}

export function runTransaction<T>(fn: (db: DatabaseSync) => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
