import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Pool } from "pg";
import { NextResponse } from "next/server";

// Temporary diagnostic: disabled unless explicitly enabled in the local Worker.
export async function GET() {
  let pool: Pool | undefined;
  try {
    const env = getCloudflareContext().env as { HYPERDRIVE?: { connectionString?: string }; DIAGNOSTICS_DB_ENABLED?: string };
    if (env.DIAGNOSTICS_DB_ENABLED !== "1") return new NextResponse(null, { status: 404 });
    if (!env.HYPERDRIVE?.connectionString) throw new Error("Hyperdrive unavailable");
    pool = new Pool({ connectionString: env.HYPERDRIVE.connectionString, max: 1 });
    const result = await pool.query("SELECT current_user, session_user, current_database()");
    const row = result.rows[0];
    if (!row) throw new Error("Empty diagnostic result");
    await pool.end();
    pool = undefined;
    return NextResponse.json(
      { current_user: row.current_user, session_user: row.session_user, current_database: row.current_database },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    if (pool) await pool.end().catch(() => {});
    return NextResponse.json({ error: "Database connection unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
