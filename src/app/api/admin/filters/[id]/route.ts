import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute, queryOne, runTransaction } from "@/db";
import { requireAdminApi } from "@/lib/auth";
import { slugify } from "@/lib/format";

const updateFilterSchema = z.object({
  name: z.string().trim().min(2).optional(),
  type: z.enum(["color", "select", "size", "text"]).optional(),
  is_visible: z.boolean().optional(),
  values: z
    .array(
      z.object({
        id: z.number().int().positive().optional(),
        value: z.string().trim().min(1),
        color_hex: z.string().optional().default(""),
      })
    )
    .optional(),
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi("filters");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const attrId = Number(id);
  const existing = queryOne<{ id: number }>(
    `SELECT id FROM attributes WHERE id = ?`,
    attrId
  );
  if (!existing) {
    return NextResponse.json({ error: "الفلتر غير موجود." }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = updateFilterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات التحديث غير صالحة." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    runTransaction((db) => {
      const fields: string[] = [];
      const params: (string | number)[] = [];
      if (d.name !== undefined) {
        fields.push("name = ?");
        params.push(d.name);
      }
      if (d.type !== undefined) {
        fields.push("type = ?");
        params.push(d.type);
      }
      if (d.is_visible !== undefined) {
        fields.push("is_visible = ?");
        params.push(d.is_visible ? 1 : 0);
      }
      if (fields.length > 0) {
        db.prepare(`UPDATE attributes SET ${fields.join(", ")} WHERE id = ?`).run(
          ...params,
          attrId
        );
      }

      if (d.values !== undefined) {
        const keepIds: number[] = [];
        for (let idx = 0; idx < d.values.length; idx++) {
          const item = d.values[idx];
          if (item.id) {
            db.prepare(
              `UPDATE attribute_values SET value = ?, color_hex = ?, sort_order = ? WHERE id = ? AND attribute_id = ?`
            ).run(item.value, item.color_hex || "", idx + 1, item.id, attrId);
            keepIds.push(item.id);
          } else {
            const valSlug = `${slugify(item.value)}-${Date.now().toString().slice(-3)}-${idx}`;
            const ins = db
              .prepare(
                `INSERT INTO attribute_values (attribute_id, slug, value, color_hex, sort_order) VALUES (?, ?, ?, ?, ?)`
              )
              .run(attrId, valSlug, item.value, item.color_hex || "", idx + 1);
            keepIds.push(Number(ins.lastInsertRowid));
          }
        }
        if (keepIds.length > 0) {
          const placeholders = keepIds.map(() => "?").join(",");
          db.prepare(
            `DELETE FROM attribute_values WHERE attribute_id = ? AND id NOT IN (${placeholders})`
          ).run(attrId, ...keepIds);
        } else {
          db.prepare(`DELETE FROM attribute_values WHERE attribute_id = ?`).run(
            attrId
          );
        }
      }
    });

    return NextResponse.json({ message: "تم تحديث الفلتر بنجاح." });
  } catch (err) {
    console.error("Update filter error:", err);
    return NextResponse.json(
      { error: "تعذر تحديث الفلتر." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi("filters");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const res = execute(`DELETE FROM attributes WHERE id = ?`, Number(id));
  if (res.changes === 0) {
    return NextResponse.json({ error: "الفلتر غير موجود." }, { status: 404 });
  }
  return NextResponse.json({ message: "تم حذف الفلتر بنجاح." });
}
