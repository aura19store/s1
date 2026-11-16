import type { DatabaseSync } from "node:sqlite";
import { hashPassword } from "../lib/password";
import { ROLE_PERMISSIONS } from "../lib/constants";

export function seedDatabase(db: DatabaseSync): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    // 1. Roles
    const insertRole = db.prepare(
      `INSERT OR IGNORE INTO roles (slug, name, description, permissions_json) VALUES (?, ?, ?, ?)`
    );
    insertRole.run(
      "super_admin",
      "المدير العام",
      "صلاحيات كاملة لإدارة جميع أقسام المتجر والمستخدمين والإعدادات",
      JSON.stringify(ROLE_PERMISSIONS.super_admin)
    );
    insertRole.run(
      "manager",
      "المدير",
      "إدارة المنتجات والتصنيفات والفلاتر والعروض والمخزون والطلبات",
      JSON.stringify(ROLE_PERMISSIONS.manager)
    );
    insertRole.run(
      "content_manager",
      "مدير المحتوى",
      "إدارة الصفحة الرئيسية والتصنيفات ومكتبة الوسائط والبانرات",
      JSON.stringify(ROLE_PERMISSIONS.content_manager)
    );
    insertRole.run(
      "order_manager",
      "مدير الطلبات",
      "إدارة الطلبات ومتابعة حالات الشحن وبيانات العملاء",
      JSON.stringify(ROLE_PERMISSIONS.order_manager)
    );

    const roleMap = new Map<string, number>();
    for (const r of db.prepare("SELECT id, slug FROM roles").all() as {
      id: number;
      slug: string;
    }[]) {
      roleMap.set(r.slug, r.id);
    }

    // 2. Admin Users (seeded only when ADMIN_SEED_PASSWORD is set in the environment)
    const adminSeedPassword = process.env.ADMIN_SEED_PASSWORD?.trim();
    if (!adminSeedPassword) {
      console.warn(
        "[AURA seed] ADMIN_SEED_PASSWORD is not set; skipping admin user seeding. Set ADMIN_SEED_PASSWORD in your environment before seeding admin accounts."
      );
    } else {
      const insertUser = db.prepare(
        `INSERT OR IGNORE INTO users (name, email, password_hash, role_id, is_active) VALUES (?, ?, ?, ?, 1)`
      );
      const adminPwHash = hashPassword(adminSeedPassword);
      insertUser.run(
        "زيد العامري",
        "admin@aura.iq",
        adminPwHash,
        roleMap.get("super_admin")!
      );
      insertUser.run(
        "نور السامرائي",
        "manager@aura.iq",
        adminPwHash,
        roleMap.get("manager")!
      );
      insertUser.run(
        "سارة العبيدي",
        "content@aura.iq",
        adminPwHash,
        roleMap.get("content_manager")!
      );
      insertUser.run(
        "مصطفى الكاظمي",
        "orders@aura.iq",
        adminPwHash,
        roleMap.get("order_manager")!
      );
    }

    // 3. Genders
    const insertGender = db.prepare(
      `INSERT OR IGNORE INTO genders (slug, name, shop_heading, entry_title, entry_subtitle, entry_image, sort_order, is_visible)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
    );
    insertGender.run(
      "men",
      "رجالي",
      "تسوق الرجالي",
      "رجالي",
      "حضور واثق وتفاصيل مصقولة بعناية",
      "/images/hero-men-editorial.jpg",
      1
    );
    insertGender.run(
      "women",
      "نسائي",
      "تسوق النسائي",
      "نسائي",
      "أناقة هادئة تبرز هالتك الخاصة",
      "/images/hero-women-editorial.jpg",
      2
    );

    const menId = (
      db.prepare("SELECT id FROM genders WHERE slug = 'men'").get() as {
        id: number;
      }
    ).id;
    const womenId = (
      db.prepare("SELECT id FROM genders WHERE slug = 'women'").get() as {
        id: number;
      }
    ).id;

    // 4. Categories (6 Men + 6 Women)
    const insertCat = db.prepare(
      `INSERT OR IGNORE INTO categories (gender_id, slug, name, description, image_url, sort_order, is_visible)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    );

    const menCategories = [
      {
        slug: "watches",
        name: "ساعات",
        description: "ساعات رجالية فاخرة بتصميم عصري وميناء هادئ يعكس الرقي",
        image: "/images/cat-men-watches.jpg",
      },
      {
        slug: "bracelets",
        name: "أساور",
        description: "أساور جلدية ومعدنية مصقولة تضيف لمسة متوازنة لمعصمك",
        image: "/images/cat-men-bracelets.jpg",
      },
      {
        slug: "rings",
        name: "خواتم",
        description: "خواتم رجالية من الفضة والستانلس ستيل بتفاصيل هندسية راقية",
        image: "/images/cat-men-rings.jpg",
      },
      {
        slug: "chains",
        name: "سلاسل",
        description: "سلاسل رجالية أنيقة بخطوط نظيفة وحضور لافت",
        image: "/images/cat-men-chains.jpg",
      },
      {
        slug: "sunglasses",
        name: "نظارات شمسية",
        description: "نظارات شمسية بإطارات أسيتات فاخرة وعدسات حماية متكاملة",
        image: "/images/cat-men-sunglasses.jpg",
      },
      {
        slug: "wallets",
        name: "محافظ",
        description: "محافظ جلد طبيعي فاخرة بتصميم نحيف وعملي",
        image: "/images/cat-men-wallets.jpg",
      },
    ];

    menCategories.forEach((c, i) =>
      insertCat.run(menId, c.slug, c.name, c.description, c.image, i + 1)
    );

    const womenCategories = [
      {
        slug: "necklaces",
        name: "قلائد",
        description: "قلائد ناعمة ومنحوتة بالذهب الهادئ تكمل إطلالتك اليومية والمسائية",
        image: "/images/cat-women-necklaces-v2.jpg",
      },
      {
        slug: "bracelets",
        name: "أساور",
        description: "أساور نسائية مصممة بانسيابية راقية وحرفية عالية",
        image: "/images/cat-women-bracelets.jpg",
      },
      {
        slug: "rings",
        name: "خواتم",
        description: "خواتم فاخرة قابلة للتنسيق بتشطيب ذهبي وفضي متألق",
        image: "/images/cat-women-rings.jpg",
      },
      {
        slug: "earrings",
        name: "أقراط",
        description: "أقراط دائرية وهندسية مرصعة تمنح وجهك إشراقة ناعمة",
        image: "/images/cat-women-earrings.jpg",
      },
      {
        slug: "bags",
        name: "حقائب",
        description: "حقائب نسائية بتصاميم معمارية راقية وألوان حيادية فاخرة",
        image: "/images/cat-women-bags.jpg",
      },
      {
        slug: "sunglasses",
        name: "نظارات شمسية",
        description: "نظارات شمسية نسائية بإطارات منحوتة ولمسات ذهبية راقية",
        image: "/images/cat-women-sunglasses-v2.jpg",
      },
    ];

    womenCategories.forEach((c, i) =>
      insertCat.run(womenId, c.slug, c.name, c.description, c.image, i + 1)
    );

    const catMap = new Map<string, number>();
    for (const c of db
      .prepare(
        `SELECT c.id, c.slug, g.slug as gslug FROM categories c JOIN genders g ON g.id = c.gender_id`
      )
      .all() as { id: number; slug: string; gslug: string }[]) {
      catMap.set(`${c.gslug}:${c.slug}`, c.id);
    }

    // 5. Dynamic Attributes & Values (Filters)
    const insertAttr = db.prepare(
      `INSERT OR IGNORE INTO attributes (slug, name, type, sort_order, is_visible, is_filterable)
       VALUES (?, ?, ?, ?, 1, 1)`
    );
    insertAttr.run("color", "اللون", "color", 1);
    insertAttr.run("material", "الخامة", "select", 2);
    insertAttr.run("size", "المقاس", "size", 3);

    const attrMap = new Map<string, number>();
    for (const a of db.prepare("SELECT id, slug FROM attributes").all() as {
      id: number;
      slug: string;
    }[]) {
      attrMap.set(a.slug, a.id);
    }

    const insertVal = db.prepare(
      `INSERT OR IGNORE INTO attribute_values (attribute_id, slug, value, color_hex, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    );

    const colorValues = [
      { slug: "black", value: "أسود", hex: "#111111" },
      { slug: "silver", value: "فضي", hex: "#C8C8C8" },
      { slug: "gold", value: "ذهبي", hex: "#B79B6C" },
      { slug: "rose-gold", value: "ذهبي وردي", hex: "#CFA38F" },
      { slug: "sand-beige", value: "بيج رملي", hex: "#D8C8B5" },
      { slug: "espresso", value: "بني داكن", hex: "#4E3829" },
    ];
    colorValues.forEach((v, idx) =>
      insertVal.run(attrMap.get("color")!, v.slug, v.value, v.hex, idx + 1)
    );

    const materialValues = [
      { slug: "stainless-steel", value: "ستانلس ستيل" },
      { slug: "leather", value: "جلد" },
      { slug: "silver", value: "فضة" },
      { slug: "gold", value: "ذهب" },
      { slug: "acetate", value: "أسيتات فاخر" },
    ];
    materialValues.forEach((v, idx) =>
      insertVal.run(attrMap.get("material")!, v.slug, v.value, "", idx + 1)
    );

    const sizeValues = [
      { slug: "one-size", value: "مقاس موحد" },
      { slug: "small", value: "صغير" },
      { slug: "medium", value: "متوسط" },
      { slug: "large", value: "كبير" },
    ];
    sizeValues.forEach((v, idx) =>
      insertVal.run(attrMap.get("size")!, v.slug, v.value, "", idx + 1)
    );

    const valMap = new Map<string, { id: number; attrId: number }>();
    for (const v of db
      .prepare(
        `SELECT av.id, av.slug, a.slug as aslug, a.id as attr_id
         FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id`
      )
      .all() as { id: number; slug: string; aslug: string; attr_id: number }[]) {
      valMap.set(`${v.aslug}:${v.slug}`, { id: v.id, attrId: v.attr_id });
    }

    // 6. Collections
    const insertCollection = db.prepare(
      `INSERT OR IGNORE INTO collections (slug, name, description, sort_order, is_visible) VALUES (?, ?, ?, ?, 1)`
    );
    insertCollection.run("new-arrivals", "وصل حديثًا", "أحدث القطع من AURA", 1);
    insertCollection.run(
      "bestsellers",
      "الأكثر طلباً",
      "القطع الأكثر طلباً من عملائنا",
      2
    );
    insertCollection.run(
      "limited-edition",
      "إصدار محدود",
      "إصدارات حصرية بكميات محدودة",
      3
    );

    // 7. Products (24 Luxury Arabic Products: 12 Men + 12 Women)
    type SeedProduct = {
      sku: string;
      slug: string;
      name: string;
      description: string;
      details: string;
      materialsInfo: string;
      gender: "men" | "women";
      category: string;
      price: number;
      discountPrice?: number | null;
      stock: number;
      featured?: boolean;
      bestseller?: boolean;
      newArrival?: boolean;
      limited?: boolean;
      rating: number;
      reviews: number;
      sales: number;
      tags: string;
      images: string[];
      attrs: string[];
    };

    const seedProducts: SeedProduct[] = [
      // === MEN (12) ===
      {
        sku: "AURA-101",
        slug: "men-obsidian-minimal-watch",
        name: "ساعة أوبسيديان السوداء المطفية",
        description:
          "ساعة رجالية فاخرة بهيكل فولاذي أسود مطفي وميناء فحمي مصقول بعقارب ذهبية هادئة، تمنحك حضورًا متزنًا في الاجتماعات والمناسبات المسائية.",
        details:
          "قطر الهيكل 40 ملم • زجاج ياقوتي مقاوم للخدش • مقاومة للماء حتى 50 متر • حركة كوارتز يابانية دقيقة • علبة تقديم فاخرة من AURA.",
        materialsInfo:
          "ستانلس ستيل 316L مقاوم للصدأ بطلاء أسود مطفي عالي الثبات مع عقارب مطلية بالذهب الهادئ.",
        gender: "men",
        category: "watches",
        price: 28000,
        discountPrice: 24500,
        stock: 14,
        featured: true,
        bestseller: true,
        newArrival: false,
        limited: false,
        rating: 4.9,
        reviews: 47,
        sales: 94,
        tags: "ساعة,أسود,ساعات رجالية,فخامة,كلاسيك",
        images: ["/images/cat-men-watches.jpg", "/images/hero-men-banner.jpg"],
        attrs: ["color:black", "color:gold", "material:stainless-steel", "size:one-size"],
      },
      {
        sku: "AURA-102",
        slug: "men-chronos-slate-watch",
        name: "ساعة كرونوس الرمادية الفاخرة",
        description:
          "تصميم معماري نظيف يجمع بين البساطة الراقية والدقة العالية، مصممة للرجل الذي يفضل التفاصيل الهادئة والخطوط المتناسقة.",
        details:
          "قطر الهيكل 41 ملم • سوار معدني قابل للتعديل • قفل مخفي محكم • ضمان لمدة سنة على الآلية.",
        materialsInfo: "ستانلس ستيل مصقول بلمسة فحمية غير لامعة وميناء معدني ناعم.",
        gender: "men",
        category: "watches",
        price: 35000,
        discountPrice: null,
        stock: 6,
        featured: true,
        bestseller: false,
        newArrival: true,
        limited: true,
        rating: 4.9,
        reviews: 21,
        sales: 38,
        tags: "ساعة,إصدار محدود,فولاذ,رجالي",
        images: ["/images/hero-men-editorial.jpg", "/images/cat-men-watches.jpg"],
        attrs: ["color:black", "color:silver", "material:stainless-steel", "size:one-size"],
      },
      {
        sku: "AURA-103",
        slug: "men-braided-leather-bracelet",
        name: "سوار جلد مجدول بقفل معدني مطفي",
        description:
          "سوار رجالي أنيق مصنوع من الجلد الطبيعي المجدول يدويًا مع قفل مغناطيسي محكم من الفولاذ المصقول، مثالي للارتداء اليومي أو بجانب الساعة.",
        details:
          "قفل مغناطيسي مزدوج الأمان • خفيف الوزن ومريح طوال اليوم • متوفر بمقاسات متعددة.",
        materialsInfo: "جلد عجل طبيعي فاخر مع معدن ستانلس ستيل مقاوم للتأكسد.",
        gender: "men",
        category: "bracelets",
        price: 8000,
        discountPrice: 6500,
        stock: 22,
        featured: true,
        bestseller: true,
        newArrival: false,
        limited: false,
        rating: 4.8,
        reviews: 63,
        sales: 132,
        tags: "سوار,جلد,أسود,إكسسوار رجالي",
        images: ["/images/cat-men-bracelets.jpg", "/images/hero-men-banner.jpg"],
        attrs: ["color:black", "color:silver", "material:leather", "size:medium", "size:large"],
      },
      {
        sku: "AURA-104",
        slug: "men-matte-steel-cuff",
        name: "سوار كاف معدني فحمي منحوت",
        description:
          "قطعة هندسية جريئة بخطوط ناعمة وتشطيب فحمي مطفي تعكس ذوقًا عصريًا متفردًا دون أي تكلف.",
        details: "سماكة متوازنة 4 ملم • حواف داخلية مصقولة للراحة • تصميم مفتوح سهل التعديل.",
        materialsInfo: "ستانلس ستيل صلب مقاوم للماء والعرق ولا يتغير لونه.",
        gender: "men",
        category: "bracelets",
        price: 14000,
        discountPrice: 12500,
        stock: 11,
        featured: false,
        bestseller: false,
        newArrival: true,
        limited: false,
        rating: 4.7,
        reviews: 19,
        sales: 41,
        tags: "سوار,كاف,معدن,أسود,جديد",
        images: ["/images/cat-men-bracelets.jpg", "/images/brand-story.jpg"],
        attrs: ["color:black", "material:stainless-steel", "size:medium", "size:large"],
      },
      {
        sku: "AURA-105",
        slug: "men-onyx-signet-ring",
        name: "خاتم سيغنيت فضة بحجر العقيق الأسود",
        description:
          "خاتم رجالي كلاسيكي برؤية معاصرة يجمع بين الفضة المصقولة وحجر الأونيكس الأسود المطفي لإطلالة قوية وراقية.",
        details: "تشطيب مصقول يدويًا • حجر أونيكس طبيعي مسطح • مريح للارتداء اليومي.",
        materialsInfo: "فضة عيار 925 أصلية مع حجر عقيق أسود طبيعي.",
        gender: "men",
        category: "rings",
        price: 19500,
        discountPrice: 17500,
        stock: 9,
        featured: true,
        bestseller: true,
        newArrival: false,
        limited: false,
        rating: 4.9,
        reviews: 52,
        sales: 88,
        tags: "خاتم,فضة,أونيكس,أسود,رجالي",
        images: ["/images/cat-men-rings.jpg", "/images/hero-men-editorial.jpg"],
        attrs: ["color:silver", "color:black", "material:silver", "size:medium", "size:large"],
      },
      {
        sku: "AURA-106",
        slug: "men-brushed-silver-band",
        name: "خاتم باند فضي بتشطيب مصقول",
        description:
          "خاتم بسيط بحواف مشطوفة ولمسة غير لامعة يليق بكل إطلالة رسمية أو كاجوال أنيقة.",
        details: "عرض 6 ملم • ملمس داخلي ناعم • مقاوم للخدوش اليومية.",
        materialsInfo: "فضة إسترليني عيار 925 مع طبقة حماية ضد الأكسدة.",
        gender: "men",
        category: "rings",
        price: 9000,
        discountPrice: null,
        stock: 3, // مخزون منخفض لتجربة تنبيهات لوحة التحكم
        featured: false,
        bestseller: false,
        newArrival: true,
        limited: true,
        rating: 4.8,
        reviews: 15,
        sales: 29,
        tags: "خاتم,فضة,مينيمال,إصدار محدود",
        images: ["/images/cat-men-rings.jpg", "/images/brand-story.jpg"],
        attrs: ["color:silver", "material:silver", "size:small", "size:medium", "size:large"],
      },
      {
        sku: "AURA-107",
        slug: "men-box-link-silver-chain",
        name: "سلسلة بوكس لينك فضية فاخرة",
        description:
          "سلسلة رجالية متينة بنمط الحلقات المربعة المتناسقة، تمنحك تفصيلاً أنيقًا يمكن ارتداؤه بمفرده أو فوق القمصان الداكنة.",
        details: "طول السلسلة 55 سم • عرض 3 ملم • قفل متين سهل الإغلاق.",
        materialsInfo: "ستانلس ستيل مطلي بالفضة الخالصة مقاوم للماء والتأكسد.",
        gender: "men",
        category: "chains",
        price: 12000,
        discountPrice: null,
        stock: 18,
        featured: true,
        bestseller: true,
        newArrival: false,
        limited: false,
        rating: 4.8,
        reviews: 44,
        sales: 76,
        tags: "سلسلة,فضي,رجالي,ستانلس ستيل",
        images: ["/images/cat-men-chains.jpg", "/images/hero-men-banner.jpg"],
        attrs: ["color:silver", "material:stainless-steel", "size:one-size"],
      },
      {
        sku: "AURA-108",
        slug: "men-oxidized-pendant-chain",
        name: "سلسلة فحمية مزدوجة بتفاصيل معدنية",
        description:
          "سلسلة عصرية بتشطيب رمادي مؤكسد داكن تعكس هوية AURA الجريئة والهادئة في آن واحد.",
        details: "طول السلسلة 58 سم • مقاومة للرطوبة والماء • تصميم خفيف ومتوازن.",
        materialsInfo: "ستانلس ستيل مؤكسد عالي الجودة.",
        gender: "men",
        category: "chains",
        price: 16000,
        discountPrice: 14500,
        stock: 12,
        featured: false,
        bestseller: false,
        newArrival: true,
        limited: false,
        rating: 4.7,
        reviews: 17,
        sales: 33,
        tags: "سلسلة,أسود,مؤكسد,وصل حديثًا",
        images: ["/images/cat-men-chains.jpg", "/images/brand-story.jpg"],
        attrs: ["color:black", "material:stainless-steel", "size:one-size"],
      },
      {
        sku: "AURA-109",
        slug: "men-architect-black-sunglasses",
        name: "نظارة أركيتكت الشمسية السوداء",
        description:
          "إطار أسيتات أسود منحوت بزوايا هندسية متقنة ومفصلات ذهبية ناعمة، مع عدسات مستقطبة لحماية فائقة تحت شمس العراق.",
        details:
          "حماية UV400 كاملة • عدسات مضادة للتوهج • علبة جلدية صلبة ومنديل تنظيف فاخر.",
        materialsInfo: "أسيتات إيطالي مصقول يدويًا مع مفصلات معدنية مطلية بالذهب.",
        gender: "men",
        category: "sunglasses",
        price: 22000,
        discountPrice: 19000,
        stock: 15,
        featured: true,
        bestseller: true,
        newArrival: true,
        limited: false,
        rating: 4.9,
        reviews: 39,
        sales: 71,
        tags: "نظارة,نظارات شمسية,أسود,رجالي,حماية",
        images: ["/images/cat-men-sunglasses.jpg", "/images/hero-men-banner.jpg"],
        attrs: ["color:black", "color:gold", "material:acetate", "size:one-size"],
      },
      {
        sku: "AURA-110",
        slug: "men-noir-aviator-sunglasses",
        name: "نظارة نوار بإطار معدني داكن",
        description:
          "نظارة شمسية خفيفة بإطار فولاذي نحيف وعدسات دخانية داكنة، تجمع بين الأناقة اليومية والراحة الفائقة.",
        details: "وزن فائق الخفة • وسادات أنف مريحة • حماية كاملة من الأشعة فوق البنفسجية.",
        materialsInfo: "ستانلس ستيل فائق الخفة مع عدسات بولي كربونات عالية النقاء.",
        gender: "men",
        category: "sunglasses",
        price: 24000,
        discountPrice: null,
        stock: 0, // غير متوفر لتجربة فلتر التوفر وتنبيه المخزون
        featured: false,
        bestseller: false,
        newArrival: false,
        limited: true,
        rating: 4.8,
        reviews: 22,
        sales: 48,
        tags: "نظارة,رجالي,أسود,إصدار محدود",
        images: ["/images/cat-men-sunglasses.jpg", "/images/hero-men-editorial.jpg"],
        attrs: ["color:black", "material:stainless-steel", "size:one-size"],
      },
      {
        sku: "AURA-111",
        slug: "men-slim-leather-bifold-wallet",
        name: "محفظة جلد طبيعي سوداء نحيفة",
        description:
          "محفظة رجالية مصنوعة من الجلد الطبيعي الكامل بخياطة متقنة وتصميم نحيف يحفظ البطاقات والأوراق النقدية بأناقة دون انتفاخ.",
        details:
          "6 جيوب للبطاقات • جيب مزدوج للأوراق النقدية • تقنية حماية البطاقات RFID • علبة هدايا فاخرة.",
        materialsInfo: "جلد طبيعي فاخر كامل الحبيبات مع بطانة داخلية ناعمة.",
        gender: "men",
        category: "wallets",
        price: 18000,
        discountPrice: null,
        stock: 20,
        featured: true,
        bestseller: true,
        newArrival: false,
        limited: false,
        rating: 4.9,
        reviews: 58,
        sales: 112,
        tags: "محفظة,جلد,أسود,رجالي,هدايا",
        images: ["/images/cat-men-wallets.jpg", "/images/hero-men-banner.jpg"],
        attrs: ["color:black", "material:leather", "size:one-size"],
      },
      {
        sku: "AURA-112",
        slug: "men-espresso-cardholder",
        name: "حاملة بطاقات جلدية فاخرة",
        description:
          "حاملة بطاقات فائقة النحافة للرجل العملي، مصنوعة بعناية لتناسب جيب السترة أو البنطال بكل سلاسة.",
        details: "4 فتحات بطاقات وجيب وسطي للأوراق النقدية • خياطة يدوية دقيقة.",
        materialsInfo: "جلد طبيعي معالج بلمسة غير لامعة.",
        gender: "men",
        category: "wallets",
        price: 4500,
        discountPrice: 3500,
        stock: 26,
        featured: false,
        bestseller: false,
        newArrival: true,
        limited: false,
        rating: 4.7,
        reviews: 27,
        sales: 64,
        tags: "محفظة,حاملة بطاقات,جلد,رجالي",
        images: ["/images/cat-men-wallets.jpg", "/images/brand-story.jpg"],
        attrs: ["color:black", "color:espresso", "material:leather", "size:one-size"],
      },

      // === WOMEN (12) ===
      {
        sku: "AURA-201",
        slug: "women-lumiere-gold-chain-necklace",
        name: "قلادة لوميير الذهبية الناعمة",
        description:
          "سلسلة نسائية فائقة الرقة بلمعان ذهبي هادئ تبرز جمال العنق وتنسجم بسلاسة مع الإطلالات اليومية والمسائية على حد سواء.",
        details:
          "طول قابل للتعديل 40-45 سم • مقاومة للماء ولا تسبب حساسية • تأتي في علبة AURA المخملية.",
        materialsInfo: "فضة إسترليني مطلية بالذهب عيار 18 بطبقة سميكة طويلة الأمد.",
        gender: "women",
        category: "necklaces",
        price: 13000,
        discountPrice: 11500,
        stock: 19,
        featured: true,
        bestseller: true,
        newArrival: false,
        limited: false,
        rating: 4.9,
        reviews: 74,
        sales: 145,
        tags: "قلادة,ذهب,نسائي,ناعمة,أنيقة",
        images: ["/images/cat-women-necklaces-v2.jpg", "/images/prod-women-necklace-2.jpg"],
        attrs: ["color:gold", "material:gold", "size:one-size"],
      },
      {
        sku: "AURA-202",
        slug: "women-solaire-bar-pendant",
        name: "قلادة سولير بقطعة هندسية مرصعة",
        description:
          "قلادة راقية تتوسطها قطعة ذهبية مفرغة تحتضن أحجار زركون لامعة تعكس الضوء مع كل حركة بأسلوب فاخر وبسيط.",
        details: "طول السلسلة 44 سم • أحجار زركون عالية النقاء • إغلاق محكم ودقيق.",
        materialsInfo: "معدن نفيس مطلي بالذهب عيار 18 مع أحجار زركون مقصوصة بدقة.",
        gender: "women",
        category: "necklaces",
        price: 22000,
        discountPrice: null,
        stock: 10,
        featured: true,
        bestseller: true,
        newArrival: true,
        limited: true,
        rating: 5.0,
        reviews: 36,
        sales: 82,
        tags: "قلادة,ذهبي,مرصع,إصدار محدود,نسائي",
        images: ["/images/prod-women-necklace-2.jpg", "/images/hero-women-editorial.jpg"],
        attrs: ["color:gold", "material:gold", "size:one-size"],
      },
      {
        sku: "AURA-203",
        slug: "women-sculpted-gold-bangle",
        name: "سوار بانجل ذهبي مصقول بتصميم معماري",
        description:
          "سوار نسائي دائري مصقول بلمعان دافئ يلتف حول المعصم بانسيابية راقية، قطعة أساسية في كل خزانة مجوهرات فاخرة.",
        details: "قفل مفصلي مخفي سهل الفتح والإغلاق • ملمس ناعم ومريح للارتداء طوال اليوم.",
        materialsInfo: "ستانلس ستيل فاخر مطلي بالذهب عيار 18 بتقنية الثبات العالي.",
        gender: "women",
        category: "bracelets",
        price: 18000,
        discountPrice: 16000,
        stock: 16,
        featured: true,
        bestseller: true,
        newArrival: false,
        limited: false,
        rating: 4.9,
        reviews: 51,
        sales: 104,
        tags: "سوار,بانجل,ذهبي,نسائي,فاخر",
        images: ["/images/cat-women-bracelets.jpg", "/images/prod-women-bracelet-2.jpg"],
        attrs: ["color:gold", "material:gold", "size:small", "size:medium"],
      },
      {
        sku: "AURA-204",
        slug: "women-organic-wave-cuff",
        name: "سوار كاف مموج منحوت بالذهب",
        description:
          "تصميم فني مستوحى من انسيابية الطبيعة بتموجات ذهبية تلتقط الضوء بأناقة استثنائية تمنح معصمك حضورًا لا يُنسى.",
        details: "تصميم مفتوح قابل للملاءمة اللطيفة • وزن متوازن يعطي إحساسًا بالفخامة.",
        materialsInfo: "نحاس نفيس مطلي بالذهب عيار 18 وخالٍ من النيكل.",
        gender: "women",
        category: "bracelets",
        price: 19500,
        discountPrice: null,
        stock: 8,
        featured: true,
        bestseller: false,
        newArrival: true,
        limited: true,
        rating: 4.9,
        reviews: 28,
        sales: 59,
        tags: "سوار,كاف,ذهبي,وصل حديثًا,نسائي",
        images: ["/images/prod-women-bracelet-2.jpg", "/images/cat-women-bracelets.jpg"],
        attrs: ["color:gold", "material:gold", "size:one-size"],
      },
      {
        sku: "AURA-205",
        slug: "women-stacking-gold-ring-set",
        name: "طقم خواتم ذهبية متناسقة مرصعة",
        description:
          "مجموعة خواتم ناعمة مصممة للارتداء معًا أو بشكل منفرد، تجمع بين البساطة الذهبية وبريق الأحجار الدقيقة.",
        details: "مجموعة من قطعتين متكاملتين • متوفرة بمقاسات متعددة • تشطيب مقاوم للبهتان.",
        materialsInfo: "فضة إسترليني مطلية بالذهب عيار 18 مع أحجار زركون ناعمة.",
        gender: "women",
        category: "rings",
        price: 9500,
        discountPrice: null,
        stock: 14,
        featured: true,
        bestseller: true,
        newArrival: false,
        limited: false,
        rating: 4.8,
        reviews: 46,
        sales: 91,
        tags: "خاتم,خواتم,ذهبي,طقم,نسائي",
        images: ["/images/cat-women-rings.jpg", "/images/hero-women-banner.jpg"],
        attrs: ["color:gold", "color:rose-gold", "material:gold", "size:small", "size:medium"],
      },
      {
        sku: "AURA-206",
        slug: "women-aura-dome-ring",
        name: "خاتم قبة ذهبي ناعم الملمس",
        description:
          "خاتم مصقول بتصميم قبة ملساء يعبر عن الفخامة الهادئة، قطعة يومية مثالية لكل مناسبة.",
        details: "سطح لامع عاكس للضوء • حواف داخلية مريحة • مقاوم للماء.",
        materialsInfo: "ستانلس ستيل مطلي بالذهب عيار 18 عالي الثبات.",
        gender: "women",
        category: "rings",
        price: 4500,
        discountPrice: null,
        stock: 4, // مخزون منخفض
        featured: false,
        bestseller: false,
        newArrival: true,
        limited: false,
        rating: 4.8,
        reviews: 19,
        sales: 43,
        tags: "خاتم,ذهبي,مينيمال,جديد",
        images: ["/images/cat-women-rings.jpg", "/images/brand-story.jpg"],
        attrs: ["color:gold", "material:stainless-steel", "size:small", "size:medium", "size:large"],
      },
      {
        sku: "AURA-207",
        slug: "women-eternity-crystal-hoops",
        name: "أقراط هوب دائرية مرصعة بالكريستال",
        description:
          "أقراط دائرية فاخرة مرصعة بالكامل من الداخل والخارج لتمنح إشراقة استثنائية من كل زاوية، متوفرة بالذهبي والفضي.",
        details: "قفل نقر محكم وخفيف على الأذن • ترصيع دقيق متناسق • علبة مخملية راقية.",
        materialsInfo: "فضة عيار 925 متوفرة بطلاء ذهبي عيار 18 أو فضي روديوم.",
        gender: "women",
        category: "earrings",
        price: 14500,
        discountPrice: null,
        stock: 17,
        featured: true,
        bestseller: true,
        newArrival: false,
        limited: false,
        rating: 5.0,
        reviews: 68,
        sales: 138,
        tags: "أقراط,حلق,ذهبي,فضي,مرصع,نسائي",
        images: ["/images/cat-women-earrings.jpg", "/images/prod-women-earrings-2.jpg"],
        attrs: ["color:gold", "color:silver", "material:silver", "size:one-size"],
      },
      {
        sku: "AURA-208",
        slug: "women-geometric-pave-earrings",
        name: "أقراط مستطيلة ذهبية مرصعة",
        description:
          "أقراط هندسية حديثة بإطار ذهبي مصقول وصفوف كريستال ناعمة، تضيف لمسة معاصرة راقية لإطلالتك.",
        details: "وزن خفيف مثالي للاستخدام الطويل • إغلاق آمن لا ينزلق.",
        materialsInfo: "ستانلس ستيل مطلي ذهب عيار 18 مع أحجار زركون لامعة.",
        gender: "women",
        category: "earrings",
        price: 8500,
        discountPrice: 7000,
        stock: 21,
        featured: false,
        bestseller: false,
        newArrival: true,
        limited: false,
        rating: 4.9,
        reviews: 31,
        sales: 65,
        tags: "أقراط,ذهبي,هندسي,وصل حديثًا",
        images: ["/images/prod-women-earrings-2.jpg", "/images/cat-women-earrings.jpg"],
        attrs: ["color:gold", "material:gold", "size:one-size"],
      },
      {
        sku: "AURA-209",
        slug: "women-crescent-sand-leather-bag",
        name: "حقيبة كريسنت الجلدية باللون البيج الرملي",
        description:
          "حقيبة يد نسائية بتصميم هلالي منحوت وجلد ناعم بلون بيج رملي دافئ، مزودة بحزام كتف قابل للفصل وإكسسوارات ذهبية هادئة.",
        details:
          "الأبعاد: 24 × 18 × 8 سم • حزام كتف طويل قابل للتعديل والفصل • جيب داخلي بسحاب • كيس قماشي للحفظ.",
        materialsInfo: "جلد طبيعي ناعم ببطانة داخلية قطنية فاخرة وإكسسوارات معدنية ذهبية.",
        gender: "women",
        category: "bags",
        price: 34000,
        discountPrice: 29500,
        stock: 9,
        featured: true,
        bestseller: true,
        newArrival: true,
        limited: true,
        rating: 4.9,
        reviews: 42,
        sales: 79,
        tags: "حقيبة,حقائب,بيج,جلد,نسائي,فخامة",
        images: ["/images/cat-women-bags.jpg", "/images/prod-women-bag-editorial.jpg"],
        attrs: ["color:sand-beige", "color:gold", "material:leather", "size:medium"],
      },
      {
        sku: "AURA-210",
        slug: "women-atelier-shoulder-bag",
        name: "حقيبة أتيليه للكتف بحواف سوداء أنيقة",
        description:
          "حقيبة كتف أنيقة بتباين متناغم بين البيج الدافئ والحواف السوداء المصقولة، مثالية لإطلالات الصباح والعمل والمقاهي الراقية.",
        details: "الأبعاد: 26 × 14 × 7 سم • سحاب علوي انسيابي • مقبض كتف مريح.",
        materialsInfo: "نسيج فاخر مدمج مع جلد طبيعي وحلية معدنية ذهبية.",
        gender: "women",
        category: "bags",
        price: 29000,
        discountPrice: null,
        stock: 13,
        featured: true,
        bestseller: false,
        newArrival: true,
        limited: false,
        rating: 4.8,
        reviews: 24,
        sales: 51,
        tags: "حقيبة,كتف,بيج,أسود,نسائي",
        images: ["/images/prod-women-bag-editorial.jpg", "/images/cat-women-bags.jpg"],
        attrs: ["color:sand-beige", "color:black", "material:leather", "size:medium"],
      },
      {
        sku: "AURA-211",
        slug: "women-velvet-tortoise-sunglasses",
        name: "نظارة كات آي الفاخرة بإطار ذهبي علوي",
        description:
          "نظارة شمسية نسائية بتصميم كات آي منحوت ولمسة معدنية ذهبية علوية مع عدسات بنية متدرجة تمنحك إطلالة واثقة وأنيقة.",
        details: "حماية كاملة UV400 • عدسات متدرجة مريحة للعين • علبة حماية أنيقة من AURA.",
        materialsInfo: "أسيتات فاخر بنقشة دافئة مع شريط معدني مطلي بالذهب.",
        gender: "women",
        category: "sunglasses",
        price: 24500,
        discountPrice: null,
        stock: 15,
        featured: true,
        bestseller: true,
        newArrival: false,
        limited: false,
        rating: 4.9,
        reviews: 35,
        sales: 68,
        tags: "نظارة,نظارات شمسية,ذهبي,بني,نسائي",
        images: ["/images/cat-women-sunglasses-v2.jpg", "/images/hero-women-banner.jpg"],
        attrs: ["color:espresso", "color:gold", "material:acetate", "size:one-size"],
      },
      {
        sku: "AURA-212",
        slug: "women-aurelia-gold-sunglasses",
        name: "نظارة أوريليا بإطار ذهبي خفيف",
        description:
          "تصميم أنثوي ناعم يجمع بين الخطوط الذهبية الرقيقة والعدسات الدافئة لإطلالة صيفية مشرقة وهادئة.",
        details: "عدسات حماية UV400 • إطار خفيف الوزن لا يترك أثرًا • علبة جلدية بيج.",
        materialsInfo: "معدن فائق الخفة مطلي بالذهب مع أطراف أسيتات مريحة.",
        gender: "women",
        category: "sunglasses",
        price: 23500,
        discountPrice: 21000,
        stock: 7,
        featured: false,
        bestseller: false,
        newArrival: true,
        limited: false,
        rating: 4.8,
        reviews: 18,
        sales: 34,
        tags: "نظارة,ذهبي,نسائي,وصل حديثًا",
        images: ["/images/cat-women-sunglasses-v2.jpg", "/images/hero-women-editorial.jpg"],
        attrs: ["color:gold", "color:rose-gold", "material:acetate", "size:one-size"],
      },
    ];

    const insertProduct = db.prepare(`
      INSERT OR IGNORE INTO products (
        sku, slug, name, description, details, materials_info,
        gender_id, category_id, price_iqd, discount_price_iqd,
        stock_quantity, low_stock_threshold, status,
        is_featured, is_bestseller, is_new_arrival, is_limited_edition,
        rating, review_count, sales_count, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5, 'active', ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertImage = db.prepare(`
      INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertPav = db.prepare(`
      INSERT OR IGNORE INTO product_attribute_values (product_id, attribute_id, attribute_value_id)
      VALUES (?, ?, ?)
    `);

    const productIdBySku = new Map<string, number>();

    for (const p of seedProducts) {
      const gId = p.gender === "men" ? menId : womenId;
      const cId = catMap.get(`${p.gender}:${p.category}`) ?? null;
      const res = insertProduct.run(
        p.sku,
        p.slug,
        p.name,
        p.description,
        p.details,
        p.materialsInfo,
        gId,
        cId,
        p.price,
        p.discountPrice ?? null,
        p.stock,
        p.featured ? 1 : 0,
        p.bestseller ? 1 : 0,
        p.newArrival ? 1 : 0,
        p.limited ? 1 : 0,
        p.rating,
        p.reviews,
        p.sales,
        p.tags
      );

      const prodId = Number(res.lastInsertRowid);
      if (prodId > 0) {
        productIdBySku.set(p.sku, prodId);
        p.images.forEach((url, idx) => {
          insertImage.run(prodId, url, p.name, idx, idx === 0 ? 1 : 0);
        });
        for (const aKey of p.attrs) {
          const found = valMap.get(aKey);
          if (found) {
            insertPav.run(prodId, found.attrId, found.id);
          }
        }
      }
    }

    // 8. Promotions
    const insertPromo = db.prepare(`
      INSERT OR IGNORE INTO promotions (
        name, description, discount_type, discount_value, scope_type,
        gender_id, category_id, product_ids_json, starts_at, ends_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertPromo.run(
      "عرض التشكيلة الموسمية",
      "خصم 10٪ إضافي على تشكيلة الحقائب النسائية الفاخرة",
      "percentage",
      10,
      "category",
      womenId,
      catMap.get("women:bags") ?? null,
      "[]",
      "2026-01-01",
      "2027-12-31",
      1
    );
    insertPromo.run(
      "تخفيض خاص على الساعات الرجالية",
      "خصم ثابت 10,000 د.ع على الساعات الرجالية المختارة",
      "fixed",
      10000,
      "category",
      menId,
      catMap.get("men:watches") ?? null,
      "[]",
      "2026-01-01",
      "2027-12-31",
      0
    );

    // 9. Homepage Sections (Men & Women — Dynamic Order, Editable, NO Newsletter)
    const insertSection = db.prepare(`
      INSERT OR IGNORE INTO homepage_sections (
        section_key, gender_slug, type, title, subtitle, description,
        cta_text, cta_link, image_url,
        secondary_title, secondary_subtitle, secondary_cta_text, secondary_cta_link, secondary_image_url,
        sort_order, is_visible
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const menSections = [
      {
        key: "hero",
        type: "hero",
        title: "اصنع حضورك",
        subtitle: "تشكيلة AURA الرجالية",
        description: "اكتشف تشكيلة AURA الرجالية من الساعات والأساور والخواتم والنظارات المصممة بعناية لتكمل حضورك.",
        ctaText: "تسوق الرجالي",
        ctaLink: "/store/men/products",
        image: "/images/hero-men-banner.jpg",
      },
      {
        key: "categories",
        type: "categories",
        title: "تسوق الرجالي",
        subtitle: "اختر حسب التصنيف",
        description: "استكشف إكسسوارات AURA الرجالية المصممة بتفاصيل دقيقة.",
        ctaText: "عرض الكل",
        ctaLink: "/store/men/products",
        image: "",
      },
      {
        key: "bestsellers",
        type: "bestsellers",
        title: "الأكثر طلباً",
        subtitle: "القطع الأكثر طلباً من عملائنا.",
        description: "",
        ctaText: "استعرض الأكثر طلباً",
        ctaLink: "/store/men/products?collection=bestsellers",
        image: "",
      },
      {
        key: "new_arrivals",
        type: "new_arrivals",
        title: "وصل حديثًا",
        subtitle: "أحدث القطع من AURA.",
        description: "",
        ctaText: "استعرض الجديد",
        ctaLink: "/store/men/products?collection=new-arrivals",
        image: "",
      },
      {
        key: "story",
        type: "story",
        title: "هالتك هي توقيعك.",
        subtitle: "قصة AURA",
        description:
          "تم إنشاء AURA لمن يؤمنون بأن التفاصيل الصغيرة يمكن أن تصنع الفرق الأكبر. كل قطعة نصممها تُصاغ بروح البساطة الفاخرة لترافق حضورك بهدوء وثقة.",
        ctaText: "اكتشف التشكيلة",
        ctaLink: "/store/men/products",
        image: "/images/brand-story.jpg",
      },
      {
        key: "featured",
        type: "featured",
        title: "مختارات AURA",
        subtitle: "قطع منتقاة بعناية لأسلوبك اليومي.",
        description: "",
        ctaText: "تصفح جميع القطع",
        ctaLink: "/store/men/products",
        image: "",
      },
      {
        key: "promo_split",
        type: "promo_split",
        title: "AURA الرجالي",
        subtitle: "اكتشف التشكيلة الرجالية",
        description: "",
        ctaText: "تسوق الرجالي",
        ctaLink: "/store/men",
        image: "/images/hero-men-editorial.jpg",
        secTitle: "AURA النسائي",
        secSubtitle: "اكتشفي التشكيلة النسائية",
        secCtaText: "تسوقي النسائي",
        secCtaLink: "/store/women",
        secImage: "/images/hero-women-editorial.jpg",
      },
    ];

    menSections.forEach((s, idx) =>
      insertSection.run(
        s.key,
        "men",
        s.type,
        s.title,
        s.subtitle,
        s.description,
        s.ctaText,
        s.ctaLink,
        s.image,
        s.secTitle ?? "",
        s.secSubtitle ?? "",
        s.secCtaText ?? "",
        s.secCtaLink ?? "",
        s.secImage ?? "",
        idx + 1
      )
    );

    const womenSections = [
      {
        key: "hero",
        type: "hero",
        title: "أسلوبك، هالتك.",
        subtitle: "تشكيلة AURA النسائية",
        description: "اكتشفي تشكيلة AURA النسائية من القلائد والأساور والأقراط والحقائب الفاخرة بلمسة هادئة وعصرية.",
        ctaText: "تسوقي النسائي",
        ctaLink: "/store/women/products",
        image: "/images/hero-women-banner.jpg",
      },
      {
        key: "categories",
        type: "categories",
        title: "تسوق النسائي",
        subtitle: "اختاري حسب التصنيف",
        description: "تشكيلة متكاملة من الإكسسوارات النسائية الفاخرة.",
        ctaText: "عرض الكل",
        ctaLink: "/store/women/products",
        image: "",
      },
      {
        key: "bestsellers",
        type: "bestsellers",
        title: "الأكثر طلباً",
        subtitle: "القطع الأكثر طلباً من عملائنا.",
        description: "",
        ctaText: "استعرضي الأكثر طلباً",
        ctaLink: "/store/women/products?collection=bestsellers",
        image: "",
      },
      {
        key: "new_arrivals",
        type: "new_arrivals",
        title: "وصل حديثًا",
        subtitle: "أحدث القطع من AURA.",
        description: "",
        ctaText: "استعرضي الجديد",
        ctaLink: "/store/women/products?collection=new-arrivals",
        image: "",
      },
      {
        key: "story",
        type: "story",
        title: "هالتك هي توقيعك.",
        subtitle: "قصة AURA",
        description:
          "تم إنشاء AURA لمن يؤمنون بأن التفاصيل الصغيرة يمكن أن تصنع الفرق الأكبر. كل قطعة تُصمم لتتناغم مع حضورك الطبيعي وتضفي عليه إشراقة لا تتلاشى.",
        ctaText: "اكتشفي التشكيلة",
        ctaLink: "/store/women/products",
        image: "/images/brand-story.jpg",
      },
      {
        key: "featured",
        type: "featured",
        title: "مختارات AURA",
        subtitle: "قطع أيقونية منتقاة لإطلالة استثنائية.",
        description: "",
        ctaText: "تصفحي جميع القطع",
        ctaLink: "/store/women/products",
        image: "",
      },
      {
        key: "promo_split",
        type: "promo_split",
        title: "AURA الرجالي",
        subtitle: "اكتشف التشكيلة الرجالية",
        description: "",
        ctaText: "تسوق الرجالي",
        ctaLink: "/store/men",
        image: "/images/hero-men-editorial.jpg",
        secTitle: "AURA النسائي",
        secSubtitle: "اكتشفي التشكيلة النسائية",
        secCtaText: "تسوقي النسائي",
        secCtaLink: "/store/women",
        secImage: "/images/hero-women-editorial.jpg",
      },
    ];

    womenSections.forEach((s, idx) =>
      insertSection.run(
        s.key,
        "women",
        s.type,
        s.title,
        s.subtitle,
        s.description,
        s.ctaText,
        s.ctaLink,
        s.image,
        s.secTitle ?? "",
        s.secSubtitle ?? "",
        s.secCtaText ?? "",
        s.secCtaLink ?? "",
        s.secImage ?? "",
        idx + 1
      )
    );

    // 10. Media Library
    const insertMedia = db.prepare(`
      INSERT OR IGNORE INTO media (filename, url, category, alt_text, mime_type, size_bytes)
      VALUES (?, ?, ?, ?, 'image/jpeg', 150000)
    `);
    const mediaList: [string, string, string, string][] = [
      ["hero-men-editorial.jpg", "/images/hero-men-editorial.jpg", "banners", "واجهة دخول القسم الرجالي"],
      ["hero-women-editorial.jpg", "/images/hero-women-editorial.jpg", "banners", "واجهة دخول القسم النسائي"],
      ["hero-men-banner.jpg", "/images/hero-men-banner.jpg", "hero", "البانر الرئيسي للقسم الرجالي"],
      ["hero-women-banner.jpg", "/images/hero-women-banner.jpg", "hero", "البانر الرئيسي للقسم النسائي"],
      ["brand-story.jpg", "/images/brand-story.jpg", "brand", "قصة العلامة التجارية AURA"],
      ["cat-men-watches.jpg", "/images/cat-men-watches.jpg", "categories", "ساعات رجالية فاخرة"],
      ["cat-men-bracelets.jpg", "/images/cat-men-bracelets.jpg", "categories", "أساور رجالية فاخرة"],
      ["cat-men-rings.jpg", "/images/cat-men-rings.jpg", "categories", "خواتم رجالية فاخرة"],
      ["cat-men-chains.jpg", "/images/cat-men-chains.jpg", "categories", "سلاسل رجالية فاخرة"],
      ["cat-men-sunglasses.jpg", "/images/cat-men-sunglasses.jpg", "categories", "نظارات شمسية رجالية"],
      ["cat-men-wallets.jpg", "/images/cat-men-wallets.jpg", "categories", "محافظ جلدية رجالية"],
      ["cat-women-necklaces-v2.jpg", "/images/cat-women-necklaces-v2.jpg", "categories", "قلائد نسائية ذهبية"],
      ["cat-women-bracelets.jpg", "/images/cat-women-bracelets.jpg", "categories", "أساور نسائية ذهبية"],
      ["cat-women-rings.jpg", "/images/cat-women-rings.jpg", "categories", "خواتم نسائية فاخرة"],
      ["cat-women-earrings.jpg", "/images/cat-women-earrings.jpg", "categories", "أقراط نسائية مرصعة"],
      ["cat-women-bags.jpg", "/images/cat-women-bags.jpg", "categories", "حقائب نسائية فاخرة"],
      ["cat-women-sunglasses-v2.jpg", "/images/cat-women-sunglasses-v2.jpg", "categories", "نظارات شمسية نسائية"],
      ["prod-women-necklace-2.jpg", "/images/prod-women-necklace-2.jpg", "products", "قلادة ذهبية هندسية"],
      ["prod-women-bracelet-2.jpg", "/images/prod-women-bracelet-2.jpg", "products", "سوار كاف ذهبي مموج"],
      ["prod-women-earrings-2.jpg", "/images/prod-women-earrings-2.jpg", "products", "أقراط مستطيلة مرصعة"],
      ["prod-women-bag-editorial.jpg", "/images/prod-women-bag-editorial.jpg", "products", "حقيبة كتف بيج أنيقة"],
    ];
    for (const [fn, url, cat, alt] of mediaList) {
      insertMedia.run(fn, url, cat, alt);
    }

    // 11. Sample Customers & Realistic Iraqi Orders (in IQD)
    const insertCustomer = db.prepare(`
      INSERT OR IGNORE INTO customers (name, phone, email, governorate, city, address, orders_count, total_spent_iqd, last_order_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertOrder = db.prepare(`
      INSERT OR IGNORE INTO orders (
        order_number, customer_id, customer_name, customer_phone, customer_email,
        governorate, city, address, notes, payment_method, payment_status,
        currency_code, subtotal_iqd, discount_iqd, shipping_iqd, total_iqd, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IQD', ?, ?, ?, ?, ?, ?)
    `);
    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, product_name, product_sku, product_image,
        variant_label, quantity, unit_price_iqd, total_price_iqd
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const sampleOrders = [
      {
        num: "AURA-2026-1001",
        name: "علي حسين الجبوري",
        phone: "07701234561",
        email: "ali.jubouri@example.iq",
        gov: "بغداد",
        city: "المنصور",
        addr: "شارع 14 رمضان، محلة 609، بناية 12",
        notes: "التوصيل بعد الساعة الخامسة مساءً",
        subtotal: 136000,
        discount: 0,
        shipping: 0,
        total: 136000,
        status: "delivered",
        date: "2026-11-10 14:20:00",
        items: [
          {
            sku: "AURA-101",
            name: "ساعة أوبسيديان السوداء المطفية",
            img: "/images/cat-men-watches.jpg",
            variant: "أسود • مقاس موحد",
            qty: 1,
            price: 109000,
          },
          {
            sku: "AURA-103",
            name: "سوار جلد مجدول بقفل معدني مطفي",
            img: "/images/cat-men-bracelets.jpg",
            variant: "أسود • متوسط",
            qty: 1,
            price: 27000,
          },
        ],
      },
      {
        num: "AURA-2026-1002",
        name: "مريم طارق الربيعي",
        phone: "07809876542",
        email: "mariam.r@example.iq",
        gov: "أربيل",
        city: "عنكاوا",
        addr: "مجمع إمباير السكني، عمارة B4",
        notes: "تغليف هدايا إن أمكن",
        subtotal: 130200,
        discount: 0,
        shipping: 0,
        total: 130200,
        status: "delivered",
        date: "2026-11-12 11:05:00",
        items: [
          {
            sku: "AURA-209",
            name: "حقيبة كريسنت الجلدية باللون البيج الرملي",
            img: "/images/cat-women-bags.jpg",
            variant: "بيج رملي • متوسط",
            qty: 1,
            price: 88200,
          },
          {
            sku: "AURA-201",
            name: "قلادة لوميير الذهبية الناعمة",
            img: "/images/cat-women-necklaces-v2.jpg",
            variant: "ذهبي • مقاس موحد",
            qty: 1,
            price: 42000,
          },
        ],
      },
      {
        num: "AURA-2026-1003",
        name: "حيدر فاضل الموسوي",
        phone: "07714567893",
        email: "haider.m@example.iq",
        gov: "البصرة",
        city: "العشار",
        addr: "قرب كورنيش شط العرب، شارع الجزائر",
        notes: "",
        subtotal: 46000,
        discount: 0,
        shipping: 3000,
        total: 49000,
        status: "shipped",
        date: "2026-11-14 16:40:00",
        items: [
          {
            sku: "AURA-105",
            name: "خاتم سيغنيت فضة بحجر العقيق الأسود",
            img: "/images/cat-men-rings.jpg",
            variant: "فضي • كبير",
            qty: 1,
            price: 46000,
          },
        ],
      },
      {
        num: "AURA-2026-1004",
        name: "داليا كريم الزبيدي",
        phone: "07503344556",
        email: "dalia.z@example.iq",
        gov: "بغداد",
        city: "الجادرية",
        addr: "قرب جامعة بغداد، زقاق 18، دار 7",
        notes: "الاتصال قبل الوصول بنصف ساعة",
        subtotal: 94000,
        discount: 0,
        shipping: 0,
        total: 94000,
        status: "processing",
        date: "2026-11-15 09:30:00",
        items: [
          {
            sku: "AURA-207",
            name: "أقراط هوب دائرية مرصعة بالكريستال",
            img: "/images/cat-women-earrings.jpg",
            variant: "ذهبي • مقاس موحد",
            qty: 1,
            price: 49000,
          },
          {
            sku: "AURA-203",
            name: "سوار بانجل ذهبي مصقول بتصميم معماري",
            img: "/images/cat-women-bracelets.jpg",
            variant: "ذهبي • متوسط",
            qty: 1,
            price: 45000,
          },
        ],
      },
      {
        num: "AURA-2026-1005",
        name: "عمر نزار الدليمي",
        phone: "07812233445",
        email: "omar.d@example.iq",
        gov: "النجف",
        city: "حي السعد",
        addr: "الشارع الرئيسي قرب مول النجف",
        notes: "",
        subtotal: 108500,
        discount: 0,
        shipping: 0,
        total: 108500,
        status: "confirmed",
        date: "2026-11-15 19:15:00",
        items: [
          {
            sku: "AURA-109",
            name: "نظارة أركيتكت الشمسية السوداء",
            img: "/images/cat-men-sunglasses.jpg",
            variant: "أسود • مقاس موحد",
            qty: 1,
            price: 59000,
          },
          {
            sku: "AURA-111",
            name: "محفظة جلد طبيعي سوداء نحيفة",
            img: "/images/cat-men-wallets.jpg",
            variant: "أسود • مقاس موحد",
            qty: 1,
            price: 49500,
          },
        ],
      },
      {
        num: "AURA-2026-1006",
        name: "نور الهدى سلمان",
        phone: "07725566778",
        email: "noor.s@example.iq",
        gov: "بغداد",
        city: "الكرادة",
        addr: "الكرادة داخل، قرب ساحة كهرمانة",
        notes: "",
        subtotal: 65000,
        discount: 0,
        shipping: 0,
        total: 65000,
        status: "pending",
        date: "2026-11-16 08:45:00",
        items: [
          {
            sku: "AURA-202",
            name: "قلادة سولير بقطعة هندسية مرصعة",
            img: "/images/prod-women-necklace-2.jpg",
            variant: "ذهبي • مقاس موحد",
            qty: 1,
            price: 65000,
          },
        ],
      },
    ];

    for (const o of sampleOrders) {
      insertCustomer.run(
        o.name,
        o.phone,
        o.email,
        o.gov,
        o.city,
        o.addr,
        1,
        o.total,
        o.date
      );
      const cust = db
        .prepare("SELECT id FROM customers WHERE phone = ?")
        .get(o.phone) as { id: number };
      const orderRes = insertOrder.run(
        o.num,
        cust.id,
        o.name,
        o.phone,
        o.email,
        o.gov,
        o.city,
        o.addr,
        o.notes,
        "الدفع عند الاستلام",
        o.status === "delivered" ? "paid" : "pending",
        o.subtotal,
        o.discount,
        o.shipping,
        o.total,
        o.status,
        o.date
      );
      const orderId = Number(orderRes.lastInsertRowid);
      if (orderId > 0) {
        for (const it of o.items) {
          insertOrderItem.run(
            orderId,
            productIdBySku.get(it.sku) ?? null,
            it.name,
            it.sku,
            it.img,
            it.variant,
            it.qty,
            it.price,
            it.price * it.qty
          );
        }
      }
    }

    // 12. Store Settings (IQD ONLY, Iraq ONLY)
    const paymentMethods = [
      {
        id: "cod",
        name: "الدفع عند الاستلام",
        description: "ادفع نقدًا بالدينار العراقي عند استلام طلبك بكل سهولة وأمان",
        enabled: true,
      },
      {
        id: "mastercard",
        name: "ماستر كارد",
        description: "التحويل المباشر عبر بطاقة ماستر كارد",
        enabled: true,
      },
    ];

    const faqs = [
      {
        question: "ما هي مدة التوصيل داخل العراق؟",
        answer:
          "تصل الطلبات خلال 1-2 يوم عمل إلى جميع المحافظات العراقية الـ18.",
      },
      {
        question: "كم تبلغ رسوم الشحن؟",
        answer:
          "الشحن مجاني للطلبات بقيمة 25,000 د.ع أو أكثر، وبتكلفة ثابتة قدرها 3,000 د.ع للطلبات الأقل من 25,000 د.ع لجميع محافظات العراق الـ18.",
      },
      {
        question: "ما هي طرق الدفع المتوفرة؟",
        answer:
          "يتوفر الدفع عند الاستلام بالدينار العراقي، كما يتوفر الدفع عبر ماستر كارد مع إمكانية إرسال وصل التحويل عبر واتساب عند إرسال هدية.",
      },
      {
        question: "هل الإكسسوارات مقاومة للماء ولا يتغير لونها؟",
        answer:
          "نحرص في AURA على اختيار خامات عالية الجودة مثل الفضة عيار 925 والستانلس ستيل المطلي بطبقات عالية الثبات لضمان دوام اللمعان مع العناية المناسبة.",
      },
    ];

    db.prepare(
      `INSERT OR IGNORE INTO store_settings (
        id, store_name, tagline, secondary_tagline, logo_url,
        currency_code, currency_symbol, country_code,
        free_shipping_threshold_iqd, shipping_fee_iqd,
        payment_methods_json, contact_phone, contact_email, contact_address,
        instagram_url, tiktok_url,
        shipping_policy, return_policy, privacy_policy, faq_json, store_info
      ) VALUES (1, ?, ?, ?, ?, 'IQD', 'د.ع', 'IQ', 25000, 3000, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "AURA",
      "أسلوبك، هالتك.",
      "إكسسوارات تصنع حضورك.",
      "",
      JSON.stringify(paymentMethods),
      "+964 7769135091",
      "aura19store@gmail.com",
      "العراق - صلاح الدين",
      "",
      "",
      "نوفر خدمة توصيل سريعة وموثوقة إلى جميع محافظات العراق الـ18. الشحن مجاني للطلبات بقيمة 25,000 د.ع أو أكثر، وبتكلفة ثابتة قدرها 3,000 د.ع للطلبات الأقل من 25,000 د.ع. تصل الطلبات خلال 1-2 يوم عمل إلى جميع المحافظات العراقية.",
      "",
      "نحترم خصوصيتك في AURA ونلتزم بحماية بياناتك الشخصية. نستخدم معلومات التواصل والعنوان فقط لإتمام طلباتك وتوصيلها بأعلى مستوى من الخدمة، ولا نشارك بياناتك مع أي جهات خارجية غير مخولة.",
      JSON.stringify(faqs),
      "AURA علامة عراقية معاصرة متخصصة بالإكسسوارات الفاخرة للرجال والنساء، تؤمن بأن الأناقة الحقيقية تكمن في التفاصيل الهادئة التي تصنع حضورك وتميز أسلوبك."
    );

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
