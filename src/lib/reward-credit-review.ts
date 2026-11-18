import type { DatabaseDriver, DbClient } from "@/db";

/** Record each event and restore each debit at most once, in the caller's transaction.
 * The locked original grant is the only balance that may be credited. Expired or
 * revoked grants retain an incident without a restoration for manual review. */
export async function recordCreditReview(
  tx: DbClient,
  orderId: number,
  reason: "cancelled" | "returned",
  driver: DatabaseDriver
): Promise<void> {
  const uses = await tx.queryAll<{ id: number; grant_id: number; amount_iqd: number }>(
    `SELECT id, grant_id, amount_iqd FROM aura_reward_credit_uses WHERE order_id = ? ORDER BY grant_id, id`, orderId
  );
  for (const use of uses) {
    // Serialize with checkout, revocation and another restoration for this grant.
    const grant = await tx.queryOne<{ id: number }>(
      `SELECT id FROM aura_reward_grants WHERE id = ?${driver === "postgres" ? " FOR UPDATE" : ""}`,
      use.grant_id
    );
    if (!grant) throw new Error("Reward credit grant is missing");
    const existing = await tx.queryOne<{ id: number }>(
      `SELECT id FROM aura_reward_credit_restorations WHERE credit_use_id = ?`, use.id
    );
    const pendingReview = await tx.queryOne<{ id: number }>(
      `SELECT id FROM aura_reward_credit_review_incidents WHERE credit_use_id = ?`, use.id
    );
    await tx.execute(
      `INSERT OR IGNORE INTO aura_reward_credit_review_incidents (credit_use_id, reason) VALUES (?, ?)`,
      use.id, reason
    );
    // Previously blocked credits stay for manual review even if the grant later changes.
    if (existing || pendingReview) continue;
    const amount = Number(use.amount_iqd);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid reward credit debit");
    // PostgreSQL CURRENT_TIMESTAMP is fixed at transaction start; check wall time
    // after acquiring the grant lock so waiting across expiry cannot restore it.
    const unexpired = driver === "postgres" ? "expires_at > clock_timestamp()" : "datetime(expires_at) > datetime('now')";
    const updated = await tx.execute(
      `UPDATE aura_reward_grants SET remaining_iqd = remaining_iqd + ?,
       status = CASE WHEN status = 'used' THEN 'available' ELSE status END
       WHERE id = ? AND kind = 'credit' AND status IN ('available', 'used')
       AND (expires_at IS NULL OR ${unexpired})
       AND remaining_iqd + ? <= credit_iqd`, amount, use.grant_id, amount
    );
    if (updated.changes === 1) {
      await tx.execute(
        `INSERT INTO aura_reward_credit_restorations (credit_use_id, amount_iqd, reason) VALUES (?, ?, ?)`,
        use.id, amount, reason
      );
    }
  }
}
