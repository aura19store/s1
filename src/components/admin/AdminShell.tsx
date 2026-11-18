"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderKanban,
  SlidersHorizontal,
  LayoutTemplate,
  Image as ImageIcon,
  Percent,
  Warehouse,
  ShoppingCart,
  Users,
  Shield,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import type { AdminUser } from "@/lib/auth";

interface NavItem {
  href: string;
  label: string;
  permission: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "لوحة المعلومات", permission: "dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "المنتجات", permission: "products", icon: Package },
  { href: "/admin/categories", label: "التصنيفات", permission: "categories", icon: FolderKanban },
  { href: "/admin/filters", label: "إدارة الفلاتر", permission: "filters", icon: SlidersHorizontal },
  { href: "/admin/homepage", label: "منشئ الصفحة الرئيسية", permission: "homepage", icon: LayoutTemplate },
  { href: "/admin/media", label: "مكتبة الوسائط", permission: "media", icon: ImageIcon },
  { href: "/admin/promotions", label: "العروض والخصومات", permission: "promotions", icon: Percent },
  { href: "/admin/inventory", label: "إدارة المخزون", permission: "inventory", icon: Warehouse },
  { href: "/admin/orders", label: "الطلبات", permission: "orders", icon: ShoppingCart },
  { href: "/admin/customers", label: "العملاء", permission: "customers", icon: Users },
  { href: "/admin/rewards", label: "المكافآت", permission: "customers", icon: Users },
  { href: "/admin/users", label: "المستخدمون والصلاحيات", permission: "users", icon: Shield },
  { href: "/admin/settings", label: "الإعدادات", permission: "settings", icon: Settings },
];

export function AdminShell({
  user,
  children,
}: {
  user: AdminUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleNav = NAV_ITEMS.filter(
    (item) =>
      user.roleSlug === "super_admin" ||
      user.permissions.includes(item.permission)
  );

  // Determine required permission for current pathname
  const matchedNav = [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) =>
      item.href === "/admin"
        ? pathname === "/admin"
        : pathname === item.href || pathname.startsWith(`${item.href}/`)
    );

  const isRouteAllowed =
    user.roleSlug === "super_admin" ||
    !matchedNav ||
    user.permissions.includes(matchedNav.permission);

  const fallbackHref = visibleNav[0]?.href || "/admin";

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-[#111111] text-[#F7F4EF]">
      {/* Brand Header */}
      <div className="px-6 py-6 border-b border-[#F7F4EF]/10 flex items-center justify-between">
        <div>
          <Link
            href="/admin"
            className="font-brand text-2xl tracking-[0.26em] text-[#F7F4EF]"
          >
            AURA
          </Link>
          <p className="text-[11px] text-[#B79B6C] mt-1">لوحة إدارة المتجر</p>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="إغلاق القائمة الجانبية"
          className="lg:hidden p-1.5 text-[#D8C8B5]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav aria-label="قائمة الإدارة" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 text-sm rounded-xs transition ${
                active
                  ? "bg-[#B79B6C] text-[#111111] font-semibold"
                  : "text-[#F7F4EF]/80 hover:bg-[#F7F4EF]/8 hover:text-[#F7F4EF]"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom User & Logout */}
      <div className="p-4 border-t border-[#F7F4EF]/10 space-y-3">
        <div className="px-2">
          <p className="text-xs font-semibold text-[#F7F4EF] truncate">
            {user.name}
          </p>
          <p className="text-[11px] text-[#B79B6C] truncate">{user.roleName}</p>
          <Link href="/admin/profile" onClick={() => setSidebarOpen(false)} className="inline-block mt-2 text-xs underline">معلومات المدير</Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            target="_blank"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 bg-[#F7F4EF]/10 hover:bg-[#F7F4EF]/15 text-xs text-[#F7F4EF] transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>عرض المتجر</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-950/60 hover:bg-rose-900/70 text-xs text-rose-200 transition"
            title="تسجيل الخروج"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F7F4EF] text-[#111111] flex">
      {/* Desktop Fixed Sidebar (RTL Right Side) */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative z-10 w-72 h-full shadow-2xl">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Utility Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-[#D8C8B5]/70 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="فتح القائمة الجانبية"
              className="lg:hidden p-2 -mr-2 text-[#111111]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs sm:text-sm font-medium text-[#111111]/70">
              العملة المعتمدة:{" "}
              <strong className="text-[#111111]">الدينار العراقي (د.ع)</strong>
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="hidden sm:inline-block px-3 py-1 bg-[#EFEAE2] text-[#111111] font-medium">
              {user.roleName}
            </span>
            <span className="text-[#111111]/75 font-medium">{user.name}</span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-[1440px] w-full mx-auto">
          {isRouteAllowed ? (
            children
          ) : (
            <div className="bg-white border border-[#D8C8B5] p-10 max-w-lg mx-auto my-12 text-center space-y-4">
              <div className="w-12 h-12 bg-rose-50 text-rose-700 mx-auto flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <h1 className="font-editorial text-2xl text-[#111111]">
                ليس لديك صلاحية للوصول إلى هذا القسم
              </h1>
              <p className="text-xs text-[#111111]/65 leading-relaxed">
                حسابك الحالي ({user.roleName}) لا يملك صلاحية الوصول إلى هذه
                الصفحة. يرجى العودة إلى أحد الأقسام المخصصة لك أو التواصل مع
                المدير العام.
              </p>
              <Link
                href={fallbackHref}
                className="inline-block px-6 py-2.5 bg-[#111111] text-[#F7F4EF] text-xs font-semibold hover:bg-[#B79B6C] hover:text-[#111111] transition"
              >
                العودة إلى القسم المتاح
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
