import { strict as assert } from "node:assert";
import { test } from "node:test";
import { eligibleRewardOrders, rewardForCycle, rewardProgress, type RewardOrder } from "./aura-rewards";

const order = (overrides: Partial<RewardOrder> = {}): RewardOrder => ({
  id: 1, accountId: "customer-1", status: "delivered", productsSubtotalAfterDiscountIqd: 15000,
  returned: false, createdAt: "2026-01-01T00:00:00.000Z", ...overrides,
});

test("only qualifying, delivered, unreturned and unused orders for this account count", () => {
  const rows = [
    order(), order(),
    order({ id: 2, productsSubtotalAfterDiscountIqd: 14999 }),
    order({ id: 3, status: "cancelled" }),
    order({ id: 4, returned: true }),
    order({ id: 5, accountId: null }),
    order({ id: 6, accountId: "customer-2" }),
    order({ id: 7, status: "confirmed" }),
    order({ id: 8 }),
  ];
  assert.deepEqual(eligibleRewardOrders(rows, "customer-1", 15000, new Set([8])).map(x => x.id), [1]);
  assert.deepEqual(eligibleRewardOrders([order({ status: "cancelled" })], "customer-1", 15000, new Set()), []);
});

test("qualifying amount is product subtotal after discounts, excluding shipping", () => {
  // Checkout stores its already-discounted product subtotal independently of shipping.
  const withDiscount = { ...order({ id: 10, productsSubtotalAfterDiscountIqd: 18000 - 3000 }), shippingIqd: 3000 };
  const belowMinimum = { ...order({ id: 11, productsSubtotalAfterDiscountIqd: 14000 }), shippingIqd: 3000 };
  const belowBoundary = { ...order({ id: 12, productsSubtotalAfterDiscountIqd: 14999 }), shippingIqd: 3000 };
  const aboveBoundary = { ...order({ id: 13, productsSubtotalAfterDiscountIqd: 15001 }), shippingIqd: 0 };
  const eligible = eligibleRewardOrders([withDiscount, belowMinimum, belowBoundary, aboveBoundary], "customer-1", 15000, new Set());
  assert.deepEqual(eligible.map((item) => item.id), [10, 13]);
  assert.equal(withDiscount.productsSubtotalAfterDiscountIqd, 15000);
});

test("five eligible orders make a reward ready; cancellation reverses progress", () => {
  const orders = Array.from({ length: 5 }, (_, i) => order({ id: i + 1 }));
  const getEligible = (rows: RewardOrder[]) => eligibleRewardOrders(rows, "customer-1", 15000, new Set());
  assert.deepEqual(rewardProgress(getEligible(orders), 5), { completed: 5, required: 5, remaining: 0, ready: true });
  const cancelled = orders.map((item) => item.id === 1 ? { ...item, status: "cancelled" } : item);
  assert.deepEqual(rewardProgress(getEligible(cancelled), 5), { completed: 4, required: 5, remaining: 1, ready: false });
  assert.throws(() => rewardProgress(getEligible(orders), 0), RangeError);
});

test("rewards are ordered deterministically and physical stock is not substituted", () => {
  const options = [
    { id: 2, position: 2, active: true, kind: "watch" as const, stockQuantity: 0 },
    { id: 1, position: 1, active: true, kind: "credit" as const, stockQuantity: null },
    { id: 3, position: 0, active: false, kind: "bag" as const, stockQuantity: 1 },
  ];
  assert.equal(rewardForCycle(options, 0)?.id, 1);
  assert.equal(rewardForCycle(options, 1), null);
  assert.equal(rewardForCycle(options, 2)?.id, 1);
  assert.equal(rewardForCycle(options, -1), null);
});
