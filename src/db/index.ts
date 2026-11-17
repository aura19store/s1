import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { Pool, type PoolClient } from "pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SCHEMA_SQL } from "./schema";
import { seedDatabase } from "./seed-data";

export type DbParam = string | number | bigint | Uint8Array | null | undefined;
export type DatabaseDriver = "postgres" | "sqlite";

export interface ExecuteResult {
  lastInsertRowid: number;
  changes: number;
}

export interface DbClient {
  queryAll<T = Record<string, unknown>>(
    sql: string,
    ...params: DbParam[]
  ): Promise<T[]>;
  queryOne<T = Record<string, unknown>>(
    sql: string,
    ...params: DbParam[]
  ): Promise<T | null>;
  execute(sql: string, ...params: DbParam[]): Promise<ExecuteResult>;
}

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "aura.db");

// Tables in the AURA schema that use composite keys instead of an `id` column
const TABLES_WITHOUT_ID = new Set([
  "product_attribute_values",
  "product_collections",
]);

declare global {
  // eslint-disable-next-line no-var
  var __auraDb: DatabaseSync | undefined;
  // eslint-disable-next-line no-var
  var __auraDbInitPromise: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var __auraPgPool: Pool | undefined;
}

function getWorkerConnectionString(): string | null {
  let env: { HYPERDRIVE?: { connectionString?: string } } | undefined;
  try {
    env = getCloudflareContext().env as typeof env;
  } catch {
    // Ordinary Next.js development and Node.js scripts have no Worker context.
    return null;
  }
  const connectionString = env?.HYPERDRIVE?.connectionString;
  if (!connectionString) {
    throw new Error("Cloudflare HYPERDRIVE binding is missing or invalid.");
  }
  return connectionString;
}

export function getPostgresConnectionString(): string {
  return getWorkerConnectionString() ?? (process.env.DATABASE_URL?.trim() || "");
}

export function isPostgresEnabled(): boolean {
  return Boolean(getPostgresConnectionString());
}

export function getDatabaseDriver(): DatabaseDriver {
  return isPostgresEnabled() ? "postgres" : "sqlite";
}

function shouldUsePostgresSsl(connectionString: string): boolean {
  const lower = connectionString.toLowerCase();
  if (lower.includes("sslmode=disable")) return false;
  if (lower.includes("localhost") || lower.includes("127.0.0.1")) return false;
  return true;
}

function getPgPool(): Pool {
  const workerConnectionString = getWorkerConnectionString();
  if (workerConnectionString) {
    // Worker I/O objects must not be shared across requests. Hyperdrive handles pooling.
    return new Pool({ connectionString: workerConnectionString, max: 1 });
  }
  if (!globalThis.__auraPgPool) {
    const connectionString = getPostgresConnectionString();
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured for PostgreSQL.");
    }
    globalThis.__auraPgPool = new Pool({
      connectionString,
      ssl: shouldUsePostgresSsl(connectionString)
        ? { rejectUnauthorized: false }
        : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalThis.__auraPgPool;
}

function createSqliteConnection(): DatabaseSync {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  const req = createRequire(import.meta.url);
  const sqliteModule = req("node:sqlite") as typeof import("node:sqlite");
  const db = new sqliteModule.DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA_SQL);
  return db;
}

function createSqliteClient(db: DatabaseSync): DbClient {
  return {
    async queryAll<T = Record<string, unknown>>(
      sql: string,
      ...params: DbParam[]
    ): Promise<T[]> {
      const normalized = params.map((p) => (p === undefined ? null : p)) as SQLInputValue[];
      const rows = db.prepare(sql).all(...normalized);
      return rows.map((r) => ({ ...(r as Record<string, unknown>) }) as T);
    },
    async queryOne<T = Record<string, unknown>>(
      sql: string,
      ...params: DbParam[]
    ): Promise<T | null> {
      const normalized = params.map((p) => (p === undefined ? null : p)) as SQLInputValue[];
      const row = db.prepare(sql).get(...normalized);
      if (!row) return null;
      return { ...(row as Record<string, unknown>) } as T;
    },
    async execute(sql: string, ...params: DbParam[]): Promise<ExecuteResult> {
      const normalized = params.map((p) => (p === undefined ? null : p)) as SQLInputValue[];
      const res = db.prepare(sql).run(...normalized);
      return {
        lastInsertRowid: Number(res.lastInsertRowid ?? 0),
        changes: Number(res.changes ?? 0),
      };
    },
  };
}

async function getSqliteDb(): Promise<DatabaseSync> {
  if (!globalThis.__auraDb) {
    globalThis.__auraDb = createSqliteConnection();
  }
  if (!globalThis.__auraDbInitPromise) {
    const db = globalThis.__auraDb;
    globalThis.__auraDbInitPromise = (async () => {
      const row = db
        .prepare("SELECT COUNT(*) as c FROM genders")
        .get() as { c: number } | undefined;
      if (!row || Number(row.c) === 0) {
        db.exec("BEGIN IMMEDIATE");
        try {
          await seedDatabase(createSqliteClient(db));
          db.exec("COMMIT");
        } catch (err) {
          db.exec("ROLLBACK");
          throw err;
        }
      }
    })();
  }
  await globalThis.__auraDbInitPromise;
  return globalThis.__auraDb;
}

/**
 * Translates portable SQLite-flavored SQL queries into valid PostgreSQL SQL:
 * - Converts positional `?` placeholders outside single-quoted literals to `$1, $2, ...`
 * - Converts `datetime('now')` -> `CURRENT_TIMESTAMP`
 * - Converts `datetime(col)` -> `col`
 * - Converts `INSERT OR IGNORE INTO` -> `INSERT INTO ... ON CONFLICT DO NOTHING`
 * - Converts `MAX(0, ...)` -> `GREATEST(0, ...)`
 * - Converts `substr(col, 1, 10)` -> `LEFT(CAST(col AS TEXT), 10)`
 * - Converts `LIKE` -> `ILIKE` for case-insensitive search parity
 * - Optionally appends `RETURNING id` on INSERTs into tables with an `id` PK
 */
export function translateSqlForPostgres(
  sql: string,
  options?: { appendReturningId?: boolean }
): string {
  let out = sql;

  // 1. Replace datetime('now') and datetime(col)
  out = out.replace(/datetime\(\s*'now'\s*\)/gi, "CURRENT_TIMESTAMP");
  out = out.replace(/datetime\(\s*([a-zA-Z0-9_.]+)\s*\)/gi, "$1");

  // 2. Replace scalar MAX(0, ...) with PostgreSQL GREATEST(0, ...)
  out = out.replace(/\bMAX\(\s*0\s*,/gi, "GREATEST(0,");

  // 3. Replace substr(expr, 1, 10) with LEFT(CAST(expr AS TEXT), 10)
  out = out.replace(
    /\bsubstr\(\s*([a-zA-Z0-9_.]+)\s*,\s*1\s*,\s*10\s*\)/gi,
    "LEFT(CAST($1 AS TEXT), 10)"
  );

  // 4. Case-insensitive LIKE parity
  out = out.replace(/\bLIKE\b/g, "ILIKE");

  // 5. Handle INSERT OR IGNORE INTO -> INSERT INTO ... ON CONFLICT DO NOTHING
  let hadInsertOrIgnore = false;
  if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(out)) {
    hadInsertOrIgnore = true;
    out = out.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i, "INSERT INTO");
  }

  // 6. Replace positional `?` placeholders outside single-quoted strings
  let paramIdx = 0;
  let inSingleQuote = false;
  let translated = "";
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (ch === "'") {
      translated += ch;
      if (inSingleQuote && out[i + 1] === "'") {
        translated += out[i + 1];
        i++;
      } else {
        inSingleQuote = !inSingleQuote;
      }
    } else if (ch === "?" && !inSingleQuote) {
      paramIdx += 1;
      translated += `$${paramIdx}`;
    } else {
      translated += ch;
    }
  }
  out = translated.trim().replace(/;+\s*$/, "");

  if (hadInsertOrIgnore && !/\bON\s+CONFLICT\b/i.test(out)) {
    out = `${out} ON CONFLICT DO NOTHING`;
  }

  if (options?.appendReturningId) {
    const insertMatch = out.match(/^\s*INSERT\s+INTO\s+([a-zA-Z0-9_]+)/i);
    if (
      insertMatch &&
      !TABLES_WITHOUT_ID.has(insertMatch[1].toLowerCase()) &&
      !/\bRETURNING\b/i.test(out)
    ) {
      out = `${out} RETURNING id`;
    }
  }

  return out;
}

function normalizePgRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    out[key] = val instanceof Date ? val.toISOString() : val;
  }
  return out as T;
}

function createPgClientAdapter(runner: Pool | PoolClient): DbClient {
  return {
    async queryAll<T = Record<string, unknown>>(
      sql: string,
      ...params: DbParam[]
    ): Promise<T[]> {
      const pgSql = translateSqlForPostgres(sql);
      const normalized = params.map((p) => (p === undefined ? null : p));
      const res = await runner.query(pgSql, normalized);
      return res.rows.map((r) => normalizePgRow<T>(r as Record<string, unknown>));
    },
    async queryOne<T = Record<string, unknown>>(
      sql: string,
      ...params: DbParam[]
    ): Promise<T | null> {
      const pgSql = translateSqlForPostgres(sql);
      const normalized = params.map((p) => (p === undefined ? null : p));
      const res = await runner.query(pgSql, normalized);
      if (!res.rows[0]) return null;
      return normalizePgRow<T>(res.rows[0] as Record<string, unknown>);
    },
    async execute(sql: string, ...params: DbParam[]): Promise<ExecuteResult> {
      const pgSql = translateSqlForPostgres(sql, { appendReturningId: true });
      const normalized = params.map((p) => (p === undefined ? null : p));
      const res = await runner.query(pgSql, normalized);
      const insertedId =
        res.rows && res.rows[0] && "id" in res.rows[0]
          ? Number((res.rows[0] as { id: unknown }).id)
          : 0;
      return {
        lastInsertRowid: insertedId,
        changes: Number(res.rowCount ?? 0),
      };
    },
  };
}

async function withPgPool<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const isWorker = getWorkerConnectionString() !== null;
  const pool = getPgPool();
  try {
    return await fn(pool);
  } finally {
    if (isWorker) await pool.end();
  }
}

export async function queryAll<T = Record<string, unknown>>(
  sql: string,
  ...params: DbParam[]
): Promise<T[]> {
  if (isPostgresEnabled()) {
    return withPgPool((pool) => createPgClientAdapter(pool).queryAll<T>(sql, ...params));
  }
  const db = await getSqliteDb();
  return createSqliteClient(db).queryAll<T>(sql, ...params);
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  ...params: DbParam[]
): Promise<T | null> {
  if (isPostgresEnabled()) {
    return withPgPool((pool) => createPgClientAdapter(pool).queryOne<T>(sql, ...params));
  }
  const db = await getSqliteDb();
  return createSqliteClient(db).queryOne<T>(sql, ...params);
}

export async function execute(
  sql: string,
  ...params: DbParam[]
): Promise<ExecuteResult> {
  if (isPostgresEnabled()) {
    return withPgPool((pool) => createPgClientAdapter(pool).execute(sql, ...params));
  }
  const db = await getSqliteDb();
  return createSqliteClient(db).execute(sql, ...params);
}

export async function runTransaction<T>(
  fn: (tx: DbClient) => Promise<T>
): Promise<T> {
  if (isPostgresEnabled()) {
    return withPgPool(async (pool) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(createPgClientAdapter(client));
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    });
  }

  const db = await getSqliteDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = await fn(createSqliteClient(db));
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export async function getDbClientForSeeding(): Promise<DbClient> {
  if (isPostgresEnabled()) {
    if (getWorkerConnectionString()) {
      return {
        queryAll: (sql, ...params) => withPgPool((pool) => createPgClientAdapter(pool).queryAll(sql, ...params)),
        queryOne: (sql, ...params) => withPgPool((pool) => createPgClientAdapter(pool).queryOne(sql, ...params)),
        execute: (sql, ...params) => withPgPool((pool) => createPgClientAdapter(pool).execute(sql, ...params)),
      };
    }
    return createPgClientAdapter(getPgPool());
  }
  if (!globalThis.__auraDb) {
    globalThis.__auraDb = createSqliteConnection();
  }
  return createSqliteClient(globalThis.__auraDb);
}

export async function closeDbPool(): Promise<void> {
  if (globalThis.__auraPgPool) {
    await globalThis.__auraPgPool.end();
    globalThis.__auraPgPool = undefined;
  }
}
