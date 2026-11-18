import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getDynamicFiltersForGender,
  queryStoreProducts,
} from "@/lib/store-queries";
import { getRenderGenderBySlug as getGenderBySlug } from "@/lib/store-render-queries";
import { ProductsExplorer } from "@/components/store/ProductsExplorer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gender: string }>;
}): Promise<Metadata> {
  const { gender: genderSlug } = await params;
  const gender = await getGenderBySlug(genderSlug);
  if (!gender) return { title: "المنتجات" };
  const label = gender.slug === "women" ? "النسائي" : "الرجالي";
  return {
    title: `تسوق ${label}`,
    description: `تصفح تشكيلة AURA الكاملة من الإكسسوارات الفاخرة لقسم ${label} بالأسعار بالدينار العراقي.`,
  };
}

export default async function GenderProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ gender: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { gender: genderSlug } = await params;
  const sp = await searchParams;
  const gender = await getGenderBySlug(genderSlug);
  if (!gender) notFound();

  const getStr = (key: string) => {
    const val = sp[key];
    return Array.isArray(val) ? val[0] : val || "";
  };

  const categorySlug = getStr("category") || undefined;
  const collection = getStr("collection") || undefined;
  const search = getStr("q") || undefined;
  const sort = getStr("sort") || "featured";
  const page = Number(getStr("page") || "1");
  const minPrice = getStr("minPrice") ? Number(getStr("minPrice")) : undefined;
  const maxPrice = getStr("maxPrice") ? Number(getStr("maxPrice")) : undefined;
  const availability = (getStr("availability") || "") as
    | "in_stock"
    | "out_of_stock"
    | "";

  const attributes: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (k.startsWith("attr_") && v) {
      const str = Array.isArray(v) ? v[0] : v;
      attributes[k.slice(5)] = str.split(",").filter(Boolean);
    }
  }

  const [result, filters] = await Promise.all([
    queryStoreProducts({
      genderId: gender.id,
      categorySlug,
      collection,
      search,
      minPrice,
      maxPrice,
      availability,
      attributes,
      sort,
      page,
      limit: 12,
    }),
    getDynamicFiltersForGender(gender.id, categorySlug),
  ]);

  const genderLabel = gender.slug === "women" ? "النسائي" : "الرجالي";
  let pageTitle = genderLabel;
  if (collection === "new-arrivals") pageTitle = `وصل حديثًا — ${genderLabel}`;
  else if (collection === "bestsellers")
    pageTitle = `الأكثر طلباً — ${genderLabel}`;
  else if (collection === "limited-edition")
    pageTitle = `إصدار محدود — ${genderLabel}`;

  return (
    <ProductsExplorer
      genderSlug={gender.slug}
      genderName={genderLabel}
      pageTitle={pageTitle}
      pageDescription={gender.entry_subtitle}
      initialData={{ ...result, filters }}
    />
  );
}
