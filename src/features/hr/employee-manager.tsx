"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Td, Th, Table } from "@/components/ui/table";
import { createEmployee, deactivateEmployee, updateEmployee } from "@/features/hr/actions";

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
    const res = await deactivateEmployee(deactivating.id);
    setDeactivating(null);
    if (!res.ok) setError(res.message);
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
        <p className="text-sm text-slate-500">○ Hết tài khoản chưa gán mã nhân viên — HR tạo tài khoản đăng nhập trước (Phase 3 chưa có mời tài khoản).</p>
      ) : null}

      {error ? <ErrorState title="Không lưu được" description={error} /> : null}

      <Card>
        {props.rows.length === 0 ? (
          <EmptyState title="Chưa có nhân viên" description="Thử đổi từ khóa hoặc thêm mới." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Mã NV</Th>
                <Th>Họ tên</Th>
                <Th>Phòng ban</Th>
                <Th>Quản lý</Th>
                <Th>Trạng thái</Th>
                <Th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {props.rows.map((r) => (
                <tr key={r.id}>
                  <Td>{r.employee_code}</Td>
                  <Td>{r.display_name || r.email}</Td>
                  <Td>{r.department_name}</Td>
                  <Td>{r.manager_code}</Td>
                  <Td>
                    {r.employment_status === "active" && r.profile_active ? (
                      <Badge tone="success">✓ Đang hoạt động</Badge>
                    ) : (
                      <Badge tone="danger">✕ Vô hiệu</Badge>
                    )}
                  </Td>
                  <Td>
                    <div className="flex gap-1">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>Sửa</Button>
                      {r.employment_status === "active" ? (
                        <Button size="sm" variant="ghost" onClick={() => setDeactivating(r)}>
                          Vô hiệu
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
          <span>Tổng {props.total} · trang {props.page}/{totalPages}</span>
          <div className="flex gap-1">
            {props.page > 1 ? (
              <a href={`?q=${encodeURIComponent(props.q)}&status=${props.status}&page=${props.page - 1}`}>
                <Button size="sm" variant="secondary">Trước</Button>
              </a>
            ) : null}
            {props.page < totalPages ? (
              <a href={`?q=${encodeURIComponent(props.q)}&status=${props.status}&page=${props.page + 1}`}>
                <Button size="sm" variant="secondary">Sau</Button>
              </a>
            ) : null}
          </div>
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
        onConfirm={onDeactivate}
        onCancel={() => setDeactivating(null)}
      />
    </div>
  );
}
