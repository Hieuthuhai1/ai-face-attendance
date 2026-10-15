"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/states";
import { createAssignment, createShift, deleteAssignment, updateShift } from "@/features/hr/actions";

export interface ShiftRow {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  overnight: boolean;
  grace_in_min: number;
  grace_out_min: number;
  rounding_min: number;
}

export interface AssignmentRow {
  id: string;
  employee_code: string;
  shift_name: string;
  effective_from: string;
  effective_to: string | null;
}

const emptyShift = { name: "", start_time: "08:00", end_time: "17:00", overnight: false, grace_in_min: 5, grace_out_min: 5, rounding_min: 1 };

export function ShiftManager(props: {
  shifts: ShiftRow[];
  assignments: AssignmentRow[];
  employees: Array<{ id: string; employee_code: string }>;
}) {
  const router = useRouter();
  const [shiftForm, setShiftForm] = useState(emptyShift);
  const [editingShift, setEditingShift] = useState<ShiftRow | null>(null);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ employee_id: "", shift_id: "", effective_from: "", effective_to: "" });
  const [deletingAssign, setDeletingAssign] = useState<AssignmentRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof typeof emptyShift>(key: K, value: (typeof emptyShift)[K]) {
    setShiftForm({ ...shiftForm, [key]: value });
  }

  function openCreateShift() {
    setShiftForm(emptyShift);
    setEditingShift(null);
    setError(null);
    setShiftOpen(true);
  }

  function openEditShift(s: ShiftRow) {
    setShiftForm({ name: s.name, start_time: s.start_time, end_time: s.end_time, overnight: s.overnight, grace_in_min: s.grace_in_min, grace_out_min: s.grace_out_min, rounding_min: s.rounding_min });
    setEditingShift(s);
    setError(null);
    setShiftOpen(true);
  }

  async function onSaveShift(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = editingShift ? await updateShift(editingShift.id, shiftForm) : await createShift(shiftForm);
    setSaving(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setShiftOpen(false);
    router.refresh();
  }

  async function onSaveAssign(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await createAssignment({
      employee_id: assignForm.employee_id,
      shift_id: assignForm.shift_id,
      effective_from: assignForm.effective_from,
      effective_to: assignForm.effective_to || null,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setAssignForm({ employee_id: "", shift_id: "", effective_from: "", effective_to: "" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorState title="Không lưu được" description={error} /> : null}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <CardTitle>Ca làm (múi giờ Asia/Ho_Chi_Minh)</CardTitle>
          <Button size="sm" onClick={openCreateShift}>Thêm ca</Button>
        </div>
        <DataTable
          ariaLabel="Danh sách ca làm"
          rows={props.shifts}
          keyOf={(s) => s.id}
          emptyTitle="Chưa có ca làm"
          emptyDescription="Tạo ca ngày, ca đêm qua ngày…"
          columns={[
            { key: "name", header: "Tên ca", render: (s) => <span className="font-medium">{s.name}</span> },
            { key: "time", header: "Giờ", render: (s) => <span className="tnum">{s.start_time}–{s.end_time}</span> },
            { key: "night", header: "Qua đêm", render: (s) => (s.overnight ? <Badge tone="info">◐ Qua đêm</Badge> : "—") },
            { key: "grace", header: "Grace vào/ra", render: (s) => <span className="tnum">{s.grace_in_min}′/{s.grace_out_min}′</span> },
            {
              key: "actions",
              header: <span className="sr-only">Thao tác</span>,
              render: (s) => <Button size="sm" variant="secondary" onClick={() => openEditShift(s)}>Sửa</Button>,
            },
          ]}
          cardTitle={(s) => `${s.name} (${s.start_time}–${s.end_time})`}
          cardStatus={(s) => (s.overnight ? <Badge tone="info">◐ Qua đêm</Badge> : undefined)}
          cardMeta={(s) => <span className="tnum">Grace {s.grace_in_min}′/{s.grace_out_min}′</span>}
          cardActions={(s) => <Button size="sm" variant="secondary" onClick={() => openEditShift(s)}>Sửa</Button>}
        />
      </Card>

      <Card>
        <CardTitle>Phân ca (100 bản ghi gần nhất)</CardTitle>
        <form onSubmit={onSaveAssign} className="mt-3 grid gap-2 sm:grid-cols-5">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Nhân viên
            <select value={assignForm.employee_id} onChange={(e) => setAssignForm({ ...assignForm, employee_id: e.target.value })} required className="h-10 rounded-lg border border-slate-300 px-2 font-normal">
              <option value="">— Chọn —</option>
              {props.employees.map((m) => <option key={m.id} value={m.id}>{m.employee_code}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Ca
            <select value={assignForm.shift_id} onChange={(e) => setAssignForm({ ...assignForm, shift_id: e.target.value })} required className="h-10 rounded-lg border border-slate-300 px-2 font-normal">
              <option value="">— Chọn —</option>
              {props.shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <Input label="Từ ngày" type="date" value={assignForm.effective_from} onChange={(e) => setAssignForm({ ...assignForm, effective_from: e.target.value })} required />
          <Input label="Đến ngày" type="date" value={assignForm.effective_to} onChange={(e) => setAssignForm({ ...assignForm, effective_to: e.target.value })} hint="Bỏ trống = vô thời hạn" />
          <div className="flex items-end">
            <Button type="submit" loading={saving}>Phân ca</Button>
          </div>
        </form>
        <div className="mt-3">
          <DataTable
            ariaLabel="Danh sách phân ca"
            rows={props.assignments}
            keyOf={(a) => a.id}
            emptyTitle="Chưa phân ca"
            emptyDescription="Chọn nhân viên, ca và ngày hiệu lực ở trên."
            columns={[
              { key: "emp", header: "Nhân viên", render: (a) => <span className="font-medium">{a.employee_code}</span> },
              { key: "shift", header: "Ca", render: (a) => a.shift_name },
              { key: "range", header: "Hiệu lực", render: (a) => <span className="tnum">{a.effective_from} → {a.effective_to ?? "∞"}</span> },
              {
                key: "actions",
                header: <span className="sr-only">Thao tác</span>,
                render: (a) => <Button size="sm" variant="ghost" onClick={() => setDeletingAssign(a)}>Xóa</Button>,
              },
            ]}
            cardTitle={(a) => `${a.employee_code} — ${a.shift_name}`}
            cardMeta={(a) => <span className="tnum">{a.effective_from} → {a.effective_to ?? "∞"}</span>}
            cardActions={(a) => <Button size="sm" variant="ghost" onClick={() => setDeletingAssign(a)}>Xóa</Button>}
          />
        </div>
      </Card>

      <Dialog open={shiftOpen} title={editingShift ? "Sửa ca làm" : "Thêm ca làm"} onClose={() => setShiftOpen(false)}>
        <form onSubmit={onSaveShift} className="flex flex-col gap-3">
          <Input label="Tên ca" value={shiftForm.name} onChange={(e) => setField("name", e.target.value)} required />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Bắt đầu" type="time" value={shiftForm.start_time} onChange={(e) => setField("start_time", e.target.value)} required />
            <Input label="Kết thúc" type="time" value={shiftForm.end_time} onChange={(e) => setField("end_time", e.target.value)} required />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={shiftForm.overnight} onChange={(e) => setField("overnight", e.target.checked)} className="h-4 w-4" />
            Ca qua đêm (kết thúc sang ngày hôm sau)
          </label>
          <div className="grid grid-cols-3 gap-2">
            <Input label="Grace vào (′)" type="number" min={0} max={120} value={shiftForm.grace_in_min} onChange={(e) => setField("grace_in_min", Number(e.target.value))} />
            <Input label="Grace ra (′)" type="number" min={0} max={120} value={shiftForm.grace_out_min} onChange={(e) => setField("grace_out_min", Number(e.target.value))} />
            <Input label="Làm tròn (′)" type="number" min={1} max={60} value={shiftForm.rounding_min} onChange={(e) => setField("rounding_min", Number(e.target.value))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShiftOpen(false)}>Hủy</Button>
            <Button type="submit" loading={saving}>Lưu</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deletingAssign !== null}
        title="Xóa phân ca"
        message={`Xóa phân ca ${deletingAssign?.employee_code} – ${deletingAssign?.shift_name}? Lịch sử chấm công đã ghi không bị ảnh hưởng.`}
        confirmLabel="Xóa"
        danger
        onConfirm={async () => {
          if (!deletingAssign) return;
          const res = await deleteAssignment(deletingAssign.id);
          setDeletingAssign(null);
          if (!res.ok) setError(res.message);
          router.refresh();
        }}
        onCancel={() => setDeletingAssign(null)}
      />
    </div>
  );
}
