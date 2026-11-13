import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/app/app-shell";
import { requireUser } from "@/server/auth";
import {
  getPersonalHistoryWithFilters,
  type HistoryRow,
} from "@/features/reports/actions";
import { DataTable } from "@/components/ui/data-table";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/states";
import { formatTimeInZone } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { HistoryPagination } from "./pagination-client";

const PAGE_SIZE = 20;

type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info" | "brand";

const STATUS_MAP: Record<string, BadgeTone> = {
  present: "success",
  late: "warning",
  early_leave: "info",
  absent: "danger",
  incomplete: "neutral",
};

const STATUS_ICONS: Record<string, "check" | "clock" | "x" | "alert"> = {
  present: "check",
  late: "clock",
  early_leave: "clock",
  absent: "x",
  incomplete: "alert",
};

const STATUS_LABELS: Record<string, string> = {
  present: "Đúng giờ",
  late: "Đi muộn",
  early_leave: "Về sớm",
  absent: "Vắng mặt",
  incomplete: "Chưa hoàn tất",
};

interface HistorySearchParams {
  month?: string;
  page?: string;
  employee_id?: string;
  department_id?: string;
  status?: string;
  q?: string;
}

export default function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<HistorySearchParams>;
}) {
  return (
    <main className="page-shell flex flex-col gap-6">
      <PageHeader
        eyebrow="Báo cáo cá nhân"
        icon="clipboard-check"
        title="Lịch sử chấm công"
        description="Tra cứu bản ghi chấm công theo tháng, phòng ban và trạng thái."
      />
      <Suspense fallback={<LoadingState message="Đang tải lịch sử chấm công…" />}>
        <HistoryData searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function HistoryData({ searchParams }: { searchParams: Promise<HistorySearchParams> }) {
  await requireUser();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const filters = {
    month: params.month ?? new Date().toISOString().slice(0, 7),
    employee_id: params.employee_id ?? undefined,
    department_id: params.department_id ?? undefined,
    status: params.status ?? undefined,
    q: params.q?.trim() || undefined,
  };

  const { ok, rows, total, departments, message } = await getPersonalHistoryWithFilters(
    filters,
    page,
    PAGE_SIZE,
  );
  const totalPages = Math.max(1, Math.ceil((total ?? 0) / PAGE_SIZE));
  const historyRows: HistoryRow[] = rows ?? [];

  if (!ok) {
    return (
      <ErrorState
        title="Không tải được lịch sử"
        description={message ?? "Lỗi không xác định."}
      />
    );
  }

  const baseParams: Record<string, string> = {};
  if (filters.month) baseParams.month = filters.month;
  if (filters.department_id) baseParams.department_id = filters.department_id;
  if (filters.status) baseParams.status = filters.status;
  if (filters.q) baseParams.q = filters.q;
  if (filters.employee_id) baseParams.employee_id = filters.employee_id;

  const hasFilters = Boolean(
    filters.department_id || filters.status || filters.q || filters.employee_id,
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Bộ lọc */}
      <section
        aria-labelledby="history-filter-heading"
        className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-icon)] bg-[var(--brand-soft)] text-[var(--brand)] ring-1 ring-inset ring-blue-100">
              <Icon name="filter" size={17} />
            </span>
            <div>
              <h2 id="history-filter-heading" className="text-[15px] font-bold tracking-[-0.01em] text-[var(--navy-800)]">
                Bộ lọc
              </h2>
              <p className="mt-0.5 text-[13px] text-[var(--text-2)]">
                Kết hợp tháng, phòng ban, trạng thái và tìm kiếm theo tên hoặc mã nhân viên.
              </p>
            </div>
          </div>
          {hasFilters ? (
            <Link
              href={`/history?month=${encodeURIComponent(filters.month)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border)] bg-white px-3 text-[13px] font-medium text-[var(--text-2)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--navy-800)]"
            >
              <Icon name="refresh" size={14} /> Xóa bộ lọc
            </Link>
          ) : null}
        </div>

        <form method="get" className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-2 xl:grid-cols-[210px_minmax(0,1fr)_190px_180px_auto]">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-[var(--text-2)]">
            Tháng
            <input
              type="month"
              name="month"
              defaultValue={filters.month}
              className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-3 text-sm text-[var(--navy-700)] transition-colors hover:border-[var(--border-strong)] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-[var(--text-2)]">
            Tìm kiếm
            <span className="relative">
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--text-3)]">
                <Icon name="search" size={15} />
              </span>
              <input
                type="search"
                name="q"
                defaultValue={filters.q ?? ""}
                placeholder="Mã nhân viên hoặc tên…"
                className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white pl-9 pr-3 text-sm text-[var(--navy-700)] transition-colors placeholder:text-[var(--text-3)] hover:border-[var(--border-strong)] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]"
              />
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-[var(--text-2)]">
            Phòng ban
            <select
              name="department_id"
              defaultValue={filters.department_id ?? ""}
              className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-2.5 text-sm text-[var(--navy-700)] transition-colors hover:border-[var(--border-strong)] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]"
            >
              <option value="">Tất cả phòng ban</option>
              {(departments ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-[var(--text-2)]">
            Trạng thái
            <select
              name="status"
              defaultValue={filters.status ?? ""}
              className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-2.5 text-sm text-[var(--navy-700)] transition-colors hover:border-[var(--border-strong)] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="present">Đúng giờ</option>
              <option value="late">Đi muộn</option>
              <option value="early_leave">Về sớm</option>
              <option value="absent">Vắng mặt</option>
              <option value="incomplete">Chưa hoàn tất</option>
            </select>
          </label>

          <div className="flex items-end">
            <Button type="submit" className="w-full sm:w-auto">
              <Icon name="filter" size={15} /> Áp dụng
            </Button>
          </div>
        </form>
      </section>

      {/* Bảng dữ liệu */}
      <section aria-labelledby="history-table-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="history-table-heading" className="text-[15px] font-bold tracking-[-0.01em] text-[var(--navy-800)]">
              Bản ghi chấm công
            </h2>
            <p className="mt-0.5 text-[13px] text-[var(--text-2)]">
              Tháng {filters.month} · {total ?? 0} bản ghi phù hợp
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">
              <Icon name="calendar" size={12} /> {filters.month}
            </Badge>
            {filters.status ? (
              <Badge tone={STATUS_MAP[filters.status] ?? "neutral"}>
                {STATUS_LABELS[filters.status] ?? filters.status}
              </Badge>
            ) : null}
            {filters.q ? (
              <Badge tone="info">
                <Icon name="search" size={12} /> “{filters.q}”
              </Badge>
            ) : null}
          </div>
        </div>

        {historyRows.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
            <EmptyState
              title="Chưa có bản ghi phù hợp"
              description={
                hasFilters
                  ? "Thử nới bộ lọc hoặc chọn tháng khác để xem dữ liệu."
                  : "Tháng này chưa có dữ liệu chấm công."
              }
              icon="clipboard-check"
            />
          </div>
        ) : (
          <DataTable
            ariaLabel="Lịch sử chấm công"
            rows={historyRows}
            keyOf={(row, index) => `${row.work_date}-${row.employee_code}-${index}`}
            columns={[
              {
                key: "date",
                header: "Ngày",
                render: (row) => (
                  <span className="tnum text-[13px] font-semibold text-[var(--navy-800)]">
                    {row.work_date}
                  </span>
                ),
              },
              {
                key: "employee",
                header: "Nhân viên",
                render: (row) => (
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[11px] font-bold uppercase text-[var(--brand-strong)]">
                      {(row.display_name || row.employee_code).trim().charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[var(--navy-800)]">
                        {row.display_name || row.employee_code}
                      </p>
                      <p className="tnum truncate text-[11px] text-[var(--text-3)]">
                        {row.employee_code}
                      </p>
                    </div>
                  </div>
                ),
              },
              {
                key: "department",
                header: "Phòng ban",
                render: (row) => (
                  <span className="text-[13px] text-[var(--text-2)]">{row.department_name}</span>
                ),
              },
              {
                key: "shift",
                header: "Ca",
                render: (row) => (
                  <span className="text-[13px] text-[var(--text-2)]">{row.shift_name}</span>
                ),
              },
              {
                key: "inout",
                header: "Vào – Ra",
                render: (row) => (
                  <span className="tnum inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--navy-800)]">
                    <span>{row.first_in ? formatTimeInZone(row.first_in) : "—"}</span>
                    <span aria-hidden="true" className="text-[var(--text-3)]">→</span>
                    <span>{row.last_out ? formatTimeInZone(row.last_out) : "—"}</span>
                  </span>
                ),
              },
              {
                key: "late",
                header: "Trễ / Sớm",
                render: (row) => {
                  if (row.late_min > 0) {
                    return (
                      <span className="tnum inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--warning-strong)]">
                        <Icon name="clock" size={13} /> {row.late_min}′
                      </span>
                    );
                  }
                  if (row.early_leave_min > 0) {
                    return (
                      <span className="tnum inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--info-strong)]">
                        <Icon name="clock" size={13} /> {row.early_leave_min}′
                      </span>
                    );
                  }
                  return <span className="text-[var(--text-3)]">—</span>;
                },
              },
              {
                key: "adjustment",
                header: "Chỉnh công",
                render: (row) =>
                  row.adjustment_status ? (
                    <Badge tone={row.adjustment_status === "approved" ? "success" : row.adjustment_status === "rejected" ? "danger" : "warning"}>
                      {row.adjustment_status === "approved"
                        ? "Đã duyệt"
                        : row.adjustment_status === "rejected"
                          ? "Từ chối"
                          : "Chờ duyệt"}
                    </Badge>
                  ) : (
                    <span className="text-[var(--text-3)]">—</span>
                  ),
              },
              {
                key: "status",
                header: "Trạng thái",
                render: (row) => (
                  <Badge tone={STATUS_MAP[row.status] ?? "neutral"}>
                    <Icon name={STATUS_ICONS[row.status] ?? "alert"} size={12} />
                    {STATUS_LABELS[row.status] ?? row.status}
                  </Badge>
                ),
              },
            ]}
            cardTitle={(row) => (
              <span className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[11px] font-bold uppercase text-[var(--brand-strong)]">
                    {(row.display_name || row.employee_code).trim().charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{row.display_name || row.employee_code}</span>
                    <span className="tnum block text-[11px] font-normal text-[var(--text-3)]">
                      {row.work_date} · {row.employee_code}
                    </span>
                  </span>
                </span>
              </span>
            )}
            cardStatus={(row) => (
              <Badge tone={STATUS_MAP[row.status] ?? "neutral"}>
                {STATUS_LABELS[row.status] ?? row.status}
              </Badge>
            )}
            cardMeta={(row) => (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--text-2)]">
                <span>{row.department_name}</span>
                <span aria-hidden="true">·</span>
                <span>{row.shift_name}</span>
                <span aria-hidden="true">·</span>
                <span className="tnum">
                  {row.first_in ? formatTimeInZone(row.first_in) : "—"} →{" "}
                  {row.last_out ? formatTimeInZone(row.last_out) : "—"}
                </span>
              </span>
            )}
          />
        )}

        {(total ?? 0) > 0 ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-xs)]">
            <HistoryPagination
              page={page}
              totalPages={totalPages}
              total={total ?? 0}
              pageSize={PAGE_SIZE}
              label="bản ghi"
              showPageSize={false}
              showJump={totalPages > 7}
              ariaLabel="Phân trang lịch sử chấm công"
              baseParams={baseParams}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
