"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Heart,
  Star,
  Plus,
  Minus,
  ShoppingBag,
  Truck,
  ShieldCheck,
  ChevronDown,
  Check,
  Sparkles,
} from "lucide-react";
import { useStore } from "./StoreProvider";
import { ProductCard } from "./ProductCard";
import { formatIQD } from "@/lib/format";
import type { StoreProductCard, StoreSettings } from "@/lib/store-queries";

type FullProduct = StoreProductCard & {
  details: string;
  materials_info: string;
  tags: string;
  allAttributes: { name: string; slug: string; values: string[] }[];
};

export function ProductDetailClient({
  product,
  similar,
  alsoLike,
  settings,
}: {
  product: FullProduct;
  similar: StoreProductCard[];
  alsoLike: StoreProductCard[];
  settings: StoreSettings;
}) {
  const { addToCart, isWishlisted, toggleWishlist } = useStore();
  const images =
    product.images.length > 0
      ? product.images
      : [{ id: 0, url: product.primary_image, alt_text: product.name, sort_order: 0 }];

  const [activeImage, setActiveImage] = useState(images[0].url);
  const [selectedColor, setSelectedColor] = useState(
    product.colors[0]?.value || ""
  );
  const [selectedSize, setSelectedSize] = useState(product.sizes[0] || "");
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string>("details");

  const wishlisted = isWishlisted(product.id);
  const outOfStock = product.stock_quantity <= 0;
  const lowStock = product.stock_quantity > 0 && product.stock_quantity <= 5;
  const genderLabel = product.gender_slug === "women" ? "النسائي" : "الرجالي";

  const handleAddToCart = async () => {
    if (outOfStock || adding) return;
    setAdding(true);
    const variantParts = [selectedColor, selectedSize].filter(Boolean);
    await addToCart(product.id, quantity, variantParts.join(" • "), true);
    setAdding(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Breadcrumb */}
      <nav
        aria-label="مسار التنقل"
        className="text-xs text-[#111111]/55 mb-6 flex flex-wrap items-center gap-2"
      >
        <Link href={`/store/${product.gender_slug}`} className="hover:text-[#111111]">
          الرئيسية
        </Link>
        <span>/</span>
        <Link
          href={`/store/${product.gender_slug}/products`}
          className="hover:text-[#111111]"
        >
          {genderLabel}
        </Link>
        {product.category_slug && (
          <>
            <span>/</span>
            <Link
              href={`/store/${product.gender_slug}/category/${product.category_slug}`}
              className="hover:text-[#111111]"
            >
              {product.category_name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-[#111111] font-medium">{product.name}</span>
      </nav>

      {/* Main 2-Column Product Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14">
        {/* Right Column (RTL start): Large Images Gallery */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative aspect-[4/5] bg-[#EFEAE2] overflow-hidden border border-[#D8C8B5]/40">
            <img
              src={activeImage}
              alt={product.name}
              className="w-full h-full object-contain lg:object-cover"
            />
            {product.has_discount && product.discount_percent > 0 && (
              <span className="absolute top-4 right-4 px-3 py-1.5 bg-[#B79B6C] text-[#111111] text-xs font-bold">
                خصم {product.discount_percent}٪
              </span>
            )}
            {product.is_limited_edition && (
              <span className="absolute top-4 left-4 px-3 py-1.5 bg-[#111111] text-[#B79B6C] text-xs font-medium border border-[#B79B6C]/40">
                إصدار محدود
              </span>
            )}
          </div>

          {images.length > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {images.map((img, i) => (
                <button
                  key={img.id || i}
                  type="button"
                  onClick={() => setActiveImage(img.url)}
                  className={`aspect-square bg-[#EFEAE2] overflow-hidden border-2 transition ${
                    activeImage === img.url
                      ? "border-[#111111]"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <img
                    src={img.url}
                    alt={`${product.name} - صورة ${i + 1}`}
                    className="w-full h-full object-contain lg:object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Left Column: Product Information & Purchase Controls */}
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28 flex flex-col gap-6">
            {/* Category & SKU */}
            <div className="order-6 lg:order-none flex flex-wrap items-center justify-between gap-2 text-xs text-[#111111]/55">
              <span>{product.category_name || genderLabel}</span>
              <span>رمز القطعة: {product.sku}</span>
            </div>

            {/* Title & Rating */}
            <div className="order-1 lg:order-none space-y-3">
              <h1 className="font-editorial text-3xl sm:text-4xl text-[#111111] leading-snug">
                {product.name}
              </h1>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1 text-[#B79B6C]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${
                        i < Math.round(product.rating)
                          ? "fill-[#B79B6C]"
                          : "text-[#D8C8B5]"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-semibold text-[#111111]">
                  {product.rating.toFixed(1)}
                </span>
                <span className="text-[#111111]/55">
                  ({product.review_count} تقييم)
                </span>
              </div>
            </div>

            {/* Price in IQD */}
            <div className="order-2 lg:order-none py-4 border-y border-[#D8C8B5]/60 space-y-1.5">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-2xl sm:text-3xl font-bold text-[#111111]">
                  {formatIQD(product.final_price)}
                </span>
                {product.has_discount && (
                  <span className="text-base text-[#111111]/45 line-through">
                    {formatIQD(product.original_price)}
                  </span>
                )}
              </div>
              {product.promotion_name && (
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B79B6C]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>مشمول ضمن عرض: {product.promotion_name}</span>
                </p>
              )}
              <p className="text-xs text-[#111111]/60">
                شامل التغليف الفاخر من {settings.store_name} • السعر بالدينار
                العراقي
              </p>
            </div>

            {/* Description */}
            <p className="order-7 lg:order-none text-sm text-[#111111]/80 leading-loose">
              {product.description}
            </p>

            {/* Color Selector */}
            {product.colors.length > 0 && (
              <div className="order-3 lg:order-none">
                <p className="text-xs font-semibold text-[#111111] mb-2.5">
                  اللون:{" "}
                  <span className="font-normal text-[#B79B6C]">
                    {selectedColor}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {product.colors.map((c) => {
                    const active = selectedColor === c.value;
                    return (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => setSelectedColor(c.value)}
                        className={`min-h-11 flex items-center gap-2 px-3 py-2 text-xs border transition ${
                          active
                            ? "border-[#111111] bg-[#111111] text-[#F7F4EF]"
                            : "border-[#D8C8B5] bg-white text-[#111111] hover:border-[#111111]"
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/40"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span>{c.value}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Selector */}
            {product.sizes.length > 0 && (
              <div className="order-4 lg:order-none">
                <p className="text-xs font-semibold text-[#111111] mb-2.5">
                  المقاس:{" "}
                  <span className="font-normal text-[#B79B6C]">
                    {selectedSize}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((sz) => {
                    const active = selectedSize === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setSelectedSize(sz)}
                        className={`min-h-11 min-w-11 px-4 py-2 text-xs font-medium border transition ${
                          active
                            ? "border-[#111111] bg-[#111111] text-[#F7F4EF]"
                            : "border-[#D8C8B5] bg-white text-[#111111] hover:border-[#111111]"
                        }`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Material & Custom Attributes Summary */}
            {product.materials.length > 0 && (
              <div className="order-8 lg:order-none text-xs text-[#111111]/75">
                <span className="font-semibold text-[#111111]">الخامة: </span>
                <span>{product.materials.join("، ")}</span>
              </div>
            )}

            {/* Availability Status */}
            <div className="order-4 lg:order-none flex items-center gap-2 text-xs font-medium">
              {outOfStock ? (
                <span className="inline-flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-600" />
                  غير متوفر حاليًا في المخزون
                </span>
              ) : lowStock ? (
                <span className="inline-flex items-center gap-1.5 text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-600" />
                  كمية محدودة — متبقي {product.stock_quantity} قطع فقط
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5">
                  <Check className="w-3.5 h-3.5" />
                  متوفر وجاهز للشحن السريع داخل العراق
                </span>
              )}
            </div>

            {/* Quantity + Add to Cart + Wishlist */}
            <div className="order-5 lg:order-none space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center justify-between w-full sm:w-auto border border-[#D8C8B5] bg-white h-13">
                  <button
                    type="button"
                    disabled={outOfStock || quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="تقليل الكمية"
                    className="w-11 h-full flex items-center justify-center hover:bg-[#F7F4EF] disabled:opacity-40"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-11 text-center text-sm font-semibold">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    disabled={outOfStock || quantity >= product.stock_quantity}
                    onClick={() =>
                      setQuantity((q) => Math.min(product.stock_quantity, q + 1))
                    }
                    aria-label="زيادة الكمية"
                    className="w-11 h-full flex items-center justify-center hover:bg-[#F7F4EF] disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={outOfStock || adding}
                  onClick={handleAddToCart}
                  className="w-full sm:w-auto sm:flex-1 min-h-13 bg-[#111111] text-[#F7F4EF] hover:bg-[#B79B6C] hover:text-[#111111] disabled:bg-stone-400 disabled:text-white text-sm font-semibold transition flex items-center justify-center gap-2.5"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>
                    {outOfStock
                      ? "غير متوفر حاليًا"
                      : adding
                      ? "جاري الإضافة..."
                      : "أضف إلى السلة"}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                className={`w-full py-3.5 border text-sm font-medium transition flex items-center justify-center gap-2 ${
                  wishlisted
                    ? "border-[#111111] bg-[#EFEAE2] text-[#111111]"
                    : "border-[#D8C8B5] bg-white text-[#111111] hover:border-[#111111]"
                }`}
              >
                <Heart
                  className={`w-4 h-4 ${
                    wishlisted ? "fill-[#B79B6C] text-[#B79B6C]" : ""
                  }`}
                />
                <span>
                  {wishlisted ? "مضاف في قائمة المفضلة" : "أضف إلى المفضلة"}
                </span>
              </button>
            </div>

            {/* Trust Strip */}
            <div className="order-9 lg:order-none grid grid-cols-2 gap-3 pt-2 text-center text-xs text-[#111111]/75">
              <div className="bg-white border border-[#D8C8B5]/50 p-3.5 flex flex-col items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#B79B6C]" />
                <span>
                  شحن مجاني من {formatIQD(settings.free_shipping_threshold_iqd)}
                </span>
              </div>
              <div className="bg-white border border-[#D8C8B5]/50 p-3.5 flex flex-col items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#B79B6C]" />
                <span>الدفع عند الاستلام أو ماستر كارد</span>
              </div>
            </div>

            {/* Accordions: Details, Materials, Shipping */}
            <div className="order-10 lg:order-none border-t border-[#D8C8B5]/70 divide-y divide-[#D8C8B5]/60">
              {[
                {
                  id: "details",
                  title: "تفاصيل المنتج",
                  content:
                    product.details ||
                    "قطعة فاخرة مصممة بعناية لتمنحك حضورًا أنيقًا ومتوازنًا وتأتي داخل علبة AURA الفاخرة.",
                },
                {
                  id: "materials",
                  title: "الخامات والعناية",
                  content:
                    product.materials_info ||
                    "مصنوعة من خامات مختارة عالية الجودة مقاومة للبهتان. يُنصح بحفظها في العلبة المخصصة وتجنب العطور المباشرة للحفاظ على بريقها.",
                },
                {
                  id: "shipping",
                  title: "الشحن والتوصيل",
                  content: settings.shipping_policy,
                },
              ].map((acc) => {
                const isOpen = openAccordion === acc.id;
                return (
                  <div key={acc.id}>
                    <button
                      type="button"
                      onClick={() => setOpenAccordion(isOpen ? "" : acc.id)}
                      className="w-full py-4 flex items-center justify-between text-sm font-semibold text-[#111111]"
                    >
                      <span>{acc.title}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-[#B79B6C] transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="pb-4 text-xs sm:text-sm text-[#111111]/75 leading-relaxed whitespace-pre-line">
                        {acc.content}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Similar Products */}
      {similar.length > 0 && (
        <section className="mt-20 pt-14 border-t border-[#D8C8B5]/60">
          <h2 className="font-editorial text-2xl sm:text-3xl text-[#111111] mb-8">
            منتجات مشابهة
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-7">
            {similar.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}

      {/* May Also Like */}
      {alsoLike.length > 0 && (
        <section className="mt-16 pt-14 border-t border-[#D8C8B5]/60">
          <h2 className="font-editorial text-2xl sm:text-3xl text-[#111111] mb-8">
            قد يعجبك أيضًا
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-7">
            {alsoLike.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
