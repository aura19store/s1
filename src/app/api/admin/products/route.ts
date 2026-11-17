import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queryAll, queryOne, runTransaction } from "@/db";
import { requireAdminApi } from "@/lib/auth";
import { slugify } from "@/lib/format";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi("products");
  if ("error" in auth) return auth.error;

  const sp = request.nextUrl.searchParams;
  const search = (sp.get("q") || "").trim();
  const genderId = sp.get("genderId");
  const categoryId = sp.get("categoryId");
  const status = sp.get("status");

  const where: string[] = ["1=1"];
  const params: (string | number)[] = [];

  if (search) {
    const term = `%${search}%`;
    where.push("(p.name LIKE ? OR p.sku LIKE ? OR p.tags LIKE ?)");
    params.push(term, term, term);
  }
  if (genderId) {
    where.push("p.gender_id = ?");
    params.push(Number(genderId));
  }
  if (categoryId) {
    where.push("p.category_id = ?");
    params.push(Number(categoryId));
  }
  if (status) {
    where.push("p.status = ?");
    params.push(status);
  }

  const [products, genders, categories, attributes, attrValues] =
    await Promise.all([
      queryAll(
        `SELECT p.*,
                g.name as gender_name, g.slug as gender_slug,
                c.name as category_name,
                (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1) as primary_image
         FROM products p
         JOIN genders g ON g.id = p.gender_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE ${where.join(" AND ")}
         ORDER BY p.id DESC`,
        ...params
      ),
      queryAll(`SELECT id, slug, name FROM genders ORDER BY sort_order ASC`),
      queryAll(
        `SELECT id, gender_id, parent_id, name, slug FROM categories ORDER BY gender_id ASC, sort_order ASC`
      ),
      queryAll<{ id: number; slug: string; name: string; type: string }>(
        `SELECT id, slug, name, type FROM attributes ORDER BY sort_order ASC`
      ),
      queryAll<{
        id: number;
        attribute_id: number;
        slug: string;
        value: string;
        color_hex: string;
      }>(`SELECT id, attribute_id, slug, value, color_hex FROM attribute_values ORDER BY sort_order ASC`),
    ]);

  return NextResponse.json({
    products,
    genders,
    categories,
    attributes: attributes.map((a) => ({
      ...a,
      values: attrValues.filter((v) => Number(v.attribute_id) === Number(a.id)),
    })),
  });
}

const productSchema = z.object({
  name: z.string().trim().min(2, "يرجى إدخال اسم المنتج."),
  sku: z.string().trim().min(2, "يرجى إدخال رمز المنتج."),
  description: z.string().trim().default(""),
  details: z.string().trim().optional().default(""),
  materials_info: z.string().trim().optional().default(""),
  gender_id: z.number().int().positive("يرجى اختيار القسم (رجالي أو نسائي)."),
  category_id: z.number().int().positive().nullable().optional(),
  subcategory_id: z.number().int().positive().nullable().optional(),
  price_iqd: z.number().int().min(0, "السعر بالدينار العراقي غير صالح."),
  discount_price_iqd: z.number().int().min(0).nullable().optional(),
  stock_quantity: z.number().int().min(0).default(0),
  low_stock_threshold: z.number().int().min(1).default(5),
  status: z.enum(["active", "hidden", "draft"]).default("active"),
  is_featured: z.boolean().optional().default(false),
  is_bestseller: z.boolean().optional().default(false),
  is_new_arrival: z.boolean().optional().default(false),
  is_limited_edition: z.boolean().optional().default(false),
  tags: z.string().optional().default(""),
  images: z
    .array(
      z.object({
        url: z.string().min(1),
        alt_text: z.string().optional().default(""),
        is_primary: z.boolean().optional().default(false),
      })
    )
    .optional()
    .default([]),
  attribute_value_ids: z.array(z.number().int().positive()).optional().default([]),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi("products");
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات المنتج غير مكتملة." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    if (
      data.discount_price_iqd !== null &&
      data.discount_price_iqd !== undefined &&
      data.discount_price_iqd >= data.price_iqd
    ) {
      return NextResponse.json(
        { error: "يجب أن يكون السعر بعد الخصم أقل من السعر الأصلي." },
        { status: 400 }
      );
    }

    const existingSku = await queryOne<{ id: number }>(
      `SELECT id FROM products WHERE sku = ?`,
      data.sku
    );
    if (existingSku) {
      return NextResponse.json(
        { error: "رمز المنتج مستخدم مسبقًا، يرجى اختيار رمز آخر." },
        { status: 400 }
      );
    }

    let slug = slugify(data.name);
    const existingSlug = await queryOne<{ id: number }>(
      `SELECT id FROM products WHERE slug = ?`,
      slug
    );
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const productId = await runTransaction(async (tx) => {
      const res = await tx.execute(
        `INSERT INTO products (
          sku, slug, name, description, details, materials_info,
          gender_id, category_id, subcategory_id,
          price_iqd, discount_price_iqd, stock_quantity, low_stock_threshold,
          status, is_featured, is_bestseller, is_new_arrival, is_limited_edition, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        data.sku,
        slug,
        data.name,
        data.description,
        data.details,
        data.materials_info,
        data.gender_id,
        data.category_id ?? null,
        data.subcategory_id ?? null,
        data.price_iqd,
        data.discount_price_iqd ?? null,
        data.stock_quantity,
        data.low_stock_threshold,
        data.status,
        data.is_featured ? 1 : 0,
        data.is_bestseller ? 1 : 0,
        data.is_new_arrival ? 1 : 0,
        data.is_limited_edition ? 1 : 0,
        data.tags
      );
      const id = Number(res.lastInsertRowid);

      for (let idx = 0; idx < data.images.length; idx++) {
        const img = data.images[idx];
        await tx.execute(
          `INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary) VALUES (?, ?, ?, ?, ?)`,
          id,
          img.url,
          img.alt_text || data.name,
          idx,
          idx === 0 || img.is_primary ? 1 : 0
        );
      }

      for (const valId of data.attribute_value_ids) {
        await tx.execute(
          `INSERT OR IGNORE INTO product_attribute_values (product_id, attribute_id, attribute_value_id)
           SELECT ?, attribute_id, id FROM attribute_values WHERE id = ?`,
          id,
          valId
        );
      }

      return id;
    });

    return NextResponse.json(
      { id: productId, message: "تمت إضافة المنتج بنجاح." },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create product error:", err);
    return NextResponse.json(
      { error: "تعذر حفظ المنتج، يرجى المحاولة مجددًا." },
      { status: 500 }
    );
  }
}
