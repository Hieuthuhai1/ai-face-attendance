"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Select, SelectOption } from "@/components/ui/select";
import { ErrorState } from "@/components/ui/states";
import { reviewLeave, reviewAdjustment } from "@/features/workflow/actions";
import { toast } from "@/components/ui/toast";

export interface ApprovalRow {
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
  employee_code: string;
  employee_id: string;
  department?: string;
  created_at: string;
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Từ chối" },
];

const TYPE_OPTIONS: SelectOption[] = [
  { value: "all", label: "Tất cả" },
  { value: "leave", label: "Đơn nghỉ" },
  { value: "adjustment", label: "Chỉnh công" },
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

function requestTypeLabel(type: string) {
  return type === "leave" ? "Đơn nghỉ" : "Chỉnh công";
}

function requestTypeIcon(type: string) {
  return type === "leave" ? "calendar" : "edit";
}

function requestDetailRow(r: ApprovalRow) {
  if (r.type === "leave") {
    return `${r.leave_type} · ${r.start_date} → ${r.end_date}`;
  }
  const parts: string[] = [];
  if (r.requested_in) parts.push(`vào ${new Date(r.requested_in).toLocaleString("vi-VN")}`);
  if (r.requested_out) parts.push(`ra ${new Date(r.requested_out).toLocaleString("vi-VN")}`);
  return parts.join(" · ") || "Chỉnh sửa";
}

export function ApprovalCenter({ rows: rowsProp = [] }: { rows?: ApprovalRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "pending");
  const [typeFilter, setTypeFilter] = useState(searchParams.get("type") ?? "all");
  const [deptFilter, setDeptFilter] = useState(searchParams.get("department") ?? "");
  const [empFilter, setEmpFilter] = useState(searchParams.get("employee") ?? "");
  const [target, setTarget] = useState<{ row: ApprovalRow; decision: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = rowsProp;
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (deptFilter && r.department !== deptFilter) return false;
      if (empFilter && r.employee_code !== empFilter) return false;
      return true;
    });
  }, [rows, statusFilter, typeFilter, deptFilter, empFilter]);

  const pendingRows = filteredRows.filter((r) => r.status === "pending");

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

  const decide = (row: ApprovalRow, decision: "approved" | "rejected") => {
    setTarget({ row, decision });
    setNote("");
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <Card>
        <CardTitle>Bộ lọc</CardTitle>
        <div className="mt-3 grid gap-3 sm:grid-cols-5">
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as string)}
            options={STATUS_OPTIONS}
            placeholder="Trạng thái"
            label="Trạng thái"
          />
          <Select
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as string)}
            options={TYPE_OPTIONS}
            placeholder="Loại"
            label="Loại yêu cầu"
          />
          <Input label="Phòng ban" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} placeholder="Lọc theo phòng ban" />
          <Input label="Nhân viên" value={empFilter} onChange={(e) => setEmpFilter(e.target.value)} placeholder="Mã nhân viên" />
          <div className="flex items-end">
            <Button variant="secondary" onClick={() => { setStatusFilter("pending"); setTypeFilter("all"); setDeptFilter(""); setEmpFilter(""); }}>Xóa lọc</Button>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="border-[var(--warning)] bg-[var(--warning-bg)]">
          <p className="text-2xl font-bold text-[var(--warning)]">{pendingRows.length}</p>
          <p className="text-sm text-slate-500">Chờ duyệt</p>
        </Card>
        <Card className="border-[var(--success)] bg-[var(--success-bg)]">
          <p className="text-2xl font-bold text-[var(--success)]">{filteredRows.filter((r) => r.status === "approved").length}</p>
          <p className="text-sm text-slate-500">Đã duyệt</p>
        </Card>
        <Card className="border-[var(--danger)] bg-[var(--danger-bg)]">
          <p className="text-2xl font-bold text-[var(--danger)]">{filteredRows.filter((r) => r.status === "rejected").length}</p>
          <p className="text-sm text-slate-500">Từ chối</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold">{filteredRows.length}</p>
          <p className="text-sm text-slate-500">Tổng (theo bộ lọc)</p>
        </Card>
      </div>

      {/* Approval Queue */}
      <Card>
        <CardTitle>Hàng đợi duyệt</CardTitle>
        <div className="mt-3">
          {error ? <ErrorState title="Không xử lý được" description={error} /> : null}
          <DataTable
            ariaLabel="Hàng đợi duyệt"
            rows={pendingRows}
            keyOf={(r) => r.id}
            emptyTitle="Hết yêu cầu chờ duyệt"
            emptyDescription="Yêu cầu mới của team sẽ hiện ở đây."
            columns={[
              { key: "type", header: "Loại", render: (r) => <span className="flex items-center gap-1"><Icon name={requestTypeIcon(r.type)} size={14} /> {requestTypeLabel(r.type)}</span> },
              { key: "emp", header: "Nhân viên", render: (r) => <span className="font-medium">{r.employee_code}</span> },
              { key: "dept", header: "Phòng ban", render: (r) => r.department ?? "—" },
              { key: "detail", header: "Chi tiết", render: (r) => <span className="text-xs">{requestDetailRow(r)}</span> },
              { key: "reason", header: "Lý do", render: (r) => <span className="max-w-56 truncate text-xs" title={r.reason ?? ""}>{r.reason ?? "—"}</span> },
              {
                key: "actions",
                header: <span className="sr-only">Thao tác</span>,
                render: (r) => (
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => decide(r, "approved")} disabled={busy}>Duyệt</Button>
                    <Button size="sm" variant="secondary" onClick={() => decide(r, "rejected")} disabled={busy}>Từ chối</Button>
                  </div>
                ),
              },
            ]}
            cardTitle={(r) => `${r.employee_code} · ${requestDetailRow(r)}`}
            cardMeta={(r) => <span className="text-xs">{requestDetailRow(r)} · {r.reason ?? "—"}</span>}
            cardActions={(r) => (
              <>
                <Button size="sm" onClick={() => decide(r, "approved")} disabled={busy}>Duyệt</Button>
                <Button size="sm" variant="secondary" onClick={() => decide(r, "rejected")} disabled={busy}>Từ chối</Button>
              </>
            )}
            cardStatus={(r) => statusBadge(r.status)}
          />
        </div>
      </Card>

      {/* All Requests Table */}
      <Card>
        <CardTitle>Tất cả yêu cầu (theo bộ lọc)</CardTitle>
        <div className="mt-3">
          <DataTable
            ariaLabel="Tất cả yêu cầu"
            rows={filteredRows}
            keyOf={(r) => r.id}
            emptyTitle="Không có yêu cầu"
            emptyDescription="Thử thay đổi bộ lọc."
            columns={[
              { key: "type", header: "Loại", render: (r) => <span className="flex items-center gap-1"><Icon name={requestTypeIcon(r.type)} size={14} /> {requestTypeLabel(r.type)}</span> },
              { key: "emp", header: "Nhân viên", render: (r) => <span className="font-medium">{r.employee_code}</span> },
              { key: "dept", header: "Phòng ban", render: (r) => r.department ?? "—" },
              { key: "detail", header: "Chi tiết", render: (r) => <span className="text-xs">{requestDetailRow(r)}</span> },
              { key: "status", header: "Trạng thái", render: (r) => statusBadge(r.status) },
              { key: "reason", header: "Lý do", render: (r) => <span className="max-w-56 truncate text-xs" title={r.reason ?? ""}>{r.reason ?? "—"}</span> },
              { key: "created", header: "Ngày tạo", render: (r) => <span className="tnum text-xs">{new Date(r.created_at).toLocaleString("vi-VN")}</span> },
            ]}
            cardTitle={(r) => `${r.employee_code} · ${requestDetailRow(r)}`}
            cardMeta={(r) => <span className="text-xs">{requestDetailRow(r)} · {r.reason ?? "—"}</span>}
            cardStatus={(r) => statusBadge(r.status)}
          />
        </div>
      </Card>

      {/* Review Dialog */}
      {target && (
        <Dialog
          open
          title={target.decision === "approved" ? "Duyệt yêu cầu" : "Từ chối yêu cầu"}
          onClose={() => setTarget(null)}
        >
          <form onSubmit={onConfirm} className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">
              {target.row.employee_code} · {requestDetailRow(target.row)} — duyệt sẽ áp dụng thay đổi + ghi audit.
            </p>
            <Input
              label={target.decision === "approved" ? "Ghi chú (không bắt buộc)" : "Lý do từ chối (bắt buộc)"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required={target.decision === "rejected"}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setTarget(null)} disabled={busy}>Hủy</Button>
              <Button type="submit" loading={busy} variant={target.decision === "rejected" ? "danger" : "primary"}>Xác nhận</Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}