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
import { createAdjustment, reviewAdjustment } from "@/features/workflow/actions";

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
        <p role="status" className="font-medium">✓ Đã gửi yêu cầu, chờ quản lý/HR duyệt.</p>
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
        {error ? <p role="alert" className="text-sm text-red-600 sm:col-span-2">✕ {error}</p> : null}
        <div className="sm:col-span-2"><Button type="submit" loading={saving}>Gửi yêu cầu</Button></div>
      </form>
    </Card>
  );
}

export function MyAdjustments({ rows }: { rows: AdjustmentRow[] }) {
  if (rows.length === 0) return <EmptyState title="Chưa có yêu cầu nào" description="Yêu cầu bạn gửi sẽ hiện ở đây." />;
  return (
    <Table>
      <thead><tr><Th>Ngày</Th><Th>Đề xuất</Th><Th>Trạng thái</Th><Th>Phản hồi</Th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <Td>{r.work_date}</Td>
            <Td className="text-xs">
              {r.requested_in ? `vào ${new Date(r.requested_in).toLocaleString("vi-VN")}` : ""}
              {r.requested_in && r.requested_out ? " · " : ""}
              {r.requested_out ? `ra ${new Date(r.requested_out).toLocaleString("vi-VN")}` : ""}
            </Td>
            <Td>
              <Badge tone={r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "warning"}>
                {r.status === "pending" ? "⏳ Chờ duyệt" : r.status === "approved" ? "✓ Đã duyệt" : "✕ Từ chối"}
              </Badge>
            </Td>
            <Td className="text-xs">{r.resolution_note ?? "—"}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
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
    setTarget(null);
    setNote("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <ErrorState title="Không xử lý được" description={error} /> : null}
      {rows.length === 0 ? (
        <EmptyState title="Hết yêu cầu chờ duyệt" description="Yêu cầu mới của team sẽ hiện ở đây." />
      ) : (
        <Table>
          <thead><tr><Th>Nhân viên</Th><Th>Ngày</Th><Th>Đề xuất</Th><Th>Lý do</Th><Th aria-label="Thao tác" /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td>{r.employee_code}</Td>
                <Td>{r.work_date}</Td>
                <Td className="text-xs">
                  {r.requested_in ? `vào ${new Date(r.requested_in).toLocaleString("vi-VN")}` : ""}
                  {r.requested_in && r.requested_out ? " · " : ""}
                  {r.requested_out ? `ra ${new Date(r.requested_out).toLocaleString("vi-VN")}` : ""}
                </Td>
                <Td className="max-w-56 truncate text-xs" title={r.reason}>{r.reason}</Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => { setTarget({ row: r, decision: "approved" }); setNote(""); }} disabled={busy}>Duyệt</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setTarget({ row: r, decision: "rejected" }); setNote(""); }} disabled={busy}>Từ chối</Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
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
