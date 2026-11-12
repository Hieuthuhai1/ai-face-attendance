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
import { createAdjustment, reviewAdjustment } from "@/features/workflow/actions";
import { toast } from "@/components/ui/toast";

export interface AdjustmentRow {
  id: string;
  work_date: string;
  requested_in: string | null;
  requested_out: string | null;
  reason: string;
  status: string;
  employee_code?: string;
  reviewer?: string | null;
  resolution_note?: string | null;
}

function statusBadge(status: string) {
  const tone = status === "approved" ? "success" as const : status === "rejected" ? "danger" as const : "warning" as const;
  const icon = status === "approved" ? "check" as const : status === "rejected" ? "x" as const : "clock" as const;
  const label = status === "pending" ? "Chờ duyệt" : status === "approved" ? "Đã duyệt" : "Từ chối";
  return (
    <Badge tone={tone}>
      <Icon name={icon} size={12} /> {label}
    </Badge>
  );
}

function proposalText(r: AdjustmentRow): string {
  const parts: string[] = [];
  if (r.requested_in) parts.push(`vào ${new Date(r.requested_in).toLocaleString("vi-VN")}`);
  if (r.requested_out) parts.push(`ra ${new Date(r.requested_out).toLocaleString("vi-VN")}`);
  return parts.join(" · ");
}

export function AdjustmentForm() {
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
    const res = await createAdjustment({
      work_date: String(fd.get("work_date") ?? ""),
      event_id: null,
      requested_in: (String(fd.get("requested_in") ?? "") || null) as string | null,
      requested_out: (String(fd.get("requested_out") ?? "") || null) as string | null,
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
            <Icon name="check" size={17} className="mt-0.5 shrink-0" /> Đã gửi yêu cầu, chờ quản lý/HR duyệt.
          </p>
          <Button size="sm" variant="secondary" onClick={() => setDone(false)} className="shrink-0">
            Gửi yêu cầu khác
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <p className="eyebrow flex items-center gap-1.5">
        <Icon name="edit" size={13} className="text-[var(--brand)]" /> Chỉnh công
      </p>
      <CardTitle>Gửi yêu cầu chỉnh công</CardTitle>
      <CardDescription>Bản ghi gốc được giữ nguyên; nội dung duyệt là correction kèm audit.</CardDescription>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Ngày công" name="work_date" type="date" required />
          <div className="hidden sm:block" />
          <Input label="Giờ vào đề xuất" name="requested_in" type="datetime-local" hint="Bỏ trống nếu chỉ sửa giờ ra" />
          <Input label="Giờ ra đề xuất" name="requested_out" type="datetime-local" hint="Bỏ trống nếu chỉ sửa giờ vào" />
        </div>
        <Textarea
          label="Lý do"
          name="reason"
          required
          rows={3}
          minLength={5}
          placeholder="Mô tả lý do chỉnh công (tối thiểu 5 ký tự)…"
        />
        {error ? (
          <p role="alert" className="flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[13px] font-medium text-[var(--danger-strong)]">
            <Icon name="x" size={14} /> {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <p className="flex items-center gap-1.5 text-[12px] text-[var(--text-3)]">
            <Icon name="info" size={13} /> Duyệt sẽ áp correction vào tổng hợp ngày.
          </p>
          <Button type="submit" loading={saving}>
            <Icon name="arrow-right" size={16} /> Gửi yêu cầu
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function MyAdjustments({ rows }: { rows: AdjustmentRow[] }) {
  return (
    <DataTable
      ariaLabel="Yêu cầu chỉnh công của tôi"
      rows={rows}
      keyOf={(r) => r.id}
      emptyTitle="Chưa có yêu cầu nào"
      emptyDescription="Yêu cầu bạn gửi sẽ hiện ở đây kèm trạng thái duyệt."
      columns={[
        {
          key: "date",
          header: "Ngày",
          render: (r) => <span className="tnum text-[13px] font-semibold text-[var(--navy-800)]">{r.work_date}</span>,
        },
        {
          key: "proposal",
          header: "Đề xuất",
          render: (r) => <span className="text-[13px] text-[var(--text-2)]">{proposalText(r) || "—"}</span>,
        },
        { key: "status", header: "Trạng thái", render: (r) => statusBadge(r.status) },
        {
          key: "note",
          header: "Phản hồi",
          render: (r) => (
            <span className="line-clamp-2 max-w-56 text-[13px] text-[var(--text-2)]">{r.resolution_note ?? "—"}</span>
          ),
        },
      ]}
      cardTitle={(r) => r.work_date}
      cardStatus={(r) => statusBadge(r.status)}
      cardMeta={(r) => (
        <span className="flex flex-col gap-1 text-[13px] text-[var(--text-2)]">
          <span>{proposalText(r) || "Chỉnh sửa"}</span>
          {r.resolution_note ? <span>Phản hồi: {r.resolution_note}</span> : null}
        </span>
      )}
    />
  );
}

export function AdjustmentQueue({ rows }: { rows: AdjustmentRow[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<{ row: AdjustmentRow; decision: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setError(null);
    const res = await reviewAdjustment(target.row.id, { decision: target.decision, note });
    setBusy(false);
    if (!res.ok) {
      setError(`${res.code}: ${res.message}`);
      return;
    }
    toast.success(target.decision === "approved" ? "Đã duyệt chỉnh công." : "Đã từ chối chỉnh công.");
    setTarget(null);
    setNote("");
    router.refresh();
  }

  const decide = (row: AdjustmentRow, decision: "approved" | "rejected") => {
    setTarget({ row, decision });
    setNote("");
  };

  const requiredNote = target?.decision === "rejected";

  return (
    <div className="flex flex-col gap-3">
      {error ? <ErrorState title="Không xử lý được" description={error} /> : null}
      <DataTable
        ariaLabel="Hàng đợi duyệt chỉnh công"
        rows={rows}
        keyOf={(r) => r.id}
        emptyTitle="Hết yêu cầu chờ duyệt"
        emptyDescription="Yêu cầu mới của team sẽ hiện ở đây."
        columns={[
          {
            key: "emp",
            header: "Nhân viên",
            render: (r) => <span className="tnum text-[13px] font-semibold text-[var(--navy-800)]">{r.employee_code ?? "—"}</span>,
          },
          {
            key: "date",
            header: "Ngày",
            render: (r) => <span className="tnum text-[13px] text-[var(--text-2)]">{r.work_date}</span>,
          },
          {
            key: "proposal",
            header: "Đề xuất",
            render: (r) => <span className="text-[13px] text-[var(--text-2)]">{proposalText(r) || "—"}</span>,
          },
          {
            key: "reason",
            header: "Lý do",
            render: (r) => (
              <span className="line-clamp-2 max-w-56 text-[13px] text-[var(--text-2)]" title={r.reason}>{r.reason}</span>
            ),
          },
          {
            key: "actions",
            header: <span className="sr-only">Thao tác</span>,
            render: (r) => (
              <div className="flex gap-1.5">
                <Button size="sm" onClick={() => decide(r, "approved")} disabled={busy}>
                  <Icon name="check" size={13} /> Duyệt
                </Button>
                <Button size="sm" variant="secondary" onClick={() => decide(r, "rejected")} disabled={busy}>
                  Từ chối
                </Button>
              </div>
            ),
          },
        ]}
        cardTitle={(r) => `${r.employee_code ?? "—"} — ${r.work_date}`}
        cardMeta={(r) => (
          <span className="flex flex-col gap-1 text-[13px] text-[var(--text-2)]">
            <span>{proposalText(r) || "Chỉnh sửa"}</span>
            <span>Lý do: {r.reason}</span>
          </span>
        )}
        cardActions={(r) => (
          <>
            <Button size="sm" onClick={() => decide(r, "approved")} disabled={busy}>
              <Icon name="check" size={13} /> Duyệt
            </Button>
            <Button size="sm" variant="secondary" onClick={() => decide(r, "rejected")} disabled={busy}>
              Từ chối
            </Button>
          </>
        )}
        cardStatus={() => statusBadge("pending")}
      />
      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target?.decision === "approved" ? "Duyệt chỉnh công" : "Từ chối chỉnh công"}
        size="md"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setTarget(null)} disabled={busy}>
              Hủy
            </Button>
            <Button
              type="submit"
              form="review-adjustment-form"
              variant={target?.decision === "approved" ? "primary" : "danger"}
              loading={busy}
            >
              <Icon name={target?.decision === "approved" ? "check" : "x"} size={15} /> Xác nhận
            </Button>
          </>
        }
      >
        <form id="review-adjustment-form" onSubmit={onConfirm} className="flex flex-col gap-4">
          <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3 text-[13px] text-[var(--text-2)]">
            <p className="font-semibold text-[var(--navy-800)]">
              {target?.row.employee_code} · {target?.row.work_date}
            </p>
            <p className="mt-0.5">{target ? proposalText(target.row) || "Chỉnh sửa" : ""}</p>
            <p className="mt-1.5">
              Duyệt sẽ áp correction vào tổng hợp ngày (giữ nguyên events gốc) và ghi audit.
            </p>
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
