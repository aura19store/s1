import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute, queryAll, queryOne, runTransaction } from "@/db";
import { requireAdminApi } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi("products");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const prodId = Number(id);
  const product = queryOne(`SELECT * FROM products WHERE id = ?`, prodId);
  if (!product) {
    return NextResponse.json({ error: "المنتج غير موجود." }, { status: 404 });
  }

  const images = queryAll(
    `SELECT id, url, alt_text, sort_order, is_primary FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC`,
    prodId
  );
  const attrValIds = queryAll<{ attribute_value_id: number }>(
    `SELECT attribute_value_id FROM product_attribute_values WHERE product_id = ?`,
    prodId
  ).map((r) => r.attribute_value_id);

  return NextResponse.json({
    product: {
      ...product,
      images,
      attribute_value_ids: attrValIds,
    },
  });
}

const updateProductSchema = z.object({
  name: z.string().trim().min(2).optional(),
  sku: z.string().trim().min(2).optional(),
  description: z.string().trim().optional(),
  details: z.string().trim().optional(),
  materials_info: z.string().trim().optional(),
  gender_id: z.number().int().positive().optional(),
  category_id: z.number().int().positive().nullable().optional(),
  subcategory_id: z.number().int().positive().nullable().optional(),
  price_iqd: z.number().int().min(0).optional(),
  discount_price_iqd: z.number().int().min(0).nullable().optional(),
  stock_quantity: z.number().int().min(0).optional(),
  low_stock_threshold: z.number().int().min(1).optional(),
  status: z.enum(["active", "hidden", "draft"]).optional(),
  is_featured: z.boolean().optional(),
  is_bestseller: z.boolean().optional(),
  is_new_arrival: z.boolean().optional(),
  is_limited_edition: z.boolean().optional(),
  tags: z.string().optional(),
  images: z
    .array(
      z.object({
        url: z.string().min(1),
        alt_text: z.string().optional().default(""),
        is_primary: z.boolean().optional().default(false),
      })
    )
    .optional(),
  attribute_value_ids: z.array(z.number().int().positive()).optional(),
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi("products");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const prodId = Number(id);
  const existing = queryOne<{ id: number; price_iqd: number }>(
    `SELECT id, price_iqd FROM products WHERE id = ?`,
    prodId
  );
  if (!existing) {
    return NextResponse.json({ error: "المنتج غير موجود." }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات التعديل غير صالحة." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const effectivePrice = d.price_iqd ?? existing.price_iqd;
    if (
      d.discount_price_iqd !== null &&
      d.discount_price_iqd !== undefined &&
      d.discount_price_iqd >= effectivePrice
    ) {
      return NextResponse.json(
        { error: "يجب أن يكون السعر بعد الخصم أقل من السعر الأصلي." },
        { status: 400 }
      );
    }

    if (d.sku) {
      const dup = queryOne<{ id: number }>(
        `SELECT id FROM products WHERE sku = ? AND id != ?`,
        d.sku,
        prodId
      );
      if (dup) {
        return NextResponse.json(
          { error: "رمز المنتج مستخدم لمنتج آخر." },
          { status: 400 }
        );
      }
    }

    runTransaction((db) => {
      const fields: string[] = [];
      const values: (string | number | null)[] = [];
      const addField = (col: string, val: string | number | null | undefined) => {
        if (val !== undefined) {
          fields.push(`${col} = ?`);
          values.push(val);
        }
      };

      addField("name", d.name);
      addField("sku", d.sku);
      addField("description", d.description);
      addField("details", d.details);
      addField("materials_info", d.materials_info);
      addField("gender_id", d.gender_id);
      if ("category_id" in d) addField("category_id", d.category_id ?? null);
      if ("subcategory_id" in d) addField("subcategory_id", d.subcategory_id ?? null);
      addField("price_iqd", d.price_iqd);
      if ("discount_price_iqd" in d)
        addField("discount_price_iqd", d.discount_price_iqd ?? null);
      addField("stock_quantity", d.stock_quantity);
      addField("low_stock_threshold", d.low_stock_threshold);
      addField("status", d.status);
      if (d.is_featured !== undefined)
        addField("is_featured", d.is_featured ? 1 : 0);
      if (d.is_bestseller !== undefined)
        addField("is_bestseller", d.is_bestseller ? 1 : 0);
      if (d.is_new_arrival !== undefined)
        addField("is_new_arrival", d.is_new_arrival ? 1 : 0);
      if (d.is_limited_edition !== undefined)
        addField("is_limited_edition", d.is_limited_edition ? 1 : 0);
      addField("tags", d.tags);

      if (fields.length > 0) {
        fields.push(`updated_at = datetime('now')`);
        db.prepare(
          `UPDATE products SET ${fields.join(", ")} WHERE id = ?`
        ).run(...values, prodId);
      }

      if (d.images !== undefined) {
        db.prepare(`DELETE FROM product_images WHERE product_id = ?`).run(prodId);
        const insImg = db.prepare(
          `INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary) VALUES (?, ?, ?, ?, ?)`
        );
        d.images.forEach((img, idx) => {
          insImg.run(
            prodId,
            img.url,
            img.alt_text || d.name || "",
            idx,
            idx === 0 || img.is_primary ? 1 : 0
          );
        });
      }

      if (d.attribute_value_ids !== undefined) {
        db.prepare(
          `DELETE FROM product_attribute_values WHERE product_id = ?`
        ).run(prodId);
        const insAttr = db.prepare(
          `INSERT OR IGNORE INTO product_attribute_values (product_id, attribute_id, attribute_value_id)
           SELECT ?, attribute_id, id FROM attribute_values WHERE id = ?`
        );
        for (const valId of d.attribute_value_ids) {
          insAttr.run(prodId, valId);
        }
      }
    });

    return NextResponse.json({ message: "تم تحديث المنتج بنجاح." });
  } catch (err) {
    console.error("Update product error:", err);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تحديث المنتج." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(request, context);
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi("products");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const prodId = Number(id);
  const res = execute(`DELETE FROM products WHERE id = ?`, prodId);
  if (res.changes === 0) {
    return NextResponse.json({ error: "المنتج غير موجود." }, { status: 404 });
  }

  return NextResponse.json({ message: "تم حذف المنتج نهائيًا بنجاح." });
}
