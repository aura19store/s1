import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getCategoriesByGender,
  getGenderBySlug,
  getHomepageSections,
  getStoreSettings,
  queryStoreProducts,
} from "@/lib/store-queries";
import { ProductCard } from "@/components/store/ProductCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gender: string }>;
}): Promise<Metadata> {
  const { gender: genderSlug } = await params;
  const [gender, settings] = await Promise.all([
    getGenderBySlug(genderSlug),
    getStoreSettings(),
  ]);
  if (!gender) return { title: settings.store_name };

  const title =
    gender.slug === "women"
      ? `القسم النسائي — تشكيلة ${settings.store_name} النسائية`
      : `القسم الرجالي — تشكيلة ${settings.store_name} الرجالية`;

  return {
    title,
    description: `${settings.tagline} ${gender.entry_subtitle} — تسوق إكسسوارات ${settings.store_name} الفاخرة في العراق بالدينار العراقي.`,
  };
}

export default async function GenderHomePage({
  params,
}: {
  params: Promise<{ gender: string }>;
}) {
  const { gender: genderSlug } = await params;
  const gender = await getGenderBySlug(genderSlug);
  if (!gender) notFound();

  const [sections, categories, featuredRes, newRes, bestRes] =
    await Promise.all([
      getHomepageSections(gender.slug),
      getCategoriesByGender(gender.id),
      queryStoreProducts({
        genderId: gender.id,
        collection: "featured",
        limit: 4,
      }),
      queryStoreProducts({
        genderId: gender.id,
        collection: "new-arrivals",
        sort: "newest",
        limit: 4,
      }),
      queryStoreProducts({
        genderId: gender.id,
        collection: "bestsellers",
        sort: "bestselling",
        limit: 4,
      }),
    ]);

  const featuredProducts = featuredRes.products;
  const newArrivals = newRes.products;
  const bestsellers = bestRes.products;

  return (
    <div className="space-y-0">
      {sections.map((sec) => {
        // 1. HERO SECTION
        if (sec.type === "hero") {
          return (
            <section
              key={sec.id}
              className="relative min-h-[520px] sm:min-h-[600px] lg:min-h-[660px] bg-[#111111] text-[#F7F4EF] overflow-hidden flex items-end sm:items-center"
            >
              <img
                src={sec.image_url || "/images/hero-men-banner.jpg"}
                alt={sec.title}
                className="absolute inset-0 w-full h-full object-cover object-center animate-aura-fade-in"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#111111]/85 via-[#111111]/45 to-[#111111]/20 sm:bg-gradient-to-l sm:from-[#111111]/85 sm:via-[#111111]/45 sm:to-transparent" />

              <div className="relative z-10 max-w-7xl mx-auto w-full px-5 sm:px-8 lg:px-10 py-14 sm:py-20">
                <div className="max-w-xl space-y-5 animate-aura-fade-up">
                  {sec.subtitle && (
                    <div className="inline-flex items-center gap-3 text-xs text-[#B79B6C] tracking-wider">
                      <span className="w-8 h-[1px] bg-[#B79B6C]" />
                      <span>{sec.subtitle}</span>
                    </div>
                  )}

                  <h1 className="font-editorial text-4xl sm:text-6xl lg:text-[64px] leading-[1.15] text-[#F7F4EF]">
                    {sec.title}
                  </h1>

                  {sec.description && (
                    <p className="text-sm sm:text-base text-[#D8C8B5]/90 leading-relaxed max-w-lg font-light">
                      {sec.description}
                    </p>
                  )}

                  {sec.cta_text && (
                    <div className="pt-3">
                      <Link
                        href={sec.cta_link || `/store/${gender.slug}/products`}
                        className="inline-flex items-center gap-3 px-8 py-4 bg-[#F7F4EF] text-[#111111] text-sm font-semibold hover:bg-[#B79B6C] hover:text-[#111111] transition-all duration-300"
                      >
                        <span>{sec.cta_text}</span>
                        <ArrowLeft className="w-4 h-4" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        }

        // 2. CATEGORY CIRCLES SECTION
        if (sec.type === "categories" && categories.length > 0) {
          return (
            <section
              key={sec.id}
              className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
            >
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
                <div>
                  {sec.subtitle && (
                    <p className="text-xs font-medium text-[#B79B6C] mb-1.5">
                      {sec.subtitle}
                    </p>
                  )}
                  <h2 className="font-editorial text-3xl sm:text-4xl text-[#111111]">
                    {sec.title || gender.shop_heading}
                  </h2>
                </div>
                <Link
                  href={`/store/${gender.slug}/products`}
                  className="text-xs sm:text-sm font-medium text-[#111111] hover:text-[#B79B6C] transition inline-flex items-center gap-1.5"
                >
                  <span>{sec.cta_text || "عرض جميع القطع"}</span>
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-5 sm:gap-7">
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/store/${gender.slug}/category/${cat.slug}`}
                    className="group flex flex-col items-center text-center"
                  >
                    <div className="relative w-24 h-24 sm:w-32 sm:h-32 lg:w-36 lg:h-36 rounded-full p-1.5 border border-[#D8C8B5] group-hover:border-[#B79B6C] transition-all duration-500 bg-[#EFEAE2] mb-3.5 shadow-xs group-hover:shadow-md group-hover:-translate-y-1">
                      <div className="w-full h-full rounded-full overflow-hidden">
                        <img
                          src={cat.image_url || "/images/brand-story.jpg"}
                          alt={cat.name}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                        />
                      </div>
                    </div>
                    <span className="text-sm sm:text-[15px] font-medium text-[#111111] group-hover:text-[#B79B6C] transition">
                      {cat.name}
                    </span>
                    <span className="text-[11px] text-[#111111]/50 mt-0.5">
                      {cat.product_count} قطعة
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        }

        // 3. BESTSELLERS / NEW ARRIVALS / FEATURED PRODUCT GRIDS
        if (
          sec.type === "bestsellers" ||
          sec.type === "new_arrivals" ||
          sec.type === "featured"
        ) {
          const items =
            sec.type === "bestsellers"
              ? bestsellers
              : sec.type === "new_arrivals"
              ? newArrivals
              : featuredProducts;

          if (items.length === 0) return null;

          const altBg = sec.type === "new_arrivals" ? "bg-[#EFEAE2]/55" : "";

          return (
            <section key={sec.id} className={`py-16 sm:py-20 ${altBg}`}>
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
                  <div>
                    <h2 className="font-editorial text-3xl sm:text-4xl text-[#111111]">
                      {sec.title}
                    </h2>
                    {sec.subtitle && (
                      <p className="text-sm text-[#111111]/65 mt-2">
                        {sec.subtitle}
                      </p>
                    )}
                  </div>
                  <Link
                    href={sec.cta_link || `/store/${gender.slug}/products`}
                    className="text-xs sm:text-sm font-medium text-[#111111] border-b border-[#111111]/30 pb-1 hover:border-[#B79B6C] hover:text-[#B79B6C] transition inline-flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <span>{sec.cta_text || "عرض المزيد"}</span>
                    <ArrowLeft className="w-4 h-4" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-7">
                  {items.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </div>
            </section>
          );
        }

        // 4. AURA BRAND STORY SECTION
        if (sec.type === "story") {
          return (
            <section
              key={sec.id}
              className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center bg-white border border-[#D8C8B5]/60 p-6 sm:p-10 lg:p-14">
                <div className="lg:col-span-6 space-y-5 order-2 lg:order-1">
                  <div className="inline-flex items-center gap-3 text-xs text-[#B79B6C]">
                    <span className="w-8 h-[1px] bg-[#B79B6C]" />
                    <span>{sec.subtitle || "قصة AURA"}</span>
                  </div>
                  <h2 className="font-editorial text-3xl sm:text-5xl text-[#111111] leading-tight">
                    {sec.title}
                  </h2>
                  <p className="text-sm sm:text-base text-[#111111]/75 leading-loose">
                    {sec.description}
                  </p>
                  {sec.cta_text && (
                    <div className="pt-2">
                      <Link
                        href={sec.cta_link || `/store/${gender.slug}/products`}
                        className="inline-flex items-center gap-3 px-7 py-3.5 bg-[#111111] text-[#F7F4EF] text-sm font-medium hover:bg-[#B79B6C] hover:text-[#111111] transition"
                      >
                        <span>{sec.cta_text}</span>
                        <ArrowLeft className="w-4 h-4" />
                      </Link>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-6 order-1 lg:order-2">
                  <div className="aspect-[4/3] overflow-hidden bg-[#EFEAE2]">
                    <img
                      src={sec.image_url || "/images/brand-story.jpg"}
                      alt={sec.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </section>
          );
        }

        // 5. PROMO SPLIT SECTION (AURA الرجالي | AURA النسائي)
        if (sec.type === "promo_split") {
          return (
            <section
              key={sec.id}
              className="py-10 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Men Card */}
                <Link
                  href={sec.cta_link || "/store/men"}
                  className="group relative min-h-[340px] sm:min-h-[420px] overflow-hidden bg-[#111111] flex flex-col justify-end p-8 sm:p-10"
                >
                  <img
                    src={sec.image_url || "/images/hero-men-editorial.jpg"}
                    alt={sec.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111111]/85 via-[#111111]/30 to-transparent" />
                  <div className="relative z-10 space-y-2">
                    <h3 className="font-editorial text-3xl sm:text-4xl text-[#F7F4EF]">
                      {sec.title || "AURA الرجالي"}
                    </h3>
                    <p className="text-sm text-[#D8C8B5]">
                      {sec.subtitle || "اكتشف التشكيلة الرجالية"}
                    </p>
                    <span className="inline-flex items-center gap-2 pt-2 text-xs font-semibold text-[#B79B6C] group-hover:text-[#F7F4EF] transition">
                      <span>{sec.cta_text || "تسوق الرجالي"}</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>

                {/* Women Card */}
                <Link
                  href={sec.secondary_cta_link || "/store/women"}
                  className="group relative min-h-[340px] sm:min-h-[420px] overflow-hidden bg-[#111111] flex flex-col justify-end p-8 sm:p-10"
                >
                  <img
                    src={
                      sec.secondary_image_url || "/images/hero-women-editorial.jpg"
                    }
                    alt={sec.secondary_title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111111]/85 via-[#111111]/30 to-transparent" />
                  <div className="relative z-10 space-y-2">
                    <h3 className="font-editorial text-3xl sm:text-4xl text-[#F7F4EF]">
                      {sec.secondary_title || "AURA النسائي"}
                    </h3>
                    <p className="text-sm text-[#D8C8B5]">
                      {sec.secondary_subtitle || "اكتشفي التشكيلة النسائية"}
                    </p>
                    <span className="inline-flex items-center gap-2 pt-2 text-xs font-semibold text-[#B79B6C] group-hover:text-[#F7F4EF] transition">
                      <span>{sec.secondary_cta_text || "تسوقي النسائي"}</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              </div>
            </section>
          );
        }

        return null;
      })}
    </div>
  );
}
