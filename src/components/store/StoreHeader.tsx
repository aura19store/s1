"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  Heart,
  UserRound,
  ShoppingBag,
  Menu,
  X,
  ChevronLeft,
} from "lucide-react";
import { useStore } from "./StoreProvider";
import { formatIQD } from "@/lib/format";
import { CUSTOMER_ACCOUNT_VISIBLE } from "@/lib/customer-account-visibility";
import type { CategoryItem, GenderItem } from "@/lib/store-queries";

export function StoreHeader({
  genderSlug,
  genders,
  categories,
  storeName,
  logoUrl,
  freeShippingThreshold = 25000,
}: {
  genderSlug: string;
  genders: GenderItem[];
  categories: CategoryItem[];
  storeName: string;
  logoUrl?: string;
  freeShippingThreshold?: number;
}) {
  const pathname = usePathname();
  const { cart, wishlistIds, setCartOpen, setSearchOpen } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isMen = genderSlug === "men";

  return (
    <>
      {/* Subtle Top Free Shipping Strip */}
      <div className="bg-[#111111] text-[#F7F4EF] text-xs py-2 px-4 text-center tracking-wide border-b border-[#B79B6C]/20">
        <span>
          شحن مجاني لجميع محافظات العراق الـ18 للطلبات بقيمة{" "}
          <strong className="text-[#B79B6C] font-semibold">
            {formatIQD(freeShippingThreshold)}
          </strong>{" "}
          أو أكثر • توصيل خلال 1-2 يوم عمل
        </span>
      </div>

      <header className="sticky top-0 z-40 bg-[#F7F4EF]/95 backdrop-blur-md border-b border-[#D8C8B5]/60 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-18 sm:h-20 flex items-center justify-between gap-3">
            {/* Right side (RTL start): Mobile Menu + Brand Wordmark */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="فتح القائمة"
                className="lg:hidden min-w-11 min-h-11 p-2 -mr-2 text-[#111111] hover:text-[#B79B6C] transition"
              >
                <Menu className="w-5 h-5" />
              </button>

              <Link
                href={`/store/${genderSlug}`}
                className="font-brand text-2xl sm:text-3xl font-medium text-[#111111] tracking-[0.26em] hover:opacity-80 transition select-none flex items-center"
                aria-label={storeName}
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={storeName}
                    className="h-9 sm:h-10 w-auto object-contain"
                  />
                ) : (
                  storeName
                )}
              </Link>
            </div>

            {/* Center Navigation (Desktop) */}
            <nav
              aria-label="التنقل الرئيسي"
              className="hidden lg:flex items-center gap-7 text-sm font-medium"
            >
              <Link
                href={`/store/${genderSlug}`}
                className={`py-1 transition relative ${
                  pathname === `/store/${genderSlug}`
                    ? "text-[#111111] after:absolute after:bottom-0 after:right-0 after:left-0 after:h-[1.5px] after:bg-[#B79B6C]"
                    : "text-[#111111]/70 hover:text-[#111111]"
                }`}
              >
                الرئيسية
              </Link>

              <Link href={`/store/${genderSlug}/orders`} className="text-[#111111]/75 hover:text-[#111111] transition">طلباتي</Link>

              {/* Prominent Dynamic Gender Switcher: رجالي | نسائي */}
              <div
                role="group"
                aria-label="التبديل بين القسم الرجالي والنسائي"
                className="flex items-center bg-[#EFEAE2] p-1 rounded-full border border-[#D8C8B5]/70"
              >
                {genders.map((g) => {
                  const active = g.slug === genderSlug;
                  return (
                    <Link
                      key={g.id}
                      href={`/store/${g.slug}`}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        active
                          ? "bg-[#111111] text-[#F7F4EF] shadow-sm"
                          : "text-[#111111]/70 hover:text-[#111111]"
                      }`}
                    >
                      {g.slug === "men"
                        ? "الرجالي"
                        : g.slug === "women"
                        ? "النسائي"
                        : g.name}
                    </Link>
                  );
                })}
              </div>

              <Link
                href={`/store/${genderSlug}/products?collection=new-arrivals`}
                className="text-[#111111]/75 hover:text-[#111111] transition"
              >
                وصل حديثًا
              </Link>

              <Link
                href={`/store/${genderSlug}/products?collection=bestsellers`}
                className="text-[#111111]/75 hover:text-[#111111] transition"
              >
                الأكثر طلباً
              </Link>
            </nav>

            {/* Left side (RTL end): Search, Wishlist, Cart */}
            <div className="flex items-center gap-0 sm:gap-2">
              {/* On small phones the same switch remains available in the menu. */}
              <div className="hidden sm:flex lg:hidden items-center bg-[#EFEAE2] p-0.5 rounded-full border border-[#D8C8B5]/70 ml-1">
                {genders.map((g) => {
                  const active = g.slug === genderSlug;
                  return (
                    <Link
                      key={g.id}
                      href={`/store/${g.slug}`}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
                        active
                          ? "bg-[#111111] text-[#F7F4EF]"
                          : "text-[#111111]/70"
                      }`}
                    >
                      {g.name}
                    </Link>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="البحث"
                className="min-w-11 min-h-11 p-2.5 text-[#111111] hover:text-[#B79B6C] transition flex items-center justify-center gap-1.5"
              >
                <Search className="w-[19px] h-[19px] stroke-[1.7]" />
                <span className="hidden xl:inline text-xs font-medium">
                  البحث
                </span>
              </button>

              {CUSTOMER_ACCOUNT_VISIBLE && (
                <Link
                  href={`/store/${genderSlug}/account`}
                  aria-label="حسابي"
                  className="hidden sm:flex p-2.5 text-[#111111] hover:text-[#B79B6C] transition items-center gap-1.5"
                >
                  <UserRound className="w-[19px] h-[19px] stroke-[1.7]" />
                  <span className="hidden xl:inline text-xs font-medium">حسابي</span>
                </Link>
              )}

              <Link
                href={`/store/${genderSlug}/wishlist`}
                aria-label="المفضلة"
                className="relative min-w-11 min-h-11 p-2.5 text-[#111111] hover:text-[#B79B6C] transition flex items-center justify-center gap-1.5"
              >
                <Heart className="w-[19px] h-[19px] stroke-[1.7]" />
                <span className="hidden xl:inline text-xs font-medium">
                  المفضلة
                </span>
                {wishlistIds.length > 0 && (
                  <span className="absolute top-1.5 right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#B79B6C] text-[#111111] text-[10px] font-bold flex items-center justify-center">
                    {wishlistIds.length}
                  </span>
                )}
              </Link>

              <button
                type="button"
                onClick={() => setCartOpen(true)}
                aria-label="السلة"
                className="relative min-w-11 min-h-11 p-2.5 text-[#111111] hover:text-[#B79B6C] transition flex items-center justify-center gap-1.5"
              >
                <ShoppingBag className="w-[19px] h-[19px] stroke-[1.7]" />
                <span className="hidden xl:inline text-xs font-medium">
                  السلة
                </span>
                {cart.itemCount > 0 && (
                  <span className="absolute top-1.5 right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#111111] text-[#F7F4EF] text-[10px] font-bold flex items-center justify-center">
                    {cart.itemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile RTL Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#111111]/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-[84%] max-w-xs bg-[#F7F4EF] h-full shadow-2xl flex flex-col z-10 animate-aura-fade-in">
            <div className="flex items-center justify-between px-5 py-5 border-b border-[#D8C8B5]/60">
              <span className="font-brand text-2xl tracking-[0.25em] text-[#111111]">
                {storeName}
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="إغلاق القائمة"
                className="p-2 text-[#111111] hover:text-[#B79B6C]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Gender Switch */}
            <div className="p-4 border-b border-[#D8C8B5]/50">
              <p className="text-xs text-[#111111]/60 mb-2">اختر القسم</p>
              <div className="grid grid-cols-2 gap-2">
                {genders.map((g) => (
                  <Link
                    key={g.id}
                    href={`/store/${g.slug}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`py-2.5 text-center text-sm font-medium rounded-sm border transition ${
                      g.slug === genderSlug
                        ? "bg-[#111111] text-[#F7F4EF] border-[#111111]"
                        : "bg-white text-[#111111] border-[#D8C8B5]"
                    }`}
                  >
                    {g.slug === "men"
                      ? "الرجالي"
                      : g.slug === "women"
                      ? "النسائي"
                      : g.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              <div className="space-y-1">
                <Link
                  href={`/store/${genderSlug}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between py-2.5 text-sm font-medium text-[#111111] border-b border-[#D8C8B5]/30"
                >
                  <span>الرئيسية</span>
                  <ChevronLeft className="w-4 h-4 text-[#B79B6C]" />
                </Link>
                <Link
                  href={`/store/${genderSlug}/products`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between py-2.5 text-sm font-medium text-[#111111] border-b border-[#D8C8B5]/30"
                >
                  <span>{isMen ? "جميع منتجات الرجالي" : "جميع منتجات النسائي"}</span>
                  <ChevronLeft className="w-4 h-4 text-[#B79B6C]" />
                </Link>
                <Link
                  href={`/store/${genderSlug}/products?collection=new-arrivals`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between py-2.5 text-sm font-medium text-[#111111] border-b border-[#D8C8B5]/30"
                >
                  <span>وصل حديثًا</span>
                  <ChevronLeft className="w-4 h-4 text-[#B79B6C]" />
                </Link>
                <Link
                  href={`/store/${genderSlug}/products?collection=bestsellers`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between py-2.5 text-sm font-medium text-[#111111] border-b border-[#D8C8B5]/30"
                >
                  <span>الأكثر طلباً</span>
                  <ChevronLeft className="w-4 h-4 text-[#B79B6C]" />
                </Link>
              </div>

              {categories.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#B79B6C] mb-3">
                    {isMen ? "تصنيفات الرجالي" : "تصنيفات النسائي"}
                  </p>
                  <div className="space-y-2">
                    {categories.map((cat) => (
                      <Link
                        key={cat.id}
                        href={`/store/${genderSlug}/category/${cat.slug}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 py-1.5 text-sm text-[#111111]/85 hover:text-[#111111]"
                      >
                        <img
                          src={cat.image_url}
                          alt={cat.name}
                          className="w-8 h-8 rounded-full object-cover border border-[#D8C8B5]"
                        />
                        <span>{cat.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-[#D8C8B5]/50 space-y-2 text-sm text-[#111111]/75">
                <Link href={`/store/${genderSlug}/orders`} onClick={() => setMobileMenuOpen(false)} className="block py-2.5">طلباتي</Link>
                {CUSTOMER_ACCOUNT_VISIBLE && (
                  <Link href={`/store/${genderSlug}/account`} onClick={() => setMobileMenuOpen(false)} className="block py-2.5">
                    حسابي
                  </Link>
                )}
                <Link
                  href={`/store/${genderSlug}/wishlist`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-1.5"
                >
                  قائمة المفضلة ({wishlistIds.length})
                </Link>
                <Link
                  href={`/store/${genderSlug}/cart`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-1.5"
                >
                  سلة التسوق ({cart.itemCount})
                </Link>
                <Link
                  href="/info/shipping"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-1.5"
                >
                  سياسة الشحن
                </Link>
                <Link
                  href="/info/contact"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-1.5"
                >
                  تواصل معنا
                </Link>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
