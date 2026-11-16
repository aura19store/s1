import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { execute, queryAll, queryOne } from "@/db";
import { requireAdminApi } from "@/lib/auth";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const category = request.nextUrl.searchParams.get("category");
  const where = category && category !== "all" ? "WHERE category = ?" : "";
  const params = category && category !== "all" ? [category] : [];

  const items = queryAll(
    `SELECT * FROM media ${where} ORDER BY id DESC`,
    ...params
  );

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi("media");
  if ("error" in auth) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const category = String(formData.get("category") || "products");
    const altText = String(formData.get("alt_text") || "");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "يرجى اختيار صورة لرفعها." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "صيغة الملف غير مدعومة. الصيغ المسموحة: JPG، PNG، WEBP." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "حجم الصورة يتجاوز الحد المسموح (5 ميجابايت)." },
        { status: 400 }
      );
    }

    const ext =
      file.type === "image/png"
        ? ".png"
        : file.type === "image/webp"
        ? ".webp"
        : ".jpg";
    const safeName = `aura-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(uploadDir, safeName), buffer);

    const url = `/uploads/${safeName}`;
    const res = execute(
      `INSERT INTO media (filename, url, category, alt_text, mime_type, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      safeName,
      url,
      category,
      altText || file.name,
      file.type,
      file.size
    );

    return NextResponse.json(
      {
        id: res.lastInsertRowid,
        url,
        filename: safeName,
        category,
        message: "تم رفع الصورة بنجاح.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Media upload error:", err);
    return NextResponse.json(
      { error: "حدث خطأ أثناء رفع الصورة." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminApi("media");
  if ("error" in auth) return auth.error;

  const id = Number(request.nextUrl.searchParams.get("id"));
  const item = queryOne<{ id: number; url: string }>(
    `SELECT id, url FROM media WHERE id = ?`,
    id
  );
  if (!item) {
    return NextResponse.json({ error: "الصورة غير موجودة." }, { status: 404 });
  }

  execute(`DELETE FROM media WHERE id = ?`, id);

  // Only delete uploaded files from /uploads (keep core /images safe)
  if (item.url.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), "public", item.url);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore fs error
      }
    }
  }

  return NextResponse.json({ message: "تم حذف الصورة من المكتبة بنجاح." });
}
