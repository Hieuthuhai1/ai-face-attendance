"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icon";
import { Input, Textarea } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/states";
import { createLeave, reviewLeave } from "@/features/workflow/actions";
import { toast } from "@/components/ui/toast";

export interface LeaveRow {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  employee_code?: string;
}

const LEAVE_TYPES = [
  { value: "annual", label: "Phép năm" },
  { value: "sick", label: "Ốm đau" },
  { value: "unpaid", label: "Nghỉ không lương" },
  { value: "maternity", label: "Thai sản" },
  { value: "other", label: "Khác" },
] as const;

function leaveTypeLabel(value: string) {
  return LEAVE_TYPES.find((type) => type.value === value)?.label ?? value;
}

function leaveBadge(status: string) {
  const tone = status === "approved" ? "success" as const : status === "rejected" ? "danger" as const : "warning" as const;
  const icon = status === "approved" ? "check" as const : status === "rejected" ? "x" as const : "clock" as const;
  const label = status === "pending" ? "Chờ duyệt" : status === "approved" ? "Đã duyệt" : "Từ chối";
  return (
    <Badge tone={tone}>
      <Icon name={icon} size={12} /> {label}
    </Badge>
  );
}

export function LeaveForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setSaving(true);
    setError(null);
    const res = await createLeave({
      leave_type: String(fd.get("leave_type") ?? ""),
      start_date: String(fd.get("start_date") ?? ""),
      end_date: String(fd.get("end_date") ?? ""),
      reason: String(fd.get("reason") ?? ""),
    });
    setSaving(false);
    if (!res.ok) {
      setError(`${res.code}: ${res.message}`);
      return;
    }
    setDone(true);
    form.reset();
    router.refresh();
  }

  if (done) {
    return (
      <Card>
        <div className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-[var(--success-border)] bg-[var(--success-bg)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p role="status" className="flex items-start gap-2 text-[13px] font-semibold text-[var(--success-strong)]">
            <Icon name="check" size={17} className="mt-0.5 shrink-0" /> Đã gửi đơn nghỉ, chờ quản lý/HR duyệt.
          </p>
          <Button size="sm" variant="secondary" onClick={() => setDone(false)} className="shrink-0">
            Gửi đơn khác
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <p className="eyebrow flex items-center gap-1.5">
        <Icon name="calendar" size={13} className="text-[var(--brand)]" /> Đơn nghỉ
      </p>
      <CardTitle>Gửi đơn nghỉ</CardTitle>
      <CardDescription>Đơn chờ quản lý/HR duyệt. Ngày nghỉ không tự xóa công đã ghi.</CardDescription>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[var(--text-2)]">
            Loại nghỉ <span className="text-[var(--danger)]">*</span>
            <select
              name="leave_type"
              required
              defaultValue=""
              className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-white px-3 text-sm text-[var(--text-1)] shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--border-strong)] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]"
            >
              <option value="">— Chọn loại nghỉ —</option>
              {LEAVE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </label>
          <div className="hidden sm:block" />
          <Input label="Từ ngày" name="start_date" type="date" required />
          <Input label="Đến ngày" name="end_date" type="date" required />
        </div>
        <Textarea
          label="Lý do"
          name="reason"
          required
          rows={3}
          minLength={5}
          placeholder="Mô tả lý do nghỉ (tối thiểu 5 ký tự)…"
        />
        {error ? (
          <p role="alert" className="flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[13px] font-medium text-[var(--danger-strong)]">
            <Icon name="x" size={14} /> {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <p className="flex items-center gap-1.5 text-[12px] text-[var(--text-3)]">
            <Icon name="info" size={13} /> Ngày nghỉ không tự xóa công đã ghi.
          </p>
          <Button type="submit" loading={saving}>
            <Icon name="calendar" size={16} /> Gửi đơn nghỉ
          </Button>
        </div>
      </form>
    </Card>
  );
}

function reviewButtons(
  busy: boolean,
  decide: (decision: "approved" | "rejected") => void,
) {
  return (
    <div className="flex gap-1.5">
      <Button size="sm" onClick={() => decide("approved")} disabled={busy}>
        <Icon name="check" size={13} /> Duyệt
      </Button>
      <Button size="sm" variant="secondary" onClick={() => decide("rejected")} disabled={busy}>
        Từ chối
      </Button>
    </div>
  );
}

export function LeaveList({ rows, reviewable }: { rows: LeaveRow[]; reviewable: boolean }) {
  const router = useRouter();
  const [target, setTarget] = useState<{ row: LeaveRow; decision: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setError(null);
    const res = await reviewLeave(target.row.id, { decision: target.decision, note });
    setBusy(false);
    if (!res.ok) {
      setError(`${res.code}: ${res.message}`);
      return;
    }
    toast.success(target.decision === "approved" ? "Đã duyệt đơn nghỉ." : "Đã từ chối đơn nghỉ.");
    setTarget(null);
    setNote("");
    router.refresh();
  }

  const decide = (row: LeaveRow, decision: "approved" | "rejected") => {
    setTarget({ row, decision });
    setNote("");
  };

  const requiredNote = target?.decision === "rejected";

  return (
    <div className="flex flex-col gap-3">
      {error ? <ErrorState title="Không xử lý được" description={error} /> : null}
      <DataTable
        ariaLabel="Danh sách đơn nghỉ"
        rows={rows}
        keyOf={(r) => r.id}
        emptyTitle="Chưa có đơn nghỉ"
        emptyDescription="Đơn bạn gửi / cần duyệt sẽ hiện ở đây."
        columns={[
          ...(reviewable
            ? [{
                key: "emp",
                header: "Nhân viên",
                render: (r: LeaveRow) => (
                  <span className="tnum text-[13px] font-semibold text-[var(--navy-800)]">{r.employee_code ?? "—"}</span>
                ),
              }]
            : []),
          {
            key: "type",
            header: "Loại nghỉ",
            render: (r: LeaveRow) => (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-2)]">
                <Icon name="calendar" size={14} /> {leaveTypeLabel(r.leave_type)}
              </span>
            ),
          },
          {
            key: "range",
            header: "Thời gian",
            render: (r: LeaveRow) => (
              <span className="tnum text-[13px] text-[var(--text-2)]">
                {r.start_date} <span aria-hidden="true" className="text-[var(--text-3)]">→</span> {r.end_date}
              </span>
            ),
          },
          { key: "status", header: "Trạng thái", render: (r: LeaveRow) => leaveBadge(r.status) },
          ...(reviewable
            ? [{
                key: "actions",
                header: <span className="sr-only">Thao tác</span>,
                render: (r: LeaveRow) =>
                  r.status === "pending" ? reviewButtons(busy, (d) => decide(r, d)) : null,
              }]
            : []),
        ]}
        cardTitle={(r) => `${leaveTypeLabel(r.leave_type)} · ${r.start_date}`}
        cardStatus={(r) => leaveBadge(r.status)}
        cardMeta={(r) => (
          <span className="flex flex-col gap-1 text-[13px] text-[var(--text-2)]">
            <span className="tnum">{r.start_date} → {r.end_date}</span>
            {reviewable && r.employee_code ? <span>Nhân viên: {r.employee_code}</span> : null}
            {r.reason ? <span>Lý do: {r.reason}</span> : null}
          </span>
        )}
        cardActions={(r) =>
          reviewable && r.status === "pending" ? reviewButtons(busy, (d) => decide(r, d)) : undefined
        }
      />
      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target?.decision === "approved" ? "Duyệt đơn nghỉ" : "Từ chối đơn nghỉ"}
        size="md"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setTarget(null)} disabled={busy}>
              Hủy
            </Button>
            <Button
              type="submit"
              form="review-leave-form"
              variant={target?.decision === "approved" ? "primary" : "danger"}
              loading={busy}
            >
              <Icon name={target?.decision === "approved" ? "check" : "x"} size={15} /> Xác nhận
            </Button>
          </>
        }
      >
        <form id="review-leave-form" onSubmit={onConfirm} className="flex flex-col gap-4">
          <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3 text-[13px] text-[var(--text-2)]">
            <p className="font-semibold text-[var(--navy-800)]">
              {target?.row.employee_code ?? "—"} · {target ? leaveTypeLabel(target.row.leave_type) : ""}
            </p>
            <p className="tnum mt-0.5">
              {target?.row.start_date} → {target?.row.end_date}
            </p>
            {target?.row.reason ? <p className="mt-1.5">Lý do: {target.row.reason}</p> : null}
          </div>
          <Textarea
            label={requiredNote ? "Lý do từ chối (bắt buộc)" : "Ghi chú (không bắt buộc)"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required={requiredNote}
            rows={3}
            placeholder={requiredNote ? "Nêu rõ lý do để nhân viên điều chỉnh…" : "Ghi chú thêm cho nhân viên…"}
          />
        </form>
      </Modal>
    </div>
  );
}
