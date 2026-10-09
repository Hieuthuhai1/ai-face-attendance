"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Td, Th, Table } from "@/components/ui/table";
import { createLeave, reviewLeave } from "@/features/workflow/actions";

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
        {error ? <p role="alert" className="text-sm text-red-600 sm:col-span-2">✕ {error}</p> : null}
        <div className="sm:col-span-2"><Button type="submit" loading={saving}>Gửi đơn</Button></div>
      </form>
    </Card>
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
    setTarget(null);
    setNote("");
    router.refresh();
  }

  if (rows.length === 0) return <EmptyState title="Chưa có đơn nghỉ" description="Đơn bạn gửi / cần duyệt sẽ hiện ở đây." />;
  return (
    <div className="flex flex-col gap-2">
      {error ? <ErrorState title="Không xử lý được" description={error} /> : null}
      <Table>
        <thead><tr>{reviewable ? <Th>Nhân viên</Th> : null}<Th>Loại</Th><Th>Thời gian</Th><Th>Trạng thái</Th>{reviewable ? <Th aria-label="Thao tác" /> : null}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {reviewable ? <Td>{r.employee_code}</Td> : null}
              <Td>{r.leave_type}</Td>
              <Td>{r.start_date} → {r.end_date}</Td>
              <Td>
                <Badge tone={r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "warning"}>
                  {r.status === "pending" ? "⏳ Chờ duyệt" : r.status === "approved" ? "✓ Đã duyệt" : "✕ Từ chối"}
                </Badge>
              </Td>
              {reviewable && r.status === "pending" ? (
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => { setTarget({ row: r, decision: "approved" }); setNote(""); }} disabled={busy}>Duyệt</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setTarget({ row: r, decision: "rejected" }); setNote(""); }} disabled={busy}>Từ chối</Button>
                  </div>
                </Td>
              ) : reviewable ? <Td /> : null}
            </tr>
          ))}
        </tbody>
      </Table>
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
