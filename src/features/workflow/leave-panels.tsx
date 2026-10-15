"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
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

const LEAVE_TYPES = ["annual", "sick", "unpaid", "maternity", "other"];

export function LeaveForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
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
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <Card>
      <CardTitle>Gửi đơn nghỉ</CardTitle>
      <CardDescription>Đơn chờ quản lý/HR duyệt. Ngày nghỉ không tự xóa công đã ghi.</CardDescription>
      <form onSubmit={onSubmit} className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Loại nghỉ
          <select name="leave_type" required className="h-10 rounded-lg border border-slate-300 px-3 font-normal">
            <option value="">— Chọn —</option>
            {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <div />
        <Input label="Từ ngày" name="start_date" type="date" required />
        <Input label="Đến ngày" name="end_date" type="date" required />
        <div className="sm:col-span-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Lý do (tối thiểu 5 ký tự)
            <textarea name="reason" required rows={3} className="rounded-lg border border-slate-300 px-3 py-2 font-normal" />
          </label>
        </div>
        {error ? <p role="alert" className="flex items-center gap-1 text-sm text-red-600 sm:col-span-2"><Icon name="x" size={14} /> {error}</p> : null}
        <div className="sm:col-span-2"><Button type="submit" loading={saving}>Gửi đơn</Button></div>
      </form>
    </Card>
  );
}

function leaveBadge(status: string) {
  const tone = status === "approved" ? "success" as const : status === "rejected" ? "danger" as const : "warning" as const;
  const icon = status === "approved" ? "check" as const : status === "rejected" ? "x" as const : "clock" as const;
  const label = status === "pending" ? "Chờ duyệt" : status === "approved" ? "Đã duyệt" : "Từ chối";
  return (
    <Badge tone={tone}>
      <Icon name={icon} size={14} /> {label}
    </Badge>
  );
}

function reviewButtons(
  r: LeaveRow,
  busy: boolean,
  decide: (decision: "approved" | "rejected") => void,
) {
  return (
    <div className="flex gap-1">
      <Button size="sm" onClick={() => decide("approved")} disabled={busy}>Duyệt</Button>
      <Button size="sm" variant="secondary" onClick={() => decide("rejected")} disabled={busy}>Từ chối</Button>
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
  return (
    <div className="flex flex-col gap-2">
      {error ? <ErrorState title="Không xử lý được" description={error} /> : null}
      <DataTable
        ariaLabel="Danh sách đơn nghỉ"
        rows={rows}
        keyOf={(r) => r.id}
        emptyTitle="Chưa có đơn nghỉ"
        emptyDescription="Đơn bạn gửi / cần duyệt sẽ hiện ở đây."
        columns={[
          ...(reviewable ? [{ key: "emp", header: "Nhân viên", render: (r: LeaveRow) => r.employee_code ?? "—" }] : []),
          { key: "type", header: "Loại", render: (r: LeaveRow) => r.leave_type },
          { key: "range", header: "Thời gian", render: (r: LeaveRow) => <span className="tnum">{r.start_date} → {r.end_date}</span> },
          { key: "status", header: "Trạng thái", render: (r: LeaveRow) => leaveBadge(r.status) },
          ...(reviewable
            ? [{
                key: "actions",
                header: <span className="sr-only">Thao tác</span>,
                render: (r: LeaveRow) => (r.status === "pending" ? reviewButtons(r, busy, (d) => decide(r, d)) : null),
              }]
            : []),
        ]}
        cardTitle={(r) => `${r.leave_type} · ${r.start_date} → ${r.end_date}`}
        cardStatus={(r) => leaveBadge(r.status)}
        cardMeta={(r) => (reviewable ? r.employee_code : undefined)}
        cardActions={(r) => (reviewable && r.status === "pending" ? reviewButtons(r, busy, (d) => decide(r, d)) : undefined)}
      />
      <Dialog open={target !== null} title="Duyệt đơn nghỉ" onClose={() => setTarget(null)}>
        <form onSubmit={onConfirm} className="flex flex-col gap-3">
          <Input label={target?.decision === "approved" ? "Ghi chú (không bắt buộc)" : "Lý do từ chối (bắt buộc)"} value={note} onChange={(e) => setNote(e.target.value)} required={target?.decision === "rejected"} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setTarget(null)}>Hủy</Button>
            <Button type="submit" loading={busy}>Xác nhận</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
