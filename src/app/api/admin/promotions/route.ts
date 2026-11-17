import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute, queryAll } from "@/db";
import { requireAdminApi } from "@/lib/auth";

export async function GET() {
  const auth = await requireAdminApi("promotions");
  if ("error" in auth) return auth.error;

  const [promotions, genders, categories, products] = await Promise.all([
    queryAll(`
      SELECT pr.*, g.name as gender_name, c.name as category_name
      FROM promotions pr
      LEFT JOIN genders g ON g.id = pr.gender_id
      LEFT JOIN categories c ON c.id = pr.category_id
      ORDER BY pr.id DESC
    `),
    queryAll(`SELECT id, name FROM genders ORDER BY sort_order ASC`),
    queryAll(
      `SELECT id, gender_id, name FROM categories ORDER BY gender_id ASC, sort_order ASC`
    ),
    queryAll(`SELECT id, name, sku, gender_id FROM products ORDER BY id DESC`),
  ]);

  return NextResponse.json({ promotions, genders, categories, products });
}

const promoSchema = z.object({
  name: z.string().trim().min(2, "يرجى إدخال اسم العرض."),
  description: z.string().trim().optional().default(""),
  discount_type: z.enum(["percentage", "fixed"]),
  discount_value: z.number().int().min(1, "يرجى إدخال قيمة خصم صحيحة."),
  scope_type: z.enum(["all", "gender", "category", "products"]).default("all"),
  gender_id: z.number().int().positive().nullable().optional(),
  category_id: z.number().int().positive().nullable().optional(),
  product_ids: z.array(z.number().int().positive()).optional().default([]),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi("promotions");
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const parsed = promoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات العرض غير صالحة." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    if (d.discount_type === "percentage" && d.discount_value > 90) {
      return NextResponse.json(
        { error: "نسبة الخصم لا يمكن أن تتجاوز 90٪." },
        { status: 400 }
      );
    }

    const res = await execute(
      `INSERT INTO promotions (
        name, description, discount_type, discount_value, scope_type,
        gender_id, category_id, product_ids_json, starts_at, ends_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      d.name,
      d.description,
      d.discount_type,
      d.discount_value,
      d.scope_type,
      d.gender_id ?? null,
      d.category_id ?? null,
      JSON.stringify(d.product_ids),
      d.starts_at || null,
      d.ends_at || null,
      d.is_active ? 1 : 0
    );

    return NextResponse.json(
      { id: res.lastInsertRowid, message: "تم إنشاء العرض بنجاح." },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create promotion error:", err);
    return NextResponse.json(
      { error: "تعذر إنشاء العرض." },
      { status: 500 }
    );
  }
}
