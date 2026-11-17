#!/usr/bin/env node
/**
 * AURA Safe Local Migration Script: SQLite (data/aura.db) -> Supabase PostgreSQL
 *
 * Safety guarantees:
 * - Opens data/aura.db strictly in READ-ONLY mode ({ readOnly: true }).
 * - Never modifies, deletes, moves, or alters SQLite schema or data.
 * - Uses only DATABASE_URL from .env.local (or process.env); never prints secrets.
 * - Verifies all 23 AURA tables exist and are completely empty in Supabase before writing.
 * - Runs all inserts and identity sequence resets inside a single PostgreSQL transaction
 *   with automatic ROLLBACK on any failure (no partial writes).
 * - Preserves original IDs and foreign-key relationships in strict topological order.
 * - Does not run seed and does not upload/modify Storage files.
 * - Compatible with Windows, macOS, and Linux (Node.js 22+).
 *
 * Usage (from project root):
 *   node scripts/migrate-sqlite-to-supabase.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";

const { Pool } = pg;

const PROJECT_ROOT = process.cwd();
const SQLITE_PATH = path.join(PROJECT_ROOT, "data", "aura.db");
const ENV_LOCAL_PATH = path.join(PROJECT_ROOT, ".env.local");

/**
 * Exact 23 AURA tables ordered strictly by Foreign Key dependencies (parents before children).
 */
const AURA_TABLES = [
  { name: "roles", hasIdentityId: true, timestamps: ["created_at"] },
  {
    name: "users",
    hasIdentityId: true,
    timestamps: ["last_login_at", "created_at", "updated_at"],
  },
  {
    name: "admin_sessions",
    hasIdentityId: true,
    timestamps: ["expires_at", "created_at"],
  },
  { name: "genders", hasIdentityId: true, timestamps: ["created_at"] },
  {
    name: "categories",
    hasIdentityId: true,
    selfParentCol: "parent_id",
    timestamps: ["created_at", "updated_at"],
  },
  {
    name: "products",
    hasIdentityId: true,
    timestamps: ["created_at", "updated_at"],
  },
  { name: "product_images", hasIdentityId: true, timestamps: [] },
  { name: "product_variants", hasIdentityId: true, timestamps: [] },
  { name: "attributes", hasIdentityId: true, timestamps: ["created_at"] },
  { name: "attribute_values", hasIdentityId: true, timestamps: [] },
  { name: "product_attribute_values", hasIdentityId: false, timestamps: [] },
  { name: "collections", hasIdentityId: true, timestamps: [] },
  { name: "product_collections", hasIdentityId: false, timestamps: [] },
  { name: "promotions", hasIdentityId: true, timestamps: ["created_at"] },
  {
    name: "customers",
    hasIdentityId: true,
    timestamps: ["last_order_at", "created_at"],
  },
  {
    name: "orders",
    hasIdentityId: true,
    timestamps: ["created_at", "updated_at"],
  },
  { name: "order_items", hasIdentityId: true, timestamps: [] },
  { name: "wishlists", hasIdentityId: true, timestamps: ["created_at"] },
  {
    name: "carts",
    hasIdentityId: true,
    timestamps: ["created_at", "updated_at"],
  },
  { name: "cart_items", hasIdentityId: true, timestamps: ["created_at"] },
  {
    name: "homepage_sections",
    hasIdentityId: true,
    timestamps: ["updated_at"],
  },
  { name: "media", hasIdentityId: true, timestamps: ["created_at"] },
  { name: "store_settings", hasIdentityId: false, timestamps: ["updated_at"] },
];

/**
 * Loads DATABASE_URL from .env.local if not already present in process.env.
 * Never logs or exposes any secret value.
 */
function loadDatabaseUrl() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
    return process.env.DATABASE_URL.trim();
  }

  if (!fs.existsSync(ENV_LOCAL_PATH)) {
    return "";
  }

  const content = fs.readFileSync(ENV_LOCAL_PATH, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    if (key !== "DATABASE_URL") continue;

    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }
    return value;
  }

  return "";
}

/**
 * Strips any potential credentials, connection strings, tokens, or hostnames from error text.
 */
function redactSecrets(message, databaseUrl) {
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
      // Ignore URL parse errors during redaction
    }
  }
  safe = safe.replace(/postgres(?:ql)?:\/\/\S+/gi, "[REDACTED_URI]");
  safe = safe.replace(/sb_secret_\S+/gi, "[REDACTED_KEY]");
  safe = safe.replace(/password=\S+/gi, "password=[REDACTED]");
  return safe;
}

function shouldUseSsl(connectionString) {
  const lower = connectionString.toLowerCase();
  if (lower.includes("sslmode=disable")) return false;
  if (lower.includes("localhost") || lower.includes("127.0.0.1")) return false;
  return true;
}

function quoteIdent(ident) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(ident)) {
    throw new Error(`Invalid SQL identifier detected: ${ident}`);
  }
  return `"${ident}"`;
}

/**
 * Topologically orders rows of a self-referencing table (e.g. categories.parent_id -> categories.id)
 * so parent rows are always inserted before their children.
 */
function sortSelfReferencingRows(rows, parentCol) {
  const byId = new Map();
  for (const row of rows) {
    byId.set(Number(row.id), row);
  }

  const ordered = [];
  const inserted = new Set();
  const remaining = [...rows];

  let safetyPass = 0;
  while (remaining.length > 0 && safetyPass <= rows.length + 1) {
    safetyPass += 1;
    let progressed = false;

    for (let i = 0; i < remaining.length; ) {
      const row = remaining[i];
      const parentVal = row[parentCol];
      const hasParent =
        parentVal !== null &&
        parentVal !== undefined &&
        byId.has(Number(parentVal));

      if (!hasParent || inserted.has(Number(parentVal))) {
        ordered.push(row);
        inserted.add(Number(row.id));
        remaining.splice(i, 1);
        progressed = true;
      } else {
        i += 1;
      }
    }

    if (!progressed) {
      // Append any remaining rows (e.g. cyclical reference) to preserve data
      ordered.push(...remaining);
      break;
    }
  }

  return ordered;
}

/**
 * Normalizes a SQLite column value for PostgreSQL insertion without altering semantics.
 */
function normalizeValue(value, isTimestampCol) {
  if (value === undefined || value === null) return null;
  if (typeof value === "bigint") return Number(value);

  if (isTimestampCol) {
    const str = String(value).trim();
    if (str === "") return null;
    // Convert bare SQLite UTC timestamp "YYYY-MM-DD HH:MM:SS" -> ISO-8601 UTC
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(str)) {
      return `${str.replace(" ", "T")}Z`;
    }
    return str;
  }

  return value;
}

function printSummary({
  supabaseConnection,
  supabaseEmptyCheck,
  migration,
  tablesMigrated,
  rowCountVerification,
}) {
  console.log("");
  console.log("SOURCE SQLITE: PRESERVED");
  console.log(`SUPABASE CONNECTION: ${supabaseConnection}`);
  console.log(`SUPABASE EMPTY CHECK: ${supabaseEmptyCheck}`);
  console.log(`MIGRATION: ${migration}`);
  console.log(`TABLES MIGRATED: ${tablesMigrated}`);
  console.log(`ROW COUNT VERIFICATION: ${rowCountVerification}`);
  console.log("SQLITE: UNTOUCHED");
}

async function main() {
  const databaseUrl = loadDatabaseUrl();

  let sqliteDb = null;
  let pool = null;
  let pgClient = null;
  let inTransaction = false;

  let supabaseConnection = "FAIL";
  let supabaseEmptyCheck = "NOT RUN";
  let migrationStatus = "NOT RUN";
  let tablesMigrated = 0;
  let rowCountVerification = "FAIL";

  try {
    // ------------------------------------------------------------------
    // Pre-check 1: Verify data/aura.db exists
    // ------------------------------------------------------------------
    console.log("[1/5] Checking local SQLite source (data/aura.db)...");
    if (!fs.existsSync(SQLITE_PATH)) {
      throw new Error("Local SQLite database not found at data/aura.db.");
    }

    // ------------------------------------------------------------------
    // Pre-check 2: Verify DATABASE_URL exists
    // ------------------------------------------------------------------
    console.log("[2/5] Checking DATABASE_URL from environment / .env.local...");
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL is missing. Set DATABASE_URL in .env.local before running this script."
      );
    }

    // Open SQLite strictly READ-ONLY so data/aura.db can never be modified
    sqliteDb = new DatabaseSync(SQLITE_PATH, { readOnly: true });

    // Verify all 23 tables exist in SQLite
    const sqliteTableRows = sqliteDb
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
      )
      .all();
    const sqliteTableSet = new Set(sqliteTableRows.map((r) => String(r.name)));
    const missingInSqlite = AURA_TABLES.map((t) => t.name).filter(
      (name) => !sqliteTableSet.has(name)
    );
    if (missingInSqlite.length > 0) {
      throw new Error(
        `Missing tables in local SQLite source: ${missingInSqlite.join(", ")}`
      );
    }

    // ------------------------------------------------------------------
    // Pre-check 3: Test PostgreSQL connection
    // ------------------------------------------------------------------
    console.log("[3/5] Testing Supabase PostgreSQL connection...");
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
      max: 2,
      connectionTimeoutMillis: 15_000,
    });

    const connCheck = await pool.query(
      "SELECT current_database() AS db, current_schema() AS schema"
    );
    if (!connCheck.rows || connCheck.rows.length === 0) {
      throw new Error("PostgreSQL connection check returned no result.");
    }
    supabaseConnection = "PASS";
    console.log(
      `      Connected to database "${connCheck.rows[0].db}" (schema: "${connCheck.rows[0].schema}").`
    );

    // ------------------------------------------------------------------
    // Pre-check 4: Verify all 23 AURA tables exist in Supabase public schema
    // ------------------------------------------------------------------
    console.log("[4/5] Verifying all 23 AURA tables exist in Supabase...");
    const tableNames = AURA_TABLES.map((t) => t.name);
    const pgTablesRes = await pool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [tableNames]
    );
    const pgTableSet = new Set(pgTablesRes.rows.map((r) => String(r.table_name)));
    const missingInPg = tableNames.filter((name) => !pgTableSet.has(name));
    if (missingInPg.length > 0) {
      throw new Error(
        `Missing AURA tables in Supabase (${missingInPg.length}/23): ${missingInPg.join(", ")}. Run supabase/migrations/0001_initial_schema.sql first.`
      );
    }

    // Fetch PostgreSQL column lists for all 23 tables
    const pgColsRes = await pool.query(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])
       ORDER BY ordinal_position ASC`,
      [tableNames]
    );
    const pgColumnsByTable = new Map();
    for (const row of pgColsRes.rows) {
      const tbl = String(row.table_name);
      if (!pgColumnsByTable.has(tbl)) pgColumnsByTable.set(tbl, []);
      pgColumnsByTable.get(tbl).push(String(row.column_name));
    }

    // ------------------------------------------------------------------
    // Pre-check 5: Verify all 23 Supabase tables are completely EMPTY
    // ------------------------------------------------------------------
    console.log("[5/5] Verifying Supabase tables are empty before migration...");
    const nonEmptyTables = [];
    for (const tbl of AURA_TABLES) {
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS c FROM public.${quoteIdent(tbl.name)}`
      );
      const count = Number(countRes.rows[0]?.c ?? 0);
      if (count > 0) {
        nonEmptyTables.push(`${tbl.name} (${count} rows)`);
      }
    }

    if (nonEmptyTables.length > 0) {
      supabaseEmptyCheck = "FAIL";
      throw new Error(
        `Aborting before write: Supabase already contains data in ${nonEmptyTables.length} table(s): ${nonEmptyTables.join(", ")}. No rows were modified.`
      );
    }
    supabaseEmptyCheck = "PASS";
    console.log("      All 23 Supabase tables are empty. Starting transactional migration...");

    // ------------------------------------------------------------------
    // Transactional Migration (Single atomic transaction with rollback)
    // ------------------------------------------------------------------
    pgClient = await pool.connect();
    await pgClient.query("BEGIN");
    inTransaction = true;

    const sqliteCounts = new Map();

    for (const tbl of AURA_TABLES) {
      const rawRows = sqliteDb
        .prepare(`SELECT * FROM ${quoteIdent(tbl.name)}`)
        .all();
      const rows = tbl.selfParentCol
        ? sortSelfReferencingRows(rawRows, tbl.selfParentCol)
        : rawRows;

      sqliteCounts.set(tbl.name, rows.length);

      if (rows.length > 0) {
        const pgCols = pgColumnsByTable.get(tbl.name) || [];
        const sqliteRowCols = Object.keys(rows[0]);
        const targetCols = pgCols.filter((c) => sqliteRowCols.includes(c));

        if (targetCols.length === 0) {
          throw new Error(`No matching columns found for table "${tbl.name}".`);
        }

        const timestampSet = new Set(tbl.timestamps);
        const quotedCols = targetCols.map(quoteIdent).join(", ");
        const placeholders = targetCols.map((_, idx) => `$${idx + 1}`).join(", ");
        const insertSql = `INSERT INTO public.${quoteIdent(tbl.name)} (${quotedCols}) VALUES (${placeholders})`;

        for (const row of rows) {
          const values = targetCols.map((col) =>
            normalizeValue(row[col], timestampSet.has(col))
          );
          await pgClient.query(insertSql, values);
        }
      }

      // Reset PostgreSQL identity sequence safely to match MAX(id)
      if (tbl.hasIdentityId) {
        await pgClient.query(
          `SELECT setval(
             pg_get_serial_sequence($1, 'id'),
             COALESCE((SELECT MAX(id) FROM public.${quoteIdent(tbl.name)}), 1),
             (SELECT COUNT(*) > 0 FROM public.${quoteIdent(tbl.name)})
           )
           WHERE pg_get_serial_sequence($1, 'id') IS NOT NULL`,
          [`public.${tbl.name}`]
        );
      }

      tablesMigrated += 1;
      console.log(`      Migrated ${tbl.name}: ${rows.length} row(s)`);
    }

    await pgClient.query("COMMIT");
    inTransaction = false;
    pgClient.release();
    pgClient = null;
    migrationStatus = "COMPLETED";

    // ------------------------------------------------------------------
    // Post-Migration Read-Only Row Count Verification
    // ------------------------------------------------------------------
    console.log("Verifying row counts (SQLite vs Supabase PostgreSQL)...");
    const mismatches = [];

    for (const tbl of AURA_TABLES) {
      const expected = sqliteCounts.get(tbl.name) ?? 0;
      const pgRes = await pool.query(
        `SELECT COUNT(*)::int AS c FROM public.${quoteIdent(tbl.name)}`
      );
      const actual = Number(pgRes.rows[0]?.c ?? 0);
      if (expected !== actual) {
        mismatches.push(`${tbl.name}: sqlite=${expected}, supabase=${actual}`);
      }
    }

    if (mismatches.length === 0) {
      rowCountVerification = "PASS";
      console.log("      All 23 table row counts match 100%.");
    } else {
      rowCountVerification = "FAIL";
      console.error(`      Row count mismatches: ${mismatches.join("; ")}`);
    }

    printSummary({
      supabaseConnection,
      supabaseEmptyCheck,
      migration: migrationStatus,
      tablesMigrated,
      rowCountVerification,
    });

    if (rowCountVerification !== "PASS") {
      process.exitCode = 1;
    }
  } catch (err) {
    if (inTransaction && pgClient) {
      try {
        await pgClient.query("ROLLBACK");
        console.error("PostgreSQL transaction rolled back cleanly (no partial data written).");
      } catch (rbErr) {
        console.error(
          `Rollback warning: ${redactSecrets(rbErr?.message, databaseUrl)}`
        );
      }
    }

    const safeReason = redactSecrets(err?.message || err, databaseUrl);
    console.error(`Migration failed: ${safeReason}`);

    printSummary({
      supabaseConnection,
      supabaseEmptyCheck,
      migration: "NOT RUN",
      tablesMigrated: 0,
      rowCountVerification: "FAIL",
    });

    process.exitCode = 1;
  } finally {
    if (pgClient) {
      try {
        pgClient.release();
      } catch {
        // ignore
      }
    }
    if (pool) {
      await pool.end().catch(() => {});
    }
    if (sqliteDb) {
      try {
        sqliteDb.close();
      } catch {
        // ignore
      }
    }
  }
}

main();
