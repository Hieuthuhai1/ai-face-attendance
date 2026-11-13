"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/states";
import { approveEnrollment, rejectEnrollment } from "@/features/face-enrollment/actions";
import { toast } from "@/components/ui/toast";
import { formatDateTimeInZone } from "@/lib/datetime";

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

  const STATUS_LABEL: Record<string, string> = {
    pending: "Chờ duyệt",
    active: "Đang hoạt động",
    rejected: "Đã từ chối",
    revoked: "Đã thu hồi",
  };

  async function onApprove(id: string) {
    setBusy(true);
    setError(null);
    const res = await approveEnrollment(id);
    setBusy(false);
    if (!res.ok) setError(`${res.code}: ${res.message}`);
    else toast.success("Đã kích hoạt enrollment.");
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
    toast.success("Đã từ chối enrollment.");
    setRejecting(null);
    setReason("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-icon)] bg-[var(--brand-soft)] text-[var(--brand)] ring-1 ring-inset ring-blue-100">
              <Icon name="filter" size={17} />
            </span>
            <div>
              <CardTitle>Bộ lọc</CardTitle>
              <p className="mt-0.5 text-[13px] text-[var(--text-2)]">
                Chỉ hiển thị trạng thái đăng ký, không hiển thị ảnh hay template khuôn mặt.
              </p>
            </div>
          </div>
          {props.filter !== "pending" ? (
            <a
              href="/admin/enrollments"
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border)] bg-white px-3 text-[13px] font-medium text-[var(--text-2)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--navy-800)]"
            >
              <Icon name="refresh" size={14} /> Xóa bộ lọc
            </a>
          ) : null}
        </div>
        <form method="get" className="mt-4 flex flex-wrap items-end gap-3 border-t border-[var(--border)] pt-4">
          <label className="flex min-w-52 flex-col gap-1.5 text-[13px] font-medium text-[var(--text-2)]">
            Trạng thái
            <select
              name="status"
              defaultValue={props.filter}
              className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-3 text-sm text-[var(--text-1)] shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--border-strong)] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]"
            >
              <option value="pending">Chờ duyệt</option>
              <option value="active">Đang hoạt động</option>
              <option value="all">Tất cả</option>
            </select>
          </label>
          <Button type="submit" size="md">
            <Icon name="search" size={15} /> Lọc
          </Button>
        </form>
      </Card>

      {error ? <ErrorState title="Thao tác thất bại" description={error} /> : null}

      <Card>
        <CardTitle>Hàng đợi xác minh (không hiển thị ảnh/template)</CardTitle>
        <div className="mt-3">
          <DataTable
            ariaLabel="Hàng đợi xác minh khuôn mặt"
            rows={props.rows}
            keyOf={(r) => r.id}
            emptyTitle="Không có đăng ký nào"
            emptyDescription="Đổi bộ lọc hoặc chờ nhân viên nộp."
            columns={[
              { key: "emp", header: "Nhân viên", render: (r) => <span className="font-medium">{r.employee_code} — {r.display_name}</span> },
              { key: "quality", header: "Chất lượng", render: (r) => <span className="tnum">{r.quality !== null ? r.quality.toFixed(2) : "—"}</span> },
              { key: "consent", header: "Đồng thuận", render: (r) => <span className="whitespace-nowrap">{r.consent_version ?? "—"}</span> },
              { key: "at", header: "Gửi lúc", render: (r) => <span className="tnum whitespace-nowrap text-xs">{formatDateTimeInZone(r.created_at)}</span> },
              {
                key: "actions",
                header: <span className="sr-only">Thao tác</span>,
                render: (r) =>
                  r.status === "pending" ? (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => onApprove(r.id)} loading={busy}>
                        Kích hoạt
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => { setRejecting(r); setReason(""); }}>
                        Từ chối
                      </Button>
                    </div>
                  ) : (
                    <Badge tone={r.status === "active" ? "success" : "neutral"}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                  ),
              },
            ]}
            cardTitle={(r) => `${r.employee_code} — ${r.display_name}`}
            cardStatus={(r) =>
              r.status === "pending" ? (
                <Badge tone="warning"><Icon name="clock" size={14} /> Chờ duyệt</Badge>
              ) : (
                <Badge tone={r.status === "active" ? "success" : "neutral"}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
              )
            }
            cardMeta={(r) => (
              <span className="tnum flex flex-col gap-1 text-xs">
                <span>Chất lượng {r.quality !== null ? r.quality.toFixed(2) : "—"} · Đồng thuận {r.consent_version ?? "—"}</span>
                <span className="text-[var(--text-3)]">Gửi lúc {formatDateTimeInZone(r.created_at)}</span>
              </span>
            )}
            cardActions={(r) =>
              r.status === "pending" ? (
                <>
                  <Button size="sm" onClick={() => onApprove(r.id)} loading={busy}>Kích hoạt</Button>
                  <Button size="sm" variant="secondary" onClick={() => { setRejecting(r); setReason(""); }}>Từ chối</Button>
                </>
              ) : undefined
            }
          />
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
