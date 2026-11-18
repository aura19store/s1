import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute, queryAll, queryOne } from "@/db";
import { requireAdminApi } from "@/lib/auth";
import { slugify } from "@/lib/format";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi("categories");
  if ("error" in auth) return auth.error;

  const genderId = request.nextUrl.searchParams.get("genderId");
  const where = genderId ? "WHERE c.gender_id = ?" : "";
  const params = genderId ? [Number(genderId)] : [];

  const [categories, genders] = await Promise.all([
    queryAll(
      `SELECT c.*, g.name as gender_name, g.slug as gender_slug,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as product_count
       FROM categories c
       JOIN genders g ON g.id = c.gender_id
       ${where}
       ORDER BY c.gender_id ASC, c.sort_order ASC, c.id ASC`,
      ...params
    ),
    queryAll(`SELECT id, slug, name FROM genders ORDER BY sort_order ASC`),
  ]);

  return NextResponse.json({ categories, genders });
}

const createCategorySchema = z.object({
  gender_id: z.number().int().positive("يرجى اختيار القسم."),
  parent_id: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(2, "يرجى إدخال اسم التصنيف."),
  description: z.string().trim().optional().default(""),
  image_url: z.string().trim().optional().default("/images/brand-story.jpg"),
  is_visible: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi("categories");
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات التصنيف غير صالحة." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    let slug = slugify(d.name);
    const dup = await queryOne<{ id: number }>(
      `SELECT id FROM categories WHERE gender_id = ? AND slug = ?`,
      d.gender_id,
      slug
    );
    if (dup) {
      slug = `${slug}-${Date.now().toString().slice(-3)}`;
    }

    const maxOrder = await queryOne<{ m: number }>(
      `SELECT COALESCE(MAX(sort_order), 0) as m FROM categories WHERE gender_id = ?`,
      d.gender_id
    );

    const res = await execute(
      `INSERT INTO categories (gender_id, parent_id, slug, name, description, image_url, sort_order, is_visible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      d.gender_id,
      d.parent_id ?? null,
      slug,
      d.name,
      d.description,
      d.image_url || "/images/brand-story.jpg",
      Number(maxOrder?.m || 0) + 1,
      d.is_visible ? 1 : 0
    );

    return NextResponse.json(
      {
        id: res.lastInsertRowid,
        category: {
          id: res.lastInsertRowid,
          gender_id: d.gender_id,
          name: d.name,
          slug,
          description: d.description,
          image_url: d.image_url || "/images/brand-story.jpg",
          sort_order: Number(maxOrder?.m || 0) + 1,
          is_visible: d.is_visible ? 1 : 0,
          product_count: 0,
        },
        message: "تم إنشاء التصنيف بنجاح.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create category error:", err);
    return NextResponse.json(
      { error: "تعذر إنشاء التصنيف." },
      { status: 500 }
    );
  }
}
