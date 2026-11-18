import { NextRequest, NextResponse } from "next/server";
import { execute, getDatabaseDriver, queryAll, queryOne, runTransaction } from "@/db";
import { deleteMediaWithJournal } from "@/lib/media-deletion";
import { requireAdminApi } from "@/lib/auth";
import {
  ensureSupabaseMediaAbsent,
  deleteMediaObjectFromSupabaseStorage,
  extractSupabaseStoragePath,
  MediaStorageError,
  getSupabaseStorageConfigurationStatus,
  getSupabaseStorageBucket,
  isCloudflareStorageRuntime,
  isSupabaseStorageConfigured,
  uploadMediaToSupabaseStorage,
} from "@/lib/supabase";

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
  const where = category && category !== "all" ? "WHERE m.category = ?" : "";
  const params = category && category !== "all" ? [category] : [];

  let items;
  try {
    items = await queryAll(
      `SELECT m.*, COALESCE(j.state, '') AS deletion_state FROM media m
       LEFT JOIN media_deletion_jobs j ON j.id = m.id ${where} ORDER BY m.id DESC`,
      ...params
    );
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    const message = error instanceof Error ? error.message : "";
    if (code !== "42P01" && !message.includes("no such table: media_deletion_jobs")) throw error;
    // The additive migration is a deployment prerequisite for deletion, not listing.
    items = await queryAll(`SELECT m.* FROM media m ${where} ORDER BY m.id DESC`, ...params);
  }

  return NextResponse.json({
    items,
    storageProvider: isSupabaseStorageConfigured() && getSupabaseStorageBucket() === "aura-media"
      ? "supabase"
      : "unconfigured",
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi("media");
  if ("error" in auth) return auth.error;

  let stage: "form_data" | "file_read" | "unexpected" = "form_data";
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const category = String(formData.get("category") || "products").replace(
      /[^a-zA-Z0-9_-]/g,
      ""
    ) || "products";
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

    if (file.size === 0) {
      return NextResponse.json({ error: "ملف الصورة فارغ." }, { status: 400 });
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

    stage = "file_read";
    const buffer = new Uint8Array(await file.arrayBuffer());
    stage = "unexpected";
    const objectPath = `${category}/${safeName}`;
    // Uploads use Supabase only; never fall back to the local filesystem.
    const bucketMatches = getSupabaseStorageBucket() === "aura-media";
    if (!isSupabaseStorageConfigured() || !bucketMatches) {
      console.error("Media upload unavailable", {
        stage: "configuration",
        runtime: isCloudflareStorageRuntime() ? "cloudflare" : "node",
        ...getSupabaseStorageConfigurationStatus(),
        bucketMatches,
      });
      return NextResponse.json({ error: "تخزين الصور غير مهيأ على الخادم." }, { status: 503 });
    }

    let url: string;
    console.info("Media upload", { stage: "storage_start", runtime: isCloudflareStorageRuntime() ? "cloudflare" : "node" });
    try {
      const uploaded = await uploadMediaToSupabaseStorage(buffer, objectPath, file.type);
      url = uploaded.publicUrl;
      console.info("Media upload", { stage: "storage_uploaded" });
    } catch (err) {
      const category = err instanceof MediaStorageError ? err.category : "transport_or_unknown";
      const status = err instanceof MediaStorageError ? err.status : undefined;
      console.error("Media upload failed", { stage: "storage", category, status });
      return NextResponse.json({ error: "تعذر رفع الصورة إلى التخزين، يرجى التحقق من إعدادات التخزين." }, { status: 502 });
    }
    if (extractSupabaseStoragePath(url) !== objectPath) {
      console.error("Media upload failed", { stage: "public_url", category: "invalid_url" });
      try {
        if (!(await deleteMediaObjectFromSupabaseStorage(objectPath))) {
          console.error("Media upload cleanup failed", { stage: "storage" });
        }
      } catch {
        console.error("Media upload cleanup failed", { stage: "storage" });
      }
      return NextResponse.json({ error: "تعذر إنشاء رابط صالح للصورة." }, { status: 502 });
    }

    let res;
    try {
      res = await execute(
        `INSERT INTO media (filename, url, category, alt_text, mime_type, size_bytes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        safeName,
        url,
        category,
        altText || file.name,
        file.type,
        file.size
      );
    } catch (err) {
      const knownDbCodes = new Set(["23505", "23503", "23502", "42P01", "42703", "42501", "08001", "08006", "57014", "SQLITE_CONSTRAINT", "SQLITE_ERROR"]);
      const rawCode = err && typeof err === "object" && "code" in err ? err.code : undefined;
      const code = typeof rawCode === "string" && knownDbCodes.has(rawCode) ? rawCode : "unknown";
      // A connection failure after INSERT may leave its commit outcome unknown.
      // Only remove the object when a fresh read confirms no record exists.
      try {
        const existing = await queryOne<{ id: number }>(`SELECT id FROM media WHERE url = ?`, url);
        if (!existing && !(await deleteMediaObjectFromSupabaseStorage(objectPath))) {
          console.error("Media upload cleanup failed at storage stage.");
        }
      } catch {
        console.error("Media upload cleanup could not verify the database or remove the file.");
      }
      console.error("Media upload failed", { stage: "database", code });
      return NextResponse.json({ error: "تعذر حفظ سجل الصورة، يرجى المحاولة مجددًا." }, { status: 500 });
    }

    console.info("Media upload", { stage: "media_record_created", storage: "supabase" });
    return NextResponse.json(
      {
        id: res.lastInsertRowid,
        url,
        filename: safeName,
        category,
        storageProvider: "supabase",
        message: "تم رفع الصورة بنجاح.",
      },
      { status: 201 }
    );
  } catch {
    console.error("Media upload failed", { stage });
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
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "معرّف الصورة غير صالح." }, { status: 400 });
  try {
    const result = await deleteMediaWithJournal(id, runTransaction, getDatabaseDriver(), async (url) => {
      if (url.startsWith("http://") || url.startsWith("https://")) {
        await ensureSupabaseMediaAbsent(url);
      } else if (url.startsWith("/images/")) {
        // Core packaged images are not owned by the media library.
      } else if (url.startsWith("/uploads/") && !isCloudflareStorageRuntime() && process.env.NODE_ENV !== "production") {
        const [{ default: fs }, { default: path }] = await Promise.all([import("node:fs/promises"), import("node:path")]);
        const base = path.resolve(process.cwd(), "public", "uploads");
        const file = path.resolve(base, url.slice("/uploads/".length));
        if (!file.startsWith(base + path.sep)) throw new Error("Invalid media path");
        try { await fs.unlink(file); } catch (error) {
          if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
        }
      } else {
        throw new Error("Unsupported media location");
      }
    });
    if (result === "not_found") return NextResponse.json({ error: "الصورة غير موجودة." }, { status: 404 });
    return NextResponse.json({ message: "تم حذف الصورة من المكتبة بنجاح." });
  } catch {
    // The committed journal retains the URL even when the outcome is ambiguous.
    return NextResponse.json({ error: "تعذر تأكيد حذف الصورة. أعد المحاولة للتحقق وإكمال العملية بأمان.", retryable: true }, { status: 503 });
  }
}
