import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { requireUser } from "@/server/auth";
import {
  getFullDashboardData,
  type DashboardData,
  type DashboardKPI,
  type DashboardRange,
  type TrendBucketGranularity,
} from "@/features/dashboard/actions";
import { EmployeeToday } from "@/features/dashboard/employee-today";
import type { Profile, Role } from "@/types/db";
import type { TrendBucket, TrendDay } from "@/lib/dashboard/trends";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/states";
import { StatCard } from "@/components/ui/stat-card";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Icon, type IconName } from "@/components/ui/icon";
import { CardSkeleton, Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app/app-shell";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  BucketChart,
  DailyAttendanceChart,
  DepartmentAttendanceChart,
  HourTrendChart,
  LateAbsentChart,
  OnTimeDonut,
  ShiftDistributionPie,
} from "@/features/dashboard/charts";
import {
  formatDateInZone,
  formatShortDateInZone,
  formatTimeInZone,
  todayInZone,
} from "@/lib/datetime";

// ============================================================
// Kiểu & hằng số
// ============================================================

interface DashboardSearchParams {
  date?: string;
  range?: string;
  bucket?: string;
  departmentId?: string;
  shiftId?: string;
  employeeId?: string;
  status?: string;
}

type DashboardHrefParams = Record<string, string | undefined>;

const RANGE_OPTIONS: Array<{ value: DashboardRange; label: string }> = [
  { value: "today", label: "Hôm nay" },
  { value: "7d", label: "7 ngày" },
  { value: "30d", label: "30 ngày" },
  { value: "month", label: "Tháng này" },
];

const ROLE_LABELS: Record<Role, string> = {
  employee: "Nhân viên",
  manager: "Quản lý",
  hr_admin: "HR Admin",
  system_admin: "System Admin",
};

const KPI_ICONS: Record<string, IconName> = {
  users: "users",
  "user-check": "user-check",
  clock: "clock",
  x: "x",
  calendar: "calendar",
  chart: "chart",
  user: "user",
  flag: "flag",
  alert: "alert",
  check: "check",
};

const KPI_TONES: Record<DashboardKPI["color"], "neutral" | "success" | "warning" | "danger" | "info"> = {
  primary: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
};

const STATUS_COLORS = {
  success: "success",
  pending_review: "needs_review",
  fallback: "pending",
  failed: "error",
} as const;

const METHOD_LABELS = {
  face: "Khuôn mặt",
  pin_fallback: "PIN thay thế",
  manual: "Thủ công",
} as const;

const METHOD_ICONS: Record<keyof typeof METHOD_LABELS, IconName> = {
  face: "scan-face",
  pin_fallback: "key",
  manual: "file-text",
};

const EXCEPTION_TYPE_LABELS = {
  unverified_checkin: "Chấm công chưa xác minh",
  missing_checkout: "Thiếu check-out",
  off_shift: "Ngoài ca làm",
  pending_review: "Chờ rà soát",
  adjustment_pending: "Chỉnh công chờ duyệt",
} as const;

const EXCEPTION_SEVERITY_COLORS = {
  high: "danger",
  medium: "warning",
  low: "info",
} as const;

// ============================================================
// Helpers
// ============================================================

function normalizeRange(value?: string): DashboardRange {
  return RANGE_OPTIONS.some((option) => option.value === value)
    ? (value as DashboardRange)
    : "7d";
}

function normalizeBucket(value?: string): TrendBucketGranularity {
  return value === "month" ? "month" : "week";
}

function dashboardHref(params: DashboardHrefParams, overrides: DashboardHrefParams = {}): string {
  const merged = { ...params, ...overrides };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

function formatKpiValue(kpi: DashboardKPI): string {
  if (kpi.value === null) return "—";
  return kpi.format === "percent"
    ? `${kpi.value.toLocaleString("vi-VN")}%`
    : kpi.value.toLocaleString("vi-VN");
}

/** Dữ liệu cho biểu đồ chấm công theo ngày / muộn / vắng. */
function toDayChartData(days: TrendDay[]) {
  return days.map((day) => ({
    name: day.label,
    checked_in: day.checked_in,
    assigned: day.assigned,
    late: day.late,
    absent: day.absent,
  }));
}

/** Dữ liệu cho biểu đồ tuần / tháng. */
function toBucketChartData(buckets: TrendBucket[]) {
  return buckets.map((bucket) => ({
    name: bucket.label,
    checked_in: bucket.checked_in,
    absent: bucket.absent,
  }));
}

function tickIntervalFor(length: number): number | undefined {
  if (length <= 8) return undefined;
  if (length <= 12) return 1;
  if (length <= 20) return 2;
  return 3;
}

// ============================================================
// Page
// ============================================================

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardRouter searchParams={searchParams} />
    </Suspense>
  );
}

/** Nhân viên thấy trang "Hôm nay" cá nhân; quản lý/HR thấy dashboard phân tích. */
async function DashboardRouter({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  await connection();
  const { profile } = await requireUser();
  if (profile.role === "employee") {
    return <EmployeeToday profile={profile} />;
  }
  return <DashboardContent profile={profile} searchParams={searchParams} />;
}

async function DashboardContent({
  profile,
  searchParams,
}: {
  profile: Profile;
  searchParams: Promise<DashboardSearchParams>;
}) {
  const params = await searchParams;
  await connection();

  const range = normalizeRange(params.range);
  const bucket = normalizeBucket(params.bucket);
  const filters = {
    date: params.date || todayInZone(),
    departmentId: params.departmentId || undefined,
    shiftId: params.shiftId || undefined,
    employeeId: params.employeeId || undefined,
    status: params.status || undefined,
    range,
    bucket,
  };

  const result = await getFullDashboardData(filters);

  if (!result.ok) {
    return (
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6">
        <PageHeader
          title="Tổng quan chấm công"
          description={`${formatDateInZone(`${filters.date}T12:00:00`)} · ${ROLE_LABELS[profile.role]}`}
        />
        <Card>
          <ErrorState title="Không thể tải dữ liệu" description={result.message} />
        </Card>
      </main>
    );
  }

  return <DashboardView profile={profile} filters={filters} data={result.data!} />;
}

function DashboardView({
  profile,
  filters,
  data,
}: {
  profile: Profile;
  filters: {
    date: string;
    departmentId?: string;
    shiftId?: string;
    employeeId?: string;
    status?: string;
    range: DashboardRange;
    bucket: TrendBucketGranularity;
  };
  data: DashboardData;
}) {
  const { trends, filterOptions } = data;
  const period = trends.period;

  const primaryKpis = data.kpis.slice(0, 6);
  const secondaryKpis = data.kpis.slice(6);

  const hasDailyData = period.assigned > 0 || period.checked_in > 0;
  const hasHourData = data.timeTrend.some((point) => point.check_ins + point.check_outs > 0);
  const hasDepartmentData = data.departmentAttendance.some(
    (row) => row.present + row.late + row.early_leave + row.absent > 0,
  );
  const activeBuckets = filters.bucket === "week" ? trends.weekly : trends.monthly;
  const hasBucketData = activeBuckets.some(
    (item) => item.checked_in + item.absent + item.assigned > 0,
  );

  const hourData = data.timeTrend.map((point) => ({
    name: point.hour,
    check_ins: point.check_ins,
    check_outs: point.check_outs,
  }));

  // Tỷ lệ đúng giờ: present / checked_in. Phần còn lại (thiếu dữ liệu) được
  // tách riêng để tổng biểu đồ luôn khớp số người đã chấm công.
  const unclassified = Math.max(
    0,
    period.checked_in - period.present - period.late - period.early_leave,
  );
  const onTimeBreakdown = [
    { name: "Đúng giờ", value: period.present, color: "var(--success)" },
    { name: "Đi muộn", value: period.late, color: "var(--warning)" },
    { name: "Về sớm", value: period.early_leave, color: "var(--info)" },
  ];
  if (unclassified > 0) {
    onTimeBreakdown.push({ name: "Thiếu dữ liệu", value: unclassified, color: "var(--border-strong)" });
  }

  const rangeParams: DashboardHrefParams = {
    date: filters.date,
    range: filters.range,
    bucket: filters.bucket,
    departmentId: filters.departmentId,
    status: filters.status,
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6">
      <PageHeader
        title="Tổng quan chấm công"
        description={`${formatDateInZone(`${filters.date}T12:00:00`)} · ${ROLE_LABELS[profile.role]}`}
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-[var(--text-3)] sm:inline">
              Cập nhật {formatTimeInZone(data.lastUpdated, undefined, true)}
            </span>
            <RefreshButton />
          </div>
        }
      />

      {/* Bộ lọc thời gian */}
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold tracking-[-0.01em] text-[var(--navy-800)]">
              Khung thời gian
            </h2>
            <p className="mt-0.5 text-[13px] text-[var(--text-2)]">
              Số liệu thẻ KPI luôn theo ngày đã chọn; biểu đồ theo khoảng đã chọn.
            </p>
          </div>
          <nav aria-label="Chọn khoảng thời gian" className="flex flex-wrap items-center gap-1.5">
            {RANGE_OPTIONS.map((option) => {
              const active = filters.range === option.value;
              return (
                <Link
                  key={option.value}
                  href={dashboardHref(rangeParams, { range: option.value })}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "inline-flex h-9 items-center rounded-full bg-[var(--brand)] px-3.5 text-[13px] font-semibold text-white shadow-sm"
                      : "inline-flex h-9 items-center rounded-full border border-[var(--border)] bg-white px-3.5 text-[13px] font-medium text-[var(--text-2)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--navy-800)]"
                  }
                >
                  {option.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <form method="get" className="flex flex-wrap items-end gap-3 border-t border-[var(--border)] pt-3">
          <input type="hidden" name="range" value={filters.range} />
          <input type="hidden" name="bucket" value={filters.bucket} />
          {filters.departmentId ? (
            <input type="hidden" name="departmentId" value={filters.departmentId} />
          ) : null}
          {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
          <label className="flex w-full flex-col gap-1.5 text-[13px] font-medium text-[var(--text-2)] sm:w-44">
            Ngày xem
            <input
              type="date"
              name="date"
              defaultValue={filters.date}
              className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-3 text-sm text-[var(--navy-700)] transition-colors hover:border-[var(--border-strong)] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]"
            />
          </label>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm">
              <Icon name="filter" size={14} /> Áp dụng
            </Button>
            <Link
              href="/dashboard"
              className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-3 text-[13px] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--surface-muted)]"
            >
              <Icon name="refresh" size={14} /> Đặt lại
            </Link>
          </div>
        </form>
      </Card>

      {/* Thẻ số liệu */}
      <section aria-labelledby="dashboard-kpi-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="dashboard-kpi-heading"
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]"
          >
            Chỉ số ngày {formatShortDateInZone(`${filters.date}T12:00:00`)}
          </h2>
          {trends.truncated ? (
            <Badge tone="warning">
              <Icon name="alert" size={12} /> Dữ liệu biểu đồ có thể chưa đầy đủ
            </Badge>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...primaryKpis, ...secondaryKpis].map((kpi) => (
            <StatCard
              key={kpi.label}
              label={kpi.label}
              value={formatKpiValue(kpi)}
              icon={KPI_ICONS[kpi.icon] ?? "chart"}
              tone={KPI_TONES[kpi.color]}
              href={kpi.href}
              hint={kpi.description}
              change={kpi.change}
              trend={kpi.trend}
              changeLabel="So với ngày trước đó"
            />
          ))}
        </div>
      </section>

      {/* Biểu đồ chính */}
      <section aria-labelledby="dashboard-charts-heading" className="flex flex-col gap-3">
        <h2
          id="dashboard-charts-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]"
        >
          Biểu đồ thống kê
        </h2>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Chấm công theo ngày"
              description={trends.range.label}
              action={<Badge tone="brand">{period.checked_in.toLocaleString("vi-VN")} ngày công</Badge>}
            />
            <div className="mt-4">
              <DailyAttendanceChart
                data={hasDailyData ? toDayChartData(trends.daily) : []}
                tickInterval={tickIntervalFor(trends.daily.length)}
                showDots={trends.daily.length <= 10}
              />
            </div>
            <dl className="mt-1 grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-3 sm:grid-cols-4">
              <MiniStat label="Tổng ngày công" value={period.checked_in} />
              <MiniStat label="Đúng giờ" value={period.present} tone="success" />
              <MiniStat label="Đi muộn" value={period.late} tone="warning" />
              <MiniStat label="Vắng mặt" value={period.absent} tone="danger" />
            </dl>
          </Card>

          <Card className="flex flex-col">
            <CardHeader
              title="Tỷ lệ đi làm đúng giờ"
              description={trends.range.label}
              action={
                <Badge
                  tone={
                    period.on_time_rate === null
                      ? "neutral"
                      : period.on_time_rate >= 80
                        ? "success"
                        : period.on_time_rate >= 60
                          ? "warning"
                          : "danger"
                  }
                >
                  {period.on_time_rate === null ? "Chưa có dữ liệu" : `${period.on_time_rate}%`}
                </Badge>
              }
            />
            <div className="mt-2 flex-1">
              <OnTimeDonut data={onTimeBreakdown} rate={period.on_time_rate} />
            </div>
            {period.checked_in > 0 ? (
              <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[var(--border)] pt-3">
                {onTimeBreakdown.map((item) => (
                  <li key={item.name} className="flex items-center gap-2 text-xs">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate text-[var(--text-2)]">{item.name}</span>
                    <span className="tnum ml-auto font-semibold text-[var(--navy-800)]">
                      {item.value.toLocaleString("vi-VN")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--text-3)]">
              Đúng giờ = nhân viên có trạng thái <span className="font-medium">present</span> / số
              người đã chấm công.
            </p>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader
              title="Đi muộn & vắng mặt"
              description={trends.range.label}
              action={
                <div className="flex items-center gap-3 text-[11px] font-medium text-[var(--text-2)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--warning)]" /> Muộn
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--danger)]" /> Vắng
                  </span>
                </div>
              }
            />
            <div className="mt-4">
              <LateAbsentChart
                data={hasDailyData ? toDayChartData(trends.daily) : []}
                tickInterval={tickIntervalFor(trends.daily.length)}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Thống kê theo tuần / tháng"
              description={
                filters.bucket === "week" ? "8 tuần gần nhất" : "6 tháng gần nhất"
              }
              action={
                <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-muted)] p-0.5">
                  {(["week", "month"] as const).map((option) => {
                    const active = filters.bucket === option;
                    return (
                      <Link
                        key={option}
                        href={dashboardHref(rangeParams, { bucket: option })}
                        aria-current={active ? "true" : undefined}
                        className={
                          active
                            ? "inline-flex h-7 items-center rounded-full bg-white px-3 text-xs font-semibold text-[var(--navy-800)] shadow-sm"
                            : "inline-flex h-7 items-center rounded-full px-3 text-xs font-medium text-[var(--text-2)] transition-colors hover:text-[var(--navy-800)]"
                        }
                      >
                        {option === "week" ? "Tuần" : "Tháng"}
                      </Link>
                    );
                  })}
                </div>
              }
            />
            <div className="mt-4">
              <BucketChart data={hasBucketData ? toBucketChartData(activeBuckets) : []} />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-3)]">
              Tỷ lệ trong mỗi cột được tính lại từ tổng ngày công của kỳ, không lấy trung bình các
              ngày.
            </p>
          </Card>
        </div>
      </section>

      {/* Biểu đồ bổ sung */}
      <section aria-labelledby="dashboard-extra-heading" className="flex flex-col gap-3">
        <h2
          id="dashboard-extra-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]"
        >
          Chi tiết vận hành
        </h2>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Xu hướng chấm công theo giờ"
              description={`Ngày ${formatShortDateInZone(`${filters.date}T12:00:00`)}`}
            />
            <div className="mt-4">
              <HourTrendChart data={hasHourData ? hourData : []} />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Phân bổ ca làm"
              description="Nhân viên đang hoạt động có phân ca trong ngày"
            />
            <div className="mt-4">
              <ShiftDistributionPie
                data={data.shiftDistribution.map((shift) => ({
                  name: shift.shift_name,
                  value: shift.count,
                  color: shift.color,
                }))}
              />
            </div>
            {data.shiftDistribution.length > 0 ? (
              <ul className="mt-2 grid gap-x-3 gap-y-2 border-t border-[var(--border)] pt-3">
                {data.shiftDistribution.map((shift) => (
                  <li key={shift.shift_name} className="flex items-center gap-2 text-xs">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: shift.color }}
                    />
                    <span className="truncate text-[var(--text-2)]">{shift.shift_name}</span>
                    <span className="tnum ml-auto font-semibold text-[var(--navy-800)]">
                      {shift.count.toLocaleString("vi-VN")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Chấm công theo phòng ban"
            description={`Ngày ${formatShortDateInZone(`${filters.date}T12:00:00`)} · đúng giờ, muộn, về sớm, vắng`}
          />
          <div className="mt-4">
            <DepartmentAttendanceChart
              data={
                hasDepartmentData
                  ? data.departmentAttendance.map((row) => ({
                      name: row.department,
                      present: row.present,
                      late: row.late,
                      early_leave: row.early_leave,
                      absent: row.absent,
                    }))
                  : []
              }
            />
          </div>
        </Card>
      </section>

      {/* Hoạt động gần đây + ngoại lệ */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Hoạt động chấm công gần đây"
            description="20 sự kiện mới nhất trong ngày đã chọn"
            action={
              <form method="get" className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="date" value={filters.date} />
                <input type="hidden" name="range" value={filters.range} />
                <input type="hidden" name="bucket" value={filters.bucket} />
                <label className="sr-only" htmlFor="activity-department">
                  Phòng ban
                </label>
                <select
                  id="activity-department"
                  name="departmentId"
                  defaultValue={filters.departmentId ?? ""}
                  className="h-9 max-w-[180px] rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-2.5 text-[13px] text-[var(--navy-700)]"
                >
                  <option value="">Tất cả phòng ban</option>
                  {filterOptions.departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.label}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="activity-status">
                  Trạng thái
                </label>
                <select
                  id="activity-status"
                  name="status"
                  defaultValue={filters.status ?? ""}
                  className="h-9 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-2.5 text-[13px] text-[var(--navy-700)]"
                >
                  <option value="">Mọi trạng thái</option>
                  <option value="success">Thành công</option>
                  <option value="pending_review">Chờ rà soát</option>
                  <option value="fallback">Thay thế</option>
                  <option value="failed">Thất bại</option>
                </select>
                <Button type="submit" variant="secondary" size="sm">
                  Lọc
                </Button>
              </form>
            }
          />
          <div className="mt-3">
            <DataTable
              ariaLabel="Hoạt động chấm công gần đây"
              rows={data.liveActivity}
              keyOf={(event) => event.id}
              emptyTitle="Chưa có hoạt động chấm công"
              emptyDescription="Sự kiện chấm công mới nhất trong ngày sẽ hiển thị tại đây."
              columns={[
                {
                  key: "employee",
                  header: "Nhân viên",
                  render: (event) => (
                    <div className="flex items-center gap-2.5">
                      <Avatar name={event.display_name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--navy-800)]">
                          {event.display_name || "—"}
                        </p>
                        <p className="truncate text-[11px] text-[var(--text-3)]">
                          {event.department}
                        </p>
                      </div>
                    </div>
                  ),
                },
                {
                  key: "code",
                  header: "Mã nhân viên",
                  render: (event) => (
                    <span className="tnum text-xs font-medium text-[var(--text-2)]">
                      {event.employee_code}
                    </span>
                  ),
                },
                {
                  key: "time",
                  header: "Thời gian chấm công",
                  render: (event) => (
                    <span className="tnum text-sm text-[var(--navy-800)]">
                      {formatTimeInZone(event.occurred_at, undefined, true)}
                    </span>
                  ),
                },
                {
                  key: "type",
                  header: "Loại chấm công",
                  render: (event) => (
                    <Badge tone={event.event_type === "check_in" ? "info" : "success"}>
                      <Icon
                        name={event.event_type === "check_in" ? "arrow-right" : "logout"}
                        size={11}
                      />
                      {event.event_type === "check_in" ? "Vào" : "Ra"}
                    </Badge>
                  ),
                },
                {
                  key: "method",
                  header: "Phương thức",
                  render: (event) => (
                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-2)]">
                      <Icon name={METHOD_ICONS[event.method]} size={13} />
                      {METHOD_LABELS[event.method]}
                    </span>
                  ),
                },
                {
                  key: "status",
                  header: "Trạng thái",
                  render: (event) => (
                    <StatusIndicator status={STATUS_COLORS[event.status] ?? "idle"} />
                  ),
                },
              ]}
              cardTitle={(event) => (
                <span className="flex items-center gap-2">
                  <Avatar name={event.display_name} size="xs" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {event.display_name || event.employee_code}
                    </span>
                    <span className="tnum block text-[11px] font-normal text-[var(--text-3)]">
                      {event.employee_code}
                    </span>
                  </span>
                </span>
              )}
              cardStatus={(event) => <StatusIndicator status={STATUS_COLORS[event.status] ?? "idle"} />}
              cardMeta={(event) => (
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-2)]">
                  <span className="tnum font-medium">
                    {formatTimeInZone(event.occurred_at, undefined, true)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{event.event_type === "check_in" ? "Vào" : "Ra"}</span>
                  <span aria-hidden="true">·</span>
                  <span>{METHOD_LABELS[event.method]}</span>
                  <span aria-hidden="true">·</span>
                  <span>{event.department}</span>
                </span>
              )}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Trung tâm ngoại lệ"
            description="Chấm công cần rà soát trong ngày"
            action={
              <Badge tone={data.exceptions.length > 0 ? "warning" : "success"}>
                {data.exceptions.length} mục
              </Badge>
            }
          />
          <div className="mt-3">
            <DataTable
              ariaLabel="Danh sách ngoại lệ"
              rows={data.exceptions}
              keyOf={(exception) => exception.id}
              emptyTitle="Không có ngoại lệ"
              emptyDescription="Tất cả chấm công trong ngày đều bình thường."
              columns={[
                {
                  key: "type",
                  header: "Loại",
                  render: (exception) => (
                    <Badge tone={EXCEPTION_SEVERITY_COLORS[exception.severity]}>
                      {EXCEPTION_TYPE_LABELS[exception.type]}
                    </Badge>
                  ),
                },
                {
                  key: "employee",
                  header: "Nhân viên",
                  render: (exception) => (
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--navy-800)]">
                        {exception.display_name || exception.employee_code}
                      </p>
                      <p className="truncate text-[11px] text-[var(--text-3)]">
                        {exception.employee_code} · {exception.department}
                      </p>
                    </div>
                  ),
                },
                {
                  key: "actions",
                  header: <span className="sr-only">Thao tác</span>,
                  render: (exception) => (
                    <Link href={exception.href}>
                      <Button variant="ghost" size="sm">
                        Xem
                      </Button>
                    </Link>
                  ),
                },
              ]}
              cardTitle={(exception) =>
                `${EXCEPTION_TYPE_LABELS[exception.type]} · ${exception.employee_code}`
              }
              cardStatus={(exception) => (
                <Badge tone={EXCEPTION_SEVERITY_COLORS[exception.severity]}>
                  {exception.severity.toUpperCase()}
                </Badge>
              )}
              cardMeta={(exception) => (
                <span className="text-xs text-[var(--text-2)]">{exception.detail}</span>
              )}
              cardActions={(exception) => (
                <Link href={exception.href}>
                  <Button variant="ghost" size="sm">
                    Xem chi tiết
                  </Button>
                </Link>
              )}
            />
          </div>
        </Card>
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--text-3)]">
        Nguồn dữ liệu: bảng tổng hợp chấm công, phân ca và đơn nghỉ đã duyệt của tổ chức. Tỷ lệ
        chuyên cần = nhân viên đã chấm công / nhân viên có ca trong ngày; vắng mặt không tính nhân
        viên có đơn nghỉ đã duyệt. Ngày chưa phân ca hiển thị “—” thay vì 0%.
      </p>
    </main>
  );
}

/** Số liệu phụ dưới biểu đồ. */
function MiniStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-[var(--success)]"
      : tone === "warning"
        ? "text-[var(--warning)]"
        : tone === "danger"
          ? "text-[var(--danger)]"
          : "text-[var(--navy-800)]";
  return (
    <div>
      <dt className="text-[11px] text-[var(--text-3)]">{label}</dt>
      <dd className={`tnum mt-0.5 text-base font-semibold ${toneClass}`}>
        {value.toLocaleString("vi-VN")}
      </dd>
    </div>
  );
}

/** Skeleton khi Suspense chờ dữ liệu (giữ đúng nhịp layout, tránh nhảy). */
function DashboardSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-64" />
        </div>
        <Skeleton className="mt-4 h-10 w-48" />
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-4 h-[286px] w-full" />
        </Card>
        <Card>
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-4 h-[230px] w-full" />
        </Card>
      </div>

      <Card>
        <Skeleton className="h-5 w-56" />
        <div className="mt-4">
          <TableSkeleton rows={6} cols={6} />
        </div>
      </Card>
    </main>
  );
}
