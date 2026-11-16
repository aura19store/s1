"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Loader2,
} from "lucide-react";
import { ProductCard } from "./ProductCard";
import { PRICE_RANGES, SORT_OPTIONS } from "@/lib/constants";
import { formatIQD } from "@/lib/format";
import type {
  CategoryItem,
  DynamicFilterGroup,
  StoreProductCard,
} from "@/lib/store-queries";

interface InitialExplorerData {
  products: StoreProductCard[];
  total: number;
  page: number;
  totalPages: number;
  filters: {
    categories: CategoryItem[];
    attributes: DynamicFilterGroup[];
    collections: { slug: string; label: string; count: number }[];
    availability: { inStock: number; outOfStock: number };
  };
}

export function ProductsExplorer({
  genderSlug,
  genderName,
  lockedCategorySlug,
  pageTitle,
  pageDescription,
  initialData,
}: {
  genderSlug: string;
  genderName: string;
  lockedCategorySlug?: string;
  pageTitle: string;
  pageDescription?: string;
  initialData: InitialExplorerData;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<InitialExplorerData>(initialData);
  const [loading, setLoading] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Filter states synced with URL search params
  const [selectedCategory, setSelectedCategory] = useState(
    lockedCategorySlug || searchParams.get("category") || ""
  );
  const [selectedCollection, setSelectedCollection] = useState(
    searchParams.get("collection") || ""
  );
  const [selectedAvailability, setSelectedAvailability] = useState(
    searchParams.get("availability") || ""
  );
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [sort, setSort] = useState(searchParams.get("sort") || "featured");
  const [page, setPage] = useState(Number(searchParams.get("page") || "1"));
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string[]>>(
    () => {
      const obj: Record<string, string[]> = {};
      for (const [k, v] of searchParams.entries()) {
        if (k.startsWith("attr_") && v) {
          obj[k.slice(5)] = v.split(",").filter(Boolean);
        }
      }
      return obj;
    }
  );

  // Sync if navigation changes gender or URL params externally
  useEffect(() => {
    setData(initialData);
    setSelectedCategory(lockedCategorySlug || searchParams.get("category") || "");
    setSelectedCollection(searchParams.get("collection") || "");
    setSearchQuery(searchParams.get("q") || "");
    setSort(searchParams.get("sort") || "featured");
    setPage(Number(searchParams.get("page") || "1"));
  }, [genderSlug, lockedCategorySlug, initialData, searchParams]);

  const fetchFiltered = useCallback(
    async (overrides?: {
      category?: string;
      collection?: string;
      availability?: string;
      minPrice?: string;
      maxPrice?: string;
      q?: string;
      sort?: string;
      page?: number;
      attrs?: Record<string, string[]>;
    }) => {
      const cat =
        lockedCategorySlug ?? overrides?.category ?? selectedCategory;
      const col = overrides?.collection ?? selectedCollection;
      const avail = overrides?.availability ?? selectedAvailability;
      const minP = overrides?.minPrice ?? minPrice;
      const maxP = overrides?.maxPrice ?? maxPrice;
      const q = overrides?.q ?? searchQuery;
      const s = overrides?.sort ?? sort;
      const pg = overrides?.page ?? 1;
      const attrs = overrides?.attrs ?? selectedAttrs;

      const sp = new URLSearchParams();
      sp.set("gender", genderSlug);
      if (cat) sp.set("category", cat);
      if (col) sp.set("collection", col);
      if (avail) sp.set("availability", avail);
      if (minP) sp.set("minPrice", minP);
      if (maxP) sp.set("maxPrice", maxP);
      if (q.trim()) sp.set("q", q.trim());
      if (s && s !== "featured") sp.set("sort", s);
      if (pg > 1) sp.set("page", String(pg));

      for (const [slug, vals] of Object.entries(attrs)) {
        if (vals.length > 0) sp.set(`attr_${slug}`, vals.join(","));
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/store/products?${sp.toString()}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const json = await res.json();
          setData({
            products: json.products,
            total: json.total,
            page: json.page,
            totalPages: json.totalPages,
            filters: json.filters,
          });
          setPage(json.page);
        }
      } finally {
        setLoading(false);
      }

      // Reflect clean URL without gender query param
      const urlSp = new URLSearchParams(sp);
      urlSp.delete("gender");
      if (lockedCategorySlug) urlSp.delete("category");
      const basePath = lockedCategorySlug
        ? `/store/${genderSlug}/category/${lockedCategorySlug}`
        : `/store/${genderSlug}/products`;
      const qs = urlSp.toString();
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    },
    [
      genderSlug,
      lockedCategorySlug,
      selectedCategory,
      selectedCollection,
      selectedAvailability,
      minPrice,
      maxPrice,
      searchQuery,
      sort,
      selectedAttrs,
      router,
    ]
  );

  const toggleAttribute = (attrSlug: string, valSlug: string) => {
    const current = selectedAttrs[attrSlug] || [];
    const nextVals = current.includes(valSlug)
      ? current.filter((v) => v !== valSlug)
      : [...current, valSlug];
    const nextAttrs = { ...selectedAttrs, [attrSlug]: nextVals };
    if (nextVals.length === 0) delete nextAttrs[attrSlug];
    setSelectedAttrs(nextAttrs);
    fetchFiltered({ attrs: nextAttrs, page: 1 });
  };

  const applyPricePreset = (min: number, max: number) => {
    const nextMin = String(min);
    const nextMax = max >= 99999999 ? "" : String(max);
    if (minPrice === nextMin && maxPrice === nextMax) {
      setMinPrice("");
      setMaxPrice("");
      fetchFiltered({ minPrice: "", maxPrice: "", page: 1 });
    } else {
      setMinPrice(nextMin);
      setMaxPrice(nextMax);
      fetchFiltered({ minPrice: nextMin, maxPrice: nextMax, page: 1 });
    }
  };

  const clearAllFilters = () => {
    setSelectedCategory(lockedCategorySlug || "");
    setSelectedCollection("");
    setSelectedAvailability("");
    setMinPrice("");
    setMaxPrice("");
    setSearchQuery("");
    setSort("featured");
    setSelectedAttrs({});
    fetchFiltered({
      category: lockedCategorySlug || "",
      collection: "",
      availability: "",
      minPrice: "",
      maxPrice: "",
      q: "",
      sort: "featured",
      attrs: {},
      page: 1,
    });
  };

  const activeFilterCount =
    (!lockedCategorySlug && selectedCategory ? 1 : 0) +
    (selectedCollection ? 1 : 0) +
    (selectedAvailability ? 1 : 0) +
    (minPrice || maxPrice ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0) +
    Object.values(selectedAttrs).reduce((acc, arr) => acc + arr.length, 0);

  const renderFiltersBody = () => (
    <div className="space-y-7">
      {/* Quick Search within current section */}
      <div>
        <label className="block text-xs font-semibold text-[#111111] mb-2.5">
          البحث داخل {genderName}
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchFiltered({ q: searchQuery, page: 1 });
          }}
          className="relative"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالاسم أو الرمز..."
            className="w-full bg-white border border-[#D8C8B5] pr-3 pl-9 py-2 text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
          />
          <button
            type="submit"
            aria-label="بحث"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#111111]/60 hover:text-[#111111]"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Category Filter (only if not locked to single category) */}
      {!lockedCategorySlug && data.filters.categories.length > 0 && (
        <div className="border-t border-[#D8C8B5]/60 pt-5">
          <h3 className="text-xs font-semibold text-[#111111] mb-3">التصنيف</h3>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("");
                fetchFiltered({ category: "", page: 1 });
              }}
              className={`w-full flex items-center justify-between text-xs py-1 transition ${
                selectedCategory === ""
                  ? "font-bold text-[#111111]"
                  : "text-[#111111]/70 hover:text-[#111111]"
              }`}
            >
              <span>جميع التصنيفات</span>
            </button>
            {data.filters.categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  const next = selectedCategory === cat.slug ? "" : cat.slug;
                  setSelectedCategory(next);
                  fetchFiltered({ category: next, page: 1 });
                }}
                className={`w-full flex items-center justify-between text-xs py-1 transition ${
                  selectedCategory === cat.slug
                    ? "font-bold text-[#B79B6C]"
                    : "text-[#111111]/75 hover:text-[#111111]"
                }`}
              >
                <span>{cat.name}</span>
                <span className="text-[11px] text-[#111111]/45">
                  ({cat.product_count})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Price Filter in IQD */}
      <div className="border-t border-[#D8C8B5]/60 pt-5">
        <h3 className="text-xs font-semibold text-[#111111] mb-3">
          السعر (د.ع)
        </h3>
        <div className="space-y-2 mb-3">
          {PRICE_RANGES.map((range) => {
            const isSelected =
              minPrice === String(range.min) &&
              maxPrice === (range.max >= 99999999 ? "" : String(range.max));
            return (
              <button
                key={range.id}
                type="button"
                onClick={() => applyPricePreset(range.min, range.max)}
                className={`w-full text-right text-xs py-1.5 px-2.5 border transition ${
                  isSelected
                    ? "bg-[#111111] text-[#F7F4EF] border-[#111111]"
                    : "bg-white text-[#111111]/80 border-[#D8C8B5]/60 hover:border-[#111111]"
                }`}
              >
                {range.label}
              </button>
            );
          })}
        </div>

        {/* Custom Price */}
        <p className="text-[11px] text-[#111111]/60 mb-2">سعر مخصص (د.ع)</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min={0}
            step={1000}
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="من"
            className="bg-white border border-[#D8C8B5] px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#111111]"
          />
          <input
            type="number"
            min={0}
            step={1000}
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="إلى"
            className="bg-white border border-[#D8C8B5] px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#111111]"
          />
        </div>
        <button
          type="button"
          onClick={() => fetchFiltered({ minPrice, maxPrice, page: 1 })}
          className="mt-2 w-full py-1.5 bg-[#EFEAE2] hover:bg-[#D8C8B5] text-[#111111] text-xs font-medium transition"
        >
          تطبيق السعر
        </button>
      </div>

      {/* Dynamic Attribute Filters (Only attributes with active products!) */}
      {data.filters.attributes.map((attr) => (
        <div key={attr.id} className="border-t border-[#D8C8B5]/60 pt-5">
          <h3 className="text-xs font-semibold text-[#111111] mb-3">
            {attr.name}
          </h3>
          {attr.type === "color" ? (
            <div className="flex flex-wrap gap-2">
              {attr.options.map((opt) => {
                const active = (selectedAttrs[attr.slug] || []).includes(
                  opt.slug
                );
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleAttribute(attr.slug, opt.slug)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 text-xs border transition ${
                      active
                        ? "border-[#111111] bg-[#111111] text-[#F7F4EF]"
                        : "border-[#D8C8B5] bg-white text-[#111111]/80 hover:border-[#111111]"
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                      style={{ backgroundColor: opt.color_hex || "#111111" }}
                    />
                    <span>{opt.value}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {attr.options.map((opt) => {
                const active = (selectedAttrs[attr.slug] || []).includes(
                  opt.slug
                );
                return (
                  <label
                    key={opt.id}
                    className="flex items-center justify-between text-xs cursor-pointer text-[#111111]/80 hover:text-[#111111]"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleAttribute(attr.slug, opt.slug)}
                        className="accent-[#111111] w-3.5 h-3.5"
                      />
                      <span>{opt.value}</span>
                    </span>
                    <span className="text-[11px] text-[#111111]/45">
                      ({opt.count})
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* Collections Filter */}
      {data.filters.collections.length > 0 && (
        <div className="border-t border-[#D8C8B5]/60 pt-5">
          <h3 className="text-xs font-semibold text-[#111111] mb-3">
            المجموعة
          </h3>
          <div className="space-y-2">
            {data.filters.collections.map((col) => {
              const active = selectedCollection === col.slug;
              return (
                <button
                  key={col.slug}
                  type="button"
                  onClick={() => {
                    const next = active ? "" : col.slug;
                    setSelectedCollection(next);
                    fetchFiltered({ collection: next, page: 1 });
                  }}
                  className={`w-full flex items-center justify-between text-xs py-1.5 px-2.5 border transition ${
                    active
                      ? "bg-[#111111] text-[#F7F4EF] border-[#111111]"
                      : "bg-white text-[#111111]/80 border-[#D8C8B5]/60 hover:border-[#111111]"
                  }`}
                >
                  <span>{col.label}</span>
                  <span className="text-[11px] opacity-70">({col.count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Availability Filter */}
      {(data.filters.availability.inStock > 0 ||
        data.filters.availability.outOfStock > 0) && (
        <div className="border-t border-[#D8C8B5]/60 pt-5">
          <h3 className="text-xs font-semibold text-[#111111] mb-3">التوفر</h3>
          <div className="space-y-2">
            {data.filters.availability.inStock > 0 && (
              <button
                type="button"
                onClick={() => {
                  const next =
                    selectedAvailability === "in_stock" ? "" : "in_stock";
                  setSelectedAvailability(next);
                  fetchFiltered({ availability: next, page: 1 });
                }}
                className={`w-full flex items-center justify-between text-xs py-1.5 px-2.5 border transition ${
                  selectedAvailability === "in_stock"
                    ? "bg-[#111111] text-[#F7F4EF] border-[#111111]"
                    : "bg-white text-[#111111]/80 border-[#D8C8B5]/60"
                }`}
              >
                <span>متوفر</span>
                <span>({data.filters.availability.inStock})</span>
              </button>
            )}
            {data.filters.availability.outOfStock > 0 && (
              <button
                type="button"
                onClick={() => {
                  const next =
                    selectedAvailability === "out_of_stock"
                      ? ""
                      : "out_of_stock";
                  setSelectedAvailability(next);
                  fetchFiltered({ availability: next, page: 1 });
                }}
                className={`w-full flex items-center justify-between text-xs py-1.5 px-2.5 border transition ${
                  selectedAvailability === "out_of_stock"
                    ? "bg-[#111111] text-[#F7F4EF] border-[#111111]"
                    : "bg-white text-[#111111]/80 border-[#D8C8B5]/60"
                }`}
              >
                <span>غير متوفر</span>
                <span>({data.filters.availability.outOfStock})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {activeFilterCount > 0 && (
        <button
          type="button"
          onClick={clearAllFilters}
          className="w-full py-2.5 border border-[#111111] text-xs font-semibold text-[#111111] hover:bg-[#111111] hover:text-[#F7F4EF] transition"
        >
          مسح جميع الفلاتر
        </button>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* Breadcrumb & Header */}
      <nav aria-label="مسار التنقل" className="text-xs text-[#111111]/55 mb-4 flex items-center gap-2">
        <Link href={`/store/${genderSlug}`} className="hover:text-[#111111]">
          الرئيسية
        </Link>
        <span>/</span>
        <Link
          href={`/store/${genderSlug}/products`}
          className="hover:text-[#111111]"
        >
          {genderName}
        </Link>
        {lockedCategorySlug && (
          <>
            <span>/</span>
            <span className="text-[#111111] font-medium">{pageTitle}</span>
          </>
        )}
      </nav>

      <div className="pb-8 border-b border-[#D8C8B5]/70 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-editorial text-3xl sm:text-5xl text-[#111111]">
            {pageTitle}
          </h1>
          {pageDescription && (
            <p className="text-sm text-[#111111]/65 mt-2 max-w-2xl">
              {pageDescription}
            </p>
          )}
          <p className="text-xs text-[#B79B6C] font-medium mt-2.5">
            {data.total} منتجًا
          </p>
        </div>

        {/* Toolbar: Mobile Filter Trigger + Sort */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="lg:hidden flex items-center gap-2 px-4 py-2.5 bg-white border border-[#D8C8B5] text-xs font-semibold text-[#111111]"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#B79B6C]" />
            <span>تصفية</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[#111111] text-[#F7F4EF] text-[10px]">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="flex items-center gap-2">
            <label
              htmlFor="aura-sort"
              className="text-xs text-[#111111]/65 whitespace-nowrap hidden sm:inline"
            >
              ترتيب حسب:
            </label>
            <select
              id="aura-sort"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                fetchFiltered({ sort: e.target.value, page: 1 });
              }}
              className="bg-white border border-[#D8C8B5] px-3.5 py-2.5 text-xs font-medium text-[#111111] focus:outline-none focus:border-[#111111]"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-5">
          {searchQuery.trim() && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-[#D8C8B5] text-xs">
              <span>بحث: {searchQuery}</span>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  fetchFiltered({ q: "", page: 1 });
                }}
                aria-label="إزالة البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
          {(minPrice || maxPrice) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-[#D8C8B5] text-xs">
              <span>
                السعر: {minPrice ? formatIQD(Number(minPrice)) : "0 د.ع"} —{" "}
                {maxPrice ? formatIQD(Number(maxPrice)) : "الكل"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setMinPrice("");
                  setMaxPrice("");
                  fetchFiltered({ minPrice: "", maxPrice: "", page: 1 });
                }}
                aria-label="إزالة فلتر السعر"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs text-[#B79B6C] hover:text-[#111111] underline mr-2"
          >
            مسح الكل
          </button>
        </div>
      )}

      {/* Main Layout: Sidebar Filters + Product Grid */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        {/* Desktop Sticky Sidebar */}
        <aside className="hidden lg:block lg:col-span-3">
          <div className="sticky top-28 bg-[#EFEAE2]/50 border border-[#D8C8B5]/60 p-5">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#D8C8B5]/60">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#B79B6C]" />
                <span className="text-sm font-semibold text-[#111111]">
                  تصفية المنتجات
                </span>
              </div>
              {activeFilterCount > 0 && (
                <span className="text-[11px] px-2 py-0.5 bg-[#111111] text-[#F7F4EF]">
                  {activeFilterCount}
                </span>
              )}
            </div>
            {renderFiltersBody()}
          </div>
        </aside>

        {/* Product Grid */}
        <div className="lg:col-span-9">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-sm text-[#111111]/65">
              <Loader2 className="w-6 h-6 animate-spin text-[#B79B6C]" />
              <span>جاري تحديث المنتجات...</span>
            </div>
          ) : data.products.length === 0 ? (
            <div className="py-20 px-6 bg-white border border-[#D8C8B5]/60 text-center">
              <p className="font-editorial text-2xl text-[#111111] mb-2">
                لا توجد منتجات مطابقة لخيارات التصفية الحالية
              </p>
              <p className="text-sm text-[#111111]/60 mb-6">
                جرّب تعديل الفلاتر أو عرض جميع قطع {genderName}.
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-7 py-3 bg-[#111111] text-[#F7F4EF] text-sm font-medium hover:bg-[#B79B6C] hover:text-[#111111] transition"
              >
                عرض جميع المنتجات
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-7">
                {data.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <nav
                  aria-label="ترقيم الصفحات"
                  className="mt-12 pt-8 border-t border-[#D8C8B5]/60 flex items-center justify-center gap-2"
                >
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => fetchFiltered({ page: page - 1 })}
                    className="px-3.5 py-2 border border-[#D8C8B5] bg-white text-xs font-medium disabled:opacity-40 hover:border-[#111111] flex items-center gap-1"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>السابق</span>
                  </button>

                  {Array.from({ length: data.totalPages }, (_, i) => i + 1).map(
                    (p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => fetchFiltered({ page: p })}
                        className={`w-9 h-9 text-xs font-semibold border transition ${
                          p === page
                            ? "bg-[#111111] text-[#F7F4EF] border-[#111111]"
                            : "bg-white text-[#111111] border-[#D8C8B5] hover:border-[#111111]"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    disabled={page >= data.totalPages}
                    onClick={() => fetchFiltered({ page: page + 1 })}
                    className="px-3.5 py-2 border border-[#D8C8B5] bg-white text-xs font-medium disabled:opacity-40 hover:border-[#111111] flex items-center gap-1"
                  >
                    <span>التالي</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#111111]/60 backdrop-blur-xs"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="relative z-10 w-[86%] max-w-sm bg-[#F7F4EF] h-full flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-[#D8C8B5] flex items-center justify-between">
              <span className="text-sm font-semibold text-[#111111]">
                تصفية المنتجات
              </span>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="إغلاق التصفية"
                className="p-1.5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {renderFiltersBody()}
            </div>
            <div className="p-4 border-t border-[#D8C8B5] bg-white">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="w-full py-3 bg-[#111111] text-[#F7F4EF] text-sm font-semibold"
              >
                عرض النتائج ({data.total})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
