"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus, Minus, Trash2, ShoppingBag, Truck, ArrowLeft } from "lucide-react";
import { useStore } from "@/components/store/StoreProvider";
import { formatIQD } from "@/lib/format";

export default function CartPage() {
  const params = useParams<{ gender: string }>();
  const genderSlug = params.gender || "men";
  const { cart, updateCartQty, removeCartItem } = useStore();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="pb-8 border-b border-[#D8C8B5]/70 mb-10">
        <h1 className="font-editorial text-3xl sm:text-5xl text-[#111111]">
          سلة التسوق
        </h1>
        <p className="text-sm text-[#111111]/65 mt-2">
          لديك {cart.itemCount} قطعة في السلة (مشتركة بين القسم الرجالي والنسائي)
          • جميع الأسعار بالدينار العراقي
        </p>
      </div>

      {cart.items.length === 0 ? (
        <div className="py-20 px-6 bg-white border border-[#D8C8B5]/60 text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-full bg-[#EFEAE2] flex items-center justify-center mx-auto mb-5">
            <ShoppingBag className="w-7 h-7 text-[#B79B6C]" />
          </div>
          <h2 className="font-editorial text-2xl text-[#111111] mb-2">
            سلة التسوق فارغة
          </h2>
          <p className="text-sm text-[#111111]/65 mb-6">
            اكتشف إكسسوارات AURA الفاخرة وأضف قطعك المفضلة من الرجالي أو النسائي
            إلى السلة.
          </p>
          <Link
            href={`/store/${genderSlug}/products`}
            className="inline-block px-8 py-3.5 bg-[#111111] text-[#F7F4EF] text-sm font-medium hover:bg-[#B79B6C] hover:text-[#111111] transition"
          >
            متابعة التسوق
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Items List */}
          <div className="lg:col-span-8 space-y-4">
            {/* Shipping Progress */}
            <div className="bg-[#EFEAE2] border border-[#D8C8B5]/60 p-4 flex items-center gap-3 text-xs sm:text-sm">
              <Truck className="w-5 h-5 text-[#B79B6C] shrink-0" />
              {cart.remainingForFreeShipping > 0 ? (
                <span>
                  أضف منتجات بقيمة{" "}
                  <strong>{formatIQD(cart.remainingForFreeShipping)}</strong>{" "}
                  للحصول على <strong>شحن مجاني</strong> (الشحن مجاني للطلبات من{" "}
                  {formatIQD(cart.freeShippingThresholdIqd)} فأكثر، وتكلفته{" "}
                  {formatIQD(cart.shippingFeeIqd)} للطلبات الأقل من ذلك).
                </span>
              ) : (
                <span className="text-emerald-800 font-medium">
                  رائع! حصلت على شحن مجاني إلى جميع محافظات العراق الـ18.
                </span>
              )}
            </div>

            {cart.items.map((item) => {
              const sectionTag =
                item.genderName ||
                (item.genderSlug === "women" ? "نسائي" : "رجالي");
              return (
                <div
                  key={item.id}
                  className="bg-white border border-[#D8C8B5]/60 p-4 sm:p-5 flex gap-3 sm:gap-6"
                >
                  <Link
                    href={`/store/${item.genderSlug}/product/${item.slug}`}
                    className="w-20 h-28 sm:w-28 sm:h-32 bg-[#EFEAE2] shrink-0 overflow-hidden"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-contain sm:object-cover"
                    />
                  </Link>

                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-block text-[11px] font-medium px-2 py-0.5 bg-[#EFEAE2] text-[#111111]/75 mb-1.5">
                          {sectionTag}
                        </span>
                        <Link
                          href={`/store/${item.genderSlug}/product/${item.slug}`}
                          className="block text-sm sm:text-base font-semibold text-[#111111] hover:text-[#B79B6C] transition"
                        >
                          {item.name}
                        </Link>
                        {item.variantLabel && (
                          <p className="text-xs text-[#111111]/60 mt-1">
                            {item.variantLabel}
                          </p>
                        )}
                        <p className="text-xs text-[#111111]/55 mt-1">
                          سعر القطعة: {formatIQD(item.unitPrice)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeCartItem(item.id)}
                        aria-label="حذف من السلة"
                        className="text-[#111111]/45 hover:text-rose-700 w-11 h-11 shrink-0 flex items-center justify-center transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-2 border-t border-[#D8C8B5]/35">
                      <div className="flex items-center border border-[#D8C8B5]">
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQty(item.id, item.quantity - 1)
                          }
                          aria-label="تقليل الكمية"
                          className="w-11 h-11 flex items-center justify-center hover:bg-[#F7F4EF]"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-10 text-center text-xs font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={item.quantity >= item.stockQuantity}
                          onClick={() =>
                            updateCartQty(item.id, item.quantity + 1)
                          }
                          aria-label="زيادة الكمية"
                          className="w-11 h-11 flex items-center justify-center hover:bg-[#F7F4EF] disabled:opacity-35"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-left">
                        <p className="text-base font-bold text-[#111111]">
                          {formatIQD(item.lineTotal)}
                        </p>
                        {item.hasDiscount && (
                          <p className="text-xs text-[#111111]/45 line-through">
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

          {/* Summary Card */}
          <div className="lg:col-span-4">
            <div className="bg-white border border-[#D8C8B5]/70 p-6 sticky top-28 space-y-5">
              <h2 className="font-editorial text-2xl text-[#111111] pb-3 border-b border-[#D8C8B5]/50">
                ملخص الطلب
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-[#111111]/75">
                  <span>المجموع الفرعي</span>
                  <span>{formatIQD(cart.subtotalIqd)}</span>
                </div>
                {cart.discountIqd > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>الخصم</span>
                    <span>- {formatIQD(cart.discountIqd)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#111111]/75">
                  <span>الشحن داخل العراق</span>
                  <span>
                    {cart.shippingIqd === 0 ? (
                      <span className="text-emerald-700 font-semibold">
                        مجاني
                      </span>
                    ) : (
                      formatIQD(cart.shippingIqd)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold text-[#111111] pt-3 border-t border-[#D8C8B5]/60">
                  <span>الإجمالي</span>
                  <span>{formatIQD(cart.totalIqd)}</span>
                </div>
              </div>

              <Link
                href={`/store/${genderSlug}/checkout`}
                className="w-full py-4 bg-[#111111] text-[#F7F4EF] hover:bg-[#B79B6C] hover:text-[#111111] text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                <span>إتمام الطلب</span>
                <ArrowLeft className="w-4 h-4" />
              </Link>

              <Link
                href={`/store/${genderSlug}/products`}
                className="block text-center text-xs text-[#111111]/65 hover:text-[#111111] underline"
              >
                متابعة التسوق
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
