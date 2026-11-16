"use client";

import React, { useEffect, useState } from "react";
import { X, Upload, Check, Loader2 } from "lucide-react";
import { MEDIA_CATEGORY_LABELS } from "@/lib/constants";

interface MediaRow {
  id: number;
  filename: string;
  url: string;
  category: string;
  alt_text: string;
}

export function MediaPickerModal({
  open,
  defaultCategory = "products",
  onSelect,
  onClose,
}: {
  open: boolean;
  defaultCategory?: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<MediaRow[]>([]);
  const [category, setCategory] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const fetchMedia = async (cat = category) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/media?category=${encodeURIComponent(cat)}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchMedia("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", defaultCategory);
    try {
      const res = await fetch("/api/admin/media", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "تعذر رفع الصورة.");
      } else {
        await fetchMedia(category);
        onSelect(data.url);
      }
    } catch {
      setError("حدث خطأ أثناء رفع الملف.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-[#111111]/65 backdrop-blur-xs"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-4xl max-h-[86vh] bg-[#F7F4EF] border border-[#D8C8B5] shadow-2xl flex flex-col">
        <div className="px-6 py-4 bg-white border-b border-[#D8C8B5] flex items-center justify-between gap-4">
          <h3 className="text-base font-bold text-[#111111]">
            اختيار صورة من مكتبة الوسائط
          </h3>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer px-4 py-2 bg-[#111111] text-[#F7F4EF] text-xs font-semibold hover:bg-[#B79B6C] hover:text-[#111111] transition flex items-center gap-2">
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>{uploading ? "جاري الرفع..." : "رفع صورة جديدة"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleUpload}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="p-1.5 text-[#111111]/60 hover:text-[#111111]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-6 py-3 bg-[#EFEAE2] border-b border-[#D8C8B5]/60 flex flex-wrap gap-2">
          {[
            { key: "all", label: "الكل" },
            ...Object.entries(MEDIA_CATEGORY_LABELS).map(([key, label]) => ({
              key,
              label,
            })),
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setCategory(tab.key);
                fetchMedia(tab.key);
              }}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                category === tab.key
                  ? "bg-[#111111] text-[#F7F4EF]"
                  : "bg-white text-[#111111]/75 border border-[#D8C8B5]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-sm text-[#111111]/60">
              <Loader2 className="w-5 h-5 animate-spin text-[#B79B6C]" />
              <span>جاري تحميل الوسائط...</span>
            </div>
          ) : items.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#111111]/60">
              لا توجد صور في هذا التصنيف حاليًا.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelect(item.url);
                    onClose();
                  }}
                  className="group relative aspect-square bg-white border border-[#D8C8B5] overflow-hidden hover:border-[#111111] text-right"
                >
                  <img
                    src={item.url}
                    alt={item.alt_text || item.filename}
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 px-2.5 py-1 bg-[#F7F4EF] text-[#111111] text-[11px] font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-[#B79B6C]" />
                      اختيار
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
