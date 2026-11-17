import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute, queryAll, queryOne } from "@/db";
import { ensureGuestSessionToken, getGuestSessionToken } from "@/lib/auth";
import { calculateShippingIQD, computeProductPricing, getActivePromotions } from "@/lib/pricing";
import { getStoreSettings } from "@/lib/store-queries";

export interface CartItemResponse {
  id: number;
  productId: number;
  slug: string;
  genderSlug: string;
  genderName: string;
  name: string;
  sku: string;
  image: string;
  variantLabel: string;
  quantity: number;
  stockQuantity: number;
  originalPrice: number;
  unitPrice: number;
  lineTotal: number;
  hasDiscount: boolean;
  promotionName: string | null;
}

async function buildCartResponse(sessionToken: string | null) {
  const settings = await getStoreSettings();
  if (!sessionToken) {
    return {
      guestToken: null as string | null,
      items: [] as CartItemResponse[],
      itemCount: 0,
      subtotalIqd: 0,
      discountIqd: 0,
      shippingIqd: 0,
      totalIqd: 0,
      freeShippingThresholdIqd: settings.free_shipping_threshold_iqd,
      shippingFeeIqd: settings.shipping_fee_iqd,
      remainingForFreeShipping: settings.free_shipping_threshold_iqd,
    };
  }

  const cart = await queryOne<{ id: number }>(
    `SELECT id FROM carts WHERE session_token = ?`,
    sessionToken
  );
  if (!cart) {
    return {
      guestToken: sessionToken,
      items: [] as CartItemResponse[],
      itemCount: 0,
      subtotalIqd: 0,
      discountIqd: 0,
      shippingIqd: 0,
      totalIqd: 0,
      freeShippingThresholdIqd: settings.free_shipping_threshold_iqd,
      shippingFeeIqd: settings.shipping_fee_iqd,
      remainingForFreeShipping: settings.free_shipping_threshold_iqd,
    };
  }

  const [rows, promos] = await Promise.all([
    queryAll<{
      ci_id: number;
      product_id: number;
      variant_label: string;
      quantity: number;
      slug: string;
      gender_slug: string;
      gender_name: string;
      name: string;
      sku: string;
      gender_id: number;
      category_id: number | null;
      price_iqd: number;
      discount_price_iqd: number | null;
      stock_quantity: number;
      status: string;
      primary_image: string | null;
    }>(
      `SELECT ci.id as ci_id, ci.product_id, ci.variant_label, ci.quantity,
              p.slug, g.slug as gender_slug, g.name as gender_name, p.name, p.sku, p.gender_id, p.category_id,
              p.price_iqd, p.discount_price_iqd, p.stock_quantity, p.status,
              (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1) as primary_image
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN genders g ON g.id = p.gender_id
       WHERE ci.cart_id = ? AND p.status = 'active'
       ORDER BY ci.id DESC`,
      cart.id
    ),
    getActivePromotions(),
  ]);
  let originalSubtotal = 0;
  let subtotalIqd = 0;
  let itemCount = 0;

  const items: CartItemResponse[] = rows.map((r) => {
    const pricing = computeProductPricing(
      {
        id: r.product_id,
        gender_id: r.gender_id,
        category_id: r.category_id,
        price_iqd: r.price_iqd,
        discount_price_iqd: r.discount_price_iqd,
      },
      promos
    );
    const qty = Math.min(Math.max(1, r.quantity), Math.max(1, r.stock_quantity));
    const lineTotal = pricing.finalPrice * qty;
    originalSubtotal += pricing.originalPrice * qty;
    subtotalIqd += lineTotal;
    itemCount += qty;

    return {
      id: r.ci_id,
      productId: r.product_id,
      slug: r.slug,
      genderSlug: r.gender_slug,
      genderName: r.gender_name,
      name: r.name,
      sku: r.sku,
      image: r.primary_image || "/images/brand-story.jpg",
      variantLabel: r.variant_label,
      quantity: qty,
      stockQuantity: r.stock_quantity,
      originalPrice: pricing.originalPrice,
      unitPrice: pricing.finalPrice,
      lineTotal,
      hasDiscount: pricing.hasDiscount,
      promotionName: pricing.promotionName,
    };
  });

  const discountIqd = Math.max(0, originalSubtotal - subtotalIqd);
  const shippingIqd = calculateShippingIQD(
    subtotalIqd,
    settings.free_shipping_threshold_iqd,
    settings.shipping_fee_iqd
  );
  const totalIqd = subtotalIqd + shippingIqd;
  const remainingForFreeShipping = Math.max(
    0,
    settings.free_shipping_threshold_iqd - subtotalIqd
  );

  return {
    guestToken: sessionToken,
    items,
    itemCount,
    subtotalIqd,
    discountIqd,
    shippingIqd,
    totalIqd,
    freeShippingThresholdIqd: settings.free_shipping_threshold_iqd,
    shippingFeeIqd: settings.shipping_fee_iqd,
    remainingForFreeShipping,
  };
}

export async function GET() {
  const token = await getGuestSessionToken();
  return NextResponse.json(await buildCartResponse(token));
}

const addSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(20).default(1),
  variantLabel: z.string().max(120).optional().default(""),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "بيانات المنتج غير صالحة." },
        { status: 400 }
      );
    }

    const { productId, quantity, variantLabel } = parsed.data;
    const product = await queryOne<{
      id: number;
      status: string;
      stock_quantity: number;
    }>(`SELECT id, status, stock_quantity FROM products WHERE id = ?`, productId);

    if (!product || product.status !== "active") {
      return NextResponse.json(
        { error: "هذا المنتج غير متوفر حاليًا." },
        { status: 404 }
      );
    }
    if (product.stock_quantity <= 0) {
      return NextResponse.json(
        { error: "عذرًا، نفدت كمية هذا المنتج من المخزون." },
        { status: 400 }
      );
    }

    const token = await ensureGuestSessionToken();
    let cart = await queryOne<{ id: number }>(
      `SELECT id FROM carts WHERE session_token = ?`,
      token
    );
    if (!cart) {
      const ins = await execute(
        `INSERT INTO carts (session_token) VALUES (?)`,
        token
      );
      cart = { id: ins.lastInsertRowid };
    }

    const existing = await queryOne<{ id: number; quantity: number }>(
      `SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND variant_label = ?`,
      cart.id,
      productId,
      variantLabel
    );

    if (existing) {
      const nextQty = Math.min(
        product.stock_quantity,
        existing.quantity + quantity
      );
      await execute(
        `UPDATE cart_items SET quantity = ? WHERE id = ?`,
        nextQty,
        existing.id
      );
    } else {
      const safeQty = Math.min(product.stock_quantity, quantity);
      await execute(
        `INSERT INTO cart_items (cart_id, product_id, variant_label, quantity) VALUES (?, ?, ?, ?)`,
        cart.id,
        productId,
        variantLabel,
        safeQty
      );
    }

    return NextResponse.json({
      message: "تمت إضافة المنتج إلى السلة بنجاح.",
      cart: await buildCartResponse(token),
    });
  } catch (err) {
    console.error("Cart POST error:", err);
    return NextResponse.json(
      { error: "تعذر إضافة المنتج إلى السلة." },
      { status: 500 }
    );
  }
}

const patchSchema = z.object({
  itemId: z.number().int().positive(),
  quantity: z.number().int().min(0).max(50),
});

export async function PATCH(request: NextRequest) {
  try {
    const token = await getGuestSessionToken();
    if (!token) {
      return NextResponse.json({ error: "السلة فارغة." }, { status: 400 });
    }
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "الكمية غير صالحة." }, { status: 400 });
    }

    const cart = await queryOne<{ id: number }>(
      `SELECT id FROM carts WHERE session_token = ?`,
      token
    );
    if (!cart) {
      return NextResponse.json({ error: "السلة غير موجودة." }, { status: 404 });
    }

    const item = await queryOne<{ id: number; product_id: number }>(
      `SELECT id, product_id FROM cart_items WHERE id = ? AND cart_id = ?`,
      parsed.data.itemId,
      cart.id
    );
    if (!item) {
      return NextResponse.json(
        { error: "العنصر غير موجود في السلة." },
        { status: 404 }
      );
    }

    if (parsed.data.quantity === 0) {
      await execute(`DELETE FROM cart_items WHERE id = ?`, item.id);
    } else {
      const prod = await queryOne<{ stock_quantity: number }>(
        `SELECT stock_quantity FROM products WHERE id = ?`,
        item.product_id
      );
      const maxStock = prod?.stock_quantity ?? 1;
      const safeQty = Math.min(maxStock, parsed.data.quantity);
      await execute(
        `UPDATE cart_items SET quantity = ? WHERE id = ?`,
        safeQty,
        item.id
      );
    }

    return NextResponse.json({
      message: "تم تحديث السلة.",
      cart: await buildCartResponse(token),
    });
  } catch (err) {
    console.error("Cart PATCH error:", err);
    return NextResponse.json(
      { error: "تعذر تحديث الكمية." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = await getGuestSessionToken();
    if (!token) {
      return NextResponse.json({ cart: await buildCartResponse(null) });
    }
    const cart = await queryOne<{ id: number }>(
      `SELECT id FROM carts WHERE session_token = ?`,
      token
    );
    if (!cart) {
      return NextResponse.json({ cart: await buildCartResponse(token) });
    }

    const itemId = request.nextUrl.searchParams.get("itemId");
    if (itemId) {
      await execute(
        `DELETE FROM cart_items WHERE id = ? AND cart_id = ?`,
        Number(itemId),
        cart.id
      );
    } else {
      await execute(`DELETE FROM cart_items WHERE cart_id = ?`, cart.id);
    }

    return NextResponse.json({
      message: "تم الحذف من السلة.",
      cart: await buildCartResponse(token),
    });
  } catch (err) {
    console.error("Cart DELETE error:", err);
    return NextResponse.json(
      { error: "تعذر حذف المنتج من السلة." },
      { status: 500 }
    );
  }
}
