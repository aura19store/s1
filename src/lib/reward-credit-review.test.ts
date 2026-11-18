import { strict as assert } from "node:assert";
import { test } from "node:test";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync } from "node:fs";
import { recordCreditReview } from "./reward-credit-review";
import type { DbClient, DbParam } from "@/db";

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON; CREATE TABLE orders(id INTEGER PRIMARY KEY);");
  db.exec(readFileSync("src/db/migrations/0002_customer_rewards.sqlite.sql", "utf8"));
  db.exec(`INSERT INTO orders VALUES(1);
    INSERT INTO customer_accounts(auth_user_id,email) VALUES('u','test@example.test');
    INSERT INTO aura_reward_grants(auth_user_id,reward_id,cycle_number,request_key,reward_name,kind,credit_iqd,remaining_iqd,status)
    VALUES('u',1,0,'key','رصيد','credit',5000,3000,'available');
    INSERT INTO aura_reward_credit_uses(grant_id,order_id,amount_iqd) VALUES(1,1,2000);`);
  const params = (p: DbParam[]) => p.map(v => v === undefined ? null : v) as SQLInputValue[];
  const tx: DbClient = {
    async queryOne<T>(sql: string, ...p: DbParam[]) { return (db.prepare(sql).get(...params(p)) || null) as T | null; },
    async queryAll<T>(sql: string, ...p: DbParam[]) { return db.prepare(sql).all(...params(p)) as T[]; },
    async execute(sql: string, ...p: DbParam[]) { const r = db.prepare(sql).run(...params(p)); return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) }; },
  };
  return { db, tx };
}

test("returns only the spent balance once across cancellation and return", async () => {
  const {db, tx} = fixture();
  try {
    db.exec("BEGIN IMMEDIATE");
    await recordCreditReview(tx, 1, "cancelled", "sqlite");
    await recordCreditReview(tx, 1, "cancelled", "sqlite");
    await recordCreditReview(tx, 1, "returned", "sqlite");
    db.exec("COMMIT");
    assert.equal(db.prepare("SELECT remaining_iqd FROM aura_reward_grants").get()?.remaining_iqd, 5000);
    assert.equal(db.prepare("SELECT count(*) AS c FROM aura_reward_credit_restorations").get()?.c, 1);
    assert.equal(db.prepare("SELECT amount_iqd FROM aura_reward_credit_restorations").get()?.amount_iqd, 2000);
    assert.equal(db.prepare("SELECT count(*) AS c FROM aura_reward_credit_review_incidents").get()?.c, 2);
    assert.equal(db.prepare("SELECT count(*) AS c FROM aura_reward_grants").get()?.c, 1);
  } finally { db.close(); }
});

for (const condition of ["status = 'revoked'", "expires_at = '2000-01-01'"]) {
  test(`invalid grant stays in review: ${condition}`, async () => {
    const {db, tx} = fixture();
    try {
      db.exec(`UPDATE aura_reward_grants SET ${condition}; BEGIN IMMEDIATE`);
      await recordCreditReview(tx, 1, "returned", "sqlite");
      db.exec("UPDATE aura_reward_grants SET status='available', expires_at=NULL");
      await recordCreditReview(tx, 1, "cancelled", "sqlite");
      db.exec("COMMIT");
      assert.equal(db.prepare("SELECT remaining_iqd FROM aura_reward_grants").get()?.remaining_iqd, 3000);
      assert.equal(db.prepare("SELECT count(*) AS c FROM aura_reward_credit_restorations").get()?.c, 0);
      assert.equal(db.prepare("SELECT count(*) AS c FROM aura_reward_credit_review_incidents").get()?.c, 2);
    } finally { db.close(); }
  });
}

test("restoring a fully spent credit makes the original grant available", async () => {
  const {db, tx} = fixture();
  try {
    db.exec("UPDATE aura_reward_grants SET remaining_iqd=0,status='used'; BEGIN IMMEDIATE");
    await recordCreditReview(tx, 1, "cancelled", "sqlite"); db.exec("COMMIT");
    const row = db.prepare("SELECT remaining_iqd,status FROM aura_reward_grants").get();
    assert.equal(row?.remaining_iqd, 2000); assert.equal(row?.status, "available");
  } finally { db.close(); }
});
