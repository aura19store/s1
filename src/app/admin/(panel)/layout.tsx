import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "لوحة إدارة AURA",
  robots: { index: false, follow: false },
};

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAdminUser();
  if (!user) {
    redirect("/admin/login");
  }

  return <AdminShell user={user}>{children}</AdminShell>;
}
