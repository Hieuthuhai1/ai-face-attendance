import { Suspense } from "react";
import { requireRole } from "@/server/auth";
import { getFullDashboardData } from "@/features/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { StatCard } from "@/components/ui/stat-card";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/app-shell";
import { Icon } from "@/components/ui/icon";
import { SimpleLineChart } from "@/components/ui/charts/line-chart";
import { SimpleBarChart } from "@/components/ui/charts/bar-chart";
import { SimplePieChart } from "@/components/ui/charts/pie-chart";
import Link from "next/link";

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

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; departmentId?: string; shiftId?: string; employeeId?: string; status?: string }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6">
      <Suspense fallback={<LoadingState message="Đang tải tổng quan chấm công…" />}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; departmentId?: string; shiftId?: string; employeeId?: string; status?: string }>;
}) {
  const { profile } = await requireRole(["manager", "hr_admin", "system_admin"]);
  const params = await searchParams;
  const filters = {
    date: params.date ?? new Date().toISOString().slice(0, 10),
    departmentId: params.departmentId,
    shiftId: params.shiftId,
    employeeId: params.employeeId,
    status: params.status,
  };

  const result = await getFullDashboardData(filters);

  if (!result.ok) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Tổng quan chấm công"
          description={`Ngày ${filters.date} · ${profile.role}`}
        />
        <ErrorState
          title="Không thể tải dữ liệu"
          description={result.message}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  const data = result.data!;
  const todayStr = new Date(filters.date + "T00:00:00").toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Page Header */}
      <PageHeader
        title="Tổng quan chấm công"
        description={`${todayStr} · Vai trò: ${profile.role}`}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              Cập nhật: {new Date(data.lastUpdated).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <Button onClick={() => window.location.reload()} variant="secondary" size="sm">
              <Icon name="refresh" size={14} /> Làm mới
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <Card>
        <form method="get" className="grid gap-3 sm:grid-cols-6">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Ngày
            <input
              type="date"
              name="date"
              defaultValue={filters.date}
              className="h-10 rounded-lg border border-slate-300 px-3"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Phòng ban
            <select name="departmentId" defaultValue={filters.departmentId ?? ""} className="h-10 rounded-lg border border-slate-300 px-3">
              <option value="">Tất cả</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Ca làm
            <select name="shiftId" defaultValue={filters.shiftId ?? ""} className="h-10 rounded-lg border border-slate-300 px-3">
              <option value="">Tất cả</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Nhân viên
            <input
              type="text"
              name="employeeId"
              placeholder="Mã hoặc tên..."
              defaultValue={filters.employeeId ?? ""}
              className="h-10 rounded-lg border border-slate-300 px-3"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Trạng thái
            <select name="status" defaultValue={filters.status ?? ""} className="h-10 rounded-lg border border-slate-300 px-3">
              <option value="">Tất cả</option>
              <option value="success">Thành công</option>
              <option value="pending_review">Chờ rà soát</option>
              <option value="fallback">Thay thế</option>
              <option value="failed">Thất bại</option>
            </select>
          </label>
          <div className="flex items-end gap-2 sm:col-span-6">
            <Button type="submit">Lọc</Button>
            <Button type="button" variant="secondary" onClick={() => window.location.assign("/dashboard")}>
              Xóa lọc
            </Button>
          </div>
        </form>
      </Card>

      {/* KPI Cards */}
      <section aria-label="Chỉ số chính" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {data.kpis.map((kpi) => (
          <StatCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value.toLocaleString("vi-VN")}
            icon={kpi.icon}
            tone={kpi.color === "primary" ? "info" : kpi.color}
            href={kpi.href}
            hint={kpi.description}
          />
        ))}
      </section>

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Time Trend Chart */}
        <Card className="lg:col-span-2">
          <CardTitle>Xu hướng check-in / check-out hôm nay</CardTitle>
          <div className="mt-4 h-64">
            {data.timeTrend.length > 0 ? (
              <SimpleLineChart
                data={data.timeTrend.map((t) => ({ x: t.hour, y: t.check_ins }))}
                color="var(--brand)"
                showArea
                showDots
                referenceLine={{ y: Math.max(...data.timeTrend.map((t) => t.check_ins)) * 0.8, label: "Trung bình" }}
              />
            ) : (
              <EmptyState title="Chưa có dữ liệu" description="Dữ liệu sẽ hiện khi có nhân viên chấm công" />
            )}
          </div>
        </Card>

        {/* Shift Distribution Chart */}
        <Card>
          <CardTitle>Phân bổ ca làm hôm nay</CardTitle>
          <div className="mt-4 h-64">
            {data.shiftDistribution.length > 0 ? (
              <SimplePieChart
                data={data.shiftDistribution.map((s) => ({
                  label: s.shift_name,
                  value: s.count,
                  color: s.color,
                }))}
              />
            ) : (
              <EmptyState title="Chưa có phân ca" description="Chưa có nhân viên được phân ca hôm nay" />
            )}
          </div>
        </Card>
      </div>

      {/* Department Attendance Chart */}
      <Card>
        <CardTitle>Chấm công theo phòng ban</CardTitle>
        <div className="mt-4 h-72">
          {data.departmentAttendance.length > 0 ? (
            <SimpleBarChart
              data={data.departmentAttendance.flatMap((d) => [
                { label: d.department, value: d.present, color: "var(--success)" },
                { label: d.department, value: d.late, color: "var(--warning)" },
                { label: d.department, value: d.absent, color: "var(--danger)" },
                { label: d.department, value: d.early_leave, color: "var(--info)" },
              ])}
            />
          ) : (
            <EmptyState title="Chưa có dữ liệu" description="Dữ liệu sẽ hiện khi có nhân viên chấm công" />
          )}
        </div>
      </Card>

      {/* Live Activity & Exceptions */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Live Activity */}
        <Card className="lg:col-span-2">
          <CardTitle>Hoạt động chấm công gần đây</CardTitle>
          <div className="mt-3">
            <DataTable
              ariaLabel="Hoạt động chấm công gần đây"
              rows={data.liveActivity}
              keyOf={(e) => e.id}
              emptyTitle="Chưa có hoạt động"
              emptyDescription="Sự kiện chấm công mới nhất sẽ hiện ở đây."
              columns={[
                { key: "time", header: "Thời gian", render: (e) => <span className="tnum text-xs">{new Date(e.occurred_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span> },
                { key: "employee", header: "Nhân viên", render: (e) => <span className="font-medium">{e.employee_code}</span> },
                { key: "name", header: "Họ tên", render: (e) => <span className="text-sm">{e.display_name}</span> },
                { key: "dept", header: "Phòng", render: (e) => <span className="text-xs text-slate-500">{e.department}</span> },
                {
                  key: "type",
                  header: "Loại",
                  render: (e) => (
                    <Badge tone={e.event_type === "check_in" ? "info" : "success"}>
                      {e.event_type === "check_in" ? "Vào" : "Ra"}
                    </Badge>
                  ),
                },
                {
                  key: "method",
                  header: "Phương thức",
                  render: (e) => <span className="text-xs text-slate-500 capitalize">{METHOD_LABELS[e.method]}</span>,
                },
                {
                  key: "status",
                  header: "Trạng thái",
                  render: (e) => (
                    <StatusIndicator status={STATUS_COLORS[e.status] ?? "idle"} />
                  ),
                },
              ]}
              cardTitle={(e) => `${e.event_type === "check_in" ? "Check-in" : "Check-out"} · ${e.employee_code}`}
              cardStatus={(e) => <StatusIndicator status={STATUS_COLORS[e.status] ?? "idle"} />}
              cardMeta={(e) => (
                <span className="text-xs text-slate-500">
                  {new Date(e.occurred_at).toLocaleString("vi-VN")} · {METHOD_LABELS[e.method]}
                  {e.confidence !== null && e.confidence !== undefined ? ` · Khớp ${(e.confidence * 100).toFixed(0)}%` : ""}
                  {e.liveness_status ? ` · Liveness: ${e.liveness_status}` : ""}
                </span>
              )}
            />
          </div>
        </Card>

        {/* Exceptions */}
        <Card>
          <CardTitle>Trung tâm ngoại lệ</CardTitle>
          <div className="mt-3">
            {data.exceptions.length === 0 ? (
              <EmptyState title="Không có ngoại lệ" description="Tất cả chấm công đều bình thường" />
            ) : (
              <DataTable
                ariaLabel="Danh sách ngoại lệ"
                rows={data.exceptions}
                keyOf={(e) => e.id}
                emptyTitle="Không có ngoại lệ"
                emptyDescription="Tất cả chấm công đều bình thường"
                columns={[
                  {
                    key: "type",
                    header: "Loại",
                    render: (e) => (
                      <Badge tone={EXCEPTION_SEVERITY_COLORS[e.severity]}>
                        {EXCEPTION_TYPE_LABELS[e.type]}
                      </Badge>
                    ),
                  },
                  { key: "employee", header: "Nhân viên", render: (e) => <span className="font-medium">{e.employee_code}</span> },
                  { key: "name", header: "Họ tên", render: (e) => <span className="text-sm">{e.display_name}</span> },
                  { key: "dept", header: "Phòng", render: (e) => <span className="text-xs text-slate-500">{e.department}</span> },
                  { key: "shift", header: "Ca", render: (e) => <span className="text-xs text-slate-500">{e.shift_name}</span> },
                  {
                    key: "actions",
                    header: <span className="sr-only">Thao tác</span>,
                    render: (e) => (
                      <Link href={e.href}>
                        <Button variant="ghost" size="sm">Xem chi tiết</Button>
                      </Link>
                    ),
                  },
                ]}
                cardTitle={(e) => `${EXCEPTION_TYPE_LABELS[e.type]} · ${e.employee_code}`}
                cardStatus={(e) => <Badge tone={EXCEPTION_SEVERITY_COLORS[e.severity]}>{e.severity.toUpperCase()}</Badge>}
                cardMeta={(e) => (
                  <span className="text-xs text-slate-500">
                    {e.detail}
                  </span>
                )}
                cardActions={(e) => (
                  <Link href={e.href}>
                    <Button variant="ghost" size="sm">Xem chi tiết</Button>
                  </Link>
                )}
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}