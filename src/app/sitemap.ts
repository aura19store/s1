import type { MetadataRoute } from "next";
import { queryAll } from "@/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aura.iq";
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, priority: 1 },
    { url: `${baseUrl}/store/men`, lastModified: now, priority: 0.9 },
    { url: `${baseUrl}/store/women`, lastModified: now, priority: 0.9 },
    { url: `${baseUrl}/store/men/products`, lastModified: now, priority: 0.85 },
    { url: `${baseUrl}/store/women/products`, lastModified: now, priority: 0.85 },
    { url: `${baseUrl}/info/contact`, lastModified: now, priority: 0.5 },
    { url: `${baseUrl}/info/shipping`, lastModified: now, priority: 0.5 },
    { url: `${baseUrl}/info/faq`, lastModified: now, priority: 0.5 },
    { url: `${baseUrl}/info/privacy`, lastModified: now, priority: 0.5 },
  ];

  const [categories, products] = await Promise.all([
    queryAll<{ slug: string; gslug: string }>(`
      SELECT c.slug, g.slug as gslug
      FROM categories c JOIN genders g ON g.id = c.gender_id
      WHERE c.is_visible = 1
    `),
    queryAll<{ slug: string; gslug: string; updated_at: string }>(`
      SELECT p.slug, g.slug as gslug, p.updated_at
      FROM products p JOIN genders g ON g.id = p.gender_id
      WHERE p.status = 'active'
    `),
  ]);

  for (const c of categories) {
    entries.push({
      url: `${baseUrl}/store/${c.gslug}/category/${c.slug}`,
      lastModified: now,
      priority: 0.8,
    });
  }

  for (const p of products) {
    entries.push({
      url: `${baseUrl}/store/${p.gslug}/product/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : now,
      priority: 0.75,
    });
  }

  return entries;
}
