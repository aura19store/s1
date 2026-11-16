import { queryAll, queryOne } from "@/db";
import { computeProductPricing, getActivePromotions } from "./pricing";

export interface PaymentMethodConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface StoreSettings {
  store_name: string;
  tagline: string;
  secondary_tagline: string;
  logo_url: string;
  currency_code: string;
  currency_symbol: string;
  country_code: string;
  free_shipping_threshold_iqd: number;
  shipping_fee_iqd: number;
  payment_methods: PaymentMethodConfig[];
  contact_phone: string;
  contact_email: string;
  contact_address: string;
  instagram_url: string;
  tiktok_url: string;
  shipping_policy: string;
  return_policy: string;
  privacy_policy: string;
  faqs: FaqItem[];
  store_info: string;
}

export interface GenderItem {
  id: number;
  slug: string;
  name: string;
  shop_heading: string;
  entry_title: string;
  entry_subtitle: string;
  entry_image: string;
  sort_order: number;
}

export interface CategoryItem {
  id: number;
  gender_id: number;
  parent_id: number | null;
  slug: string;
  name: string;
  description: string;
  image_url: string;
  sort_order: number;
  is_visible: number;
  product_count: number;
}

export interface StoreProductCard {
  id: number;
  sku: string;
  slug: string;
  name: string;
  description: string;
  gender_id: number;
  gender_slug: string;
  category_id: number | null;
  category_name: string;
  category_slug: string;
  price_iqd: number;
  discount_price_iqd: number | null;
  original_price: number;
  final_price: number;
  has_discount: boolean;
  discount_percent: number;
  promotion_name: string | null;
  stock_quantity: number;
  is_featured: boolean;
  is_bestseller: boolean;
  is_new_arrival: boolean;
  is_limited_edition: boolean;
  rating: number;
  review_count: number;
  sales_count: number;
  primary_image: string;
  secondary_image: string;
  images: { id: number; url: string; alt_text: string; sort_order: number }[];
  colors: { value: string; slug: string; hex: string }[];
  materials: string[];
  sizes: string[];
}

export interface HomepageSectionItem {
  id: number;
  section_key: string;
  gender_slug: string;
  type: string;
  title: string;
  subtitle: string;
  description: string;
  cta_text: string;
  cta_link: string;
  image_url: string;
  secondary_title: string;
  secondary_subtitle: string;
  secondary_cta_text: string;
  secondary_cta_link: string;
  secondary_image_url: string;
  sort_order: number;
  is_visible: number;
}

export interface DynamicFilterGroup {
  id: number;
  slug: string;
  name: string;
  type: string;
  options: {
    id: number;
    slug: string;
    value: string;
    color_hex: string;
    count: number;
  }[];
}

export function getStoreSettings(): StoreSettings {
  const row = queryOne<Record<string, unknown>>(
    `SELECT * FROM store_settings WHERE id = 1`
  );
  let paymentMethods: PaymentMethodConfig[] = [];
  let faqs: FaqItem[] = [];
  try {
    paymentMethods = JSON.parse(String(row?.payment_methods_json || "[]"));
  } catch {
    paymentMethods = [];
  }
  try {
    faqs = JSON.parse(String(row?.faq_json || "[]"));
  } catch {
    faqs = [];
  }

  return {
    store_name: String(row?.store_name || "AURA"),
    tagline: String(row?.tagline || "أسلوبك، هالتك."),
    secondary_tagline: String(
      row?.secondary_tagline || "إكسسوارات تصنع حضورك."
    ),
    logo_url: String(row?.logo_url || ""),
    currency_code: "IQD",
    currency_symbol: "د.ع",
    country_code: "IQ",
    free_shipping_threshold_iqd: Number(
      row?.free_shipping_threshold_iqd ?? 25000
    ),
    shipping_fee_iqd: Number(row?.shipping_fee_iqd ?? 3000),
    payment_methods: paymentMethods,
    contact_phone: String(row?.contact_phone || "+964 7769135091"),
    contact_email: String(row?.contact_email || "aura19store@gmail.com"),
    contact_address: String(row?.contact_address || "العراق - صلاح الدين"),
    instagram_url: String(row?.instagram_url || ""),
    tiktok_url: String(row?.tiktok_url || ""),
    shipping_policy: String(row?.shipping_policy || ""),
    return_policy: String(row?.return_policy || ""),
    privacy_policy: String(row?.privacy_policy || ""),
    faqs,
    store_info: String(row?.store_info || ""),
  };
}

export function getGenders(): GenderItem[] {
  return queryAll<GenderItem>(
    `SELECT id, slug, name, shop_heading, entry_title, entry_subtitle, entry_image, sort_order
     FROM genders WHERE is_visible = 1 ORDER BY sort_order ASC, id ASC`
  );
}

export function getGenderBySlug(slug: string): GenderItem | null {
  return queryOne<GenderItem>(
    `SELECT id, slug, name, shop_heading, entry_title, entry_subtitle, entry_image, sort_order
     FROM genders WHERE slug = ? AND is_visible = 1`,
    slug
  );
}

export function getCategoriesByGender(genderId: number): CategoryItem[] {
  return queryAll<CategoryItem>(
    `SELECT c.id, c.gender_id, c.parent_id, c.slug, c.name, c.description, c.image_url, c.sort_order, c.is_visible,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status = 'active') as product_count
     FROM categories c
     WHERE c.gender_id = ? AND c.is_visible = 1 AND c.parent_id IS NULL
     ORDER BY c.sort_order ASC, c.id ASC`,
    genderId
  );
}

export function getHomepageSections(genderSlug: string): HomepageSectionItem[] {
  return queryAll<HomepageSectionItem>(
    `SELECT * FROM homepage_sections
     WHERE gender_slug = ? AND is_visible = 1
     ORDER BY sort_order ASC, id ASC`,
    genderSlug
  );
}

function hydrateProducts(rawRows: Record<string, unknown>[]): StoreProductCard[] {
  if (rawRows.length === 0) return [];
  const ids = rawRows.map((r) => Number(r.id));
  const placeholders = ids.map(() => "?").join(",");

  const imagesRows = queryAll<{
    id: number;
    product_id: number;
    url: string;
    alt_text: string;
    sort_order: number;
    is_primary: number;
  }>(
    `SELECT id, product_id, url, alt_text, sort_order, is_primary
     FROM product_images
     WHERE product_id IN (${placeholders})
     ORDER BY is_primary DESC, sort_order ASC, id ASC`,
    ...ids
  );

  const attrRows = queryAll<{
    product_id: number;
    attr_slug: string;
    val_slug: string;
    val_label: string;
    color_hex: string;
  }>(
    `SELECT pav.product_id, a.slug as attr_slug, av.slug as val_slug, av.value as val_label, av.color_hex
     FROM product_attribute_values pav
     JOIN attributes a ON a.id = pav.attribute_id
     JOIN attribute_values av ON av.id = pav.attribute_value_id
     WHERE pav.product_id IN (${placeholders})
     ORDER BY av.sort_order ASC`,
    ...ids
  );

  const imagesByProd = new Map<
    number,
    { id: number; url: string; alt_text: string; sort_order: number }[]
  >();
  for (const img of imagesRows) {
    const list = imagesByProd.get(img.product_id) ?? [];
    list.push({
      id: img.id,
      url: img.url,
      alt_text: img.alt_text,
      sort_order: img.sort_order,
    });
    imagesByProd.set(img.product_id, list);
  }

  const attrsByProd = new Map<number, typeof attrRows>();
  for (const a of attrRows) {
    const list = attrsByProd.get(a.product_id) ?? [];
    list.push(a);
    attrsByProd.set(a.product_id, list);
  }

  const activePromos = getActivePromotions();

  return rawRows.map((r) => {
    const id = Number(r.id);
    const imgs = imagesByProd.get(id) ?? [];
    const primary = imgs[0]?.url || "/images/brand-story.jpg";
    const secondary = imgs[1]?.url || primary;
    const pAttrs = attrsByProd.get(id) ?? [];

    const pricing = computeProductPricing(
      {
        id,
        gender_id: Number(r.gender_id),
        category_id: r.category_id ? Number(r.category_id) : null,
        price_iqd: Number(r.price_iqd),
        discount_price_iqd:
          r.discount_price_iqd !== null && r.discount_price_iqd !== undefined
            ? Number(r.discount_price_iqd)
            : null,
      },
      activePromos
    );

    return {
      id,
      sku: String(r.sku),
      slug: String(r.slug),
      name: String(r.name),
      description: String(r.description || ""),
      gender_id: Number(r.gender_id),
      gender_slug: String(r.gender_slug || "men"),
      category_id: r.category_id ? Number(r.category_id) : null,
      category_name: String(r.category_name || ""),
      category_slug: String(r.category_slug || ""),
      price_iqd: Number(r.price_iqd),
      discount_price_iqd:
        r.discount_price_iqd !== null && r.discount_price_iqd !== undefined
          ? Number(r.discount_price_iqd)
          : null,
      original_price: pricing.originalPrice,
      final_price: pricing.finalPrice,
      has_discount: pricing.hasDiscount,
      discount_percent: pricing.discountPercent,
      promotion_name: pricing.promotionName,
      stock_quantity: Number(r.stock_quantity),
      is_featured: Boolean(r.is_featured),
      is_bestseller: Boolean(r.is_bestseller),
      is_new_arrival: Boolean(r.is_new_arrival),
      is_limited_edition: Boolean(r.is_limited_edition),
      rating: Number(r.rating || 4.8),
      review_count: Number(r.review_count || 0),
      sales_count: Number(r.sales_count || 0),
      primary_image: primary,
      secondary_image: secondary,
      images: imgs,
      colors: pAttrs
        .filter((a) => a.attr_slug === "color")
        .map((a) => ({
          value: a.val_label,
          slug: a.val_slug,
          hex: a.color_hex || "#111111",
        })),
      materials: pAttrs
        .filter((a) => a.attr_slug === "material")
        .map((a) => a.val_label),
      sizes: pAttrs
        .filter((a) => a.attr_slug === "size")
        .map((a) => a.val_label),
    };
  });
}

export interface ProductQueryOptions {
  genderId: number;
  categorySlug?: string;
  search?: string;
  collection?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: "in_stock" | "out_of_stock" | "";
  attributes?: Record<string, string[]>;
  sort?: string;
  page?: number;
  limit?: number;
}

export function queryStoreProducts(opts: ProductQueryOptions): {
  products: StoreProductCard[];
  total: number;
  page: number;
  totalPages: number;
} {
  const where: string[] = [
    "p.gender_id = ?",
    "p.status = 'active'",
    "(p.category_id IS NULL OR c.is_visible = 1)",
  ];
  const params: (string | number)[] = [opts.genderId];

  if (opts.categorySlug) {
    where.push("c.slug = ?");
    params.push(opts.categorySlug);
  }

  if (opts.collection === "new-arrivals") {
    where.push("p.is_new_arrival = 1");
  } else if (opts.collection === "bestsellers") {
    where.push("p.is_bestseller = 1");
  } else if (opts.collection === "limited-edition") {
    where.push("p.is_limited_edition = 1");
  } else if (opts.collection === "featured") {
    where.push("p.is_featured = 1");
  }

  if (opts.availability === "in_stock") {
    where.push("p.stock_quantity > 0");
  } else if (opts.availability === "out_of_stock") {
    where.push("p.stock_quantity <= 0");
  }

  if (opts.search && opts.search.trim()) {
    const term = `%${opts.search.trim()}%`;
    where.push(`(
      p.name LIKE ? OR p.sku LIKE ? OR p.tags LIKE ? OR p.description LIKE ?
      OR c.name LIKE ?
      OR EXISTS (
        SELECT 1 FROM product_attribute_values pav
        JOIN attribute_values av ON av.id = pav.attribute_value_id
        WHERE pav.product_id = p.id AND av.value LIKE ?
      )
    )`);
    params.push(term, term, term, term, term, term);
  }

  if (opts.attributes) {
    for (const [attrSlug, valSlugs] of Object.entries(opts.attributes)) {
      if (!valSlugs || valSlugs.length === 0) continue;
      const placeholders = valSlugs.map(() => "?").join(",");
      where.push(`EXISTS (
        SELECT 1 FROM product_attribute_values pav
        JOIN attributes a ON a.id = pav.attribute_id
        JOIN attribute_values av ON av.id = pav.attribute_value_id
        WHERE pav.product_id = p.id AND a.slug = ? AND av.slug IN (${placeholders})
      )`);
      params.push(attrSlug, ...valSlugs);
    }
  }

  const rawRows = queryAll<Record<string, unknown>>(
    `SELECT p.*, g.slug as gender_slug, c.name as category_name, c.slug as category_slug
     FROM products p
     JOIN genders g ON g.id = p.gender_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE ${where.join(" AND ")}`,
    ...params
  );

  let hydrated = hydrateProducts(rawRows);

  // Price filter applied accurately on effective price (including active promotions)
  if (typeof opts.minPrice === "number" && !Number.isNaN(opts.minPrice)) {
    hydrated = hydrated.filter((p) => p.final_price >= opts.minPrice!);
  }
  if (typeof opts.maxPrice === "number" && !Number.isNaN(opts.maxPrice)) {
    hydrated = hydrated.filter((p) => p.final_price <= opts.maxPrice!);
  }

  // Sort
  const sort = opts.sort || "featured";
  hydrated.sort((a, b) => {
    if (sort === "price_asc") return a.final_price - b.final_price;
    if (sort === "price_desc") return b.final_price - a.final_price;
    if (sort === "bestselling") return b.sales_count - a.sales_count;
    if (sort === "newest") return b.id - a.id;
    // featured default
    const featDiff = Number(b.is_featured) - Number(a.is_featured);
    if (featDiff !== 0) return featDiff;
    return b.sales_count - a.sales_count;
  });

  const total = hydrated.length;
  const limit = Math.max(1, Math.min(48, opts.limit || 12));
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.max(1, Math.min(totalPages, opts.page || 1));
  const offset = (page - 1) * limit;

  return {
    products: hydrated.slice(offset, offset + limit),
    total,
    page,
    totalPages,
  };
}

export function getDynamicFiltersForGender(
  genderId: number,
  categorySlug?: string
): {
  categories: CategoryItem[];
  attributes: DynamicFilterGroup[];
  collections: { slug: string; label: string; count: number }[];
  availability: { inStock: number; outOfStock: number };
} {
  const categories = getCategoriesByGender(genderId).filter(
    (c) => c.product_count > 0
  );

  const scopeJoin = categorySlug
    ? "JOIN categories c ON c.id = p.category_id AND c.slug = ? AND c.is_visible = 1"
    : "LEFT JOIN categories c ON c.id = p.category_id";
  const scopeWhere = categorySlug
    ? "p.gender_id = ? AND p.status = 'active'"
    : "p.gender_id = ? AND p.status = 'active' AND (p.category_id IS NULL OR c.is_visible = 1)";
  const scopeParams = categorySlug ? [categorySlug, genderId] : [genderId];

  const attrRows = queryAll<{
    attr_id: number;
    attr_slug: string;
    attr_name: string;
    attr_type: string;
    val_id: number;
    val_slug: string;
    val_label: string;
    color_hex: string;
    cnt: number;
  }>(
    `SELECT a.id as attr_id, a.slug as attr_slug, a.name as attr_name, a.type as attr_type,
            av.id as val_id, av.slug as val_slug, av.value as val_label, av.color_hex,
            COUNT(DISTINCT p.id) as cnt
     FROM attributes a
     JOIN attribute_values av ON av.attribute_id = a.id
     JOIN product_attribute_values pav ON pav.attribute_value_id = av.id
     JOIN products p ON p.id = pav.product_id
     ${scopeJoin}
     WHERE a.is_visible = 1 AND a.is_filterable = 1 AND ${scopeWhere}
     GROUP BY av.id
     HAVING cnt > 0
     ORDER BY a.sort_order ASC, av.sort_order ASC`,
    ...scopeParams
  );

  const grouped = new Map<number, DynamicFilterGroup>();
  for (const row of attrRows) {
    let g = grouped.get(row.attr_id);
    if (!g) {
      g = {
        id: row.attr_id,
        slug: row.attr_slug,
        name: row.attr_name,
        type: row.attr_type,
        options: [],
      };
      grouped.set(row.attr_id, g);
    }
    g.options.push({
      id: row.val_id,
      slug: row.val_slug,
      value: row.val_label,
      color_hex: row.color_hex,
      count: row.cnt,
    });
  }

  const colStats = queryOne<{
    new_cnt: number;
    best_cnt: number;
    lim_cnt: number;
    in_stock: number;
    out_stock: number;
  }>(
    `SELECT
       SUM(CASE WHEN p.is_new_arrival = 1 THEN 1 ELSE 0 END) as new_cnt,
       SUM(CASE WHEN p.is_bestseller = 1 THEN 1 ELSE 0 END) as best_cnt,
       SUM(CASE WHEN p.is_limited_edition = 1 THEN 1 ELSE 0 END) as lim_cnt,
       SUM(CASE WHEN p.stock_quantity > 0 THEN 1 ELSE 0 END) as in_stock,
       SUM(CASE WHEN p.stock_quantity <= 0 THEN 1 ELSE 0 END) as out_stock
     FROM products p
     ${scopeJoin}
     WHERE ${scopeWhere}`,
    ...scopeParams
  );

  const collections = [
    {
      slug: "new-arrivals",
      label: "وصل حديثًا",
      count: Number(colStats?.new_cnt || 0),
    },
    {
      slug: "bestsellers",
      label: "الأكثر طلباً",
      count: Number(colStats?.best_cnt || 0),
    },
    {
      slug: "limited-edition",
      label: "إصدار محدود",
      count: Number(colStats?.lim_cnt || 0),
    },
  ].filter((c) => c.count > 0);

  return {
    categories,
    attributes: Array.from(grouped.values()).filter((g) => g.options.length > 0),
    collections,
    availability: {
      inStock: Number(colStats?.in_stock || 0),
      outOfStock: Number(colStats?.out_stock || 0),
    },
  };
}

export function getProductDetailBySlug(
  genderSlug: string,
  productSlug: string
): {
  product: StoreProductCard & {
    details: string;
    materials_info: string;
    tags: string;
    allAttributes: { name: string; slug: string; values: string[] }[];
  };
  similar: StoreProductCard[];
  alsoLike: StoreProductCard[];
} | null {
  const row = queryOne<Record<string, unknown>>(
    `SELECT p.*, g.slug as gender_slug, c.name as category_name, c.slug as category_slug
     FROM products p
     JOIN genders g ON g.id = p.gender_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.slug = ? AND g.slug = ? AND p.status = 'active'
       AND (p.category_id IS NULL OR c.is_visible = 1)`,
    productSlug,
    genderSlug
  );
  if (!row) return null;

  const [hydrated] = hydrateProducts([row]);
  const prodId = hydrated.id;

  const fullAttrs = queryAll<{
    attr_name: string;
    attr_slug: string;
    val_label: string;
  }>(
    `SELECT a.name as attr_name, a.slug as attr_slug, av.value as val_label
     FROM product_attribute_values pav
     JOIN attributes a ON a.id = pav.attribute_id
     JOIN attribute_values av ON av.id = pav.attribute_value_id
     WHERE pav.product_id = ?
     ORDER BY a.sort_order ASC, av.sort_order ASC`,
    prodId
  );

  const attrGrouped = new Map<
    string,
    { name: string; slug: string; values: string[] }
  >();
  for (const a of fullAttrs) {
    const entry = attrGrouped.get(a.attr_slug) ?? {
      name: a.attr_name,
      slug: a.attr_slug,
      values: [],
    };
    entry.values.push(a.val_label);
    attrGrouped.set(a.attr_slug, entry);
  }

  const similarRows = queryAll<Record<string, unknown>>(
    `SELECT p.*, g.slug as gender_slug, c.name as category_name, c.slug as category_slug
     FROM products p
     JOIN genders g ON g.id = p.gender_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.gender_id = ? AND p.category_id = ? AND p.id != ? AND p.status = 'active'
     ORDER BY p.is_featured DESC, p.sales_count DESC
     LIMIT 4`,
    hydrated.gender_id,
    hydrated.category_id ?? -1,
    prodId
  );

  const alsoLikeRows = queryAll<Record<string, unknown>>(
    `SELECT p.*, g.slug as gender_slug, c.name as category_name, c.slug as category_slug
     FROM products p
     JOIN genders g ON g.id = p.gender_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.gender_id = ? AND p.id != ? AND (p.category_id IS NULL OR p.category_id != ?) AND p.status = 'active'
     ORDER BY p.is_bestseller DESC, p.rating DESC
     LIMIT 4`,
    hydrated.gender_id,
    prodId,
    hydrated.category_id ?? -1
  );

  return {
    product: {
      ...hydrated,
      details: String(row.details || ""),
      materials_info: String(row.materials_info || ""),
      tags: String(row.tags || ""),
      allAttributes: Array.from(attrGrouped.values()),
    },
    similar: hydrateProducts(similarRows),
    alsoLike: hydrateProducts(alsoLikeRows),
  };
}

export function getProductsByIds(ids: number[]): StoreProductCard[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = queryAll<Record<string, unknown>>(
    `SELECT p.*, g.slug as gender_slug, c.name as category_name, c.slug as category_slug
     FROM products p
     JOIN genders g ON g.id = p.gender_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id IN (${placeholders}) AND p.status = 'active'`,
    ...ids
  );
  return hydrateProducts(rows);
}
