"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmModal } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/states";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { createEmployee, deleteEmployee, updateEmployee } from "@/features/hr/actions";
import { toast } from "@/components/ui/toast";
import { Avatar } from "@/components/ui/avatar";

// Client-side pagination wrapper
import { Pagination as PaginationComp, type PaginationProps } from "@/components/ui/pagination";

function EmployeePagination(props: Omit<PaginationProps, "onPageChange" | "hrefFor"> & {
  baseParams: Record<string, string>;
}) {
  const router = useRouter();

  const onPageChange = (page: number) => {
    const params = new URLSearchParams(props.baseParams);
    params.set("page", String(page));
    router.push(`?${params.toString()}`);
  };

  return <PaginationComp {...props} onPageChange={onPageChange} />;
}

export interface EmployeeRow {
  id: string;
  employee_code: string;
  title: string;
  employment_status: "active" | "inactive" | "terminated";
  department_id: string | null;
  department_name: string;
  manager_id: string | null;
  manager_code: string;
  display_name: string;
  email: string;
  profile_active: boolean;
  hired_at: string | null;
}

interface Props {
  rows: EmployeeRow[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  status: string;
  departments: Array<{ id: string; name: string }>;
  managers: Array<{ id: string; employee_code: string }>;
  freeProfiles: Array<{ id: string; email: string; display_name: string }>;
}

const STATUS_LABELS: Record<EmployeeRow["employment_status"], string> = {
  active: "Đang hoạt động",
  inactive: "Tạm nghỉ",
  terminated: "Đã nghỉ việc",
};

const STATUS_TONE: Record<EmployeeRow["employment_status"], "success" | "warning" | "danger"> = {
  active: "success",
  inactive: "warning",
  terminated: "danger",
};

type EmployeeFormValues = {
  employee_code: string;
  display_name: string;
  department_id: string;
  manager_id: string;
  title: string;
  employment_status: "active" | "inactive" | "terminated";
  hired_at: string | null;
};

const emptyForm: EmployeeFormValues = {
  employee_code: "",
  display_name: "",
  department_id: "",
  manager_id: "",
  title: "",
  employment_status: "active",
  hired_at: null,
};

export function EmployeeManager(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState<EmployeeFormValues>(emptyForm);
  const [profileId, setProfileId] = useState("");
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [viewing, setViewing] = useState<EmployeeRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<EmployeeRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totalPages = Math.max(1, Math.ceil(props.total / props.pageSize));

  function openCreate() {
    setForm(emptyForm);
    setProfileId("");
    setError(null);
    setEditing(null);
    setViewing(null);
    setCreating(true);
  }

  function openEdit(row: EmployeeRow) {
    setForm({
      employee_code: row.employee_code,
      display_name: row.display_name,
      department_id: row.department_id ?? "",
      manager_id: row.manager_id ?? "",
      title: row.title,
      employment_status: row.employment_status,
      hired_at: row.hired_at,
    });
    setError(null);
    setCreating(false);
    setViewing(null);
    setEditing(row);
  }

  function openView(row: EmployeeRow) {
    setViewing(row);
    setEditing(null);
    setCreating(false);
  }

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      employee_code: form.employee_code.trim(),
      display_name: form.display_name.trim(),
      department_id: form.department_id || null,
      manager_id: form.manager_id || null,
      title: form.title.trim(),
      employment_status: form.employment_status as "active" | "inactive" | "terminated",
      hired_at: form.hired_at,
    };
    const res = editing
      ? await updateEmployee(editing.id, payload)
      : await createEmployee(profileId, payload);
    setSaving(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setCreating(false);
    setEditing(null);
    toast.success(editing ? "Đã cập nhật nhân viên." : "Đã tạo nhân viên mới.");
    router.refresh();
  }

  async function handleDelete(row: EmployeeRow) {
    if (!row) return;
    setConfirmDelete(true);
    const res = await deleteEmployee(row.id);
    setConfirmDelete(false);
    setDeleting(null);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    toast.success(`Đã xóa ${row.employee_code}.`);
    router.refresh();
  }

  const handleSort = useCallback((key: string) => {
    // Sorting is handled server-side; kept for UI compatibility.
    return;
  }, []);

  const statusBadge = (row: EmployeeRow) => {
    const active = row.employment_status === "active" && row.profile_active;
    return (
      <Badge tone={active ? "success" : STATUS_TONE[row.employment_status]}>
        <Icon name={active ? "check" : "x"} size={12} /> {STATUS_LABELS[row.employment_status]}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-2 md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Input
            label="Tìm kiếm"
            name="q"
            defaultValue={props.q}
            placeholder="Mã, tên, email, chức danh…"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            label="Phòng ban"
            value={searchParams.get("departmentId") || ""}
            onChange={(v) => {
              const val = Array.isArray(v) ? v.join(",") : v;
              const params = new URLSearchParams(searchParams.toString());
              if (val) params.set("departmentId", val);
              else params.delete("departmentId");
              params.set("page", "1");
              router.push(`?${params.toString()}`);
            }}
            options={[
              { value: "", label: "Tất cả phòng ban" },
              ...props.departments.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
          <Select
            label="Trạng thái"
            value={searchParams.get("status") || "all"}
            onChange={(v) => {
              const val = Array.isArray(v) ? v.join(",") : v;
              const params = new URLSearchParams(searchParams.toString());
              if (val !== "all") params.set("status", val);
              else params.delete("status");
              params.set("page", "1");
              router.push(`?${params.toString()}`);
            }}
            options={[
              { value: "all", label: "Tất cả" },
              { value: "active", label: "Đang hoạt động" },
              { value: "inactive", label: "Tạm nghỉ" },
              { value: "terminated", label: "Đã nghỉ việc" },
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={openCreate} disabled={props.freeProfiles.length === 0}>
            <Icon name="plus" size={16} /> Thêm nhân viên
          </Button>
        </div>
      </div>

      {error ? <ErrorState title="Không lưu được" description={error} /> : null}

      {/* Table */}
      <Card>
        <DataTable
          ariaLabel="Danh sách nhân viên"
          rows={props.rows}
          keyOf={(r) => r.id}
          emptyTitle="Chưa có nhân viên"
          emptyDescription="Thử đổi từ khóa hoặc thêm mới."
          columns={[
            {
              key: "avatar",
              header: "Avatar",
              render: (r) => (
                <Avatar name={r.display_name || r.email} size="sm" />
              ),
            },
            {
              key: "code",
              header: "Mã NV",
              render: (r) => <span className="tnum font-medium">{r.employee_code}</span>,
            },
            {
              key: "name",
              header: "Họ tên",
              render: (r) => (
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{r.display_name || r.email}</p>
                  <p className="text-[11px] text-slate-500 truncate">{r.email}</p>
                </div>
              ),
            },
            {
              key: "phone",
              header: "Số điện thoại",
              render: () => <span className="text-slate-400 italic">—</span>,
            },
            {
              key: "department",
              header: "Phòng ban",
              render: (r) => <span>{r.department_name}</span>,
            },
            {
              key: "title",
              header: "Chức vụ",
              render: (r) => <span className="text-slate-600">{r.title || "—"}</span>,
            },
            {
              key: "hired_at",
              header: "Ngày vào làm",
              render: (r) => <span className="tnum">{r.hired_at || "—"}</span>,
            },
            {
              key: "status",
              header: "Trạng thái",
              render: statusBadge,
            },
            {
              key: "actions",
              header: <span className="sr-only">Thao tác</span>,
              render: (r) => (
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => openView(r)}>
                    <Icon name="file-text" size={14} /> Xem
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>
                    Sửa
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleting(r)}
                    disabled={r.employment_status === "terminated"}
                  >
                    <Icon name="x" size={14} /> Xóa
                  </Button>
                </div>
              ),
            },
          ]}
          cardTitle={(r) => `${r.employee_code} — ${r.display_name || r.email}`}
          cardStatus={() => <></>}
          cardMeta={(r) => `${r.department_name} · ${r.title || "—"} · ${r.hired_at || "—"}`}
          cardActions={(r) => (
            <>
              <Button size="sm" variant="secondary" onClick={() => openView(r)}>
                Xem
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>
                Sửa
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDeleting(r)}
                disabled={r.employment_status === "terminated"}
              >
                Xóa
              </Button>
            </>
          )}
        />
        <div className="mt-3 flex justify-end">
          <EmployeePagination
            page={props.page}
            totalPages={totalPages}
            total={props.total}
            label="nhân viên"
            baseParams={{
              q: searchParams.get("q") || "",
              status: searchParams.get("status") || "all",
              departmentId: searchParams.get("departmentId") || "",
            }}
          />
        </div>
      </Card>

      {/* View Detail Modal */}
      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title="Chi tiết nhân viên"
        size="lg"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={viewing?.display_name || viewing?.email} size="lg" />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-800">
                {viewing?.display_name || viewing?.email}
              </h2>
              <p className="tnum font-mono text-sm text-slate-500">
                {viewing?.employee_code}
              </p>
            </div>
            <div className="ml-auto">{statusBadge(viewing!)}</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-slate-500">Email</span>
              <span>{viewing?.email || "—"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-slate-500">Số điện thoại</span>
              <span className="text-slate-400 italic">—</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-slate-500">Phòng ban</span>
              <span>{viewing?.department_name || "—"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-slate-500">Chức vụ</span>
              <span>{viewing?.title || "—"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-slate-500">Ngày vào làm</span>
              <span className="tnum">{viewing?.hired_at || "—"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-slate-500">Quản lý trực tiếp</span>
              <span>{viewing?.manager_code || "—"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-slate-500">Trạng thái làm việc</span>
              <span>{STATUS_LABELS[viewing!.employment_status]}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-slate-500">Tài khoản</span>
              <span>{viewing?.profile_active ? "Kích hoạt" : "Vô hiệu"}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Create/Edit Modal */}
      <Modal
        open={creating || editing !== null}
        onClose={() => { setCreating(false); setEditing(null); setError(null); }}
        title={editing ? "Sửa nhân viên" : "Thêm nhân viên"}
        size="lg"
      >
        <form onSubmit={onSave} className="flex flex-col gap-4">
          {!editing ? (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Tài khoản đăng nhập
                <select
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value)}
                  required
                  className="h-10 rounded-lg border border-slate-300 px-3 font-normal focus:ring-2 focus:ring-[var(--brand)]"
                >
                  <option value="">— Chọn tài khoản —</option>
                  {props.freeProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.email}{p.display_name ? ` (${p.display_name})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Mã nhân viên *"
              value={form.employee_code}
              onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
              required
            />
            <Input
              label="Họ tên *"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              required
            />
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Phòng ban
              <select
                value={form.department_id}
                onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                className="h-10 rounded-lg border border-slate-300 px-3 font-normal focus:ring-2 focus:ring-[var(--brand)]"
              >
                <option value="">— Chưa gán —</option>
                {props.departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Quản lý trực tiếp
              <select
                value={form.manager_id}
                onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
                className="h-10 rounded-lg border border-slate-300 px-3 font-normal focus:ring-2 focus:ring-[var(--brand)]"
              >
                <option value="">— Không có —</option>
                {props.managers.filter((m) => m.id !== editing?.id).map((m) => (
                  <option key={m.id} value={m.id}>{m.employee_code}</option>
                ))}
              </select>
            </label>
            <Input
              label="Chức danh"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Input
              label="Ngày vào làm"
              type="date"
              value={form.hired_at || ""}
              onChange={(e) => setForm({ ...form, hired_at: e.target.value || null })}
            />
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Trạng thái làm việc
              <select
                value={form.employment_status}
                onChange={(e) => setForm({ ...form, employment_status: e.target.value as "active" | "inactive" | "terminated" })}
                className="h-10 rounded-lg border border-slate-300 px-3 font-normal focus:ring-2 focus:ring-[var(--brand)]"
              >
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Tạm nghỉ</option>
                <option value="terminated">Đã nghỉ việc</option>
              </select>
            </label>
          </div>
          {error && (
            <div className="rounded-lg border border-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setCreating(false); setEditing(null); setError(null); }}>
              Hủy
            </Button>
            <Button type="submit" loading={saving}>
              Lưu
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        open={confirmDelete}
        onClose={() => { setConfirmDelete(false); setDeleting(null); }}
        onConfirm={() => handleDelete(deleting!)}
        title="Xóa nhân viên"
        message={`Bạn có chắc muốn xóa ${deleting?.employee_code}? Lịch sử chấm công của nhân viên sẽ được giữ lại, tài khoản không thể đăng nhập nữa.`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        danger
        loading={confirmDelete}
      />
    </div>
  );
}
