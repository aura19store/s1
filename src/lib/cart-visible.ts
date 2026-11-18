import type { CartState } from "@/components/store/StoreProvider";

/** View-only projection while deletions are pending; the server remains authoritative. */
export function cartWithoutPendingItems(cart: CartState, pending: ReadonlySet<number>): CartState {
  if (pending.size === 0) return cart;
  const items = cart.items.filter((item) => !pending.has(item.id));
  const subtotalIqd = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const originalSubtotal = items.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0);
  const shippingIqd = subtotalIqd <= 0 || subtotalIqd >= cart.freeShippingThresholdIqd ? 0 : cart.shippingFeeIqd;
  return {
    ...cart,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalIqd,
    discountIqd: Math.max(0, originalSubtotal - subtotalIqd),
    shippingIqd,
    totalIqd: subtotalIqd + shippingIqd,
    remainingForFreeShipping: Math.max(0, cart.freeShippingThresholdIqd - subtotalIqd),
  };
}
