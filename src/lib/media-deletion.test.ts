import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import type { DbClient, DbParam } from "@/db";
import { deleteMediaWithJournal } from "./media-deletion";

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE media(id INTEGER PRIMARY KEY, url TEXT NOT NULL); CREATE TABLE media_deletion_jobs(id INTEGER PRIMARY KEY, url TEXT NOT NULL, state TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);");
  db.prepare("INSERT INTO media VALUES (1, ?)").run("object/one");
  const objects = new Set(["object/one"]);
  let failStorage = false, failDb = false, failJournal = false, calls = 0;
  let queue = Promise.resolve();
  const client: DbClient = {
    async queryOne<T>(sql: string, ...params: DbParam[]) { return (db.prepare(sql).get(...params as never[]) ?? null) as T | null; },
    async queryAll<T>(sql: string, ...params: DbParam[]) { return db.prepare(sql).all(...params as never[]) as T[]; },
    async execute(sql: string, ...params: DbParam[]) {
      if ((failDb && sql.startsWith("DELETE FROM media")) || (failJournal && sql.startsWith("INSERT OR IGNORE INTO media_deletion_jobs"))) throw new Error("simulated database failure");
      const result = db.prepare(sql).run(...params as never[]);
      return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
    },
  };
  async function transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
    const prior = queue; let release!: () => void;
    queue = new Promise<void>(resolve => { release = resolve; });
    await prior;
    try { db.exec("BEGIN IMMEDIATE"); try { const result = await fn(client); db.exec("COMMIT"); return result; } catch (error) { db.exec("ROLLBACK"); throw error; } }
    finally { release(); }
  }
  const absent = async (url: string) => { calls++; if (failStorage) throw new Error("simulated storage failure"); objects.delete(url); };
  return {
    db, objects, get calls() { return calls; },
    setStorageFailure(value: boolean) { failStorage = value; },
    setDbFailure(value: boolean) { failDb = value; },
    setJournalFailure(value: boolean) { failJournal = value; },
    delete: (id = 1) => deleteMediaWithJournal(id, transaction, "sqlite", absent),
    row: () => db.prepare("SELECT * FROM media WHERE id=1").get(),
    job: () => db.prepare("SELECT state, url FROM media_deletion_jobs WHERE id=1").get(),
  };
}

test("successful deletion is idempotent, including concurrent requests", async () => {
  const f = fixture();
  assert.deepEqual(await Promise.all([f.delete(), f.delete()]), ["deleted", "deleted"]);
  assert.equal(f.row(), undefined); assert.equal(f.objects.size, 0);
  assert.equal(f.job()?.state, "completed"); assert.equal(f.calls, 1);
  assert.equal(await f.delete(), "deleted"); assert.equal(f.calls, 1);
  f.db.close();
});

test("journal failure does not touch storage or remove the record", async () => {
  const f = fixture(); f.setJournalFailure(true);
  await assert.rejects(f.delete()); assert(f.row()); assert(f.objects.has("object/one")); assert.equal(f.calls, 0); assert.equal(f.job(), undefined);
  f.setJournalFailure(false); assert.equal(await f.delete(), "deleted"); f.db.close();
});

test("storage failure retains the row and durable URL; retry finishes", async () => {
  const f = fixture(); f.setStorageFailure(true);
  await assert.rejects(f.delete()); assert(f.row()); assert(f.objects.has("object/one"));
  assert.equal(f.job()?.state, "pending"); assert.equal(f.job()?.url, "object/one");
  f.setStorageFailure(false); assert.equal(await f.delete(), "deleted"); assert.equal(f.row(), undefined);
  f.db.close();
});

test("database failure after storage removal retains durable pending intent and retries", async () => {
  const f = fixture(); f.setDbFailure(true);
  await assert.rejects(f.delete()); assert(f.row()); assert.equal(f.objects.size, 0); assert.equal(f.job()?.state, "pending");
  f.setDbFailure(false); assert.equal(await f.delete(), "deleted"); assert.equal(f.row(), undefined); assert.equal(f.job()?.state, "completed");
  f.db.close();
});

test("missing storage object is idempotent; missing DB record does not touch storage", async () => {
  const f = fixture(); f.objects.clear(); assert.equal(await f.delete(), "deleted");
  assert.equal(await f.delete(999), "not_found"); assert.equal(f.calls, 1); f.db.close();
});

test("shared objects and reused or replaced IDs are never deleted", async () => {
  const shared = fixture();
  shared.db.prepare("INSERT INTO media VALUES (2, ?)").run("object/one");
  await assert.rejects(shared.delete()); assert.equal(shared.calls, 0); assert(shared.row()); assert(shared.objects.has("object/one"));
  shared.db.prepare("DELETE FROM media WHERE id=2").run();
  assert.equal(await shared.delete(), "deleted");
  shared.db.prepare("INSERT INTO media VALUES (1, ?)").run("object/new");
  await assert.rejects(shared.delete()); assert.equal(shared.calls, 1); assert(shared.row());
  shared.db.close();
  const changed = fixture(); changed.setStorageFailure(true); await assert.rejects(changed.delete());
  changed.db.prepare("UPDATE media SET url=? WHERE id=1").run("object/new"); changed.setStorageFailure(false);
  await assert.rejects(changed.delete()); assert.equal(changed.calls, 1); assert(changed.objects.has("object/one"));
  changed.db.close();
});
