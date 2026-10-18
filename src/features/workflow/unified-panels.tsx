"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { ErrorState } from "@/components/ui/states";
import { createLeave, reviewLeave, createAdjustment, reviewAdjustment } from "@/features/workflow/actions";
import { toast } from "@/components/ui/toast";

export interface UnifiedRequestRow {
  id: string;
  type: "leave" | "adjustment";
  leave_type?: string;
  start_date?: string;
  end_date?: string;
  work_date?: string;
  requested_in?: string | null;
  requested_out?: string | null;
  reason: string | null;
  status: string;
  employee_code?: string;
  reviewer?: string | null;
  reviewed_at?: string | null;
  resolution_note?: string | null;
  created_at: string;
}

const LEAVE_TYPES = [
  { value: "annual", label: "Phép năm" },
  { value: "sick", label: "Ốm đau" },
  { value: "unpaid", label: "Nghỉ không lương" },
  { value: "maternity", label: "Thai sản" },
  { value: "other", label: "Khác" },
];

function statusConfig(status: string) {
  const map: Record<string, { tone: "success" | "danger" | "warning" | "neutral"; icon: string; label: string }> = {
    pending: { tone: "warning", icon: "clock", label: "Chờ duyệt" },
    approved: { tone: "success", icon: "check", label: "Đã duyệt" },
    rejected: { tone: "danger", icon: "x", label: "Từ chối" },
  };
  return map[status] ?? { tone: "neutral", icon: "help", label: status };
}

function statusBadge(status: string) {
  const { tone, icon, label } = statusConfig(status);
  return (
    <Badge tone={tone}>
      <Icon name={icon} size={12} /> {label}
    </Badge>
  );
}

export function UnifiedRequestForm() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"leave" | "adjustment">("leave");
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [adjError, setAdjError] = useState<string | null>(null);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [adjSaving, setAdjSaving] = useState(false);
  const [leaveDone, setLeaveDone] = useState(false);
  const [adjDone, setAdjDone] = useState(false);

  async function onLeaveSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLeaveSaving(true);
    setLeaveError(null);
    const res = await createLeave({
      leave_type: String(fd.get("leave_type") ?? ""),
      start_date: String(fd.get("start_date") ?? ""),
      end_date: String(fd.get("end_date") ?? ""),
      reason: String(fd.get("reason") ?? ""),
    });
    setLeaveSaving(false);
    if (!res.ok) {
      setLeaveError(`${res.code}: ${res.message}`);
      return;
    }
    setLeaveDone(true);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  async function onAdjSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setAdjSaving(true);
    setAdjError(null);
    const res = await createAdjustment({
      work_date: String(fd.get("work_date") ?? ""),
      event_id: null,
      requested_in: (String(fd.get("requested_in") ?? "") || null) as string | null,
      requested_out: (String(fd.get("requested_out") ?? "") || null) as string | null,
      reason: String(fd.get("reason") ?? ""),
    });
    setAdjSaving(false);
    if (!res.ok) {
      setAdjError(`${res.code}: ${res.message}`);
      return;
    }
    setAdjDone(true);
    router.refresh();
  }

  return (
    <Card>
      <Tabs items={[
        { key: "leave", label: "Đơn nghỉ" },
        { key: "adjustment", label: "Chỉnh công" },
      ]} value={activeTab} onChange={(key) => setActiveTab(key as "leave" | "adjustment")} />

      <TabPanel key="leave" value={activeTab}>
        {leaveDone ? (
          <div className="mt-3 p-4 bg-[var(--success-bg)] rounded-lg border border-[var(--success-border)]">
            <p className="flex items-center gap-2 font-medium text-[var(--success)]">
              <Icon name="check" size={16} /> Đã gửi đơn nghỉ, chờ duyệt.
            </p>
            <Button size="sm" variant="secondary" onClick={() => setLeaveDone(false)} className="mt-2">Gửi đơn khác</Button>
          </div>
        ) : (
          <form onSubmit={onLeaveSubmit} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Loại nghỉ
              <select name="leave_type" required className="h-10 rounded-lg border border-slate-300 px-3 font-normal">
                <option value="">— Chọn —</option>
                {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
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
            {leaveError ? <p role="alert" className="flex items-center gap-1 text-sm text-red-600 sm:col-span-2"><Icon name="x" size={14} /> {leaveError}</p> : null}
            <div className="sm:col-span-2"><Button type="submit" loading={leaveSaving}>Gửi đơn</Button></div>
          </form>
        )}
      </TabPanel>

      <TabPanel key="adjustment" value={activeTab}>
        {adjDone ? (
          <div className="mt-3 p-4 bg-[var(--success-bg)] rounded-lg border border-[var(--success-border)]">
            <p className="flex items-center gap-2 font-medium text-[var(--success)]">
              <Icon name="check" size={16} /> Đã gửi yêu cầu, chờ duyệt.
            </p>
            <Button size="sm" variant="secondary" onClick={() => setAdjDone(false)} className="mt-2">Gửi yêu cầu khác</Button>
          </div>
        ) : (
          <form onSubmit={onAdjSubmit} className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input label="Ngày công" name="work_date" type="date" required />
            <div />
            <Input label="Giờ vào đề xuất" name="requested_in" type="datetime-local" hint="Bỏ trống nếu chỉ sửa giờ ra" />
            <Input label="Giờ ra đề xuất" name="requested_out" type="datetime-local" hint="Bỏ trống nếu chỉ sửa giờ vào" />
            <div className="sm:col-span-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Lý do (tối thiểu 5 ký tự)
                <textarea name="reason" required rows={3} className="rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
            </div>
            {adjError ? <p role="alert" className="flex items-center gap-1 text-sm text-red-600 sm:col-span-2"><Icon name="x" size={14} /> {adjError}</p> : null}
            <div className="sm:col-span-2"><Button type="submit" loading={adjSaving}>Gửi yêu cầu</Button></div>
          </form>
        )}
      </TabPanel>
    </Card>
  );
}

function requestDetailRow(r: UnifiedRequestRow) {
  if (r.type === "leave") {
    return `${r.leave_type} · ${r.start_date} → ${r.end_date}`;
  }
  const parts: string[] = [];
  if (r.requested_in) parts.push(`vào ${new Date(r.requested_in).toLocaleString("vi-VN")}`);
  if (r.requested_out) parts.push(`ra ${new Date(r.requested_out).toLocaleString("vi-VN")}`);
  return parts.join(" · ") || "Chỉnh sửa";
}

function requestTypeLabel(type: string) {
  return type === "leave" ? "Đơn nghỉ" : "Chỉnh công";
}

function requestTypeIcon(type: string) {
  return type === "leave" ? "calendar" : "edit";
}

export function MyRequests({ rows }: { rows: UnifiedRequestRow[] }) {
  return (
    <DataTable
      ariaLabel="Yêu cầu của tôi"
      rows={rows}
      keyOf={(r) => r.id}
      emptyTitle="Chưa có yêu cầu"
      emptyDescription="Đơn bạn gửi sẽ hiện ở đây."
      columns={[
        { key: "type", header: "Loại", render: (r) => <span className="flex items-center gap-1"><Icon name={requestTypeIcon(r.type)} size={14} /> {requestTypeLabel(r.type)}</span> },
        { key: "detail", header: "Chi tiết", render: (r) => <span className="text-xs">{requestDetailRow(r)}</span> },
        { key: "status", header: "Trạng thái", render: (r) => statusBadge(r.status) },
        { key: "resolution", header: "Phản hồi", render: (r) => <span className="text-xs">{r.resolution_note ?? "—"}</span> },
      ]}
      cardTitle={(r) => `${requestTypeLabel(r.type)} · ${r.created_at.slice(0, 10)}`}
      cardStatus={(r) => statusBadge(r.status)}
      cardMeta={(r) => (
        <span className="text-xs">
          {requestDetailRow(r)}
          {r.resolution_note ? ` · Phản hồi: ${r.resolution_note}` : ""}
          {r.reviewed_at ? ` · Đã xử lý: ${new Date(r.reviewed_at).toLocaleString("vi-VN")}` : ""}
        </span>
      )}
    />
  );
}

type ReviewDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  row: UnifiedRequestRow | null;
  busy: boolean;
  note: string;
  setNote: (v: string) => void;
  onConfirm: (e: React.FormEvent) => Promise<void>;
  requiredNote: boolean;
};

function ReviewDialog({ open, onClose, title, row, busy, note, setNote, onConfirm, requiredNote }: ReviewDialogProps) {
  if (!open || !row) return null;
  return (
    <Dialog open={open} title={title} onClose={onClose}>
      <form onSubmit={onConfirm} className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">
          {row.employee_code ?? "—"} · {requestDetailRow(row)}
        </p>
        <Input
          label={requiredNote ? "Lý do từ chối (bắt buộc)" : "Ghi chú (không bắt buộc)"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required={requiredNote}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Hủy</Button>
          <Button type="submit" loading={busy} variant={requiredNote ? "danger" : "primary"}>Xác nhận</Button>
        </div>
      </form>
    </Dialog>
  );
}

interface ApprovalQueueProps {
  rows: UnifiedRequestRow[];
}

export function ApprovalQueue({ rows }: ApprovalQueueProps) {
  const router = useRouter();
  const [target, setTarget] = useState<{ row: UnifiedRequestRow; decision: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setError(null);
    let res;
    if (target.row.type === "leave") {
      res = await reviewLeave(target.row.id, { decision: target.decision, note });
    } else {
      res = await reviewAdjustment(target.row.id, { decision: target.decision, note });
    }
    setBusy(false);
    if (!res.ok) {
      setError(`${res.code}: ${res.message}`);
      return;
    }
    toast.success(target.decision === "approved" ? "Đã duyệt." : "Đã từ chối.");
    setTarget(null);
    setNote("");
    router.refresh();
  }

  const decide = (row: UnifiedRequestRow, decision: "approved" | "rejected") => {
    setTarget({ row, decision });
    setNote("");
  };

  return (
    <div className="flex flex-col gap-2">
      {error ? <ErrorState title="Không xử lý được" description={error} /> : null}
      <DataTable
        ariaLabel="Hàng đợi duyệt"
        rows={rows}
        keyOf={(r) => r.id}
        emptyTitle="Hết yêu cầu chờ duyệt"
        emptyDescription="Yêu cầu mới của team sẽ hiện ở đây."
        columns={[
          { key: "type", header: "Loại", render: (r) => <span className="flex items-center gap-1"><Icon name={requestTypeIcon(r.type)} size={14} /> {requestTypeLabel(r.type)}</span> },
          { key: "emp", header: "Nhân viên", render: (r) => <span className="font-medium">{r.employee_code ?? "—"}</span> },
          { key: "detail", header: "Chi tiết", render: (r) => <span className="text-xs">{requestDetailRow(r)}</span> },
          { key: "reason", header: "Lý do", render: (r) => <span className="max-w-56 truncate text-xs" title={r.reason ?? ""}>{r.reason ?? "—"}</span> },
          {
            key: "actions",
            header: <span className="sr-only">Thao tác</span>,
            render: (r) => (
              r.status === "pending" ? (
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => decide(r, "approved")} disabled={busy}>Duyệt</Button>
                  <Button size="sm" variant="secondary" onClick={() => decide(r, "rejected")} disabled={busy}>Từ chối</Button>
                </div>
              ) : null
            ),
          },
        ]}
        cardTitle={(r) => `${r.employee_code ?? "—"} · ${requestDetailRow(r)}`}
        cardMeta={(r) => <span className="text-xs">{requestDetailRow(r)} · {r.reason ?? "—"}</span>}
        cardActions={(r) => (
          r.status === "pending" ? (
            <>
              <Button size="sm" onClick={() => decide(r, "approved")} disabled={busy}>Duyệt</Button>
              <Button size="sm" variant="secondary" onClick={() => decide(r, "rejected")} disabled={busy}>Từ chối</Button>
            </>
          ) : undefined
        )}
        cardStatus={(r) => statusBadge(r.status)}
      />
      <ReviewDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target?.decision === "approved" ? "Duyệt yêu cầu" : "Từ chối yêu cầu"}
        row={target?.row ?? null}
        busy={busy}
        note={note}
        setNote={setNote}
        onConfirm={onConfirm}
        requiredNote={target?.decision === "rejected"}
      />
    </div>
  );
}

export function UnifiedRequestDetail({ row }: { row: UnifiedRequestRow }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{requestTypeLabel(row.type)}</h3>
          <p className="text-sm text-slate-500">{row.created_at.slice(0, 19).replace("T", " ")}</p>
        </div>
        {statusBadge(row.status)}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-sm text-slate-500">Nhân viên</p>
          <p className="font-medium">{row.employee_code ?? "—"}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Trạng thái</p>
          <p className="font-medium">{statusConfig(row.status).label}</p>
        </div>
        {row.type === "leave" && (
          <>
            <div>
              <p className="text-sm text-slate-500">Loại nghỉ</p>
              <p className="font-medium">{LEAVE_TYPES.find(t => t.value === row.leave_type)?.label ?? row.leave_type}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Thời gian</p>
              <p className="font-medium">{row.start_date} → {row.end_date}</p>
            </div>
          </>
        )}
        {row.type === "adjustment" && (
          <>
            <div>
              <p className="text-sm text-slate-500">Ngày công</p>
              <p className="font-medium">{row.work_date}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Đề xuất</p>
              <p className="font-medium">{requestDetailRow(row)}</p>
            </div>
          </>
        )}
        {row.resolution_note && (
          <div className="sm:col-span-2">
            <p className="text-sm text-slate-500">Phản hồi</p>
            <p className="font-medium">{row.resolution_note}</p>
          </div>
        )}
        {row.reviewed_at && (
          <div className="sm:col-span-2">
            <p className="text-sm text-slate-500">Đã xử lý lúc</p>
            <p className="font-medium">{new Date(row.reviewed_at).toLocaleString("vi-VN")}</p>
          </div>
        )}
        <div className="sm:col-span-2">
          <p className="text-sm text-slate-500">Lý do</p>
          <p className="whitespace-pre-wrap text-sm">{row.reason}</p>
        </div>
      </div>
    </Card>
  );
}