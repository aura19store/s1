import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductDetailBySlug, getStoreSettings } from "@/lib/store-queries";
import { ProductDetailClient } from "@/components/store/ProductDetailClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gender: string; slug: string }>;
}): Promise<Metadata> {
  const { gender, slug } = await params;
  const data = getProductDetailBySlug(gender, slug);
  if (!data) return { title: "المنتج غير موجود" };

  return {
    title: data.product.name,
    description: data.product.description.slice(0, 155),
    openGraph: {
      title: `${data.product.name} | AURA`,
      description: data.product.description.slice(0, 155),
      images: [data.product.primary_image],
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ gender: string; slug: string }>;
}) {
  const { gender, slug } = await params;
  const data = getProductDetailBySlug(gender, slug);
  if (!data) notFound();

  const settings = getStoreSettings();

  // Arabic JSON-LD Product Structured Data strictly in IQD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: data.product.name,
    description: data.product.description,
    sku: data.product.sku,
    image: data.product.images.map((i) => i.url),
    brand: {
      "@type": "Brand",
      name: settings.store_name,
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "IQD",
      price: data.product.final_price,
      availability:
        data.product.stock_quantity > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailClient
        product={data.product}
        similar={data.similar}
        alsoLike={data.alsoLike}
        settings={settings}
      />
    </>
  );
}
