import React from "react";
import type { Metadata } from "next";
import { getStoreSettings } from "@/lib/store-queries";
import { CheckoutClient } from "@/components/store/CheckoutClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "إتمام الطلب",
  description: "أكمل طلبك من متجر AURA مع شحن سريع لجميع محافظات العراق والدفع بالدينار العراقي.",
};

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ gender: string }>;
}) {
  const { gender } = await params;
  const settings = await getStoreSettings();
  return (
    <CheckoutClient
      genderSlug={gender}
      paymentMethods={settings.payment_methods}
      contactPhone={settings.contact_phone}
    />
  );
}
