import { queryAll, type DbClient } from "@/db";

export interface PromotionRow {
  id: number;
  name: string;
  description: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  scope_type: "all" | "gender" | "category" | "products";
  gender_id: number | null;
  category_id: number | null;
  product_ids_json: string;
  starts_at: string | null;
  ends_at: string | null;
  is_active: number;
}

export interface ProductPricingInput {
  id: number;
  gender_id: number;
  category_id: number | null;
  price_iqd: number;
  discount_price_iqd: number | null;
}

export interface ComputedPricing {
  originalPrice: number;
  finalPrice: number;
  discountAmount: number;
  discountPercent: number;
  hasDiscount: boolean;
  promotionName: string | null;
}

export async function getActivePromotions(db?: DbClient): Promise<PromotionRow[]> {
  const sql = `SELECT * FROM promotions WHERE is_active = 1`;
  const all = db ? await db.queryAll<PromotionRow>(sql) : await queryAll<PromotionRow>(sql);
  const now = Date.now();
  return all.filter((promo) => {
    if (promo.starts_at) {
      const start = new Date(promo.starts_at).getTime();
      if (!Number.isNaN(start) && now < start) return false;
    }
    if (promo.ends_at) {
      // Treat YYYY-MM-DD as end of that day
      const endStr =
        promo.ends_at.length === 10
          ? `${promo.ends_at}T23:59:59Z`
          : promo.ends_at;
      const end = new Date(endStr).getTime();
      if (!Number.isNaN(end) && now > end) return false;
    }
    return true;
  });
}

function promotionApplies(
  promo: PromotionRow,
  product: ProductPricingInput
): boolean {
  if (promo.scope_type === "all") return true;
  if (promo.scope_type === "gender") {
    return promo.gender_id === product.gender_id;
  }
  if (promo.scope_type === "category") {
    return (
      promo.category_id !== null && promo.category_id === product.category_id
    );
  }
  if (promo.scope_type === "products") {
    try {
      const ids: number[] = JSON.parse(promo.product_ids_json || "[]");
      return ids.includes(product.id);
    } catch {
      return false;
    }
  }
  return false;
}

export function computeProductPricing(
  product: ProductPricingInput,
  activePromos: PromotionRow[] = []
): ComputedPricing {
  const promos = activePromos;
  const originalPrice = Math.max(0, Math.round(product.price_iqd));

  // Base price starts from product's explicit discount_price_iqd if valid
  let bestPrice =
    product.discount_price_iqd !== null &&
    product.discount_price_iqd > 0 &&
    product.discount_price_iqd < originalPrice
      ? Math.round(product.discount_price_iqd)
      : originalPrice;

  let appliedPromoName: string | null = null;

  for (const promo of promos) {
    if (!promotionApplies(promo, product)) continue;
    const baseForPromo =
      product.discount_price_iqd !== null &&
      product.discount_price_iqd > 0 &&
      product.discount_price_iqd < originalPrice
        ? Math.round(product.discount_price_iqd)
        : originalPrice;

    let candidate = baseForPromo;
    if (promo.discount_type === "percentage") {
      const pct = Math.min(90, Math.max(0, promo.discount_value));
      candidate = Math.round(baseForPromo * (1 - pct / 100));
    } else {
      candidate = Math.max(0, baseForPromo - promo.discount_value);
    }

    if (candidate < bestPrice) {
      bestPrice = candidate;
      appliedPromoName = promo.name;
    }
  }

  // Round neatly to nearest 100 IQD if fractional promotion occurred
  if (appliedPromoName && bestPrice > 1000) {
    bestPrice = Math.round(bestPrice / 100) * 100;
  }

  const discountAmount = Math.max(0, originalPrice - bestPrice);
  const discountPct =
    originalPrice > 0 && discountAmount > 0
      ? Math.round((discountAmount / originalPrice) * 100)
      : 0;

  return {
    originalPrice,
    finalPrice: bestPrice,
    discountAmount,
    discountPercent: discountPct,
    hasDiscount: discountAmount > 0,
    promotionName: appliedPromoName,
  };
}

export function calculateShippingIQD(
  subtotalIqd: number,
  freeThresholdIqd = 25000,
  shippingFeeIqd = 3000
): number {
  if (subtotalIqd <= 0) return 0;
  return subtotalIqd >= freeThresholdIqd ? 0 : shippingFeeIqd;
}
