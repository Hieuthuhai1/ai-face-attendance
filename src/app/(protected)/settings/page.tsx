"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectOption } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  getAttendancePolicies,
  updateAttendancePolicies,
  getFaceVerificationConfig,
  updateFaceVerificationConfig,
  getOrganizationProfile,
  updateOrganizationProfile,
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  listUsersWithRoles,
  updateUserRole,
  toggleUserActive,
  updateUserProfile,
} from "@/features/settings/actions";

const TIMEZONES = [
  { value: "Asia/Ho_Chi_Minh", label: "Asia/Ho_Chi_Minh (UTC+7)" },
  { value: "Asia/Bangkok", label: "Asia/Bangkok (UTC+7)" },
  { value: "Asia/Jakarta", label: "Asia/Jakarta (UTC+7)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (UTC+8)" },
  { value: "Asia/Kuala_Lumpur", label: "Asia/Kuala_Lumpur (UTC+8)" },
  { value: "UTC", label: "UTC (UTC+0)" },
];

const ROLE_LABELS: Record<string, string> = {
  employee: "Nhân viên",
  manager: "Quản lý",
  hr_admin: "HR Admin",
  system_admin: "System Admin",
};

const ROLE_BADGE_COLORS: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  employee: "neutral",
  manager: "info",
  hr_admin: "warning",
  system_admin: "danger",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge tone={ROLE_BADGE_COLORS[role] || "neutral"}>
      {ROLE_LABELS[role] || role}
    </Badge>
  );
}

function RoleSelect({ role, onChange, disabled }: { role: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <Select
      label="Vai trò"
      value={role}
      onChange={(v) => onChange(v as string)}
      options={[
        { value: "employee", label: "Nhân viên" },
        { value: "manager", label: "Quản lý" },
        { value: "hr_admin", label: "HR Admin" },
        { value: "system_admin", label: "System Admin" },
      ]}
      placeholder="Chọn vai trò"
      disabled={disabled}
      className="w-48"
    />
  );
}

export function OrganizationSettings() {
  const [org, setOrg] = useState<{ name: string; timezone: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await getOrganizationProfile();
    setLoading(false);
    if (res.ok && res.data) setOrg(res.data as { name: string; timezone: string });
    else setError(res.ok ? "Lỗi không xác định" : (res as { ok: false; message: string }).message);
  }

  async function save() {
    if (!org) return;
    setSaving(true);
    setError(null);
    const res = await updateOrganizationProfile(org);
    setSaving(false);
    if (!res.ok) setError((res as { ok: false; message: string }).message);
    else toast.success("Đã cập nhật thông tin tổ chức.");
  }

  if (loading) return <div className="flex h-32 items-center justify-center">Đang tải…</div>;
  if (error) return <p className="text-red-600" role="alert">{error}</p>;

  return (
    <Card>
      <CardTitle>Thông tin tổ chức</CardTitle>
      <CardDescription>Cập nhật tên và múi giờ của tổ chức.</CardDescription>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input label="Tên tổ chức" value={org?.name ?? ""} onChange={(e) => setOrg({ ...org!, name: e.target.value })} required />
        <Select
          label="Múi giờ"
          value={org?.timezone ?? "Asia/Ho_Chi_Minh"}
          onChange={(v) => setOrg({ ...org!, timezone: v as string })}
          options={TIMEZONES}
        />
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" loading={saving}>Lưu thay đổi</Button>
        </div>
      </form>
    </Card>
  );
}

export function AttendancePoliciesSettings() {
  const [policies, setPolicies] = useState<{
    grace_in_min: number;
    grace_out_min: number;
    rounding_min: number;
    late_threshold_min: number;
    early_leave_threshold_min: number;
    overtime_requires_approval: boolean;
    max_overtime_hours_per_month: number;
    check_in_methods: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await getAttendancePolicies();
    setLoading(false);
    if (res.ok && res.data) setPolicies(res.data as typeof policies);
    else setError(res.ok ? "Lỗi không xác định" : (res as { ok: false; message: string }).message);
  }

  async function save() {
    if (!policies) return;
    setSaving(true);
    setError(null);
    const res = await updateAttendancePolicies(policies);
    setSaving(false);
    if (!res.ok) setError((res as { ok: false; message: string }).message);
    else toast.success("Đã cập nhật chính sách chấm công.");
  }

  if (loading) return <div className="flex h-32 items-center justify-center">Đang tải…</div>;
  if (error) return <p className="text-red-600" role="alert">{error}</p>;

  return (
    <Card>
      <CardTitle>Chính sách chấm công</CardTitle>
      <CardDescription>Cấu hình quy tắc tính công, grace period, overtime, phương thức check-in.</CardDescription>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Input label="Grace check-in (phút)" type="number" min={0} max={120} value={policies?.grace_in_min ?? 0} onChange={(e) => setPolicies({ ...policies!, grace_in_min: Number(e.target.value) })} />
        <Input label="Grace check-out (phút)" type="number" min={0} max={120} value={policies?.grace_out_min ?? 0} onChange={(e) => setPolicies({ ...policies!, grace_out_min: Number(e.target.value) })} />
        <Input label="Rounding (phút)" type="number" min={1} max={60} value={policies?.rounding_min ?? 1} onChange={(e) => setPolicies({ ...policies!, rounding_min: Number(e.target.value) })} />
        <Input label="Ngưỡng trễ (phút)" type="number" min={0} max={480} value={policies?.late_threshold_min ?? 0} onChange={(e) => setPolicies({ ...policies!, late_threshold_min: Number(e.target.value) })} />
        <Input label="Ngưỡng về sớm (phút)" type="number" min={0} max={480} value={policies?.early_leave_threshold_min ?? 0} onChange={(e) => setPolicies({ ...policies!, early_leave_threshold_min: Number(e.target.value) })} />
        <Input label="Max OT/tháng (giờ)" type="number" min={0} max={200} value={policies?.max_overtime_hours_per_month ?? 50} onChange={(e) => setPolicies({ ...policies!, max_overtime_hours_per_month: Number(e.target.value) })} />
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            <span>Phương thức check-in cho phép</span>
            <div className="flex flex-wrap gap-2">
              {["face", "pin_fallback", "manual"].map((m) => (
                <label key={m} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={policies?.check_in_methods?.includes(m) ?? false}
                    onChange={(e) => setPolicies({ ...policies!, check_in_methods: e.target.checked ? [...(policies?.check_in_methods ?? []), m] : (policies?.check_in_methods ?? []).filter((x) => x !== m) })}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-sm capitalize">{m}</span>
                </label>
              ))}
            </div>
          </label>
        </div>
        <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={policies?.overtime_requires_approval ?? true}
              onChange={(e) => setPolicies({ ...policies!, overtime_requires_approval: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm">OT cần duyệt trước khi tính</span>
          </label>
        </div>
        <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
          <Button type="submit" loading={saving}>Lưu chính sách</Button>
        </div>
      </form>
    </Card>
  );
}

export function FaceVerificationSettings() {
  const [config, setConfig] = useState<{ threshold: number; review_band_low: number; provider_timeout_ms: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await getFaceVerificationConfig();
    setLoading(false);
    if (res.ok && res.data) setConfig(res.data as { threshold: number; review_band_low: number; provider_timeout_ms: number });
    else setError(res.ok ? "Lỗi không xác định" : (res as { ok: false; message: string }).message);
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    const res = await updateFaceVerificationConfig(config);
    setSaving(false);
    if (!res.ok) setError((res as { ok: false; message: string }).message);
    else toast.success("Đã cập nhật cấu hình nhận diện.");
  }

  if (loading) return <div className="flex h-32 items-center justify-center">Đang tải…</div>;
  if (error) return <p className="text-red-600" role="alert">{error}</p>;

  return (
    <Card>
      <CardTitle>Cấu hình nhận diện khuôn mặt</CardTitle>
      <CardDescription>Ngưỡng xác thực, band review, timeout provider. Production: fail closed nếu chưa cấu hình provider thật.</CardDescription>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="mt-4 grid gap-4 sm:grid-cols-3">
        <Input label="Ngưỡng verify (0-1)" type="number" step={0.01} min={0} max={1} value={config?.threshold ?? 0.7} onChange={(e) => setConfig({ ...config!, threshold: Number(e.target.value) })} />
        <Input label="Review band low (0-1)" type="number" step={0.01} min={0} max={1} value={config?.review_band_low ?? 0.5} onChange={(e) => setConfig({ ...config!, review_band_low: Number(e.target.value) })} />
        <Input label="Provider timeout (ms)" type="number" min={1000} max={30000} value={config?.provider_timeout_ms ?? 8000} onChange={(e) => setConfig({ ...config!, provider_timeout_ms: Number(e.target.value) })} />
        <div className="sm:col-span-3 flex justify-end">
          <Button type="submit" loading={saving}>Lưu cấu hình</Button>
        </div>
      </form>
    </Card>
  );
}

export function HolidaysSettings() {
  const [holidays, setHolidays] = useState<Array<{ id: string; name: string; date: string; is_recurring: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; date: string; is_recurring: boolean } | null>(null);
  const [formData, setFormData] = useState({ name: "", date: "", is_recurring: false });

  async function load() {
    setLoading(true);
    const res = await listHolidays();
    setLoading(false);
    if (res.ok && res.data) setHolidays(res.data as Array<{ id: string; name: string; date: string; is_recurring: boolean }>);
    else setError(res.ok ? "Lỗi không xác định" : (res as { ok: false; message: string }).message);
  }

  function openCreate() {
    setEditing(null);
    setFormData({ name: "", date: format(new Date(), "yyyy-MM-dd"), is_recurring: false });
    setDialogOpen(true);
  }

  function openEdit(h: { id: string; name: string; date: string; is_recurring: boolean }) {
    setEditing(h);
    setFormData({ name: h.name, date: h.date, is_recurring: h.is_recurring });
    setDialogOpen(true);
  }

  async function submit() {
    setSaving(true);
    try {
      let res;
      if (editing) {
        res = await updateHoliday(editing.id, formData);
      } else {
        res = await createHoliday(formData);
      }
      if (res.ok) {
        toast.success(editing ? "Đã cập nhật ngày lễ." : "Đã tạo ngày lễ.");
        setDialogOpen(false);
        load();
      } else {
        toast.error((res as { ok: false; message: string }).message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Xóa ngày lễ này?")) return;
    const res = await deleteHoliday(id);
    if (res.ok) {
      toast.success("Đã xóa ngày lễ.");
      load();
    } else {
      toast.error((res as { ok: false; message: string }).message);
    }
  }

  if (loading) return <div className="flex h-32 items-center justify-center">Đang tải…</div>;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle>Ngày lễ / Nghỉ lễ</CardTitle>
          <CardDescription>Quản lý ngày nghỉ chung của tổ chức. Có thể đặt lặp lại hàng năm.</CardDescription>
        </div>
        <Button onClick={() => { setEditing(null); setFormData({ name: "", date: format(new Date(), "yyyy-MM-dd"), is_recurring: false }); setDialogOpen(true); }}>Thêm ngày lễ</Button>
      </div>
      <div className="mt-4">
        {error && <p className="text-red-600" role="alert">{error}</p>}
        {holidays.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Chưa có ngày lễ nào. Thêm ngày lễ đầu tiên.</p>
        ) : (
          <DataTable
            ariaLabel="Danh sách ngày lễ"
            rows={holidays}
            keyOf={(h) => h.id}
            emptyTitle="Chưa có ngày lễ"
            emptyDescription="Thêm ngày lễ đầu tiên."
            columns={[
              { key: "name", header: "Tên ngày lễ", render: (h) => <span className="font-medium">{h.name}</span> },
              { key: "date", header: "Ngày", render: (h) => <span className="tnum">{format(new Date(h.date), "dd/MM/yyyy", { locale: vi })}</span> },
              { key: "recurring", header: "Lặp lại", render: (h) => <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium">{h.is_recurring ? <span className="bg-green-100 text-green-700">Hàng năm</span> : <span className="bg-slate-100 text-slate-700">Một lần</span>}</span> },
              {
                key: "actions",
                header: <span className="sr-only">Thao tác</span>,
                render: (h) => (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(h); setFormData({ name: h.name, date: h.date, is_recurring: h.is_recurring }); setDialogOpen(true); }}>Sửa</Button>
                    <Button variant="danger" size="sm" onClick={() => remove(h.id)}>Xóa</Button>
                  </div>
                ),
              },
            ]}
            cardTitle={(h) => h.name}
          />
        )}
      </div>
      {dialogOpen && (
        <Dialog open={dialogOpen} title={editing ? "Sửa ngày lễ" : "Thêm ngày lễ"} onClose={() => setDialogOpen(false)}>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mt-4 grid gap-4">
            <Input label="Tên ngày lễ" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            <Input label="Ngày" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={formData.is_recurring} onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
              <span className="text-sm">Lặp lại hàng năm</span>
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Hủy</Button>
              <Button type="submit" loading={saving}>{editing ? "Cập nhật" : "Tạo"}</Button>
            </div>
          </form>
        </Dialog>
      )}
    </Card>
  );
}

export function RolesSettings() {
  const [users, setUsers] = useState<Array<{
    id: string;
    email: string;
    display_name: string;
    role: string;
    is_active: boolean;
    employee_code: string | null;
    department: string | null;
    created_at: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await listUsersWithRoles();
    setLoading(false);
    if (res.ok && res.data) setUsers(res.data as Array<{ id: string; email: string; display_name: string; role: string; is_active: boolean; employee_code: string | null; department: string | null; created_at: string }>);
    else setError(res.ok ? "Lỗi không xác định" : (res as { ok: false; message: string }).message);
  }

  async function handleRoleChange(userId: string, newRole: string) {
    const res = await updateUserRole(userId, newRole);
    if (res.ok) {
      toast.success("Đã cập nhật vai trò.");
      load();
    } else {
      toast.error((res as { ok: false; message: string }).message);
      load();
    }
  }

  async function handleToggleActive(userId: string) {
    const res = await toggleUserActive(userId);
    if (res.ok) {
      toast.success("Đã thay đổi trạng thái.");
      load();
    } else {
      toast.error((res as { ok: false; message: string }).message);
    }
  }

  async function handleProfileUpdate(userId: string, field: "display_name" | "email", value: string) {
    const res = await updateUserProfile(userId, { [field]: value });
    if (!res.ok) {
      toast.error((res as { ok: false; message: string }).message);
      load();
    }
  }

  if (loading) return <div className="flex h-32 items-center justify-center">Đang tải…</div>;
  if (error) return <p className="text-red-600" role="alert">{error}</p>;

  return (
    <Card>
      <CardTitle>Quản lý người dùng & Vai trò</CardTitle>
      <CardDescription>Phân quyền, kích hoạt/vô hiệu hóa tài khoản. System Admin có toàn quyền; HR Admin quản lý org.</CardDescription>
      <div className="mt-4">
        {loading ? (
          <div className="flex h-32 items-center justify-center">Đang tải…</div>
        ) : (
          <DataTable
            ariaLabel="Danh sách người dùng"
            rows={users}
            keyOf={(u) => u.id}
            emptyTitle="Chưa có người dùng"
            emptyDescription="Người dùng sẽ hiện ở đây sau khi được tạo."
            cardTitle={(u) => `${u.display_name || "—"} (${u.email})`}
            columns={[
              { key: "name", header: "Họ tên", render: (u) => <span className="font-medium">{u.display_name || "—"}</span> },
              { key: "email", header: "Email", render: (u) => <span className="text-sm">{u.email}</span> },
              { key: "employee", header: "Mã NV", render: (u) => u.employee_code ? <span className="font-mono text-sm">{u.employee_code}</span> : "—" },
              { key: "dept", header: "Phòng ban", render: (u) => u.department ?? "—" },
              { key: "role", header: "Vai trò", render: (u) => <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)} disabled={u.id === users.find(x => x.role === "system_admin")?.id} className="h-8 rounded-lg border border-slate-300 px-2 text-sm"><option value="employee">Nhân viên</option><option value="manager">Quản lý</option><option value="hr_admin">HR Admin</option><option value="system_admin">System Admin</option></select> },
              { key: "status", header: "Trạng thái", render: (u) => <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{u.is_active ? "Hoạt động" : "Vô hiệu"}</span> },
              {
                key: "toggle",
                header: <span className="sr-only">Bật/Tắt</span>,
                render: (u) => (
                  <button
                    className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${u.is_active ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}
                    onClick={() => handleToggleActive(u.id)}
                  >
                    {u.is_active ? "Vô hiệu" : "Kích hoạt"}
                  </button>
                ),
              },
            ]}
          />
        )}
      </div>
    </Card>
  );
}

export function AuditLogsSettings() {
  const [filters, setFilters] = useState({
    from: format(new Date(Date.now() - 30 * 86400000), "yyyy-MM-dd"),
    to: format(new Date(), "yyyy-MM-dd"),
    action: "",
    resource_type: "",
  });
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const { exportAuditLogs } = await import("@/features/settings/actions");
      const res = await exportAuditLogs(filters);
      if (res.ok) {
        const blob = new Blob(["\uFEFF" + res.csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Đã xuất ${res.count} bản ghi audit.`);
      } else {
        toast.error((res as { ok: false; message: string }).message);
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle>Nhật ký Audit</CardTitle>
          <CardDescription>Xuất log hệ thống để review. Chỉ HR/Admin. Metadata đã tối thiểu hóa — không chứa ảnh, template, secret.</CardDescription>
        </div>
        <Button onClick={handleExport} loading={exporting}>Xuất CSV (Audit)</Button>
      </div>
      <form onSubmit={(e) => e.preventDefault()} className="mt-4 grid gap-3 sm:grid-cols-4">
        <Input label="Từ ngày" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        <Input label="Đến ngày" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        <Input label="Hành động" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} placeholder="VD: enrollment, adjustment" />
        <Input label="Loại tài nguyên" value={filters.resource_type} onChange={(e) => setFilters({ ...filters, resource_type: e.target.value })} placeholder="VD: leave_request, face_enrollment" />
        <div className="flex items-end sm:col-span-2">
          <p className="text-xs text-slate-500">Tối đa 5000 dòng. Metadata không chứa dữ liệu nhạy cảm.</p>
        </div>
      </form>
    </Card>
  );
}

export function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <h1 className="text-2xl font-bold">Cài đặt tổ chức</h1>
      <Tabs items={[
        { key: "organization", label: "Tổ chức", icon: "building" },
        { key: "policies", label: "Chính sách chấm công", icon: "file-text" },
        { key: "face", label: "Nhận diện khuôn mặt", icon: "user" },
        { key: "holidays", label: "Ngày lễ", icon: "calendar" },
        { key: "roles", label: "Người dùng & Vai trò", icon: "users" },
        { key: "audit", label: "Nhật ký Audit", icon: "file" },
      ]} value="organization" onChange={() => {}} />
      <TabPanel key="organization" value="organization">
        <OrganizationSettings />
      </TabPanel>
      <TabPanel key="policies" value="policies">
        <AttendancePoliciesSettings />
      </TabPanel>
      <TabPanel key="face" value="face">
        <FaceVerificationSettings />
      </TabPanel>
      <TabPanel key="holidays" value="holidays">
        <HolidaysSettings />
      </TabPanel>
      <TabPanel key="roles" value="roles">
        <RolesSettings />
      </TabPanel>
      <TabPanel key="audit" value="audit">
        <AuditLogsSettings />
      </TabPanel>
    </div>
  );
}
