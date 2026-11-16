"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X, ArrowLeft, Loader2 } from "lucide-react";
import { useStore } from "./StoreProvider";
import { formatIQD } from "@/lib/format";
import type { StoreProductCard } from "@/lib/store-queries";

export function SearchModal() {
  const router = useRouter();
  const { genderSlug, isSearchOpen, setSearchOpen } = useStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StoreProductCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSuggestion, setIsSuggestion] = useState(true);

  const sectionLabel = genderSlug === "women" ? "القسم النسائي" : "القسم الرجالي";

  useEffect(() => {
    if (!isSearchOpen) {
      setQuery("");
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/store/search?gender=${encodeURIComponent(genderSlug)}&q=${encodeURIComponent(query)}`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.products || []);
          setIsSuggestion(Boolean(data.isSuggestion));
        }
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query, genderSlug, isSearchOpen]);

  if (!isSearchOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearchOpen(false);
    router.push(
      `/store/${genderSlug}/products?q=${encodeURIComponent(query.trim())}`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div
        className="fixed inset-0 bg-[#111111]/60 backdrop-blur-xs"
        onClick={() => setSearchOpen(false)}
      />

      <div className="relative z-10 w-full bg-[#F7F4EF] border-b border-[#D8C8B5] shadow-2xl animate-aura-fade-in">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-[#B79B6C]">
              البحث داخل {sectionLabel}
            </span>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              aria-label="إغلاق البحث"
              className="p-1.5 text-[#111111]/60 hover:text-[#111111]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="relative">
            <Search className="w-5 h-5 text-[#111111]/50 absolute right-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`ابحث عن منتج، تصنيف، خامة أو رمز المنتج في ${sectionLabel}...`}
              className="w-full bg-white border border-[#D8C8B5] pr-12 pl-24 py-3.5 text-sm text-[#111111] placeholder:text-[#111111]/45 focus:outline-none focus:border-[#111111]"
            />
            {query && (
              <button
                type="submit"
                className="absolute left-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-[#111111] text-[#F7F4EF] text-xs font-medium hover:bg-[#111111]/85 transition"
              >
                بحث
              </button>
            )}
          </form>

          <div className="mt-6 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="py-10 flex items-center justify-center gap-2 text-sm text-[#111111]/60">
                <Loader2 className="w-4 h-4 animate-spin text-[#B79B6C]" />
                <span>جاري البحث...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-[#111111]">
                  لم يتم العثور على نتائج مطابقة لـ &quot;{query}&quot; في{" "}
                  {sectionLabel}.
                </p>
                <p className="text-xs text-[#111111]/60 mt-1">
                  جرّب كلمات أخرى مثل اسم الصنف أو اللون أو الخامة.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-[#111111]/65">
                    {isSuggestion
                      ? `مقترحات مميزة في ${sectionLabel}`
                      : `نتائج البحث (${results.length})`}
                  </p>
                  {query.trim() && (
                    <Link
                      href={`/store/${genderSlug}/products?q=${encodeURIComponent(query.trim())}`}
                      onClick={() => setSearchOpen(false)}
                      className="text-xs font-medium text-[#B79B6C] hover:text-[#111111] flex items-center gap-1"
                    >
                      <span>عرض جميع النتائج</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
                  {results.map((prod) => (
                    <Link
                      key={prod.id}
                      href={`/store/${prod.gender_slug}/product/${prod.slug}`}
                      onClick={() => setSearchOpen(false)}
                      className="flex items-center gap-3.5 p-2.5 bg-white border border-[#D8C8B5]/50 hover:border-[#B79B6C] transition group"
                    >
                      <img
                        src={prod.primary_image}
                        alt={prod.name}
                        className="w-16 h-16 object-cover bg-[#EFEAE2] shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-[#B79B6C]">
                          {prod.category_name}
                        </p>
                        <p className="text-sm font-medium text-[#111111] truncate group-hover:text-[#B79B6C] transition">
                          {prod.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-semibold text-[#111111]">
                            {formatIQD(prod.final_price)}
                          </span>
                          {prod.has_discount && (
                            <span className="text-[11px] text-[#111111]/40 line-through">
                              {formatIQD(prod.original_price)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
