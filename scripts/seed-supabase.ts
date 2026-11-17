#!/usr/bin/env tsx
/**
 * AURA Safe PostgreSQL Seed Script (Supabase)
 *
 * Seeds Supabase PostgreSQL directly from the project's canonical data definitions
 * (`src/db/seed-data.ts`) without requiring local SQLite (`data/aura.db`).
 *
 * Safety guarantees:
 * - Connects strictly to PostgreSQL via `DATABASE_URL` (env or `.env.local`); never touches SQLite.
 * - Contains zero hardcoded secrets or passwords; never logs credentials, URLs, or tokens.
 * - Verifies all 23 AURA tables exist in Supabase `public` schema before writing.
 * - Verifies all 23 Supabase tables are completely EMPTY before writing; aborts safely otherwise.
 * - Runs all inserts, explicit ID preservation (`store_settings.id = 1`), and identity sequence
 *   resets inside a single atomic PostgreSQL transaction with automatic ROLLBACK on any error.
 * - Verifies post-insert row counts across all 23 tables against exact project expectations.
 * - Uses only existing project image paths/URLs (`/images/...`); never stores binary images in DB.
 * - Does not invent fake data outside `src/db/seed-data.ts`.
 *
 * Usage (from project root, when ready to run manually):
 *   npx tsx scripts/seed-supabase.ts
 */

import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import {
  translateSqlForPostgres,
  type DbClient,
  type DbParam,
  type ExecuteResult,
} from "../src/db/index";
import { seedDatabase } from "../src/db/seed-data";

const PROJECT_ROOT = process.cwd();
const ENV_LOCAL_PATH = path.join(PROJECT_ROOT, ".env.local");

interface AuraTableSpec {
  name: string;
  hasIdentityId: boolean;
  expectedRows: (hasAdminPassword: boolean) => number;
}

/**
 * All 23 AURA tables in strict Foreign Key topological order (parents before children),
 * together with their exact expected row counts from `src/db/seed-data.ts`.
 */
const AURA_TABLES: readonly AuraTableSpec[] = [
  { name: "roles", hasIdentityId: true, expectedRows: () => 4 },
  {
    name: "users",
    hasIdentityId: true,
    expectedRows: (hasAdminPw) => (hasAdminPw ? 4 : 0),
  },
  { name: "admin_sessions", hasIdentityId: true, expectedRows: () => 0 },
  { name: "genders", hasIdentityId: true, expectedRows: () => 2 },
  { name: "categories", hasIdentityId: true, expectedRows: () => 12 },
  { name: "products", hasIdentityId: true, expectedRows: () => 24 },
  { name: "product_images", hasIdentityId: true, expectedRows: () => 48 },
  { name: "product_variants", hasIdentityId: true, expectedRows: () => 0 },
  { name: "attributes", hasIdentityId: true, expectedRows: () => 3 },
  { name: "attribute_values", hasIdentityId: true, expectedRows: () => 15 },
  {
    name: "product_attribute_values",
    hasIdentityId: false,
    expectedRows: () => 93,
  },
  { name: "collections", hasIdentityId: true, expectedRows: () => 3 },
  {
    name: "product_collections",
    hasIdentityId: false,
    expectedRows: () => 0,
  },
  { name: "promotions", hasIdentityId: true, expectedRows: () => 2 },
  { name: "customers", hasIdentityId: true, expectedRows: () => 6 },
  { name: "orders", hasIdentityId: true, expectedRows: () => 6 },
  { name: "order_items", hasIdentityId: true, expectedRows: () => 10 },
  { name: "wishlists", hasIdentityId: true, expectedRows: () => 0 },
  { name: "carts", hasIdentityId: true, expectedRows: () => 0 },
  { name: "cart_items", hasIdentityId: true, expectedRows: () => 0 },
  { name: "homepage_sections", hasIdentityId: true, expectedRows: () => 14 },
  { name: "media", hasIdentityId: true, expectedRows: () => 21 },
  { name: "store_settings", hasIdentityId: false, expectedRows: () => 1 },
];

/**
 * Safely loads unset environment variables (`DATABASE_URL`, `ADMIN_SEED_PASSWORD`)
 * from `.env.local` if present. Never logs or prints any values.
 */
function loadEnvLocalSafely(): void {
  if (!fs.existsSync(ENV_LOCAL_PATH)) return;

  const allowedKeys = new Set(["DATABASE_URL", "ADMIN_SEED_PASSWORD"]);
  const content = fs.readFileSync(ENV_LOCAL_PATH, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    if (!allowedKeys.has(key)) continue;
    if (process.env[key] && process.env[key]!.trim().length > 0) continue;

    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }
    if (value.length > 0) {
      process.env[key] = value;
    }
  }
}

function redactSecrets(message: unknown, databaseUrl: string): string {
  let safe = String(message || "Unknown error");
  if (databaseUrl) {
    safe = safe.split(databaseUrl).join("[REDACTED]");
    try {
      const parsed = new URL(databaseUrl);
      if (parsed.password) {
        safe = safe.split(parsed.password).join("[REDACTED]");
        safe = safe.split(decodeURIComponent(parsed.password)).join("[REDACTED]");
      }
      if (parsed.username) {
        safe = safe.split(parsed.username).join("[REDACTED]");
      }
      if (parsed.hostname) {
        safe = safe.split(parsed.hostname).join("[DB_HOST]");
      }
    } catch {
      // Ignore URL parsing issues while redacting
    }
  }

  const adminSeedPw = process.env.ADMIN_SEED_PASSWORD?.trim();
  if (adminSeedPw) {
    safe = safe.split(adminSeedPw).join("[REDACTED]");
  }

  safe = safe.replace(/postgres(?:ql)?:\/\/\S+/gi, "[REDACTED_URI]");
  safe = safe.replace(/sb_secret_\S+/gi, "[REDACTED_KEY]");
  safe = safe.replace(/password=\S+/gi, "password=[REDACTED]");
  return safe;
}

function shouldUseSsl(connectionString: string): boolean {
  const lower = connectionString.toLowerCase();
  if (lower.includes("sslmode=disable")) return false;
  if (lower.includes("localhost") || lower.includes("127.0.0.1")) return false;
  return true;
}

function quoteIdent(ident: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(ident)) {
    throw new Error(`Invalid SQL identifier: ${ident}`);
  }
  return `"${ident}"`;
}

function normalizeParam(param: DbParam): string | number | bigint | Uint8Array | null {
  if (param === undefined || param === null) return null;
  if (typeof param === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(param)) {
    return `${param.replace(" ", "T")}Z`;
  }
  return param;
}

function normalizeRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out as T;
}

/**
 * Wraps a transactional `pg.PoolClient` in AURA's `DbClient` interface so
 * `seedDatabase(tx)` executes natively inside a single PostgreSQL transaction.
 */
function createTxDbClient(client: PoolClient): DbClient {
  return {
    async queryAll<T = Record<string, unknown>>(
      sql: string,
      ...params: DbParam[]
    ): Promise<T[]> {
      const pgSql = translateSqlForPostgres(sql);
      const res = await client.query(pgSql, params.map(normalizeParam));
      return res.rows.map((r) => normalizeRow<T>(r as Record<string, unknown>));
    },
    async queryOne<T = Record<string, unknown>>(
      sql: string,
      ...params: DbParam[]
    ): Promise<T | null> {
      const pgSql = translateSqlForPostgres(sql);
      const res = await client.query(pgSql, params.map(normalizeParam));
      if (!res.rows[0]) return null;
      return normalizeRow<T>(res.rows[0] as Record<string, unknown>);
    },
    async execute(sql: string, ...params: DbParam[]): Promise<ExecuteResult> {
      const pgSql = translateSqlForPostgres(sql, { appendReturningId: true });
      const res = await client.query(pgSql, params.map(normalizeParam));
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

async function resetIdentitySequences(
  client: PoolClient,
  mode: "start_at_one" | "sync_to_max"
): Promise<void> {
  for (const tbl of AURA_TABLES) {
    if (!tbl.hasIdentityId) continue;

    if (mode === "start_at_one") {
      await client.query(
        `SELECT setval(pg_get_serial_sequence($1, 'id'), 1, false)
         WHERE pg_get_serial_sequence($1, 'id') IS NOT NULL`,
        [`public.${tbl.name}`]
      );
    } else {
      await client.query(
        `SELECT setval(
           pg_get_serial_sequence($1, 'id'),
           COALESCE((SELECT MAX(id) FROM public.${quoteIdent(tbl.name)}), 1),
           (SELECT COUNT(*) > 0 FROM public.${quoteIdent(tbl.name)})
         )
         WHERE pg_get_serial_sequence($1, 'id') IS NOT NULL`,
        [`public.${tbl.name}`]
      );
    }
  }
}

async function main(): Promise<void> {
  loadEnvLocalSafely();

  const databaseUrl = process.env.DATABASE_URL?.trim() || "";
  const hasAdminSeedPassword = Boolean(process.env.ADMIN_SEED_PASSWORD?.trim());

  let pool: Pool | null = null;
  let client: PoolClient | null = null;
  let inTransaction = false;

  try {
    // 1. Validate DATABASE_URL presence
    console.log("[1/5] Checking DATABASE_URL from environment...");
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL is not set. Configure DATABASE_URL in your environment or .env.local."
      );
    }
    console.log(
      `      ADMIN_SEED_PASSWORD: ${hasAdminSeedPassword ? "SET (4 admin users will be seeded)" : "UNSET (admin users will be skipped safely)"}`
    );

    // 2. Connect to Supabase PostgreSQL
    console.log("[2/5] Connecting to Supabase PostgreSQL...");
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
      max: 2,
      connectionTimeoutMillis: 15_000,
    });

    const connInfo = await pool.query<{ db: string; schema: string }>(
      "SELECT current_database() AS db, current_schema() AS schema"
    );
    if (!connInfo.rows[0]) {
      throw new Error("PostgreSQL connection check returned no result.");
    }
    console.log(
      `      Connected to database "${connInfo.rows[0].db}" (schema: "${connInfo.rows[0].schema}").`
    );

    // 3. Verify all 23 AURA tables exist
    console.log("[3/5] Verifying all 23 AURA tables exist in Supabase...");
    const tableNames = AURA_TABLES.map((t) => t.name);
    const existingRes = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [tableNames]
    );
    const existingSet = new Set(existingRes.rows.map((r) => r.table_name));
    const missingTables = tableNames.filter((name) => !existingSet.has(name));
    if (missingTables.length > 0) {
      throw new Error(
        `Missing AURA tables in Supabase (${missingTables.length}/23): ${missingTables.join(", ")}. Run supabase/migrations/0001_initial_schema.sql first.`
      );
    }

    // 4. Verify all 23 Supabase tables are completely EMPTY (never overwrite/delete)
    console.log("[4/5] Verifying all 23 Supabase tables are empty...");
    const nonEmpty: string[] = [];
    for (const tbl of AURA_TABLES) {
      const countRes = await pool.query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM public.${quoteIdent(tbl.name)}`
      );
      const count = Number(countRes.rows[0]?.c ?? 0);
      if (count > 0) {
        nonEmpty.push(`${tbl.name} (${count} rows)`);
      }
    }
    if (nonEmpty.length > 0) {
      throw new Error(
        `Aborting before write: Supabase is not empty (${nonEmpty.join(", ")}). Existing data was left untouched.`
      );
    }

    // 5. Seed inside a single atomic PostgreSQL transaction
    console.log("[5/5] Seeding AURA data inside a single PostgreSQL transaction...");
    client = await pool.connect();
    await client.query("BEGIN");
    inTransaction = true;

    // Ensure deterministic starting IDs (1..N) on empty tables before seeding
    await resetIdentitySequences(client, "start_at_one");

    // Seed canonical AURA data using the project's single source of truth
    await seedDatabase(createTxDbClient(client));

    // Synchronize all PostgreSQL identity sequences to MAX(id) after seeding
    await resetIdentitySequences(client, "sync_to_max");

    // Verify expected row counts before committing so any mismatch rolls back cleanly
    const mismatches: string[] = [];
    const verifiedCounts: Record<string, number> = {};
    for (const tbl of AURA_TABLES) {
      const res = await client.query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM public.${quoteIdent(tbl.name)}`
      );
      const actual = Number(res.rows[0]?.c ?? 0);
      const expected = tbl.expectedRows(hasAdminSeedPassword);
      verifiedCounts[tbl.name] = actual;
      if (actual !== expected) {
        mismatches.push(`${tbl.name}: expected=${expected}, actual=${actual}`);
      }
    }

    if (mismatches.length > 0) {
      throw new Error(
        `Row count verification failed before commit: ${mismatches.join("; ")}`
      );
    }

    await client.query("COMMIT");
    inTransaction = false;
    client.release();
    client = null;

    // Final post-commit read-only verification summary
    console.log("");
    console.log("SUPABASE SEED: COMPLETED");
    console.log("TABLES VERIFIED: 23/23");
    console.log("SEQUENCES SYNCED: PASS");
    console.log("ROW COUNTS:", verifiedCounts);
  } catch (err) {
    if (inTransaction && client) {
      try {
        await client.query("ROLLBACK");
        console.error(
          "PostgreSQL transaction rolled back cleanly (no partial data written)."
        );
      } catch (rbErr) {
        console.error(
          `Rollback warning: ${redactSecrets(rbErr instanceof Error ? rbErr.message : rbErr, databaseUrl)}`
        );
      }
    }

    const safeMessage = redactSecrets(
      err instanceof Error ? err.message : err,
      databaseUrl
    );
    console.error(`Supabase seed aborted: ${safeMessage}`);
    process.exitCode = 1;
  } finally {
    if (client) {
      try {
        client.release();
      } catch {
        // ignore
      }
    }
    if (pool) {
      await pool.end().catch(() => {});
    }
  }
}

main();
