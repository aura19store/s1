"use client";
import { createContext, useContext } from "react";
import type { AdminUser } from "@/lib/auth";

export const AdminIdentity = createContext<{ user: AdminUser; update: (value: { name: string; email: string }) => void } | null>(null);
export function useAdminIdentity() { return useContext(AdminIdentity); }
