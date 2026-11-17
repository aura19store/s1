import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute, queryOne, runTransaction } from "@/db";
import { requireAdminApi } from "@/lib/auth";

const updateCatSchema = z.object({
  gender_id: z.number().int().positive().optional(),
  parent_id: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().optional(),
  image_url: z.string().trim().optional(),
  is_visible: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi("categories");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const catId = Number(id);
  const existing = await queryOne<{ id: number }>(
    `SELECT id FROM categories WHERE id = ?`,
    catId
  );
  if (!existing) {
    return NextResponse.json({ error: "التصنيف غير موجود." }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = updateCatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات التعديل غير صالحة." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (d.gender_id !== undefined) {
      fields.push("gender_id = ?");
      values.push(d.gender_id);
    }
    if ("parent_id" in d) {
      fields.push("parent_id = ?");
      values.push(d.parent_id ?? null);
    }
    if (d.name !== undefined) {
      fields.push("name = ?");
      values.push(d.name);
    }
    if (d.description !== undefined) {
      fields.push("description = ?");
      values.push(d.description);
    }
    if (d.image_url !== undefined) {
      fields.push("image_url = ?");
      values.push(d.image_url);
    }
    if (d.is_visible !== undefined) {
      fields.push("is_visible = ?");
      values.push(d.is_visible ? 1 : 0);
    }
    if (d.sort_order !== undefined) {
      fields.push("sort_order = ?");
      values.push(d.sort_order);
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      await execute(
        `UPDATE categories SET ${fields.join(", ")} WHERE id = ?`,
        ...values,
        catId
      );
    }

    return NextResponse.json({ message: "تم تحديث التصنيف بنجاح." });
  } catch (err) {
    console.error("Update category error:", err);
    return NextResponse.json(
      { error: "تعذر تحديث التصنيف." },
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
  const auth = await requireAdminApi("categories");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const catId = Number(id);

  // Safe deletion: unlink products cleanly without losing them
  const result = await runTransaction(async (tx) => {
    const linked = await tx.queryOne<{ c: number }>(
      `SELECT COUNT(*) as c FROM products WHERE category_id = ?`,
      catId
    );
    await tx.execute(
      `UPDATE products SET category_id = NULL, updated_at = datetime('now') WHERE category_id = ?`,
      catId
    );
    await tx.execute(
      `UPDATE products SET subcategory_id = NULL WHERE subcategory_id = ?`,
      catId
    );
    const del = await tx.execute(`DELETE FROM categories WHERE id = ?`, catId);
    return {
      changes: Number(del.changes),
      unlinkedProducts: Number(linked?.c ?? 0),
    };
  });

  if (result.changes === 0) {
    return NextResponse.json({ error: "التصنيف غير موجود." }, { status: 404 });
  }

  const msg =
    result.unlinkedProducts > 0
      ? `تم حذف التصنيف بأمان وتم فك ارتباط ${result.unlinkedProducts} منتج دون حذفها.`
      : "تم حذف التصنيف بنجاح.";

  return NextResponse.json({ message: msg });
}
