"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ConfirmModal } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { createAssignment, createShift, deleteAssignment, updateShift } from "@/features/hr/actions";
import { toast } from "@/components/ui/toast";

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

const SHIFT_STATUS_LABELS: Record<string, string> = {
  overnight: "Qua đêm",
  regular: "Bình thường",
};

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
  const [deletingShift, setDeletingShift] = useState<ShiftRow | null>(null);
  const [confirmDeleteShift, setConfirmDeleteShift] = useState(false);
  const [confirmDeleteAssign, setConfirmDeleteAssign] = useState(false);
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

  async function handleDeleteShift(s: ShiftRow) {
    setDeletingShift(s);
    setConfirmDeleteShift(true);
    // Note: Shift deletion is not exposed via server API. Inform user instead.
    setConfirmDeleteShift(false);
    setDeletingShift(null);
    toast.error("Xóa ca làm chưa được hỗ trợ qua API hiện tại. Vui lòng liên hệ quản trị viên.");
  }

  async function handleDeleteAssign(a: AssignmentRow) {
    setDeletingAssign(a);
    setConfirmDeleteAssign(true);
    const res = await deleteAssignment(a.id);
    setConfirmDeleteAssign(false);
    setDeletingAssign(null);
    if (!res.ok) setError(res.message);
    else {
      toast.success("Đã xóa phân ca.");
      router.refresh();
    }
  }

  const shiftStatus = (s: ShiftRow) => (
    <Badge tone={s.overnight ? "warning" : "success"}>
      <Icon name={s.overnight ? "clock" : "check"} size={12} /> {s.overnight ? "Qua đêm" : "Bình thường"}
    </Badge>
  );

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div className="rounded-lg border border-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]" role="alert">
          {error}
        </div>
      ) : null}

      {/* Danh sách ca làm */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <CardTitle>Danh sách ca làm</CardTitle>
            <p className="text-[11px] text-slate-500">Quản lý ca ngày, ca đêm qua ngày, grace period và làm tròn</p>
          </div>
          <Button size="sm" onClick={openCreateShift}>
            <Icon name="plus" size={14} /> Thêm ca
          </Button>
        </div>
        <DataTable
          ariaLabel="Danh sách ca làm"
          rows={props.shifts}
          keyOf={(s) => s.id}
          emptyTitle="Chưa có ca làm"
          emptyDescription="Tạo ca ngày, ca đêm qua ngày…"
          columns={[
            {
              key: "name",
              header: "Tên ca",
              render: (s) => <span className="font-medium">{s.name}</span>,
            },
            {
              key: "time",
              header: "Giờ làm",
              render: (s) => <span className="tnum">{s.start_time} – {s.end_time}</span>,
            },
            {
              key: "type",
              header: "Loại ca",
              render: shiftStatus,
            },
            {
              key: "grace",
              header: "Grace vào/ra",
              render: (s) => <span className="tnum">{s.grace_in_min}′ / {s.grace_out_min}′</span>,
            },
            {
              key: "round",
              header: "Làm tròn",
              render: (s) => <span className="tnum">{s.rounding_min}′</span>,
            },
            {
              key: "actions",
              header: <span className="sr-only">Thao tác</span>,
              render: (s) => (
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => openEditShift(s)}>
                    <Icon name="file-text" size={14} /> Sửa
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setDeletingShift(s); setConfirmDeleteShift(true); }}
                  >
                    <Icon name="x" size={14} /> Xóa
                  </Button>
                </div>
              ),
            },
          ]}
          cardTitle={(s) => `${s.name} (${s.start_time} – ${s.end_time})`}
          cardStatus={shiftStatus}
          cardMeta={(s) => <span className="tnum">Grace {s.grace_in_min}′/{s.grace_out_min}′ · Làm tròn {s.rounding_min}′</span>}
          cardActions={(s) => (
            <div className="flex gap-1">
              <Button size="sm" variant="secondary" onClick={() => openEditShift(s)}>
                Sửa
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setDeletingShift(s); setConfirmDeleteShift(true); }}
              >
                Xóa
              </Button>
            </div>
          )}
        />
      </Card>

      {/* Phân ca */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <CardTitle>Phân ca nhân viên</CardTitle>
            <p className="text-[11px] text-slate-500">Gán ca làm cho nhân viên trong khoảng thời gian hiệu lực</p>
          </div>
          <Button size="sm" onClick={openCreateShift} disabled={props.shifts.length === 0 || props.employees.length === 0}>
            Thêm ca mới
          </Button>
        </div>
        <form onSubmit={onSaveAssign} className="mt-3 grid gap-2 sm:grid-cols-5">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Nhân viên
            <Select
              value={assignForm.employee_id}
              onChange={(v) => setAssignForm({ ...assignForm, employee_id: v as string })}
              options={[{ value: "", label: "— Chọn —" }, ...props.employees.map((m) => ({ value: m.id, label: m.employee_code }))]}
              placeholder="Chọn nhân viên"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Ca làm
            <Select
              value={assignForm.shift_id}
              onChange={(v) => setAssignForm({ ...assignForm, shift_id: v as string })}
              options={[{ value: "", label: "— Chọn —" }, ...props.shifts.map((s) => ({ value: s.id, label: s.name }))]}
              placeholder="Chọn ca làm"
            />
          </label>
          <Input label="Từ ngày" type="date" value={assignForm.effective_from} onChange={(e) => setAssignForm({ ...assignForm, effective_from: e.target.value })} required />
          <Input label="Đến ngày" type="date" value={assignForm.effective_to} onChange={(e) => setAssignForm({ ...assignForm, effective_to: e.target.value })} hint="Bỏ trống = vô thời hạn" />
          <div className="flex items-end">
            <Button type="submit" loading={saving}>
              <Icon name="arrow-right" size={16} /> Phân ca
            </Button>
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
              {
                key: "emp",
                header: "Nhân viên",
                render: (a) => <span className="font-medium">{a.employee_code}</span>,
              },
              {
                key: "shift",
                header: "Ca làm",
                render: (a) => <span>{a.shift_name}</span>,
              },
              {
                key: "range",
                header: "Hiệu lực",
                render: (a) => <span className="tnum">{a.effective_from} → {a.effective_to ?? "∞"}</span>,
              },
              {
                key: "actions",
                header: <span className="sr-only">Thao tác</span>,
                render: (a) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setDeletingAssign(a); setConfirmDeleteAssign(true); }}
                  >
                    <Icon name="x" size={14} /> Xóa
                  </Button>
                ),
              },
            ]}
            cardTitle={(a) => `${a.employee_code} — ${a.shift_name}`}
            cardMeta={(a) => <span className="tnum">{a.effective_from} → {a.effective_to ?? "∞"}</span>}
            cardActions={(a) => (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setDeletingAssign(a); setConfirmDeleteAssign(true); }}
              >
                Xóa
              </Button>
            )}
          />
        </div>
      </Card>

      {/* Thêm/Sửa ca làm Modal */}
      <Modal
        open={shiftOpen}
        onClose={() => setShiftOpen(false)}
        title={editingShift ? "Sửa ca làm" : "Thêm ca làm"}
        size="lg"
      >
        <form onSubmit={onSaveShift} className="flex flex-col gap-3">
          <Input label="Tên ca *" value={shiftForm.name} onChange={(e) => setField("name", e.target.value)} required />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Giờ bắt đầu *" type="time" value={shiftForm.start_time} onChange={(e) => setField("start_time", e.target.value)} required />
            <Input label="Giờ kết thúc *" type="time" value={shiftForm.end_time} onChange={(e) => setField("end_time", e.target.value)} required />
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
          {error && (
            <div className="rounded-lg border border-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShiftOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" loading={saving}>
              Lưu
            </Button>
          </div>
        </form>
      </Modal>

      {/* Xóa ca làm Confirm */}
      <ConfirmModal
        open={confirmDeleteShift}
        onClose={() => { setConfirmDeleteShift(false); setDeletingShift(null); }}
        onConfirm={() => {
          // Shift deletion not supported via API (soft delete via employment_status equivalent not available for shifts)
          // We inform user and close
          setConfirmDeleteShift(false);
          setDeletingShift(null);
          toast.error("Xóa ca làm chưa được hỗ trợ qua API. Vui lòng liên hệ quản trị viên.");
        }}
        title="Xóa ca làm"
        message={`Bạn có chắc muốn xóa ca "${deletingShift?.name}"? Các phân ca đã gán sẽ bị ảnh hưởng.`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        danger
        loading={confirmDeleteShift}
      />

      {/* Xóa phân ca Confirm */}
      <ConfirmModal
        open={confirmDeleteAssign}
        onClose={() => { setConfirmDeleteAssign(false); setDeletingAssign(null); }}
        onConfirm={() => handleDeleteAssign(deletingAssign!)}
        title="Xóa phân ca"
        message={`Xóa phân ca ${deletingAssign?.employee_code} – ${deletingAssign?.shift_name}? Lịch sử chấm công đã ghi không bị ảnh hưởng.`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        danger
        loading={confirmDeleteAssign}
      />
    </div>
  );
}
