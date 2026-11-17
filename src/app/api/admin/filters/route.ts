import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queryAll, queryOne, runTransaction } from "@/db";
import { requireAdminApi } from "@/lib/auth";
import { slugify } from "@/lib/format";

export async function GET() {
  const auth = await requireAdminApi("filters");
  if ("error" in auth) return auth.error;

  const [attrs, values] = await Promise.all([
    queryAll<{
      id: number;
      slug: string;
      name: string;
      type: string;
      sort_order: number;
      is_visible: number;
      is_filterable: number;
    }>(`SELECT * FROM attributes ORDER BY sort_order ASC, id ASC`),
    queryAll<{
      id: number;
      attribute_id: number;
      slug: string;
      value: string;
      color_hex: string;
      sort_order: number;
      usage_count: number;
    }>(`
      SELECT av.*,
             (SELECT COUNT(*) FROM product_attribute_values pav WHERE pav.attribute_value_id = av.id) as usage_count
      FROM attribute_values av
      ORDER BY av.sort_order ASC, av.id ASC
    `),
  ]);

  return NextResponse.json({
    filters: attrs.map((a) => ({
      ...a,
      values: values
        .filter((v) => Number(v.attribute_id) === Number(a.id))
        .map((v) => ({ ...v, usage_count: Number(v.usage_count || 0) })),
    })),
  });
}

const filterCreateSchema = z.object({
  name: z.string().trim().min(2, "يرجى إدخال اسم الفلتر."),
  type: z.enum(["color", "select", "size", "text"]).default("select"),
  is_visible: z.boolean().optional().default(true),
  values: z
    .array(
      z.object({
        value: z.string().trim().min(1),
        color_hex: z.string().optional().default(""),
      })
    )
    .optional()
    .default([]),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi("filters");
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const parsed = filterCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات الفلتر غير صالحة." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    let slug = slugify(d.name);
    const dup = await queryOne<{ id: number }>(
      `SELECT id FROM attributes WHERE slug = ?`,
      slug
    );
    if (dup) slug = `${slug}-${Date.now().toString().slice(-3)}`;

    const maxOrder = await queryOne<{ m: number }>(
      `SELECT COALESCE(MAX(sort_order), 0) as m FROM attributes`
    );

    const id = await runTransaction(async (tx) => {
      const res = await tx.execute(
        `INSERT INTO attributes (slug, name, type, sort_order, is_visible, is_filterable)
         VALUES (?, ?, ?, ?, ?, 1)`,
        slug,
        d.name,
        d.type,
        Number(maxOrder?.m || 0) + 1,
        d.is_visible ? 1 : 0
      );
      const attrId = Number(res.lastInsertRowid);

      for (let idx = 0; idx < d.values.length; idx++) {
        const v = d.values[idx];
        await tx.execute(
          `INSERT OR IGNORE INTO attribute_values (attribute_id, slug, value, color_hex, sort_order)
           VALUES (?, ?, ?, ?, ?)`,
          attrId,
          `${slugify(v.value)}-${idx + 1}`,
          v.value,
          v.color_hex || "",
          idx + 1
        );
      }
      return attrId;
    });

    return NextResponse.json(
      { id, message: "تمت إضافة الفلتر وخياراته بنجاح." },
      { status: 201 }
    );
  } catch (err) {
    console.error("Filter create error:", err);
    return NextResponse.json(
      { error: "تعذر إنشاء الفلتر." },
      { status: 500 }
    );
  }
}
