import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute, queryAll } from "@/db";
import { requireAdminApi } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi("homepage");
  if ("error" in auth) return auth.error;

  const genderSlug = request.nextUrl.searchParams.get("gender") || "men";
  const [sections, genders] = await Promise.all([
    queryAll(
      `SELECT * FROM homepage_sections WHERE gender_slug = ? ORDER BY sort_order ASC, id ASC`,
      genderSlug
    ),
    queryAll(`SELECT * FROM genders ORDER BY sort_order ASC, id ASC`),
  ]);

  return NextResponse.json({ sections, genders });
}

const updateSectionSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  cta_text: z.string().optional(),
  cta_link: z.string().optional(),
  image_url: z.string().optional(),
  secondary_title: z.string().optional(),
  secondary_subtitle: z.string().optional(),
  secondary_cta_text: z.string().optional(),
  secondary_cta_link: z.string().optional(),
  secondary_image_url: z.string().optional(),
  is_visible: z.boolean().optional(),
});

export async function PUT(request: NextRequest) {
  const auth = await requireAdminApi("homepage");
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();

    // Optional update of entry gender cards
    if (body.target === "gender_entry") {
      const { id, entry_title, entry_subtitle, entry_image } = body;
      await execute(
        `UPDATE genders SET entry_title = ?, entry_subtitle = ?, entry_image = ? WHERE id = ?`,
        String(entry_title || ""),
        String(entry_subtitle || ""),
        String(entry_image || ""),
        Number(id)
      );
      return NextResponse.json({ message: "تم تحديث واجهة الدخول بنجاح." });
    }

    const parsed = updateSectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "بيانات القسم غير صالحة." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const fields: string[] = [];
    const params: (string | number)[] = [];

    const add = (col: string, val: string | number | undefined) => {
      if (val !== undefined) {
        fields.push(`${col} = ?`);
        params.push(val);
      }
    };

    add("title", d.title);
    add("subtitle", d.subtitle);
    add("description", d.description);
    add("cta_text", d.cta_text);
    add("cta_link", d.cta_link);
    add("image_url", d.image_url);
    add("secondary_title", d.secondary_title);
    add("secondary_subtitle", d.secondary_subtitle);
    add("secondary_cta_text", d.secondary_cta_text);
    add("secondary_cta_link", d.secondary_cta_link);
    add("secondary_image_url", d.secondary_image_url);
    if (d.is_visible !== undefined) add("is_visible", d.is_visible ? 1 : 0);

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      await execute(
        `UPDATE homepage_sections SET ${fields.join(", ")} WHERE id = ?`,
        ...params,
        d.id
      );
    }

    return NextResponse.json({ message: "تم حفظ تعديلات القسم بنجاح." });
  } catch (err) {
    console.error("Homepage update error:", err);
    return NextResponse.json(
      { error: "تعذر حفظ تعديلات الصفحة الرئيسية." },
      { status: 500 }
    );
  }
}
