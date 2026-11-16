"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Upload, Trash2, Copy, Check, Loader2 } from "lucide-react";
import { MEDIA_CATEGORY_LABELS } from "@/lib/constants";
import { ConfirmModal } from "@/components/admin/ConfirmModal";

interface MediaRow {
  id: number;
  filename: string;
  url: string;
  category: string;
  alt_text: string;
  created_at: string;
}

export default function AdminMediaPage() {
  const [items, setItems] = useState<MediaRow[]>([]);
  const [activeCat, setActiveCat] = useState("all");
  const [uploadCat, setUploadCat] = useState("products");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MediaRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3200);
  };

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/media?category=${encodeURIComponent(activeCat)}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } finally {
      setLoading(false);
    }
  }, [activeCat]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", uploadCat);
    const res = await fetch("/api/admin/media", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    e.target.value = "";
    if (res.ok) {
      flash(data.message || "تم رفع الصورة بنجاح.");
      loadMedia();
    } else {
      flash(data.error || "تعذر رفع الصورة.");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/media?id=${deleteTarget.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    setDeleteTarget(null);
    if (res.ok) {
      flash("تم حذف الصورة من مكتبة الوسائط.");
      loadMedia();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-3xl text-[#111111]">
            مكتبة الوسائط
          </h1>
          <p className="text-xs text-[#111111]/60 mt-1">
            رفع وإدارة جميع صور المتجر واستخدامها في المنتجات والتصنيفات والبانرات
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={uploadCat}
            onChange={(e) => setUploadCat(e.target.value)}
            className="bg-white border border-[#D8C8B5] px-3 py-2.5 text-xs"
          >
            {Object.entries(MEDIA_CATEGORY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                رفع إلى: {label}
              </option>
            ))}
          </select>

          <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-[#111111] text-[#F7F4EF] text-xs font-semibold hover:bg-[#B79B6C] hover:text-[#111111] transition">
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>{uploading ? "جاري الرفع..." : "رفع صورة"}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
          <Check className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: "الكل" },
          ...Object.entries(MEDIA_CATEGORY_LABELS).map(([key, label]) => ({
            key,
            label,
          })),
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveCat(t.key)}
            className={`px-4 py-2 text-xs font-semibold border transition ${
              activeCat === t.key
                ? "bg-[#111111] text-[#F7F4EF] border-[#111111]"
                : "bg-white text-[#111111]/75 border-[#D8C8B5] hover:border-[#111111]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center gap-2 text-sm text-[#111111]/60">
          <Loader2 className="w-5 h-5 animate-spin text-[#B79B6C]" />
          <span>جاري تحميل المكتبة...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-[#D8C8B5] p-14 text-center text-sm text-[#111111]/60">
          لا توجد صور في هذا التصنيف.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-[#D8C8B5]/80 overflow-hidden flex flex-col"
            >
              <div className="aspect-square bg-[#EFEAE2] overflow-hidden">
                <img
                  src={item.url}
                  alt={item.alt_text || item.filename}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-2.5 space-y-2 flex-1 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-medium text-[#111111] truncate">
                    {item.alt_text || item.filename}
                  </p>
                  <span className="text-[10px] text-[#B79B6C]">
                    {MEDIA_CATEGORY_LABELS[item.category] || item.category}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1 pt-1 border-t border-[#D8C8B5]/40">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(item.url);
                      flash("تم نسخ رابط الصورة.");
                    }}
                    className="flex-1 py-1 text-[11px] bg-[#F7F4EF] hover:bg-[#EFEAE2] flex items-center justify-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>نسخ الرابط</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    title="حذف الصورة"
                    className="p-1.5 text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="تأكيد حذف الصورة"
        message={`هل تريد حذف الصورة "${deleteTarget?.alt_text || deleteTarget?.filename || ""}" من مكتبة الوسائط؟`}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
