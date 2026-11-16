"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { ProductCard } from "@/components/store/ProductCard";
import { getGuestTokenHeaders, useStore } from "@/components/store/StoreProvider";
import type { StoreProductCard } from "@/lib/store-queries";

export default function WishlistPage() {
  const params = useParams<{ gender: string }>();
  const genderSlug = params.gender || "men";
  const { wishlistIds } = useStore();
  const [products, setProducts] = useState<StoreProductCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/store/wishlist?gender=${encodeURIComponent(genderSlug)}`,
          { cache: "no-store", headers: getGuestTokenHeaders() }
        );
        if (res.ok && active) {
          const data = await res.json();
          setProducts(data.products || []);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [genderSlug, wishlistIds]);

  const sectionLabel = genderSlug === "women" ? "النسائي" : "الرجالي";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="pb-8 border-b border-[#D8C8B5]/70 mb-10">
        <p className="text-xs font-medium text-[#B79B6C] mb-1.5">
          {sectionLabel}
        </p>
        <h1 className="font-editorial text-3xl sm:text-5xl text-[#111111]">
          قائمة المفضلة
        </h1>
        <p className="text-sm text-[#111111]/65 mt-2">
          القطع المحفوظة في القسم {sectionLabel} ({products.length})
        </p>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center gap-2 text-sm text-[#111111]/60">
          <Loader2 className="w-5 h-5 animate-spin text-[#B79B6C]" />
          <span>جاري تحميل المفضلة...</span>
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 px-6 bg-white border border-[#D8C8B5]/60 text-center max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-full bg-[#EFEAE2] flex items-center justify-center mx-auto mb-4">
            <Heart className="w-6 h-6 text-[#B79B6C]" />
          </div>
          <h2 className="font-editorial text-2xl text-[#111111] mb-2">
            قائمة المفضلة فارغة في القسم {sectionLabel}
          </h2>
          <p className="text-sm text-[#111111]/65 mb-6">
            اضغط على أيقونة القلب لحفظ القطع التي نالت إعجابك والعودة إليها في أي
            وقت.
          </p>
          <Link
            href={`/store/${genderSlug}/products`}
            className="inline-block px-8 py-3.5 bg-[#111111] text-[#F7F4EF] text-sm font-medium hover:bg-[#B79B6C] hover:text-[#111111] transition"
          >
            استكشف التشكيلة
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-7">
          {products.map((prod) => (
            <ProductCard key={prod.id} product={prod} />
          ))}
        </div>
      )}
    </div>
  );
}
