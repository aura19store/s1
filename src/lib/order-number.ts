import type { DatabaseDriver, DbClient } from "@/db";

/** Called inside the order transaction; PostgreSQL uses an identity sequence and
 * SQLite requires BEGIN IMMEDIATE. The insert must use ON CONFLICT(order_number)
 * DO NOTHING and return its affected row count. */
export async function insertOrderWithUniqueNumber(
  tx: DbClient,
  driver: DatabaseDriver,
  insert: (id: number, number: string) => Promise<number>
): Promise<{ orderId: number; orderNumber: string }> {
  const identity = await tx.queryOne<{ id: number }>(driver === "postgres"
    ? `SELECT nextval(pg_get_serial_sequence('orders', 'id')) AS id`
    : `SELECT MAX(COALESCE((SELECT MAX(id) FROM orders), 0), COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'orders'), 0)) + 1 AS id`);
  const orderId = Number(identity?.id);
  if (!Number.isSafeInteger(orderId) || orderId < 1) throw new Error("ORDER_ID_ALLOCATION_FAILED");
  for (let offset = 0; offset < 100000; offset++) {
    const orderNumber = `AURA-2026-${1000 + orderId + offset}`;
    if (await insert(orderId, orderNumber) === 1) return { orderId, orderNumber };
  }
  throw new Error("ORDER_NUMBER_ALLOCATION_FAILED");
}
