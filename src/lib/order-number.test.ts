import { strict as assert } from "node:assert";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { insertOrderWithUniqueNumber } from "./order-number";
import type { DbClient } from "@/db";

test("historical order number collision is retried without randomness", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE orders(id INTEGER PRIMARY KEY AUTOINCREMENT, order_number TEXT UNIQUE NOT NULL); INSERT INTO orders(id,order_number) VALUES(1,'AURA-2026-1002')");
  const tx = { queryOne: async (sql: string) => db.prepare(sql).get() } as unknown as DbClient;
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = await insertOrderWithUniqueNumber(tx, "sqlite", async (id, number) =>
      Number(db.prepare("INSERT INTO orders(id,order_number) VALUES(?,?) ON CONFLICT(order_number) DO NOTHING").run(id, number).changes));
    assert.deepEqual(result, { orderId: 2, orderNumber: "AURA-2026-1003" });
    assert.equal(db.prepare("SELECT COUNT(DISTINCT order_number) AS n FROM orders").get()?.n, 2);
    db.exec("COMMIT");
  } finally { db.close(); }
});
