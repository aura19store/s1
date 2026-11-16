import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runTransaction } from "@/db";
import { requireAdminApi } from "@/lib/auth";

const schema = z.object({
  orderedIds: z.array(z.number().int().positive()).min(1),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi("filters");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات الترتيب غير صالحة." }, { status: 400 });
  }

  runTransaction((db) => {
    const stmt = db.prepare(`UPDATE attributes SET sort_order = ? WHERE id = ?`);
    parsed.data.orderedIds.forEach((id, idx) => stmt.run(idx + 1, id));
  });

  return NextResponse.json({ message: "تم حفظ ترتيب الفلاتر بنجاح." });
}
