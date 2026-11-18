import type { DbClient, DatabaseDriver } from "@/db";

type Transaction = <T>(fn: (tx: DbClient) => Promise<T>) => Promise<T>;
interface Media { id: number; url: string }
interface Job { id: number; url: string; state: "pending" | "completed" }

/**
 * A durable intent is committed before touching Storage. A row lock serializes
 * retries for the same image. A failed/ambiguous Storage or DB operation leaves
 * the intent and URL available for an explicit retry; no success is reported.
 */
export async function deleteMediaWithJournal(
  id: number,
  transaction: Transaction,
  driver: DatabaseDriver,
  ensureAbsent: (url: string) => Promise<void>,
): Promise<"deleted" | "not_found"> {
  const prepared = await transaction(async (tx) => {
    const existing = await tx.queryOne<Job>("SELECT id, url, state FROM media_deletion_jobs WHERE id = ?", id);
    if (existing) return true;
    const media = await tx.queryOne<Media>("SELECT id, url FROM media WHERE id = ?", id);
    if (!media) return false;
    await tx.execute("INSERT OR IGNORE INTO media_deletion_jobs (id, url, state) VALUES (?, ?, 'pending')", id, media.url);
    return true;
  });
  if (!prepared) return "not_found";
  return transaction<"deleted">(async (tx) => {
    const job = await tx.queryOne<Job>(
      `SELECT id, url, state FROM media_deletion_jobs WHERE id = ?${driver === "postgres" ? " FOR UPDATE" : ""}`, id
    );
    if (!job) throw new Error("Deletion intent is missing");
    const current = await tx.queryOne<Media>(
      `SELECT id, url FROM media WHERE id = ?${driver === "postgres" ? " FOR UPDATE" : ""}`, id
    );
    // A retained journal must never authorize deletion of a newly reused ID.
    if (current && (job.state === "completed" || current.url !== job.url)) throw new Error("Media identity changed");
    if (job.state === "completed") return "deleted";
    // Do not remove an object that is also represented by a different media row.
    if (await tx.queryOne("SELECT id FROM media WHERE url = ? AND id <> ? LIMIT 1", job.url, id)) {
      throw new Error("Media object is shared");
    }
    await ensureAbsent(job.url);
    // The URL guard prevents a retry from removing an unrelated replacement row.
    await tx.execute("DELETE FROM media WHERE id = ? AND url = ?", id, job.url);
    await tx.execute("UPDATE media_deletion_jobs SET state = 'completed', updated_at = datetime('now') WHERE id = ?", id);
    return "deleted";
  });
}
