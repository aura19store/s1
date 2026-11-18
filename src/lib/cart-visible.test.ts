import { test } from "node:test";
import assert from "node:assert/strict";
import type { CartState, CartItemClient } from "@/components/store/StoreProvider";
import { cartWithoutPendingItems } from "./cart-visible";

const item = (id: number, quantity: number, unitPrice: number, originalPrice: number) =>
  ({ id, quantity, unitPrice, originalPrice, lineTotal: quantity * unitPrice } as CartItemClient);
const cart = {
  items: [item(1, 1, 10000, 12000), item(2, 2, 8000, 8000), item(3, 1, 5000, 5000)],
  itemCount: 4, subtotalIqd: 31000, discountIqd: 2000, shippingIqd: 0, totalIqd: 31000,
  freeShippingThresholdIqd: 25000, shippingFeeIqd: 3000, remainingForFreeShipping: 0,
} satisfies CartState;

test("one pending deletion recalculates count, discount and shipping immediately", () => {
  const visible = cartWithoutPendingItems(cart, new Set([1]));
  assert.deepEqual(visible.items.map((i) => i.id), [2, 3]);
  assert.equal(visible.itemCount, 3);
  assert.equal(visible.subtotalIqd, 21000);
  assert.equal(visible.discountIqd, 0);
  assert.equal(visible.shippingIqd, 3000);
  assert.equal(visible.totalIqd, 24000);
});

test("multiple and final pending deletions disappear without altering server snapshot", () => {
  assert.deepEqual(cartWithoutPendingItems(cart, new Set([1, 2])).items.map((i) => i.id), [3]);
  const empty = cartWithoutPendingItems(cart, new Set([1, 2, 3]));
  assert.equal(empty.items.length, 0);
  assert.equal(empty.itemCount, 0);
  assert.equal(empty.shippingIqd, 0);
  assert.equal(empty.totalIqd, 0);
  assert.equal(cart.items.length, 3);
  assert.equal(cartWithoutPendingItems(cart, new Set()), cart);
});
