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

export function AdjustmentForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
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
    router.refresh();
  }

  if (done) {
    return (
      <Card>
        <p role="status" className="flex items-center gap-2 font-medium">
          <Icon name="check" size={16} className="text-[var(--success)]" /> Đã gửi yêu cầu, chờ quản lý/HR duyệt.
        </p>
        <div className="mt-2"><Button size="sm" variant="secondary" onClick={() => setDone(false)}>Gửi yêu cầu khác</Button></div>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>Gửi yêu cầu chỉnh công</CardTitle>
      <CardDescription>Bản ghi gốc được giữ nguyên; nội dung duyệt là correction kèm audit.</CardDescription>
      <form onSubmit={onSubmit} className="mt-3 grid gap-3 sm:grid-cols-2">
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
        {error ? <p role="alert" className="flex items-center gap-1 text-sm text-red-600 sm:col-span-2"><Icon name="x" size={14} /> {error}</p> : null}
        <div className="sm:col-span-2"><Button type="submit" loading={saving}>Gửi yêu cầu</Button></div>
      </form>
    </Card>
  );
}

function proposalText(r: AdjustmentRow): string {
  const parts: string[] = [];
  if (r.requested_in) parts.push(`vào ${new Date(r.requested_in).toLocaleString("vi-VN")}`);
  if (r.requested_out) parts.push(`ra ${new Date(r.requested_out).toLocaleString("vi-VN")}`);
  return parts.join(" · ");
}

function statusBadge(status: string) {
  const tone = status === "approved" ? "success" as const : status === "rejected" ? "danger" as const : "warning" as const;
  const icon = status === "approved" ? "check" as const : status === "rejected" ? "x" as const : "clock" as const;
  const label = status === "pending" ? "Chờ duyệt" : status === "approved" ? "Đã duyệt" : "Từ chối";
  return (
    <Badge tone={tone}>
      <Icon name={icon} size={14} /> {label}
    </Badge>
  );
}

export function MyAdjustments({ rows }: { rows: AdjustmentRow[] }) {
  return (
    <DataTable
      ariaLabel="Yêu cầu chỉnh công của tôi"
      rows={rows}
      keyOf={(r) => r.id}
      emptyTitle="Chưa có yêu cầu nào"
      emptyDescription="Yêu cầu bạn gửi sẽ hiện ở đây."
      columns={[
        { key: "date", header: "Ngày", render: (r) => <span className="tnum">{r.work_date}</span> },
        { key: "proposal", header: "Đề xuất", render: (r) => <span className="text-xs">{proposalText(r)}</span> },
        { key: "status", header: "Trạng thái", render: (r) => statusBadge(r.status) },
        { key: "note", header: "Phản hồi", render: (r) => <span className="text-xs">{r.resolution_note ?? "—"}</span> },
      ]}
      cardTitle={(r) => r.work_date}
      cardStatus={(r) => statusBadge(r.status)}
      cardMeta={(r) => (
        <span className="text-xs">
          {proposalText(r)}
          {r.resolution_note ? ` · Phản hồi: ${r.resolution_note}` : ""}
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

  return (
    <div className="flex flex-col gap-2">
      {error ? <ErrorState title="Không xử lý được" description={error} /> : null}
      <DataTable
        ariaLabel="Hàng đợi duyệt chỉnh công"
        rows={rows}
        keyOf={(r) => r.id}
        emptyTitle="Hết yêu cầu chờ duyệt"
        emptyDescription="Yêu cầu mới của team sẽ hiện ở đây."
        columns={[
          { key: "emp", header: "Nhân viên", render: (r) => <span className="font-medium">{r.employee_code}</span> },
          { key: "date", header: "Ngày", render: (r) => <span className="tnum">{r.work_date}</span> },
          { key: "proposal", header: "Đề xuất", render: (r) => <span className="text-xs">{proposalText(r)}</span> },
          { key: "reason", header: "Lý do", render: (r) => <span className="max-w-56 truncate text-xs" title={r.reason}>{r.reason}</span> },
          {
            key: "actions",
            header: <span className="sr-only">Thao tác</span>,
            render: (r) => (
              <div className="flex gap-1">
                <Button size="sm" onClick={() => { setTarget({ row: r, decision: "approved" }); setNote(""); }} disabled={busy}>Duyệt</Button>
                <Button size="sm" variant="secondary" onClick={() => { setTarget({ row: r, decision: "rejected" }); setNote(""); }} disabled={busy}>Từ chối</Button>
              </div>
            ),
          },
        ]}
        cardTitle={(r) => `${r.employee_code} — ${r.work_date}`}
        cardMeta={(r) => <span className="text-xs">{proposalText(r)} · {r.reason}</span>}
        cardActions={(r) => (
          <>
            <Button size="sm" onClick={() => { setTarget({ row: r, decision: "approved" }); setNote(""); }} disabled={busy}>Duyệt</Button>
            <Button size="sm" variant="secondary" onClick={() => { setTarget({ row: r, decision: "rejected" }); setNote(""); }} disabled={busy}>Từ chối</Button>
          </>
        )}
      />
      <Dialog open={target !== null} title={target?.decision === "approved" ? "Duyệt chỉnh công" : "Từ chối chỉnh công"} onClose={() => setTarget(null)}>
        <form onSubmit={onConfirm} className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">
            {target?.row.employee_code} · {target?.row.work_date} — duyệt sẽ áp correction vào tổng hợp ngày (giữ nguyên events gốc) + ghi audit.
          </p>
          <Input label={target?.decision === "approved" ? "Ghi chú (không bắt buộc)" : "Lý do từ chối (bắt buộc)"} value={note} onChange={(e) => setNote(e.target.value)} required={target?.decision === "rejected"} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setTarget(null)}>Hủy</Button>
            <Button type="submit" variant={target?.decision === "approved" ? "primary" : "danger"} loading={busy}>Xác nhận</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
