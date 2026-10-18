"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { createEmployee, deactivateEmployee, updateEmployee } from "@/features/hr/actions";
import { toast } from "@/components/ui/toast";

// Client-side pagination wrapper
import { Pagination as PaginationComp, type PaginationProps } from "@/components/ui/pagination";

function EmployeeManagerPagination(props: Omit<PaginationProps, "onPageChange" | "hrefFor"> & {
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

const emptyForm = { employee_code: "", display_name: "", department_id: "", manager_id: "", title: "" };

export function EmployeeManager(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [profileId, setProfileId] = useState("");
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deactivating, setDeactivating] = useState<EmployeeRow | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totalPages = Math.max(1, Math.ceil(props.total / props.pageSize));

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
    router.refresh();
  }

  async function onDeactivate() {
    if (!deactivating) return;
    setConfirming(true);
    const res = await deactivateEmployee(deactivating.id);
    setConfirming(false);
    setDeactivating(null);
    if (!res.ok) setError(res.message);
    else toast.success(`Đã vô hiệu hóa ${deactivating?.employee_code ?? ""}.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <Input label="Tìm kiếm" name="q" defaultValue={props.q} placeholder="Mã hoặc chức danh…" />
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Trạng thái
          <select name="status" defaultValue={props.status} className="h-10 rounded-lg border border-slate-300 px-3">
            <option value="all">Tất cả</option>
            <option value="inactive">Không hoạt động</option>
          </select>
        </label>
        <Button type="submit" variant="secondary">Tìm</Button>
        <Button type="button" onClick={openCreate} disabled={props.freeProfiles.length === 0}>
          Thêm nhân viên
        </Button>
      </form>
      {props.freeProfiles.length === 0 ? (
        <p className="text-sm text-slate-500">Hết tài khoản chưa gán mã nhân viên — HR tạo tài khoản đăng nhập trước khi thêm mới (chưa có luồng mời tài khoản).</p>
      ) : null}

      {error ? <ErrorState title="Không lưu được" description={error} /> : null}

      <Card>
        <DataTable
          ariaLabel="Danh sách nhân viên"
          rows={props.rows}
          keyOf={(r) => r.id}
          emptyTitle="Chưa có nhân viên"
          emptyDescription="Thử đổi từ khóa hoặc thêm mới."
          columns={[
            { key: "code", header: "Mã NV", render: (r) => <span className="font-medium">{r.employee_code}</span> },
            { key: "name", header: "Họ tên", render: (r) => r.display_name || r.email },
            { key: "dept", header: "Phòng ban", render: (r) => r.department_name },
            { key: "mgr", header: "Quản lý", render: (r) => r.manager_code },
            {
              key: "status",
              header: "Trạng thái",
              render: (r) =>
                r.employment_status === "active" && r.profile_active ? (
                  <Badge tone="success"><Icon name="check" size={14} /> Đang hoạt động</Badge>
                ) : (
                  <Badge tone="danger"><Icon name="x" size={14} /> Vô hiệu</Badge>
                ),
            },
            {
              key: "actions",
              header: <span className="sr-only">Thao tác</span>,
              render: (r) => (
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>Sửa</Button>
                  {r.employment_status === "active" ? (
                    <Button size="sm" variant="ghost" onClick={() => setDeactivating(r)}>
                      Vô hiệu
                    </Button>
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
                <Button size="sm" variant="ghost" onClick={() => setDeactivating(r)}>
                  Vô hiệu
                </Button>
              ) : null}
            </>
          )}
        />
        <div className="mt-3">
          <EmployeeManagerPagination
            page={props.page}
            totalPages={totalPages}
            total={props.total}
            label="nhân viên"
            baseParams={{
              q: props.q,
              status: props.status,
            }}
          />
        </div>
      </Card>

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
    </div>
  );
}
