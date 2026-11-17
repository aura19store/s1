import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute, queryOne } from "@/db";
import { requireAdminApi } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().optional(),
  discount_type: z.enum(["percentage", "fixed"]).optional(),
  discount_value: z.number().int().min(1).optional(),
  scope_type: z.enum(["all", "gender", "category", "products"]).optional(),
  gender_id: z.number().int().positive().nullable().optional(),
  category_id: z.number().int().positive().nullable().optional(),
  product_ids: z.array(z.number().int().positive()).optional(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi("promotions");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const promoId = Number(id);
  const existing = await queryOne<{ id: number }>(
    `SELECT id FROM promotions WHERE id = ?`,
    promoId
  );
  if (!existing) {
    return NextResponse.json({ error: "العرض غير موجود." }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "بيانات العرض غير صالحة." },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const fields: string[] = [];
  const params: (string | number | null)[] = [];
  const add = (col: string, val: string | number | null | undefined) => {
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      params.push(val);
    }
  };

  add("name", d.name);
  add("description", d.description);
  add("discount_type", d.discount_type);
  add("discount_value", d.discount_value);
  add("scope_type", d.scope_type);
  if ("gender_id" in d) add("gender_id", d.gender_id ?? null);
  if ("category_id" in d) add("category_id", d.category_id ?? null);
  if (d.product_ids !== undefined)
    add("product_ids_json", JSON.stringify(d.product_ids));
  if ("starts_at" in d) add("starts_at", d.starts_at || null);
  if ("ends_at" in d) add("ends_at", d.ends_at || null);
  if (d.is_active !== undefined) add("is_active", d.is_active ? 1 : 0);

  if (fields.length > 0) {
    await execute(
      `UPDATE promotions SET ${fields.join(", ")} WHERE id = ?`,
      ...params,
      promoId
    );
  }

  return NextResponse.json({ message: "تم تحديث العرض بنجاح." });
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
  const auth = await requireAdminApi("promotions");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const res = await execute(`DELETE FROM promotions WHERE id = ?`, Number(id));
  if (res.changes === 0) {
    return NextResponse.json({ error: "العرض غير موجود." }, { status: 404 });
  }
  return NextResponse.json({ message: "تم حذف العرض بنجاح." });
}
