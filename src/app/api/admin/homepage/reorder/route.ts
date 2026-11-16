import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runTransaction } from "@/db";
import { requireAdminApi } from "@/lib/auth";

const reorderSchema = z.object({
  orderedIds: z.array(z.number().int().positive()).min(1),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi("homepage");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "بيانات الترتيب غير صالحة." },
      { status: 400 }
    );
  }

  runTransaction((db) => {
    const stmt = db.prepare(
      `UPDATE homepage_sections SET sort_order = ?, updated_at = datetime('now') WHERE id = ?`
    );
    parsed.data.orderedIds.forEach((id, idx) => stmt.run(idx + 1, id));
  });

  return NextResponse.json({ message: "تم حفظ ترتيب أقسام الصفحة الرئيسية بنجاح." });
}
