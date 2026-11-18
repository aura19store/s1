"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Edit3, Trash2, Shield, Check, X, Loader2, AlertCircle } from "lucide-react";
import { PERMISSION_LABELS } from "@/lib/constants";
import { formatArabicDate } from "@/lib/format";
import { ConfirmModal } from "@/components/admin/ConfirmModal";

interface UserRow {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role_slug: string;
  role_name: string;
  is_active: number;
  last_login_at: string | null;
}

interface RoleRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  permissions_json: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState("");
  const [notice, setNotice] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const pendingSave = useRef(false);
  const pendingDeletes = useRef(new Set<number>());
  const listRevision = useRef(0);
  const [roleId, setRoleId] = useState<number>(2);
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);


  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3200);
  };

  const loadData = useCallback(async () => {
    const revision = listRevision.current;
    setLoading(true);
    setErrorBanner("");
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || "ليس لديك صلاحية للوصول إلى هذا القسم.");
      } else {
        if (revision === listRevision.current) setUsers((data.users || []).filter((user: UserRow) => !pendingDeletes.current.has(user.id)));
        setRoles(data.roles || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    let active = true;
    fetch("/api/admin/auth/me", { cache: "no-store" }).then((res) => res.ok ? res.json() : null)
      .then((data) => { if (active && data?.user) setCurrentUserId(data.user.id); }).catch(() => {});
    return () => { active = false; };
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setEmail("");
    setPassword("");
    setCurrentPassword("");
    setRoleId(roles[1]?.id || roles[0]?.id || 2);
    setIsActive(true);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setName(u.name);
    setEmail(u.email);
    setPassword("");
    setCurrentPassword("");
    setRoleId(u.role_id);
    setIsActive(Boolean(u.is_active));
    setFormError("");
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingSave.current) return;
    pendingSave.current = true;
    setFormError("");
    setSaving(true);
    const payload = {
      name,
      email,
      password,
      ...(editing && editing.id === currentUserId && password ? { current_password: currentPassword } : {}),
      role_id: Number(roleId),
      is_active: isActive,
    };
    const url = editing ? `/api/admin/users/${editing.id}` : "/api/admin/users";
    try {
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setFormError(data.error || "تعذر حفظ بيانات المستخدم."); return; }
      setModalOpen(false);
      setPassword(""); setCurrentPassword("");
      flash(data.message || "تم حفظ المستخدم بنجاح.");
      void loadData();
    } catch {
      setFormError("تعذر الاتصال بالخادم. تحقق من البيانات قبل إعادة المحاولة.");
    } finally {
      pendingSave.current = false;
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    if (!target || pendingDeletes.current.has(target.id)) return;
    pendingDeletes.current.add(target.id); listRevision.current += 1;
    setDeleteTarget(null); setErrorBanner("");
    setUsers((previous) => previous.filter((user) => user.id !== target.id));
    try {
      const res = await fetch(`/api/admin/users/${target.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذر حذف المستخدم.");
      flash(data.message || "تم حذف المستخدم.");
    } catch (error) {
      setUsers((previous) => previous.some((user) => user.id === target.id) ? previous : [...previous, target].sort((a, b) => a.id - b.id));
      setErrorBanner(error instanceof Error ? error.message : "تعذر حذف المستخدم.");
    } finally {
      listRevision.current += 1; pendingDeletes.current.delete(target.id);
    }
  };

  if (errorBanner && users.length === 0) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
        <AlertCircle className="w-5 h-5" />
        <span>{errorBanner}</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-3xl text-[#111111]">
            المستخدمون والصلاحيات
          </h1>
          <p className="text-xs text-[#111111]/60 mt-1">
            إدارة حسابات فريق الإدارة ومستويات الصلاحيات — يرى كل مستخدم فقط الأقسام المسموحة له
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#111111] text-[#F7F4EF] text-xs font-semibold hover:bg-[#B79B6C] hover:text-[#111111] transition"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة مستخدم إداري</span>
        </button>
      </div>

      {notice && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
          <Check className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {errorBanner && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          {errorBanner}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white border border-[#D8C8B5]/70 overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-sm text-[#111111]/60">
            <Loader2 className="w-5 h-5 animate-spin text-[#B79B6C]" />
            <span>جاري التحميل...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#EFEAE2]/70 border-b border-[#D8C8B5] text-right">
                  <th className="py-3.5 px-4 font-semibold">الاسم</th>
                  <th className="py-3.5 px-3 font-semibold">البريد الإلكتروني</th>
                  <th className="py-3.5 px-3 font-semibold">الصلاحية</th>
                  <th className="py-3.5 px-3 font-semibold">الحالة</th>
                  <th className="py-3.5 px-3 font-semibold">آخر دخول</th>
                  <th className="py-3.5 px-4 font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8C8B5]/50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F7F4EF]/50">
                    <td className="py-3.5 px-4 font-semibold text-[#111111]">
                      {u.name}
                    </td>
                    <td className="py-3.5 px-3 text-[#111111]/75">{u.email}</td>
                    <td className="py-3.5 px-3">
                      <span className="px-2.5 py-1 bg-[#EFEAE2] text-[#111111] font-semibold">
                        {u.role_name}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`px-2 py-0.5 border text-[11px] ${
                          u.is_active
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-stone-100 text-stone-600 border-stone-300"
                        }`}
                      >
                        {u.is_active ? "مفعل" : "معطل"}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-[#111111]/60">
                      {formatArabicDate(u.last_login_at)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="p-1.5 border border-[#D8C8B5] hover:border-[#111111]"
                          title="تعديل"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(u)}
                          className="p-1.5 border border-rose-200 text-rose-700 hover:bg-rose-50"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Roles Permissions Matrix */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-[#111111] flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#B79B6C]" />
          <span>مستويات الصلاحيات المعتمدة</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((r) => {
            let perms: string[] = [];
            try {
              perms = JSON.parse(r.permissions_json || "[]");
            } catch {
              perms = [];
            }
            return (
              <div
                key={r.id}
                className="bg-white border border-[#D8C8B5]/70 p-5 space-y-3"
              >
                <div>
                  <h3 className="text-sm font-bold text-[#111111]">{r.name}</h3>
                  <p className="text-xs text-[#111111]/60 mt-0.5">
                    {r.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {perms.map((p) => (
                    <span
                      key={p}
                      className="px-2.5 py-1 bg-[#F7F4EF] border border-[#D8C8B5]/70 text-[11px] font-medium"
                    >
                      {PERMISSION_LABELS[p] || p}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#111111]/60 backdrop-blur-xs"
            onClick={() => setModalOpen(false)}
          />
          <form
            onSubmit={handleSave}
            className="relative z-10 w-full max-w-md bg-white border border-[#D8C8B5] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#D8C8B5]">
              <h2 className="text-base font-bold">
                {editing ? "تعديل بيانات المستخدم" : "إضافة مستخدم جديد"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1">الاسم</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-[#D8C8B5] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                required
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-right border border-[#D8C8B5] px-3 py-2 text-sm"
              />
            </div>

            {editing && editing.id === currentUserId && password && (
              <label className="block text-xs font-semibold">كلمة المرور الحالية
                <input type="password" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="block w-full border border-[#D8C8B5] px-3 py-2 text-sm" />
              </label>
            )}
            <div>
              <label className="block text-xs font-semibold mb-1">
                {editing
                  ? "كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية)"
                  : "كلمة المرور"}
              </label>
              <input
                type="password"
                required={!editing}
                minLength={editing ? undefined : 6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-[#D8C8B5] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                مستوى الصلاحية
              </label>
              <select
                value={roleId}
                onChange={(e) => setRoleId(Number(e.target.value))}
                className="w-full border border-[#D8C8B5] px-3 py-2 text-sm bg-white"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="accent-[#111111] w-4 h-4"
              />
              <span>الحساب نشط</span>
            </label>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#D8C8B5]/60">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-5 py-2.5 border border-[#D8C8B5] text-xs font-semibold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-[#111111] text-[#F7F4EF] text-xs font-semibold hover:bg-[#B79B6C] hover:text-[#111111]"
              >
                {saving ? "جاري الحفظ..." : "حفظ"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="تأكيد حذف المستخدم"
        message={`هل تريد حذف حساب "${deleteTarget?.name || ""}" نهائيًا؟`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
