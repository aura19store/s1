#!/usr/bin/env tsx
/** Create only missing AURA admin accounts using environment variables. */
import { Pool, type PoolClient } from "pg";
import { loadEnvConfig } from "@next/env";
import { hashPassword } from "../src/lib/password";

const admins = [
  { name: "زيد العامري", email: "admin@aura.iq", role: "super_admin" },
  { name: "نور السامرائي", email: "manager@aura.iq", role: "manager" },
  { name: "سارة العبيدي", email: "content@aura.iq", role: "content_manager" },
  { name: "مصطفى الكاظمي", email: "orders@aura.iq", role: "order_manager" },
] as const;

async function main(): Promise<void> {
  loadEnvConfig(process.cwd(), false, {
    error: () => console.error("Could not load environment configuration."),
    info: () => {},
  });
  const connectionString = process.env.DATABASE_URL?.trim();
  const password = process.env.ADMIN_SEED_PASSWORD?.trim();
  if (!connectionString || !password) {
    console.error("DATABASE_URL and ADMIN_SEED_PASSWORD must both be set in the environment.");
    process.exitCode = 1;
    return;
  }

  let pool: Pool | undefined;
  let client: PoolClient | undefined;
  let transactionStarted = false;
  try {
    pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 15000 });
    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    const roles = await client.query<{ id: number; slug: string }>(
      "SELECT id, slug FROM public.roles WHERE slug = ANY($1::text[])",
      [admins.map((admin) => admin.role)]
    );
    const roleIds = new Map(roles.rows.map((role) => [role.slug, role.id]));
    if (admins.some((admin) => !roleIds.has(admin.role))) {
      throw new Error("Required admin roles are missing.");
    }

    let created = 0;
    let skipped = 0;
    for (const admin of admins) {
      const passwordHash = hashPassword(password);
      const result = await client.query(
        `INSERT INTO public.users (name, email, password_hash, role_id, is_active)
         VALUES ($1, $2, $3, $4, 1)
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [admin.name, admin.email, passwordHash, roleIds.get(admin.role)]
      );
      if (result.rowCount === 1) {
        created++;
      } else {
        skipped++;
      }
    }

    await client.query("COMMIT");
    transactionStarted = false;
    console.log(`Admin accounts created: ${created}; existing accounts skipped: ${skipped}.`);
  } catch {
    if (transactionStarted && client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        console.error("Rollback failed; verify the database state before retrying.");
      }
    }
    // Driver errors can contain connection details or query parameters; never print them.
    console.error("Admin account operation failed. Verify database access and required roles.");
    process.exitCode = 1;
  } finally {
    client?.release();
    if (pool) await pool.end().catch(() => {});
  }
}

void main();
