"use client";

import React from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useStore } from "./StoreProvider";
import { formatIQD } from "@/lib/format";
import type { StoreProductCard } from "@/lib/store-queries";

export function ProductCard({ product }: { product: StoreProductCard }) {
  const { isWishlisted, toggleWishlist } = useStore();
  const wishlisted = isWishlisted(product.id);
  const outOfStock = product.stock_quantity <= 0;

  let badgeText = "";
  let badgeStyle = "bg-[#111111] text-[#F7F4EF]";
  if (outOfStock) {
    badgeText = "غير متوفر";
    badgeStyle = "bg-stone-600 text-white";
  } else if (product.has_discount && product.discount_percent > 0) {
    badgeText = `خصم ${product.discount_percent}٪`;
    badgeStyle = "bg-[#B79B6C] text-[#111111]";
  } else if (product.is_limited_edition) {
    badgeText = "إصدار محدود";
    badgeStyle = "bg-[#111111] text-[#B79B6C] border border-[#B79B6C]/40";
  } else if (product.is_new_arrival) {
    badgeText = "جديد";
    badgeStyle = "bg-[#111111] text-[#F7F4EF]";
  } else if (product.is_bestseller) {
    badgeText = "الأكثر طلباً";
    badgeStyle = "bg-[#F7F4EF]/95 text-[#111111] border border-[#D8C8B5]";
  }

  return (
    <article className="group flex flex-col">
      <div className="relative aspect-[4/5] bg-[#EFEAE2] overflow-hidden mb-3.5">
        <Link
          href={`/store/${product.gender_slug}/product/${product.slug}`}
          className="block w-full h-full"
        >
          {/* Primary Image */}
          <img
            src={product.primary_image}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-contain sm:object-cover transition-all duration-700 ease-out sm:group-hover:scale-[1.03]"
          />
          {/* Secondary Hover Image */}
          {product.secondary_image &&
            product.secondary_image !== product.primary_image && (
              <img
                src={product.secondary_image}
                alt={product.name}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-contain sm:object-cover opacity-0 transition-opacity duration-500 ease-out sm:group-hover:opacity-100"
              />
            )}
        </Link>

        {/* Badge */}
        {badgeText && (
          <span
            className={`absolute top-3 right-3 px-2.5 py-1 text-[11px] font-semibold tracking-wide ${badgeStyle}`}
          >
            {badgeText}
          </span>
        )}

        {/* Wishlist Heart */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggleWishlist(product.id);
          }}
          aria-label={wishlisted ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
          className={`absolute bottom-2 left-2 sm:bottom-auto sm:top-3 sm:left-3 w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
            wishlisted
              ? "bg-[#111111] text-[#B79B6C]"
              : "bg-[#F7F4EF]/85 text-[#111111] hover:bg-[#111111] hover:text-[#F7F4EF]"
          }`}
        >
          <Heart
            className={`w-4 h-4 ${wishlisted ? "fill-[#B79B6C]" : "stroke-[1.7]"}`}
          />
        </button>
      </div>

      {/* Product Info */}
      <div className="flex flex-col flex-1">
        {product.category_name && (
          <span className="text-[11px] text-[#111111]/55 mb-1">
            {product.category_name}
          </span>
        )}
        <Link
          href={`/store/${product.gender_slug}/product/${product.slug}`}
          className="text-sm sm:text-[15px] font-medium text-[#111111] group-hover:text-[#B79B6C] transition sm:line-clamp-2 leading-snug mb-2"
        >
          {product.name}
        </Link>

        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[#111111]">
              {formatIQD(product.final_price)}
            </span>
            {product.has_discount && (
              <span className="text-xs text-[#111111]/45 line-through">
                {formatIQD(product.original_price)}
              </span>
            )}
          </div>

          {product.colors.length > 0 && (
            <div className="flex items-center gap-1" aria-label="الألوان المتوفرة">
              {product.colors.slice(0, 3).map((c) => (
                <span
                  key={c.slug}
                  title={c.value}
                  className="w-3 h-3 rounded-full border border-[#111111]/20"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
