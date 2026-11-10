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
  { value: "annual", label: "Phép năm", icon: "calendar" as const },
  { value: "sick", label: "Ốm đau", icon: "alert" as const },
  { value: "unpaid", label: "Nghỉ không lương", icon: "calendar" as const },
  { value: "maternity", label: "Thai sản", icon: "calendar" as const },
  { value: "other", label: "Khác", icon: "file-text" as const },
];

const LEAVE_TYPE_LABEL = Object.fromEntries(LEAVE_TYPES.map((type) => [type.value, type.label]));

function leaveTypeLabel(value?: string) {
  if (!value) return "Đơn nghỉ";
  return LEAVE_TYPE_LABEL[value] ?? value;
}

function statusConfig(status: string) {
  const map: Record<string, { tone: "success" | "danger" | "warning" | "neutral"; icon: "check" | "x" | "clock" | "help"; label: string }> = {
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

const SELECT_CLASS =
  "h-10 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-white px-3 text-sm text-[var(--text-1)] shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--border-strong)] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]";

function SuccessPanel({ title, onReset, resetLabel }: { title: string; onReset: () => void; resetLabel: string }) {
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-[var(--radius-control)] border border-[var(--success-border)] bg-[var(--success-bg)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2 text-[13px] font-semibold text-[var(--success-strong)]">
        <Icon name="check" size={17} className="mt-0.5 shrink-0" />
        {title}
      </p>
      <Button size="sm" variant="secondary" onClick={onReset} className="shrink-0">
        {resetLabel}
      </Button>
    </div>
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
    const form = e.currentTarget;
    const fd = new FormData(form);
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
    form.reset();
    router.refresh();
  }

  async function onAdjSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
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
    setAdjError(null);
    form.reset();
    router.refresh();
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5">
            <Icon name="file-text" size={13} className="text-[var(--brand)]" /> Gửi yêu cầu
          </p>
          <CardTitle>Yêu cầu mới</CardTitle>
          <CardDescription>Gửi đơn nghỉ hoặc yêu cầu chỉnh công. Người duyệt sẽ nhận thông báo ngay.</CardDescription>
        </div>
        <Badge tone="brand">
          <Icon name="shield" size={12} /> Có audit log
        </Badge>
      </div>

      <div className="mt-4">
        <Tabs
          items={[
            { key: "leave", label: "Đơn nghỉ" },
            { key: "adjustment", label: "Chỉnh công" },
          ]}
          value={activeTab}
          onChange={(key) => setActiveTab(key as "leave" | "adjustment")}
          variant="soft"
        />
      </div>

      <TabPanel tabKey="leave" value={activeTab}>
        {leaveDone ? (
          <SuccessPanel
            title="Đã gửi đơn nghỉ, đang chờ quản lý/HR duyệt."
            onReset={() => setLeaveDone(false)}
            resetLabel="Gửi đơn khác"
          />
        ) : (
          <form onSubmit={onLeaveSubmit} className="mt-4 flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[var(--text-2)]">
                Loại nghỉ <span className="text-[var(--danger)]">*</span>
                <select name="leave_type" required defaultValue="" className={SELECT_CLASS}>
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
            {leaveError ? (
              <p role="alert" className="flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[13px] font-medium text-[var(--danger-strong)]">
                <Icon name="x" size={14} /> {leaveError}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
              <p className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-3)]">
                <Icon name="info" size={13} /> Đơn nghỉ không tự xóa công đã ghi.
              </p>
              <Button type="submit" loading={leaveSaving}>
                <Icon name="calendar" size={16} /> Gửi đơn nghỉ
              </Button>
            </div>
          </form>
        )}
      </TabPanel>

      <TabPanel tabKey="adjustment" value={activeTab}>
        {adjDone ? (
          <SuccessPanel
            title="Đã gửi yêu cầu chỉnh công, đang chờ duyệt."
            onReset={() => setAdjDone(false)}
            resetLabel="Gửi yêu cầu khác"
          />
        ) : (
          <form onSubmit={onAdjSubmit} className="mt-4 flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Ngày công" name="work_date" type="date" required />
              <div className="hidden sm:block" />
              <Input
                label="Giờ vào đề xuất"
                name="requested_in"
                type="datetime-local"
                hint="Bỏ trống nếu chỉ sửa giờ ra"
              />
              <Input
                label="Giờ ra đề xuất"
                name="requested_out"
                type="datetime-local"
                hint="Bỏ trống nếu chỉ sửa giờ vào"
              />
            </div>
            <Textarea
              label="Lý do"
              name="reason"
              required
              rows={3}
              minLength={5}
              placeholder="Mô tả lý do chỉnh công (tối thiểu 5 ký tự)…"
            />
            {adjError ? (
              <p role="alert" className="flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[13px] font-medium text-[var(--danger-strong)]">
                <Icon name="x" size={14} /> {adjError}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
              <p className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-3)]">
                <Icon name="info" size={13} /> Bản ghi gốc được giữ nguyên, duyệt sẽ ghi correction + audit.
              </p>
              <Button type="submit" loading={adjSaving}>
                <Icon name="edit" size={16} /> Gửi yêu cầu
              </Button>
            </div>
          </form>
        )}
      </TabPanel>
    </Card>
  );
}

function requestDetailRow(r: UnifiedRequestRow) {
  if (r.type === "leave") {
    return `${leaveTypeLabel(r.leave_type)} · ${r.start_date} → ${r.end_date}`;
  }
  const parts: string[] = [];
  if (r.requested_in) parts.push(`vào ${new Date(r.requested_in).toLocaleString("vi-VN")}`);
  if (r.requested_out) parts.push(`ra ${new Date(r.requested_out).toLocaleString("vi-VN")}`);
  return parts.join(" · ") || "Chỉnh sửa";
}

function requestTypeLabel(type: string) {
  return type === "leave" ? "Đơn nghỉ" : "Chỉnh công";
}

function requestTypeIcon(type: string): "calendar" | "edit" {
  return type === "leave" ? "calendar" : "edit";
}

export function MyRequests({ rows }: { rows: UnifiedRequestRow[] }) {
  return (
    <DataTable
      ariaLabel="Yêu cầu của tôi"
      rows={rows}
      keyOf={(r) => r.id}
      emptyTitle="Chưa có yêu cầu"
      emptyDescription="Đơn bạn gửi sẽ hiện ở đây kèm trạng thái duyệt."
      columns={[
        {
          key: "type",
          header: "Loại",
          render: (r) => (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--navy-800)]">
              <Icon name={requestTypeIcon(r.type)} size={14} /> {requestTypeLabel(r.type)}
            </span>
          ),
        },
        {
          key: "detail",
          header: "Chi tiết",
          render: (r) => <span className="text-[12.5px] text-[var(--text-2)]">{requestDetailRow(r)}</span>,
        },
        {
          key: "created",
          header: "Gửi lúc",
          render: (r) => (
            <span className="tnum text-[12.5px] text-[var(--text-2)]">
              {new Date(r.created_at).toLocaleDateString("vi-VN")}
            </span>
          ),
        },
        { key: "status", header: "Trạng thái", render: (r) => statusBadge(r.status) },
        {
          key: "resolution",
          header: "Phản hồi",
          render: (r) => (
            <span className="line-clamp-2 max-w-56 text-[12.5px] text-[var(--text-2)]">
              {r.resolution_note ?? "—"}
            </span>
          ),
        },
      ]}
      cardTitle={(r) => `${requestTypeLabel(r.type)} · ${new Date(r.created_at).toLocaleDateString("vi-VN")}`}
      cardStatus={(r) => statusBadge(r.status)}
      cardMeta={(r) => (
        <span className="flex flex-col gap-1 text-[12.5px] text-[var(--text-2)]">
          <span>{requestDetailRow(r)}</span>
          {r.resolution_note ? <span>Phản hồi: {r.resolution_note}</span> : null}
          {r.reviewed_at ? <span>Đã xử lý: {new Date(r.reviewed_at).toLocaleString("vi-VN")}</span> : null}
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
  if (!row) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button
            type="submit"
            form="review-request-form"
            loading={busy}
            variant={requiredNote ? "danger" : "primary"}
          >
            <Icon name={requiredNote ? "x" : "check"} size={15} /> Xác nhận
          </Button>
        </>
      }
    >
      <form id="review-request-form" onSubmit={onConfirm} className="flex flex-col gap-4">
        <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3">
          <p className="text-[13px] font-semibold text-[var(--navy-800)]">
            {requestTypeLabel(row.type)} · {row.employee_code ?? "—"}
          </p>
          <p className="mt-0.5 text-[12.5px] text-[var(--text-2)]">{requestDetailRow(row)}</p>
          {row.reason ? <p className="mt-1.5 text-[12.5px] text-[var(--text-2)]">Lý do: {row.reason}</p> : null}
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
    <div className="flex flex-col gap-3">
      {error ? <ErrorState title="Không xử lý được" description={error} /> : null}
      <DataTable
        ariaLabel="Hàng đợi duyệt"
        rows={rows}
        keyOf={(r) => r.id}
        emptyTitle="Hết yêu cầu chờ duyệt"
        emptyDescription="Yêu cầu mới của team sẽ hiện ở đây."
        columns={[
          {
            key: "type",
            header: "Loại",
            render: (r) => (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--navy-800)]">
                <Icon name={requestTypeIcon(r.type)} size={14} /> {requestTypeLabel(r.type)}
              </span>
            ),
          },
          {
            key: "emp",
            header: "Nhân viên",
            render: (r) => <span className="tnum text-[13px] font-semibold text-[var(--navy-800)]">{r.employee_code ?? "—"}</span>,
          },
          {
            key: "detail",
            header: "Chi tiết",
            render: (r) => <span className="text-[12.5px] text-[var(--text-2)]">{requestDetailRow(r)}</span>,
          },
          {
            key: "reason",
            header: "Lý do",
            render: (r) => (
              <span className="line-clamp-2 max-w-56 text-[12.5px] text-[var(--text-2)]" title={r.reason ?? ""}>
                {r.reason ?? "—"}
              </span>
            ),
          },
          {
            key: "actions",
            header: <span className="sr-only">Thao tác</span>,
            render: (r) =>
              r.status === "pending" ? (
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={() => decide(r, "approved")} disabled={busy}>
                    <Icon name="check" size={13} /> Duyệt
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => decide(r, "rejected")} disabled={busy}>
                    Từ chối
                  </Button>
                </div>
              ) : null,
          },
        ]}
        cardTitle={(r) => `${r.employee_code ?? "—"} · ${requestTypeLabel(r.type)}`}
        cardMeta={(r) => (
          <span className="flex flex-col gap-1 text-[12.5px] text-[var(--text-2)]">
            <span>{requestDetailRow(r)}</span>
            {r.reason ? <span>Lý do: {r.reason}</span> : null}
          </span>
        )}
        cardActions={(r) =>
          r.status === "pending" ? (
            <>
              <Button size="sm" onClick={() => decide(r, "approved")} disabled={busy}>
                <Icon name="check" size={13} /> Duyệt
              </Button>
              <Button size="sm" variant="secondary" onClick={() => decide(r, "rejected")} disabled={busy}>
                Từ chối
              </Button>
            </>
          ) : undefined
        }
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-bold text-[var(--navy-900)]">{requestTypeLabel(row.type)}</h3>
          <p className="tnum mt-0.5 text-[12.5px] text-[var(--text-3)]">{row.created_at.slice(0, 19).replace("T", " ")}</p>
        </div>
        {statusBadge(row.status)}
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Nhân viên</dt>
          <dd className="mt-0.5 text-[13px] font-medium text-[var(--navy-800)]">{row.employee_code ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Trạng thái</dt>
          <dd className="mt-0.5 text-[13px] font-medium text-[var(--navy-800)]">{statusConfig(row.status).label}</dd>
        </div>
        {row.type === "leave" && (
          <>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Loại nghỉ</dt>
              <dd className="mt-0.5 text-[13px] font-medium text-[var(--navy-800)]">{leaveTypeLabel(row.leave_type)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Thời gian</dt>
              <dd className="tnum mt-0.5 text-[13px] font-medium text-[var(--navy-800)]">{row.start_date} → {row.end_date}</dd>
            </div>
          </>
        )}
        {row.type === "adjustment" && (
          <>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Ngày công</dt>
              <dd className="tnum mt-0.5 text-[13px] font-medium text-[var(--navy-800)]">{row.work_date}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Đề xuất</dt>
              <dd className="mt-0.5 text-[13px] font-medium text-[var(--navy-800)]">{requestDetailRow(row)}</dd>
            </div>
          </>
        )}
        {row.resolution_note && (
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Phản hồi</dt>
            <dd className="mt-0.5 text-[13px] text-[var(--text-2)]">{row.resolution_note}</dd>
          </div>
        )}
        {row.reviewed_at && (
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Đã xử lý lúc</dt>
            <dd className="tnum mt-0.5 text-[13px] text-[var(--text-2)]">{new Date(row.reviewed_at).toLocaleString("vi-VN")}</dd>
          </div>
        )}
        <div className="sm:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Lý do</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-[13px] text-[var(--text-2)]">{row.reason}</dd>
        </div>
      </dl>
    </Card>
  );
}
