/** Pure helpers for the AURA rewards rules. Database transactions remain authoritative. */
export interface RewardOrder {
  id: number;
  accountId: string | null;
  status: string;
  /** Products after discounts, before shipping (orders.subtotal_iqd). */
  productsSubtotalAfterDiscountIqd: number;
  returned: boolean;
  createdAt: string;
}

export interface RewardOption {
  id: number;
  position: number;
  active: boolean;
  kind: "credit" | "necklace" | "bracelet" | "watch" | "wallet" | "bag";
  stockQuantity: number | null;
}

/** Returns the account's currently eligible, unused orders in a stable order. */
export function eligibleRewardOrders(
  orders: readonly RewardOrder[],
  accountId: string,
  minimumIqd: number,
  usedOrderIds: ReadonlySet<number>
): RewardOrder[] {
  if (!accountId || !Number.isSafeInteger(minimumIqd) || minimumIqd < 0) return [];
  const seen = new Set<number>();
  return [...orders]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
    .filter((order) => {
      if (seen.has(order.id)) return false;
      seen.add(order.id);
      return Number.isSafeInteger(order.id) && order.id > 0 &&
        order.accountId === accountId && order.status === "delivered" &&
        !order.returned && Number.isSafeInteger(order.productsSubtotalAfterDiscountIqd) &&
        order.productsSubtotalAfterDiscountIqd >= minimumIqd && !usedOrderIds.has(order.id);
    });
}

/** Calculates progress from a server-supplied set of eligible, unconsumed orders. */
export function rewardProgress(eligibleOrders: readonly RewardOrder[], requiredOrders: number): {
  completed: number;
  required: number;
  remaining: number;
  ready: boolean;
} {
  if (!Number.isSafeInteger(requiredOrders) || requiredOrders < 1) {
    throw new RangeError("requiredOrders must be a positive safe integer");
  }
  const completed = Math.min(eligibleOrders.length, requiredOrders);
  const remaining = requiredOrders - completed;
  return { completed, required: requiredOrders, remaining, ready: remaining === 0 };
}

/**
 * Selects a candidate from an ordered configuration, without randomness or substitution.
 * A server must persist the assignment before displaying it and enforce stock atomically.
 */
export function rewardForCycle(options: readonly RewardOption[], cycle: number): RewardOption | null {
  if (!Number.isSafeInteger(cycle) || cycle < 0) return null;
  const active = options.filter((option) => option.active)
    .sort((a, b) => a.position - b.position || a.id - b.id);
  if (active.length === 0) return null;
  const selected = active[cycle % active.length];
  if (selected.kind !== "credit" && (!Number.isSafeInteger(selected.stockQuantity) || selected.stockQuantity! <= 0)) {
    return null;
  }
  return selected;
}
