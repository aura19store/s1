import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute } from "@/db";
import { requireAdminApi } from "@/lib/auth";
import { getStoreSettings } from "@/lib/store-queries";

export async function GET() {
  const auth = await requireAdminApi("settings");
  if ("error" in auth) return auth.error;
  return NextResponse.json({ settings: getStoreSettings() });
}

const settingsSchema = z.object({
  store_name: z.string().trim().min(1).default("AURA"),
  tagline: z.string().trim().min(1),
  secondary_tagline: z.string().trim().optional().default(""),
  logo_url: z.string().optional().default(""),
  free_shipping_threshold_iqd: z.number().int().min(0).default(25000),
  shipping_fee_iqd: z.number().int().min(0).default(3000),
  payment_methods: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1),
        description: z.string().optional().default(""),
        enabled: z.boolean(),
      })
    )
    .optional(),
  contact_phone: z.string().optional().default(""),
  contact_email: z.string().optional().default(""),
  contact_address: z.string().optional().default(""),
  instagram_url: z.string().optional().default(""),
  tiktok_url: z.string().optional().default(""),
  shipping_policy: z.string().optional().default(""),
  return_policy: z.string().optional().default(""),
  privacy_policy: z.string().optional().default(""),
  faqs: z
    .array(
      z.object({
        question: z.string().min(1),
        answer: z.string().min(1),
      })
    )
    .optional(),
  store_info: z.string().optional().default(""),
});

export async function PUT(request: NextRequest) {
  const auth = await requireAdminApi("settings");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "بيانات الإعدادات غير صالحة." },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const current = getStoreSettings();

  // Currency is STRICTLY locked to IQD / د.ع and country to IQ in current version
  execute(
    `UPDATE store_settings SET
      store_name = ?,
      tagline = ?,
      secondary_tagline = ?,
      logo_url = ?,
      currency_code = 'IQD',
      currency_symbol = 'د.ع',
      country_code = 'IQ',
      free_shipping_threshold_iqd = ?,
      shipping_fee_iqd = ?,
      payment_methods_json = ?,
      contact_phone = ?,
      contact_email = ?,
      contact_address = ?,
      instagram_url = ?,
      tiktok_url = ?,
      shipping_policy = ?,
      return_policy = ?,
      privacy_policy = ?,
      faq_json = ?,
      store_info = ?,
      updated_at = datetime('now')
     WHERE id = 1`,
    d.store_name,
    d.tagline,
    d.secondary_tagline,
    d.logo_url,
    d.free_shipping_threshold_iqd,
    d.shipping_fee_iqd,
    JSON.stringify(d.payment_methods ?? current.payment_methods),
    d.contact_phone,
    d.contact_email,
    d.contact_address,
    d.instagram_url,
    d.tiktok_url,
    d.shipping_policy,
    d.return_policy,
    d.privacy_policy,
    JSON.stringify(d.faqs ?? current.faqs),
    d.store_info
  );

  return NextResponse.json({
    message: "تم حفظ إعدادات المتجر بنجاح.",
    settings: getStoreSettings(),
  });
}
