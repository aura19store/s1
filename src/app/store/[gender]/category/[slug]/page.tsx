import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { queryOne } from "@/db";
import {
  getDynamicFiltersForGender,
  queryStoreProducts,
} from "@/lib/store-queries";
import { getRenderGenderBySlug as getGenderBySlug } from "@/lib/store-render-queries";
import { ProductsExplorer } from "@/components/store/ProductsExplorer";

export const dynamic = "force-dynamic";

function getCategory(genderId: number, slug: string) {
  return queryOne<{
    id: number;
    slug: string;
    name: string;
    description: string;
    image_url: string;
  }>(
    `SELECT id, slug, name, description, image_url FROM categories WHERE gender_id = ? AND slug = ? AND is_visible = 1`,
    genderId,
    slug
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gender: string; slug: string }>;
}): Promise<Metadata> {
  const { gender: genderSlug, slug } = await params;
  const gender = await getGenderBySlug(genderSlug);
  if (!gender) return { title: "التصنيف" };
  const cat = await getCategory(gender.id, slug);
  if (!cat) return { title: "التصنيف غير موجود" };
  const genderLabel = gender.slug === "women" ? "النسائي" : "الرجالي";
  return {
    title: `${cat.name} — ${genderLabel}`,
    description:
      cat.description ||
      `تسوق تشكيلة ${cat.name} لقسم ${genderLabel} من AURA بأسعار الدينار العراقي.`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ gender: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { gender: genderSlug, slug } = await params;
  const sp = await searchParams;
  const gender = await getGenderBySlug(genderSlug);
  if (!gender) notFound();

  const category = await getCategory(gender.id, slug);
  if (!category) notFound();

  const getStr = (key: string) => {
    const val = sp[key];
    return Array.isArray(val) ? val[0] : val || "";
  };

  const attributes: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(sp)) {
    if (key.startsWith("attr_") && value) {
      const text = Array.isArray(value) ? value[0] : value;
      attributes[key.slice(5)] = text.split(",").map((v) => v.trim()).filter(Boolean);
    }
  }

  const [result, filters] = await Promise.all([
    queryStoreProducts({
      genderId: gender.id,
      categorySlug: category.slug,
      search: getStr("q") || undefined,
      collection: getStr("collection") || undefined,
      minPrice: getStr("minPrice") ? Number(getStr("minPrice")) : undefined,
      maxPrice: getStr("maxPrice") ? Number(getStr("maxPrice")) : undefined,
      availability: (getStr("availability") || "") as "in_stock" | "out_of_stock" | "",
      attributes,
      sort: getStr("sort") || "featured",
      page: Number(getStr("page") || "1"),
      limit: 12,
    }),
    getDynamicFiltersForGender(gender.id, category.slug),
  ]);
  const genderLabel = gender.slug === "women" ? "النسائي" : "الرجالي";

  return (
    <ProductsExplorer
      genderSlug={gender.slug}
      genderName={genderLabel}
      lockedCategorySlug={category.slug}
      pageTitle={category.name}
      pageDescription={category.description}
      initialData={{ ...result, filters }}
    />
  );
}
