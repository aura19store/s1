import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getRenderGenders as getGenders, getRenderStoreSettings as getStoreSettings } from "@/lib/store-render-queries";

export const dynamic = "force-dynamic";

export default async function EntryPage() {
  const [settings, genders] = await Promise.all([
    getStoreSettings(),
    getGenders(),
  ]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F7F4EF] via-[#EFE7DA] to-[#E4D6C3] text-[#111111] flex flex-col justify-between overflow-x-hidden">
      {/* Top Luxury Brand Arrival Header */}
      <section className="pt-10 pb-8 sm:pt-14 sm:pb-10 px-4 text-center relative z-10 animate-aura-fade-up">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-3 text-[11px] text-[#705631] tracking-[0.2em]">
            <span className="w-8 h-[1px] bg-[#B79B6C]/60" />
            <span>دار الإكسسوارات الفاخرة</span>
            <span className="w-8 h-[1px] bg-[#B79B6C]/60" />
          </div>

          <h1 className="font-brand text-5xl sm:text-7xl font-medium tracking-[0.3em] text-[#111111]">
            {settings.store_name}
          </h1>

          <p className="font-editorial text-2xl sm:text-3xl text-[#111111] pt-1">
            {settings.tagline}
          </p>

          <p className="text-sm sm:text-base text-[#4A4035] font-light">
            {settings.secondary_tagline}
          </p>

          <div className="pt-4">
            <span className="inline-block px-5 py-1.5 border border-[#8A704D]/60 text-xs sm:text-sm text-[#705631] tracking-wider">
              اختر هالتك
            </span>
          </div>
        </div>
      </section>

      {/* Split Men / Women Luxury Lifestyle Selection */}
      <section
        aria-label="اختر هالتك"
        className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-8 pb-10 sm:pb-14"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 h-full">
          {genders.map((g, idx) => (
            <Link
              key={g.id}
              href={`/store/${g.slug}`}
              className="group relative min-h-[380px] sm:min-h-[500px] lg:min-h-[560px] overflow-hidden bg-[#1a1a1a] border border-[#F7F4EF]/10 hover:border-[#B79B6C]/60 transition-all duration-700 flex flex-col justify-end p-7 sm:p-11 animate-aura-fade-up"
              style={{ animationDelay: `${idx * 120}ms` }}
            >
              {/* Lifestyle Background Image */}
              <img
                src={g.entry_image}
                alt={`تشكيلة ${settings.store_name} ${g.name}`}
                className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-1000 ease-out group-hover:scale-105"
              />

              {/* Subtle Editorial Dark Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#111111]/90 via-[#111111]/35 to-transparent transition-opacity duration-500 group-hover:via-[#111111]/25" />

              {/* Content */}
              <div className="relative z-10 space-y-3">
                <div className="w-10 h-[1px] bg-[#B79B6C] transition-all duration-500 group-hover:w-16" />

                <h2 className="font-editorial text-4xl sm:text-5xl text-[#F7F4EF] font-normal">
                  {g.entry_title}
                </h2>

                {g.entry_subtitle && (
                  <p className="text-sm sm:text-base text-[#D8C8B5]/90 max-w-md leading-relaxed">
                    {g.entry_subtitle}
                  </p>
                )}

                <div className="pt-3 inline-flex items-center gap-3 text-sm font-medium text-[#F7F4EF] border-b border-[#B79B6C]/60 pb-1.5 group-hover:text-[#B79B6C] transition">
                  <span>
                    {g.slug === "women" ? "استكشفي التشكيلة" : "استكشف التشكيلة"}
                  </span>
                  <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Subtle Minimal Footer Strip */}
      <footer className="py-5 px-4 text-center text-xs text-[#5C5144] border-t border-[#B79B6C]/30">
        © 2026 {settings.store_name}. جميع الحقوق محفوظة • العراق
      </footer>
    </main>
  );
}
