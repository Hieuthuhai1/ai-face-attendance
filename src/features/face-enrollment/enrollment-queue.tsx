"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Td, Th, Table } from "@/components/ui/table";
import { approveEnrollment, rejectEnrollment } from "@/features/face-enrollment/actions";

export interface EnrollmentQueueRow {
  id: string;
  employee_code: string;
  display_name: string;
  status: string;
  quality: number | null;
  consent_version: string | null;
  created_at: string;
}

export function EnrollmentQueue(props: { rows: EnrollmentQueueRow[]; filter: string }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState<EnrollmentQueueRow | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onApprove(id: string) {
    setBusy(true);
    setError(null);
    const res = await approveEnrollment(id);
    setBusy(false);
    if (!res.ok) setError(`${res.code}: ${res.message}`);
    router.refresh();
  }

  async function onReject(e: React.FormEvent) {
    e.preventDefault();
    if (!rejecting) return;
    setBusy(true);
    const res = await rejectEnrollment(rejecting.id, reason);
    setBusy(false);
    if (!res.ok) {
      setError(`${res.code}: ${res.message}`);
      return;
    }
    setRejecting(null);
    setReason("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <form method="get" className="flex gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Trạng thái
          <select name="status" defaultValue={props.filter} className="h-10 rounded-lg border border-slate-300 px-3">
            <option value="pending">Chờ duyệt</option>
            <option value="active">Đang hoạt động</option>
            <option value="all">Tất cả</option>
          </select>
        </label>
        <div className="flex items-end">
          <Button type="submit" variant="secondary">Lọc</Button>
        </div>
      </form>

      {error ? <ErrorState title="Thao tác thất bại" description={error} /> : null}

      <Card>
        <CardTitle>Hàng đợi xác minh (không hiển thị ảnh/template)</CardTitle>
        <div className="mt-3">
          {props.rows.length === 0 ? (
            <EmptyState title="Không có đăng ký nào" description="Đổi bộ lọc hoặc chờ nhân viên nộp." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Nhân viên</Th>
                  <Th>Chất lượng</Th>
                  <Th>Consent</Th>
                  <Th>Gửi lúc</Th>
                  <Th aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {props.rows.map((r) => (
                  <tr key={r.id}>
                    <Td>{r.employee_code} — {r.display_name}</Td>
                    <Td>{r.quality !== null ? r.quality.toFixed(2) : "—"}</Td>
                    <Td>{r.consent_version ?? "—"}</Td>
                    <Td>{new Date(r.created_at).toLocaleString("vi-VN")}</Td>
                    <Td>
                      {r.status === "pending" ? (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => onApprove(r.id)} loading={busy}>
                            Kích hoạt
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => { setRejecting(r); setReason(""); }}>
                            Từ chối
                          </Button>
                        </div>
                      ) : (
                        <Badge tone={r.status === "active" ? "success" : "neutral"}>{r.status}</Badge>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      <Dialog open={rejecting !== null} title="Từ chối đăng ký" onClose={() => setRejecting(null)}>
        <form onSubmit={onReject} className="flex flex-col gap-3">
          <Input label="Lý do từ chối" value={reason} onChange={(e) => setReason(e.target.value)} required hint="Lý do được lưu audit và hiển thị cho nhân viên." />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRejecting(null)}>Hủy</Button>
            <Button type="submit" variant="danger" loading={busy}>Từ chối</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
