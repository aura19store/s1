import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute, queryAll } from "@/db";
import { requireAdminApi } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi("inventory");
  if ("error" in auth) return auth.error;

  const filter = request.nextUrl.searchParams.get("filter") || "all";
  let where = "1=1";
  if (filter === "in_stock") {
    where = "p.stock_quantity > p.low_stock_threshold";
  } else if (filter === "low_stock") {
    where = "p.stock_quantity > 0 AND p.stock_quantity <= p.low_stock_threshold";
  } else if (filter === "out_of_stock") {
    where = "p.stock_quantity <= 0";
  }

  const items = queryAll(`
    SELECT p.id, p.sku, p.name, p.stock_quantity, p.low_stock_threshold, p.status, p.price_iqd,
           g.name as gender_name, c.name as category_name,
           (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1) as primary_image
    FROM products p
    JOIN genders g ON g.id = p.gender_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE ${where}
    ORDER BY p.stock_quantity ASC, p.id DESC
  `);

  const summary = queryAll<{ status_bucket: string; cnt: number }>(`
    SELECT
      CASE
        WHEN stock_quantity <= 0 THEN 'out_of_stock'
        WHEN stock_quantity <= low_stock_threshold THEN 'low_stock'
        ELSE 'in_stock'
      END as status_bucket,
      COUNT(*) as cnt
    FROM products
    GROUP BY status_bucket
  `);

  return NextResponse.json({ items, summary });
}

const patchSchema = z.object({
  productId: z.number().int().positive(),
  stock_quantity: z.number().int().min(0),
  low_stock_threshold: z.number().int().min(1).optional(),
});

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi("inventory");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "كمية المخزون غير صالحة." },
      { status: 400 }
    );
  }

  if (parsed.data.low_stock_threshold !== undefined) {
    execute(
      `UPDATE products SET stock_quantity = ?, low_stock_threshold = ?, updated_at = datetime('now') WHERE id = ?`,
      parsed.data.stock_quantity,
      parsed.data.low_stock_threshold,
      parsed.data.productId
    );
  } else {
    execute(
      `UPDATE products SET stock_quantity = ?, updated_at = datetime('now') WHERE id = ?`,
      parsed.data.stock_quantity,
      parsed.data.productId
    );
  }

  return NextResponse.json({ message: "تم تحديث كمية المخزون بنجاح." });
}
