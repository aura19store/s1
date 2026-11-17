import { NextRequest, NextResponse } from "next/server";
import { queryOne, runTransaction } from "@/db";
import { requireAdminApi } from "@/lib/auth";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi("products");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const prodId = Number(id);
  const orig = await queryOne<Record<string, unknown>>(
    `SELECT * FROM products WHERE id = ?`,
    prodId
  );
  if (!orig) {
    return NextResponse.json({ error: "المنتج غير موجود." }, { status: 404 });
  }

  const suffix = Date.now().toString().slice(-4);
  const newId = await runTransaction(async (tx) => {
    const res = await tx.execute(
      `INSERT INTO products (
        sku, slug, name, description, details, materials_info,
        gender_id, category_id, subcategory_id,
        price_iqd, discount_price_iqd, stock_quantity, low_stock_threshold,
        status, is_featured, is_bestseller, is_new_arrival, is_limited_edition, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`,
      `${orig.sku}-${suffix}`,
      `${orig.slug}-${suffix}`,
      `${orig.name} (نسخة)`,
      String(orig.description || ""),
      String(orig.details || ""),
      String(orig.materials_info || ""),
      Number(orig.gender_id),
      orig.category_id ? Number(orig.category_id) : null,
      orig.subcategory_id ? Number(orig.subcategory_id) : null,
      Number(orig.price_iqd),
      orig.discount_price_iqd ? Number(orig.discount_price_iqd) : null,
      Number(orig.stock_quantity),
      Number(orig.low_stock_threshold || 5),
      Number(orig.is_featured || 0),
      Number(orig.is_bestseller || 0),
      Number(orig.is_new_arrival || 0),
      Number(orig.is_limited_edition || 0),
      String(orig.tags || "")
    );
    const createdId = Number(res.lastInsertRowid);

    await tx.execute(
      `INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
       SELECT ?, url, alt_text, sort_order, is_primary FROM product_images WHERE product_id = ?`,
      createdId,
      prodId
    );

    await tx.execute(
      `INSERT OR IGNORE INTO product_attribute_values (product_id, attribute_id, attribute_value_id)
       SELECT ?, attribute_id, attribute_value_id FROM product_attribute_values WHERE product_id = ?`,
      createdId,
      prodId
    );

    return createdId;
  });

  return NextResponse.json({
    id: newId,
    message: "تم نسخ المنتج كمسودة بنجاح.",
  });
}
