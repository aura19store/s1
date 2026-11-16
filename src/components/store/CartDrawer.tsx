"use client";

import React from "react";
import Link from "next/link";
import { X, Plus, Minus, Trash2, ShoppingBag, Truck } from "lucide-react";
import { useStore } from "./StoreProvider";
import { formatIQD } from "@/lib/format";

export function CartDrawer() {
  const {
    genderSlug,
    cart,
    isCartOpen,
    setCartOpen,
    updateCartQty,
    removeCartItem,
  } = useStore();

  if (!isCartOpen) return null;

  const progress = Math.min(
    100,
    Math.round(
      (cart.subtotalIqd / Math.max(1, cart.freeShippingThresholdIqd)) * 100
    )
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-[#111111]/55 backdrop-blur-xs"
        onClick={() => setCartOpen(false)}
      />

      <aside className="relative z-10 w-full max-w-md bg-[#F7F4EF] h-full shadow-2xl flex flex-col animate-aura-fade-in">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#D8C8B5]/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-[#111111] stroke-[1.6]" />
            <h2 className="text-base font-semibold text-[#111111]">
              سلة التسوق ({cart.itemCount})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            aria-label="إغلاق السلة"
            className="p-2 text-[#111111]/70 hover:text-[#111111] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Shipping Meter */}
        {cart.items.length > 0 && (
          <div className="px-6 py-3.5 bg-[#EFEAE2] border-b border-[#D8C8B5]/60">
            <div className="flex items-center gap-2 text-xs text-[#111111] mb-2">
              <Truck className="w-4 h-4 text-[#B79B6C] shrink-0" />
              {cart.remainingForFreeShipping > 0 ? (
                <span>
                  أضف منتجات بقيمة{" "}
                  <strong className="font-semibold">
                    {formatIQD(cart.remainingForFreeShipping)}
                  </strong>{" "}
                  للحصول على شحن مجاني (مجاني من{" "}
                  {formatIQD(cart.freeShippingThresholdIqd)})
                </span>
              ) : (
                <span className="font-semibold text-emerald-800">
                  تهانينا! طلبك مؤهل للشحن المجاني لجميع محافظات العراق
                </span>
              )}
            </div>
            <div className="w-full h-1.5 bg-[#D8C8B5]/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#B79B6C] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Items (Shared Men & Women) */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {cart.items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 rounded-full bg-[#EFEAE2] flex items-center justify-center mb-4">
                <ShoppingBag className="w-7 h-7 text-[#B79B6C] stroke-[1.5]" />
              </div>
              <p className="text-base font-medium text-[#111111] mb-1.5">
                سلة التسوق فارغة حاليًا
              </p>
              <p className="text-sm text-[#111111]/60 mb-6 max-w-xs">
                اكتشف قطع AURA الفاخرة وأضف ما يعكس أسلوبك وهالتك من القسمين
                الرجالي والنسائي في سلة واحدة.
              </p>
              <Link
                href={`/store/${genderSlug}/products`}
                onClick={() => setCartOpen(false)}
                className="px-7 py-3 bg-[#111111] text-[#F7F4EF] text-sm font-medium hover:bg-[#111111]/90 transition"
              >
                تصفح المنتجات
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {cart.items.map((item) => {
                const sectionTag =
                  item.genderName ||
                  (item.genderSlug === "women" ? "نسائي" : "رجالي");
                return (
                  <div
                    key={item.id}
                    className="flex gap-4 pb-5 border-b border-[#D8C8B5]/50"
                  >
                    <Link
                      href={`/store/${item.genderSlug}/product/${item.slug}`}
                      onClick={() => setCartOpen(false)}
                      className="w-20 h-24 bg-[#EFEAE2] shrink-0 overflow-hidden"
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="inline-block text-[10px] font-medium px-2 py-0.5 bg-[#EFEAE2] text-[#111111]/75 mb-1">
                            {sectionTag}
                          </span>
                          <Link
                            href={`/store/${item.genderSlug}/product/${item.slug}`}
                            onClick={() => setCartOpen(false)}
                            className="block text-sm font-medium text-[#111111] hover:text-[#B79B6C] transition line-clamp-2"
                          >
                            {item.name}
                          </Link>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.id)}
                          aria-label="حذف المنتج"
                          className="text-[#111111]/45 hover:text-rose-700 transition p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {item.variantLabel && (
                        <p className="text-xs text-[#111111]/60 mt-1">
                          {item.variantLabel}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center border border-[#D8C8B5] bg-white">
                          <button
                            type="button"
                            onClick={() =>
                              updateCartQty(item.id, item.quantity - 1)
                            }
                            aria-label="تقليل الكمية"
                            className="w-7 h-7 flex items-center justify-center text-[#111111] hover:bg-[#F7F4EF]"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center text-xs font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={item.quantity >= item.stockQuantity}
                            onClick={() =>
                              updateCartQty(item.id, item.quantity + 1)
                            }
                            aria-label="زيادة الكمية"
                            className="w-7 h-7 flex items-center justify-center text-[#111111] hover:bg-[#F7F4EF] disabled:opacity-35"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-left">
                          <p className="text-sm font-semibold text-[#111111]">
                            {formatIQD(item.lineTotal)}
                          </p>
                          {item.hasDiscount && (
                            <p className="text-[11px] text-[#111111]/45 line-through">
                              {formatIQD(item.originalPrice * item.quantity)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Summary */}
        {cart.items.length > 0 && (
          <div className="px-6 py-5 bg-white border-t border-[#D8C8B5]/80 space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-[#111111]/75">
                <span>المجموع الفرعي</span>
                <span>{formatIQD(cart.subtotalIqd)}</span>
              </div>
              {cart.discountIqd > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>إجمالي التوفير</span>
                  <span>- {formatIQD(cart.discountIqd)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#111111]/75">
                <span>الشحن (لجميع محافظات العراق)</span>
                <span>
                  {cart.shippingIqd === 0 ? (
                    <span className="text-emerald-700 font-semibold">مجاني</span>
                  ) : (
                    formatIQD(cart.shippingIqd)
                  )}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-[#111111] pt-2.5 border-t border-[#D8C8B5]/60">
                <span>الإجمالي</span>
                <span>{formatIQD(cart.totalIqd)}</span>
              </div>
            </div>

            <div className="pt-2 space-y-2.5">
              <Link
                href={`/store/${genderSlug}/checkout`}
                onClick={() => setCartOpen(false)}
                className="block w-full py-3.5 bg-[#111111] text-[#F7F4EF] text-center text-sm font-semibold hover:bg-[#111111]/90 transition"
              >
                إتمام الطلب
              </Link>
              <Link
                href={`/store/${genderSlug}/cart`}
                onClick={() => setCartOpen(false)}
                className="block w-full py-2.5 border border-[#111111]/25 text-[#111111] text-center text-xs font-medium hover:border-[#111111] transition"
              >
                عرض صفحة السلة الكاملة
              </Link>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
