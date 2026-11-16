export const IRAQI_GOVERNORATES = [
  "بغداد",
  "البصرة",
  "نينوى",
  "أربيل",
  "السليمانية",
  "دهوك",
  "النجف",
  "كربلاء",
  "بابل",
  "الأنبار",
  "ديالى",
  "كركوك",
  "صلاح الدين",
  "واسط",
  "ميسان",
  "ذي قار",
  "المثنى",
  "القادسية",
] as const;

export const AURA_CONTACT = {
  phoneDisplay: "+964 7769135091",
  phoneHref: "+9647769135091",
  whatsappDigits: "9647769135091",
  email: "aura19store@gmail.com",
  location: "العراق - صلاح الدين",
  mastercardNumber: "2998557033",
} as const;

export const AURA_SHIPPING_TEXT =
  "نوفر خدمة توصيل سريعة وموثوقة إلى جميع محافظات العراق الـ18. الشحن مجاني للطلبات بقيمة 25,000 د.ع أو أكثر، وبتكلفة ثابتة قدرها 3,000 د.ع للطلبات الأقل من 25,000 د.ع. تصل الطلبات خلال 1-2 يوم عمل إلى جميع المحافظات العراقية.";

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  confirmed: "تم التأكيد",
  processing: "قيد التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغى",
};

export const ORDER_STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  confirmed: "bg-sky-50 text-sky-800 border-sky-200",
  processing: "bg-indigo-50 text-indigo-800 border-indigo-200",
  shipped: "bg-purple-50 text-purple-800 border-purple-200",
  delivered: "bg-emerald-50 text-emerald-800 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-800 border-rose-200",
};

export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  active: "نشط",
  hidden: "مخفي",
  draft: "مسودة",
};

export const PRODUCT_STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-800 border-emerald-200",
  hidden: "bg-stone-100 text-stone-700 border-stone-300",
  draft: "bg-amber-50 text-amber-800 border-amber-200",
};

export const MEDIA_CATEGORY_LABELS: Record<string, string> = {
  products: "المنتجات",
  categories: "التصنيفات",
  hero: "الواجهة الرئيسية",
  banners: "البانرات",
  brand: "العلامة التجارية",
};

export const ROLE_PERMISSIONS = {
  super_admin: [
    "dashboard",
    "products",
    "categories",
    "filters",
    "homepage",
    "media",
    "promotions",
    "inventory",
    "orders",
    "customers",
    "users",
    "settings",
  ],
  manager: [
    "dashboard",
    "products",
    "categories",
    "filters",
    "promotions",
    "inventory",
    "orders",
  ],
  content_manager: [
    "dashboard",
    "categories",
    "homepage",
    "media",
  ],
  order_manager: [
    "dashboard",
    "orders",
    "customers",
  ],
} as const;

export const PERMISSION_LABELS: Record<string, string> = {
  dashboard: "لوحة المعلومات",
  products: "إدارة المنتجات",
  categories: "إدارة التصنيفات",
  filters: "إدارة الفلاتر",
  homepage: "منشئ الصفحة الرئيسية",
  media: "مكتبة الوسائط",
  promotions: "إدارة العروض",
  inventory: "إدارة المخزون",
  orders: "إدارة الطلبات",
  customers: "إدارة العملاء",
  users: "المستخدمون والصلاحيات",
  settings: "إعدادات المتجر",
};

export const SORT_OPTIONS = [
  { value: "featured", label: "مميز" },
  { value: "newest", label: "الأحدث" },
  { value: "price_asc", label: "السعر: من الأقل إلى الأعلى" },
  { value: "price_desc", label: "السعر: من الأعلى إلى الأقل" },
  { value: "bestselling", label: "الأكثر طلباً" },
] as const;

export const PRICE_RANGES = [
  { id: "under-5k", label: "أقل من 5,000 د.ع", min: 0, max: 5000 },
  { id: "5k-10k", label: "5,000 - 10,000 د.ع", min: 5000, max: 10000 },
  { id: "10k-15k", label: "10,000 - 15,000 د.ع", min: 10000, max: 15000 },
  { id: "15k-20k", label: "15,000 - 20,000 د.ع", min: 15000, max: 20000 },
  { id: "20k-25k", label: "20,000 - 25,000 د.ع", min: 20000, max: 25000 },
  { id: "over-25k", label: "25,000 د.ع فأكثر", min: 25000, max: 99999999 },
] as const;

export const SECTION_TYPE_LABELS: Record<string, string> = {
  hero: "الواجهة الرئيسية الترحيبية",
  categories: "دوائر التصنيفات",
  featured: "المنتجات المميزة",
  new_arrivals: "وصل حديثًا",
  bestsellers: "الأكثر طلباً",
  story: "قصة AURA",
  promo_split: "بانر الرجالي والنسائي",
};
