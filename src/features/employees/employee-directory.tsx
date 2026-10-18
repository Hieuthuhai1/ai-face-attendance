"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { ErrorState } from "@/components/ui/states";
import { EmployeeRow } from "@/features/hr/employee-manager";
import { deactivateEmployee, updateEmployee, createEmployee } from "@/features/hr/actions";
import { toast } from "@/components/ui/toast";

// Client-side pagination wrapper for employee directory
import { Pagination as PaginationComp, type PaginationProps } from "@/components/ui/pagination";

function EmployeeDirectoryPagination(props: Omit<PaginationProps, "onPageChange" | "hrefFor"> & {
  baseParams: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const onPageChange = (page: number) => {
    const params = new URLSearchParams(props.baseParams);
    params.set("page", String(page));
    router.push(`?${params.toString()}`);
  };

  return <PaginationComp {...props} onPageChange={onPageChange} />;
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

const emptyForm = { employee_code: "", display_name: "", department_id: "", manager_id: "", title: "", employment_status: "active" as const };

export function EmployeeDirectory(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState(emptyForm);
  const [profileId, setProfileId] = useState("");
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deactivating, setDeactivating] = useState<EmployeeRow | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const totalPages = Math.max(1, Math.ceil(props.total / props.pageSize));

  const handleSort = useCallback((key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  }, []);

  const sortedRows = useCallback(() => {
    if (!sortConfig) return props.rows;
    return [...props.rows].sort((a, b) => {
      const aVal = a[sortConfig.key as keyof EmployeeRow];
      const bVal = b[sortConfig.key as keyof EmployeeRow];
      if (aVal === bVal) return 0;
      const comparison = String(aVal).localeCompare(String(bVal), "vi", { numeric: true });
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [props.rows, sortConfig]);

  function openCreate() {
    setForm(emptyForm);
    setProfileId("");
    setError(null);
    setEditing(null);
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
    });
    setError(null);
    setCreating(false);
    setEditing(row);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      employee_code: form.employee_code.trim(),
      display_name: form.display_name.trim(),
      department_id: form.department_id || null,
      manager_id: form.manager_id || null,
      title: form.title.trim(),
      employment_status: (editing?.employment_status ?? "active") as EmployeeRow["employment_status"],
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
    window.location.reload();
  }

  async function onDeactivate() {
    if (!deactivating) return;
    setConfirming(true);
    const res = await deactivateEmployee(deactivating.id);
    setConfirming(false);
    setDeactivating(null);
    if (!res.ok) setError(res.message);
    else toast.success(`Đã vô hiệu hóa ${deactivating?.employee_code ?? ""}.`);
    window.location.reload();
  }

  function toggleRowSelection(id: string) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedRows.size === props.rows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(props.rows.map((r) => r.id)));
    }
  }

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input label="Tìm kiếm" name="q" defaultValue={props.q} placeholder="Mã, tên, email, chức danh…" />
        </div>
        <div className="flex items-center gap-2">
          <Select
            label="Phòng ban"
            value={searchParams.get("departmentId") || ""}
            onChange={(v) => {
              const params = new URLSearchParams(searchParams.toString());
              if (v) params.set("departmentId", v);
              else params.delete("departmentId");
              params.set("page", "1");
              router.push(`?${params.toString()}`);
            }}
            options={[{ value: "", label: "Tất cả phòng ban" }, ...props.departments.map((d) => ({ value: d.id, label: d.name }))]}
          />
          <Select
            label="Trạng thái"
            value={searchParams.get("status") || "all"}
            onChange={(v) => {
              const params = new URLSearchParams(searchParams.toString());
              if (v !== "all") params.set("status", v);
              else params.delete("status");
              params.set("page", "1");
              router.push(`?${params.toString()}`);
            }}
            options={[
              { value: "all", label: "Tất cả" },
              { value: "active", label: "Đang hoạt động" },
              { value: "inactive", label: "Không hoạt động" },
              { value: "terminated", label: "Đã nghỉ việc" },
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setViewMode("table")} className={viewMode === "table" ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : ""}>
            <Icon name="layout" size={16} /> Bảng
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setViewMode("cards")} className={viewMode === "cards" ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : ""}>
            <Icon name="layout" size={16} /> Thẻ
          </Button>
        </div>
        <Button type="button" onClick={openCreate} disabled={props.freeProfiles.length === 0}>
          <Icon name="plus" size={16} /> Thêm nhân viên
        </Button>
        {selectedRows.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Đã chọn {selectedRows.size}</span>
            <Button variant="danger" size="sm" disabled={!confirming} onClick={() => setConfirming(true)}>
              <Icon name="x" size={14} /> Xóa nhiều
            </Button>
          </div>
        )}
      </div>

      {error ? <ErrorState title="Không lưu được" description={error} /> : null}

      {/* Table View */}
      {viewMode === "table" && (
        <Card>
          <DataTable
            ariaLabel="Danh sách nhân viên"
            rows={props.rows}
            keyOf={(r) => r.id}
            emptyTitle="Chưa có nhân viên"
            emptyDescription="Thử đổi từ khóa hoặc thêm mới."
            columns={[
              { key: "code", header: "Mã NV", render: (r) => <span className="font-medium">{r.employee_code}</span>, sortable: true, sortConfig },
              { key: "name", header: "Họ tên", render: (r) => <span className="font-medium">{r.display_name || r.email}</span>, sortable: true, sortConfig },
              { key: "dept", header: "Phòng ban", render: (r) => r.department_name, sortable: true, sortConfig },
              { key: "mgr", header: "Quản lý", render: (r) => r.manager_code, sortable: true, sortConfig },
              {
                key: "face_status",
                header: "Face Enrollment",
                render: (r) => {
                  // This would need to be passed in - for now showing placeholder
                  return <Badge tone="neutral">Chưa biết</Badge>;
                },
              },
              {
                key: "status",
                header: "Trạng thái",
                render: (r) =>
                  r.employment_status === "active" && r.profile_active ? (
                    <Badge tone="success"><Icon name="check" size={14} /> Đang hoạt động</Badge>
                  ) : (
                    <Badge tone="danger"><Icon name="x" size={14} /> Vô hiệu</Badge>
                  ),
                sortable: true,
                sortConfig,
              },
              {
                key: "actions",
                header: <span className="sr-only">Thao tác</span>,
                render: (r) => (
                  <div className="flex gap-1">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>Sửa</Button>
                    {r.employment_status === "active" ? (
                      <Button size="sm" variant="ghost" onClick={() => setDeactivating(r)}>Vô hiệu</Button>
                    ) : null}
                  </div>
                ),
              },
            ]}
            cardTitle={(r) => `${r.employee_code} — ${r.display_name || r.email}`}
            cardStatus={(r) =>
              r.employment_status === "active" && r.profile_active ? (
                <Badge tone="success"><Icon name="check" size={14} /> Đang hoạt động</Badge>
              ) : (
                <Badge tone="danger"><Icon name="x" size={14} /> Vô hiệu</Badge>
              )
            }
            cardMeta={(r) => `${r.department_name} · QL: ${r.manager_code}`}
            cardActions={(r) => (
              <>
                <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>Sửa</Button>
                {r.employment_status === "active" ? (
                  <Button size="sm" variant="ghost" onClick={() => setDeactivating(r)}>Vô hiệu</Button>
                ) : null}
              </>
            )}
            rowClassName={(r) => `cursor-pointer ${selectedRows.has(r.id) ? "bg-[var(--brand-soft)]" : ""}`}
            onRowClick={(r) => toggleRowSelection(r.id)}
          />
          <div className="mt-3">
            <EmployeeDirectoryPagination
              page={props.page}
              totalPages={totalPages}
              total={props.total}
              label="nhân viên"
              baseParams={{
                q: searchParams.get("q") || "",
                status: searchParams.get("status") || "all",
              }}
            />
          </div>
        </Card>
      )}

      {/* Card View */}
      {viewMode === "cards" && (
        <div className="flex flex-col gap-2 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {props.rows.map((r) => (
            <article
              key={r.id}
              className={`rounded-xl border border-slate-200 bg-white p-4 ${selectedRows.has(r.id) ? "ring-2 ring-[var(--brand)]" : ""}`}
              onClick={() => toggleRowSelection(r.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Avatar name={r.display_name || r.email} src={null} size="md" />
                  <div>
                    <p className="font-medium text-slate-800">{r.employee_code}</p>
                    <p className="text-sm text-slate-500">{r.display_name || r.email}</p>
                  </div>
                </div>
                <Badge tone={r.employment_status === "active" && r.profile_active ? "success" : "danger"}>
                  <Icon name={r.employment_status === "active" && r.profile_active ? "check" : "x"} size={12} />
                  {r.employment_status === "active" && r.profile_active ? "Đang hoạt động" : "Vô hiệu"}
                </Badge>
              </div>
              <div className="mt-3 text-sm text-slate-500">
                <p>{r.department_name} · QL: {r.manager_code}</p>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>Sửa</Button>
                {r.employment_status === "active" ? (
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDeactivating(r); }}>Vô hiệu</Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="mt-3">
        <EmployeeDirectoryPagination
          page={props.page}
          totalPages={Math.max(1, Math.ceil(props.total / props.pageSize))}
          total={props.total}
          label="nhân viên"
          baseParams={{
            q: searchParams.get("q") || "",
            status: searchParams.get("status") || "all",
          }}
        />
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={creating || editing !== null} title={editing ? "Sửa nhân viên" : "Thêm nhân viên"} onClose={() => { setCreating(false); setEditing(null); }}>
        <form onSubmit={onSave} className="flex flex-col gap-3">
          {!editing ? (
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Tài khoản đăng nhập
              <select value={profileId} onChange={(e) => setProfileId(e.target.value)} required className="h-10 rounded-lg border border-slate-300 px-3 font-normal">
                <option value="">— Chọn tài khoản —</option>
                {props.freeProfiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.email}{p.display_name ? ` (${p.display_name})` : ""}</option>
                ))}
              </select>
            </label>
          ) : null}
          <Input label="Mã nhân viên" value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} required />
          <Input label="Họ tên" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} required />
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Phòng ban
            <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} className="h-10 rounded-lg border border-slate-300 px-3 font-normal">
              <option value="">— Chưa gán —</option>
              {props.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Quản lý trực tiếp
            <select value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })} className="h-10 rounded-lg border border-slate-300 px-3 font-normal">
              <option value="">— Không có —</option>
              {props.managers.filter((m) => m.id !== editing?.id).map((m) => <option key={m.id} value={m.id}>{m.employee_code}</option>)}
            </select>
          </label>
          <Input label="Chức danh" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Trạng thái làm việc
            <select value={form.employment_status} onChange={(e) => setForm({ ...form, employment_status: e.target.value })} className="h-10 rounded-lg border border-slate-300 px-3 font-normal">
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Tạm nghỉ</option>
              <option value="terminated">Đã nghỉ việc</option>
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>Hủy</Button>
            <Button type="submit" loading={saving}>Lưu</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deactivating !== null}
        title="Vô hiệu hóa nhân viên"
        message={`Vô hiệu ${deactivating?.employee_code}? Lịch sử chấm công được giữ lại, tài khoản không đăng nhập được nữa.`}
        confirmLabel="Vô hiệu hóa"
        danger
        loading={confirming}
        onConfirm={onDeactivate}
        onCancel={() => setDeactivating(null)}
      />

      <ConfirmDialog
        open={confirming}
        title="Xóa nhiều nhân viên"
        message={`Bạn có chắc muốn xóa ${selectedRows.size} nhân viên đã chọn? Lịch sử chấm công được giữ lại.`}
        confirmLabel="Xóa"
        danger
        loading={confirming}
        onConfirm={() => {
          // Implement bulk deactivate
          setConfirming(false);
          setSelectedRows(new Set());
          window.location.reload();
        }}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}