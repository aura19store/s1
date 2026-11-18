import React from "react";
import { notFound } from "next/navigation";
import {
  getRenderCategoriesByGender as getCategoriesByGender,
  getRenderGenderBySlug as getGenderBySlug,
  getRenderGenders as getGenders,
  getRenderStoreSettings as getStoreSettings,
} from "@/lib/store-render-queries";
import { StoreProvider } from "@/components/store/StoreProvider";
import { StoreHeader } from "@/components/store/StoreHeader";
import { CartDrawer } from "@/components/store/CartDrawer";
import { SearchModal } from "@/components/store/SearchModal";
import { StoreFooter } from "@/components/store/StoreFooter";
import { WhatsAppFloatingButton } from "@/components/store/WhatsAppFloatingButton";

export const dynamic = "force-dynamic";

export default async function GenderStoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ gender: string }>;
}) {
  const { gender: genderSlug } = await params;
  const activeGender = await getGenderBySlug(genderSlug);
  if (!activeGender) {
    notFound();
  }

  const [settings, genders, categories] = await Promise.all([
    getStoreSettings(),
    getGenders(),
    getCategoriesByGender(activeGender.id),
  ]);

  return (
    <StoreProvider genderSlug={activeGender.slug}>
      <div className="min-h-screen flex flex-col bg-[#F7F4EF] text-[#111111]">
        <StoreHeader
          genderSlug={activeGender.slug}
          genders={genders}
          categories={categories}
          storeName={settings.store_name}
          logoUrl={settings.logo_url}
          freeShippingThreshold={settings.free_shipping_threshold_iqd}
        />
        <main className="flex-1">{children}</main>
        <StoreFooter settings={settings} genderSlug={activeGender.slug} />
        <CartDrawer />
        <SearchModal />
        <WhatsAppFloatingButton phone={settings.contact_phone} />
      </div>
    </StoreProvider>
  );
}
