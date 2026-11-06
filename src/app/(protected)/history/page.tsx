import { Suspense } from "react";
import { requireUser } from "@/server/auth";
import { getPersonalHistoryWithFilters, type HistoryRow } from "@/features/reports/actions";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/states";
import { formatTimeInZone } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 20;

const STATUS_MAP: Record<string, BadgeTone> = {
  present: "success",
  late: "warning",
  early_leave: "info",
  absent: "danger",
  incomplete: "neutral",
};

type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info" | "brand";

const STATUS_LABELS: Record<string, string> = {
  present: "Đúng giờ",
  late: "Đi muộn",
  early_leave: "Về sớm",
  absent: "Vắng mặt",
  incomplete: "Chưa hoàn tất",
};

export default function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    page?: string;
    employee_id?: string;
    department_id?: string;
    status?: string;
    q?: string;
  }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">Lịch sử chấm công</h1>
      <Suspense fallback={<LoadingState message="Đang tải lịch sử…" />}>
        <HistoryData searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function HistoryData({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    page?: string;
    employee_id?: string;
    department_id?: string;
    status?: string;
    q?: string;
  }>;
}) {
  await requireUser();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const filters = {
    month: params.month ?? new Date().toISOString().slice(0, 7),
    employee_id: params.employee_id ?? undefined,
    department_id: params.department_id ?? undefined,
    status: params.status ?? undefined,
    q: params.q ?? undefined,
  };

  const { ok, rows, total, message } = await getPersonalHistoryWithFilters(filters, page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil((total ?? 0) / PAGE_SIZE));

  if (!ok) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorState title="Không tải được dữ liệu" description={message ?? "Lỗi không xác định."} />
      </div>
    );
  }

  const historyRows: HistoryRow[] = (rows ?? []).map((r) => r);

  return (
    <div className="flex flex-col gap-4">
      {/* Bộ lọc */}
      <Card>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Tháng
              <input
                type="month"
                name="month"
                defaultValue={filters.month}
                className="h-10 rounded-lg border border-slate-300 px-3"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Tìm kiếm
              <Input
                name="q"
                defaultValue={filters.q ?? ""}
                placeholder="Mã NV, tên, phòng ban…"
                className="h-10 rounded-lg border border-slate-300 px-3"
              />
            </label>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Phòng ban
              <Select
                value={filters.department_id ?? ""}
                onChange={(v) => {}}
                options={[]}
                placeholder="Tất cả phòng ban"
                className="h-10 rounded-lg border border-slate-300 px-3"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Trạng thái
              <Select
                value={filters.status ?? ""}
                onChange={(v) => {}}
                options={[
                  { value: "", label: "Tất cả" },
                  { value: "present", label: "Đúng giờ" },
                  { value: "late", label: "Đi muộn" },
                  { value: "early_leave", label: "Về sớm" },
                  { value: "absent", label: "Vắng mặt" },
                  { value: "incomplete", label: "Chưa hoàn tất" },
                ]}
                placeholder="Tất cả trạng thái"
                className="h-10 rounded-lg border border-slate-300 px-3"
              />
            </label>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white"
            >
              Lọc
            </button>
            <a
              href="?page=1"
              className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700"
            >
              Đặt lại
            </a>
          </div>
        </form>
      </Card>

      {/* Bảng dữ liệu */}
      <Card>
        <DataTable
          ariaLabel="Lịch sử chấm công"
          rows={historyRows}
          keyOf={(r) => `${r.work_date}-${r.employee_code}`}
          emptyTitle="Chưa có bản ghi"
          emptyDescription="Tháng này chưa có dữ liệu chấm công."
          columns={[
            {
              key: "date",
              header: "Ngày",
              render: (r) => <span className="tnum">{r.work_date}</span>,
            },
            {
              key: "employee",
              header: "Nhân viên",
              render: (r) => (
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{r.display_name || r.employee_code}</p>
                  <p className="tnum text-[11px] text-slate-500 truncate">{r.employee_code}</p>
                </div>
              ),
            },
            {
              key: "department",
              header: "Phòng ban",
              render: (r) => <span>{r.department_name}</span>,
            },
            {
              key: "shift",
              header: "Ca",
              render: (r) => <span>{r.shift_name}</span>,
            },
            {
              key: "inout",
              header: "Vào – Ra",
              render: (r) => (
                <span className="tnum">
                  {r.first_in ? formatTimeInZone(r.first_in) : "—"}
                  {" – "}
                  {r.last_out ? formatTimeInZone(r.last_out) : "—"}
                </span>
              ),
            },
            {
              key: "late",
              header: "Trễ / Sớm",
              render: (r) => {
                if (r.late_min > 0) return <span className="tnum text-[var(--warning)] font-medium">Trễ {r.late_min}′</span>;
                if (r.early_leave_min > 0) return <span className="tnum text-[var(--info)] font-medium">Sớm {r.early_leave_min}′</span>;
                return <span className="tnum text-slate-400">—</span>;
              },
            },
            {
              key: "status",
              header: "Trạng thái",
              render: (r) => (
                <Badge tone={STATUS_MAP[r.status]}>
                  <Icon name={r.status === "present" ? "check" : "alert"} size={12} />
                  {STATUS_LABELS[r.status] || r.status}
                </Badge>
              ),
            },
          ]}
          cardTitle={(r) => `${r.work_date} · ${r.display_name || r.employee_code}`}
          cardStatus={(r) => <Badge tone={STATUS_MAP[r.status]}>{STATUS_LABELS[r.status] || r.status}</Badge>}
          cardMeta={(r) => (
            <span className="tnum text-sm">
              {r.department_name} · {r.shift_name} · Vào {r.first_in ? formatTimeInZone(r.first_in) : "—"}
              {r.last_out ? ` – Ra ${formatTimeInZone(r.last_out)}` : ""}
              {r.adjustment_status ? ` · Chỉnh công: ${r.adjustment_status}` : ""}
            </span>
          )}
        />
        {((total ?? 0) > 0) && (
          <div className="mt-3 flex justify-between items-center">
            <span className="text-sm text-slate-500">{historyRows.length} / {total} bản ghi</span>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <a
                  href={`?${new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page: String(page - 1) }).toString()}`}
                  className="text-sm text-[var(--brand)] hover:underline"
                >
                  Trang trước
                </a>
              )}
              <span className="text-sm text-slate-500">Trang {page} / {totalPages}</span>
              {page < totalPages && (
                <a
                  href={`?${new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page: String(page + 1) }).toString()}`}
                  className="text-sm text-[var(--brand)] hover:underline"
                >
                  Trang sau
                </a>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
