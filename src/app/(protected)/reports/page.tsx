import { Suspense } from "react";
import { requireRole } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { getDashboard, getReport, getFullDashboardData, type ReportFilters, type ReportRow, type AnalyticsData, type KPIData, type ExceptionItem, type DepartmentSummaryRow, type LateEarlyReportRow, type MissingCheckReportRow } from "@/features/reports/actions";
import { ExportButton } from "@/features/reports/export-button";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/states";
import { ReportsPagination } from "./pagination-client";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const STATUS_MAP: Record<string, "ontime" | "late" | "early_leave" | "absent" | "needs_review" | "idle"> = {
  present: "ontime",
  late: "late",
  early_leave: "early_leave",
  absent: "absent",
  incomplete: "needs_review",
};

const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  unverified: "Chưa xác minh",
  missing_checkout: "Thiếu check-out",
  pending_review: "Chờ rà soát",
  pending_adjustment: "Chờ duyệt điều chỉnh",
  ai_exception: "Ngoại lệ AI",
};

const EXCEPTION_SEVERITY_COLORS: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

export default function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Báo cáo & Phân tích chấm công</h1>
        <Badge tone="info" className="text-xs">Analytics</Badge>
      </div>
      <Suspense fallback={<LoadingState message="Đang tải báo cáo…" />}>
        <ReportsData searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ReportsData({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { profile } = await requireRole(["manager", "hr_admin", "system_admin"]);
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const filters: ReportFilters = {
    from: params.from ?? today.slice(0, 7) + "-01",
    to: params.to ?? today,
    departmentId: params.departmentId || undefined,
    employeeId: params.employeeId || undefined,
    shiftId: params.shiftId || undefined,
    status: params.status || undefined,
    page: Number(params.page ?? "1"),
  };
  const supabase = await createClient();
  const orgId = profile.organization_id ?? "";
  const [{ rows, total, page, message }, analytics, { data: departments }, { data: shifts }, { data: employees }] = await Promise.all([
    getReport(filters),
    getFullDashboardData(params.date ?? today),
    supabase.from("departments").select("id, name").eq("organization_id", orgId).order("name"),
    supabase.from("work_shifts").select("id, name").eq("organization_id", orgId).order("name"),
    supabase.from("employees").select("id, employee_code, display_name").eq("organization_id", orgId).eq("employment_status", "active").order("employee_code").limit(200),
  ]);

  return (
    <div className="flex flex-col gap-4">
      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {analytics.kpis.map((kpi) => (
          <Card key={kpi.label} className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-full w-1 bg-[var(--brand)]" />
            <div className="p-4">
              <p className="text-sm text-slate-500">{kpi.label}</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{kpi.value.toLocaleString("vi-VN")}</p>
              {kpi.change !== undefined && kpi.change !== 0 && (
                <p className="mt-1 flex items-center gap-1 text-xs font-medium" style={{ color: kpi.trend === "up" && kpi.label.includes("Đi muộn") ? "var(--danger)" : kpi.trend === "down" && kpi.label.includes("Đi muộn") ? "var(--success)" : kpi.trend === "up" ? "var(--success)" : "var(--danger)" }}>
                  <Icon name={kpi.trend === "up" ? "chevron-up" : kpi.trend === "down" ? "chevron-down" : "minus"} size={12} />
                  <span>{kpi.change > 0 ? "+" : ""}{kpi.change}%</span>
                  <span className="text-slate-400">vs hôm qua</span>
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardTitle>Bộ lọc</CardTitle>
        <form method="get" className="mt-2 grid gap-2 sm:grid-cols-6">
          <label className="flex flex-col gap-1 text-sm">Từ ngày<input type="date" name="from" defaultValue={filters.from} className="h-10 rounded-lg border px-2" /></label>
          <label className="flex flex-col gap-1 text-sm">Đến ngày<input type="date" name="to" defaultValue={filters.to} className="h-10 rounded-lg border px-2" /></label>
          <label className="flex flex-col gap-1 text-sm">Phòng ban
            <select name="departmentId" defaultValue={filters.departmentId ?? ""} className="h-10 rounded-lg border px-2">
              <option value="">Tất cả</option>
              {(departments ?? []).map((d) => <option key={d.id as string} value={d.id as string}>{d.name as string}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">Nhân viên
            <select name="employeeId" defaultValue={filters.employeeId ?? ""} className="h-10 rounded-lg border px-2">
              <option value="">Tất cả</option>
              {(employees ?? []).map((e) => <option key={e.id as string} value={e.id as string}>{e.employee_code as string} — {e.display_name as string}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">Ca
            <select name="shiftId" defaultValue={filters.shiftId ?? ""} className="h-10 rounded-lg border px-2">
              <option value="">Tất cả</option>
              {(shifts ?? []).map((s) => <option key={s.id as string} value={s.id as string}>{s.name as string}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">Trạng thái
            <select name="status" defaultValue={filters.status ?? ""} className="h-10 rounded-lg border px-2">
              <option value="">Tất cả</option>
              {["present", "late", "early_leave", "absent", "incomplete"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" size="sm">Lọc</Button>
            <ExportButton filters={filters} />
          </div>
        </form>
        <p className="mt-2 text-xs text-slate-500">Vắng chỉ kết luận khi nhân viên có phân ca phủ ngày xem. Xuất CSV ghi audit.</p>
      </Card>

      {/* Tabs */}
      <Tabs items={[
        { key: "overview", label: "Tổng quan", icon: "home" },
        { key: "analytics", label: "Phân tích", icon: "chart" },
        { key: "exceptions", label: "Ngoại lệ", icon: "alert" },
        { key: "dept", label: "Theo phòng ban", icon: "users" },
        { key: "late", label: "Trễ/Sớm", icon: "clock" },
        { key: "missing", label: "Thiếu chấm", icon: "help" },
      ]} value="overview" onChange={() => {}} />

      {/* Overview Tab */}
      <TabPanel key="overview" value="overview">
        <Card>
          <CardTitle>Chi tiết chấm công</CardTitle>
          <div className="mt-3">
            {!rows ? (
              <ErrorState title="Lỗi tải dữ liệu" description={message ?? "Không xác định"} />
            ) : (
              <>
                <DataTable
                  ariaLabel="Báo cáo chấm công"
                  rows={rows}
                  keyOf={(r) => `${r.work_date}-${r.employee_code}`}
                  emptyTitle="Không có dữ liệu"
                  emptyDescription="Đổi khoảng ngày hoặc bộ lọc."
                  columns={[
                    { key: "date", header: "Ngày", render: (r) => <span className="tnum">{r.work_date}</span> },
                    { key: "emp", header: "Nhân viên", render: (r) => `${r.employee_code} — ${r.display_name}` },
                    { key: "dept", header: "Phòng/Ca", render: (r) => `${r.department} / {r.shift}` },
                    {
                      key: "inout",
                      header: "Vào–Ra",
                      render: (r) => (
                        <span className="tnum">
                          {r.first_in ? new Date(r.first_in).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                          {" – "}
                          {r.last_out ? new Date(r.last_out).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </span>
                      ),
                    },
                    {
                      key: "late",
                      header: "Trễ/Sớm",
                      render: (r) => (r.late_min > 0 ? `Trễ ${r.late_min}′` : r.early_leave_min > 0 ? `Sớm ${r.early_leave_min}′` : r.overtime_min > 0 ? `OT ${r.overtime_min}′` : "—"),
                    },
                    { key: "status", header: "Trạng thái", render: (r) => <StatusIndicator status={STATUS_MAP[r.status] ?? "idle"} /> },
                  ]}
                  cardTitle={(r) => `${r.employee_code} — ${r.display_name}`}
                  cardStatus={(r) => <StatusIndicator status={STATUS_MAP[r.status] ?? "idle"} />}
                  cardMeta={(r) => (
                    <span className="tnum">
                      {r.work_date} · {r.department} / {r.shift} · Vào{" "}
                      {r.first_in ? new Date(r.first_in).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      {" – Ra "}
                      {r.last_out ? new Date(r.last_out).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      {r.overtime_min > 0 ? ` · OT ${r.overtime_min}′` : ""}
                    </span>
                  )}
                />
                <div className="mt-3">
                  <ReportsPagination
                    page={page ?? 1}
                    totalPages={Math.max(1, Math.ceil((total ?? 0) / 20))}
                    total={total ?? 0}
                    label="dòng"
                    baseParams={{
                      from: filters.from,
                      to: filters.to,
                      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
                      ...(filters.shiftId ? { shiftId: filters.shiftId } : {}),
                      ...(filters.status ? { status: filters.status } : {}),
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </Card>
      </TabPanel>

      {/* Analytics Tab */}
      <TabPanel key="analytics" value="analytics">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Time Trend */}
          <Card>
            <CardTitle>Xu hướng chấm công theo giờ</CardTitle>
            <div className="mt-4 h-64">
              <TimeTrendChart data={analytics.timeTrend} />
            </div>
          </Card>

          {/* Shift Distribution */}
          <Card>
            <CardTitle>Phân bổ ca làm hôm nay</CardTitle>
            <div className="mt-4 h-64">
              <ShiftDistributionChart data={analytics.shiftDistribution} />
            </div>
          </Card>

          {/* Department Attendance */}
          <Card className="lg:col-span-2">
            <CardTitle>Chấm công theo phòng ban (hôm nay)</CardTitle>
            <div className="mt-4">
              <DepartmentAttendanceChart data={analytics.departmentAttendance} />
            </div>
          </Card>
        </div>
      </TabPanel>

      {/* Exceptions Tab */}
      <TabPanel key="exceptions" value="exceptions">
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Ngoại lệ cần xử lý</CardTitle>
            <Badge tone={analytics.exceptions.some(e => e.severity === "high") ? "danger" : analytics.exceptions.some(e => e.severity === "medium") ? "warning" : "success"}>
              {analytics.exceptions.length} mục
            </Badge>
          </div>
          <div className="mt-3">
            {analytics.exceptions.length === 0 ? (
              <EmptyState title="Không có ngoại lệ" description="Tất cả hoạt động bình thường." />
            ) : (
              <DataTable
                ariaLabel="Ngoại lệ chấm công"
                rows={analytics.exceptions}
                keyOf={(e) => `${e.type}-${e.employee_code}-${e.date}`}
                emptyTitle="Không có ngoại lệ"
                emptyDescription="Tất cả hoạt động bình thường."
                columns={[
                  { key: "type", header: "Loại", render: (e) => <Badge tone={EXCEPTION_SEVERITY_COLORS[e.severity]}>{EXCEPTION_TYPE_LABELS[e.type] ?? e.type}</Badge> },
                  { key: "severity", header: "Mức độ", render: (e) => <Badge tone={EXCEPTION_SEVERITY_COLORS[e.severity]}>{e.severity === "high" ? "Cao" : e.severity === "medium" ? "Trung bình" : "Thấp"}</Badge> },
                  { key: "emp", header: "Nhân viên", render: (e) => `${e.employee_code} — ${e.employee_name}` },
                  { key: "dept", header: "Phòng ban", render: (e) => e.department },
                  { key: "date", header: "Ngày", render: (e) => <span className="tnum">{e.date}</span> },
                  { key: "detail", header: "Chi tiết", render: (e) => <span className="max-w-64 truncate text-xs">{e.detail}</span> },
                  {
                    key: "action",
                    header: <span className="sr-only">Xử lý</span>,
                    render: (e) => e.link ? (
                      <Button size="sm" variant="secondary" onClick={() => { if (e.link) window.location.href = e.link; }}>Xử lý</Button>
                    ) : null,
                  },
                ]}
                cardTitle={(e) => `${e.employee_code} — ${e.employee_name}`}
                cardMeta={(e) => `${e.date} · ${e.department ?? "—"} · ${e.detail}`}
                cardStatus={(e) => <Badge tone={EXCEPTION_SEVERITY_COLORS[e.severity]}>{EXCEPTION_TYPE_LABELS[e.type] ?? e.type}</Badge>}
                cardActions={(e) => e.link ? <Button size="sm" variant="secondary" onClick={() => { if (e.link) window.location.href = e.link; }}>Xử lý</Button> : undefined}
              />
            )}
          </div>
        </Card>
      </TabPanel>

      {/* Department Summary Tab */}
      <TabPanel key="dept" value="dept">
        <Suspense fallback={<LoadingState message="Đang tải tổng hợp phòng ban…" />}>
          <DepartmentSummaryTable filters={filters} />
        </Suspense>
      </TabPanel>

      {/* Late/Early Tab */}
      <TabPanel key="late" value="late">
        <Suspense fallback={<LoadingState message="Đang tải báo cáo trễ/sớm…" />}>
          <LateEarlyTable filters={filters} />
        </Suspense>
      </TabPanel>

      {/* Missing Check Tab */}
      <TabPanel key="missing" value="missing">
        <Suspense fallback={<LoadingState message="Đang tải báo cáo thiếu chấm…" />}>
          <MissingCheckTable filters={filters} />
        </Suspense>
      </TabPanel>

    </div>
  );
}

// ============================ Chart Components ============================

function TimeTrendChart({ data }: { data: Array<{ hour: number; checkins: number; checkouts: number }> }) {
  // Simple bar chart using CSS
  const maxVal = Math.max(...data.map(d => Math.max(d.checkins, d.checkouts)), 1);
  return (
    <div className="flex items-end justify-between h-full gap-1 px-2">
      {data.map((d) => {
        const heightPct = (Math.max(d.checkins, d.checkouts) / maxVal) * 100;
        return (
          <div key={d.hour} className="flex-1 flex flex-col items-center justify-end gap-1">
            <div className="w-full flex gap-1 justify-center" style={{ height: `${heightPct}%` }}>
              {d.checkins > 0 && (
                <div className="flex-1 bg-[var(--brand)] rounded-t" title={`Check-in: ${d.checkins}`} />
              )}
              {d.checkouts > 0 && (
                <div className="flex-1 bg-[var(--success)] rounded-t" title={`Check-out: ${d.checkouts}`} />
              )}
            </div>
            <span className="text-[10px] text-slate-400">{d.hour}:00</span>
          </div>
        );
      })}
    </div>
  );
}

function ShiftDistributionChart({ data }: { data: Array<{ shift: string; count: number }> }) {
  const total = data.reduce((sum, d) => sum + d.count, 0) || 1;
  return (
    <div className="flex flex-col gap-2 items-center justify-center h-full px-4">
      {data.length === 0 ? (
        <EmptyState title="Chưa có phân ca" description="Hôm nay không có nhân viên được phân ca." />
      ) : (
        data.map((d) => (
          <div key={d.shift} className="w-full flex items-center gap-3">
            <span className="w-28 text-sm text-slate-600 truncate">{d.shift}</span>
            <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--brand)] rounded-full transition-all"
                style={{ width: `${(d.count / total) * 100}%` }}
              />
            </div>
            <span className="w-16 text-right text-sm font-medium tnum">{d.count}</span>
          </div>
        ))
      )}
    </div>
  );
}

function DepartmentAttendanceChart({ data }: { data: Array<{ department: string; present: number; late: number; early_leave: number; absent: number; incomplete: number }> }) {
  if (data.length === 0) {
    return <EmptyState title="Chưa có dữ liệu" description="Hôm nay không có dữ liệu chấm công theo phòng ban." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-3 py-2 text-left font-medium text-slate-600">Phòng ban</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600">Đúng giờ</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600 text-[var(--warning)]">Trễ</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600 text-[var(--danger)]">Về sớm</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600 text-[var(--danger)]">Vắng</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600">Chưa hoàn tất</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600">Tổng</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((d) => {
            const total = d.present + d.late + d.early_leave + d.absent + d.incomplete;
            return (
              <tr key={d.department}>
                <td className="px-3 py-2 font-medium">{d.department}</td>
                <td className="px-3 py-2 text-right text-[var(--success)]">{d.present}</td>
                <td className="px-3 py-2 text-right text-[var(--warning)]">{d.late}</td>
                <td className="px-3 py-2 text-right text-[var(--danger)]">{d.early_leave}</td>
                <td className="px-3 py-2 text-right text-[var(--danger)]">{d.absent}</td>
                <td className="px-3 py-2 text-right text-slate-500">{d.incomplete}</td>
                <td className="px-3 py-2 text-right font-medium">{total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================ Department Summary Table ============================

async function DepartmentSummaryTable({ filters }: { filters: ReportFilters }) {
  const { getDepartmentSummary } = await import("@/features/reports/actions");
  const res = await getDepartmentSummary(filters);

  if (!res.ok) return <ErrorState title="Lỗi" description={res.message} />;

  return (
    <Card>
      <CardTitle>Tổng hợp theo phòng ban</CardTitle>
      <div className="mt-3">
        {res.rows && res.rows.length > 0 ? (
          <DataTable
            ariaLabel="Tổng hợp phòng ban"
            rows={res.rows}
            keyOf={(r) => r.department}
            emptyTitle="Không có dữ liệu"
            emptyDescription="Thử thay đổi bộ lọc."
            columns={[
              { key: "dept", header: "Phòng ban", render: (r) => <span className="font-medium">{r.department}</span> },
              { key: "total", header: "Tổng NV", render: (r) => <span className="tnum">{r.total_employees}</span> },
              { key: "present", header: "Đúng giờ", render: (r) => <span className="tnum text-[var(--success)]">{r.present}</span> },
              { key: "late", header: "Trễ", render: (r) => <span className="tnum text-[var(--warning)]">{r.late}</span> },
              { key: "early", header: "Về sớm", render: (r) => <span className="tnum text-[var(--danger)]">{r.early_leave}</span> },
              { key: "absent", header: "Vắng", render: (r) => <span className="tnum text-[var(--danger)]">{r.absent}</span> },
              { key: "incomplete", header: "Chưa xong", render: (r) => <span className="tnum">{r.incomplete}</span> },
              { key: "avg", header: "TB làm/ngày", render: (r) => <span className="tnum">{Math.round(r.avg_work_min / 60 * 10) / 10}h</span> },
              { key: "ot", header: "Tổng OT", render: (r) => <span className="tnum text-[var(--info)]">{Math.round(r.total_overtime_min / 60 * 10) / 10}h</span> },
            ]}
            cardTitle={(r) => r.department}
            cardMeta={(r) => `NV: ${r.total_employees} · Đúng giờ: ${r.present} · Trễ: ${r.late} · OT: ${Math.round(r.total_overtime_min / 60 * 10) / 10}h`}
          />
        ) : (
          <EmptyState title="Không có dữ liệu" description="Thử thay đổi bộ lọc." />
        )}
      </div>
    </Card>
  );
}

// ============================ Late/Early Table ============================

async function LateEarlyTable({ filters }: { filters: ReportFilters }) {
  const { getLateEarlyReport } = await import("@/features/reports/actions");
  const res = await getLateEarlyReport(filters);

  if (!res.ok) return <ErrorState title="Lỗi" description={res.message} />;

  return (
    <Card>
      <CardTitle>Báo cáo đi trễ / về sớm</CardTitle>
      <div className="mt-3">
        {res.rows && res.rows.length > 0 ? (
          <DataTable
            ariaLabel="Báo cáo trễ/sớm"
            rows={res.rows}
            keyOf={(r) => `${r.work_date}-${r.employee_code}`}
            emptyTitle="Không có nhân viên đi trễ/về sớm"
            emptyDescription="Trong khoảng thời gian này không ai đi trễ hay về sớm."
            columns={[
              { key: "date", header: "Ngày", render: (r) => <span className="tnum">{r.work_date}</span> },
              { key: "emp", header: "Nhân viên", render: (r) => `${r.employee_code} — ${r.display_name}` },
              { key: "dept", header: "Phòng ban", render: (r) => r.department },
              { key: "shift", header: "Ca", render: (r) => r.shift },
              { key: "late", header: "Trễ (phút)", render: (r) => r.late_min > 0 ? <span className="tnum text-[var(--warning)] font-medium">{r.late_min}</span> : "—" },
              { key: "early", header: "Về sớm (phút)", render: (r) => r.early_leave_min > 0 ? <span className="tnum text-[var(--danger)] font-medium">{r.early_leave_min}</span> : "—" },
              { key: "status", header: "Trạng thái", render: (r) => <StatusIndicator status={STATUS_MAP[r.status] ?? "idle"} /> },
            ]}
            cardTitle={(r) => `${r.employee_code} — ${r.display_name}`}
            cardMeta={(r) => `${r.work_date} · ${r.department ?? "—"} / ${r.shift ?? "—"}`}
            cardStatus={(r) => <StatusIndicator status={STATUS_MAP[r.status] ?? "idle"} />}
          />
        ) : (
          <EmptyState title="Không có dữ liệu" description="Trong khoảng thời gian này không ai đi trễ hay về sớm." />
        )}
      </div>
    </Card>
  );
}

// ============================ Missing Check Table ============================

async function MissingCheckTable({ filters }: { filters: ReportFilters }) {
  const { getMissingCheckReport } = await import("@/features/reports/actions");
  const res = await getMissingCheckReport(filters);

  if (!res.ok) return <ErrorState title="Lỗi" description={res.message} />;

  return (
    <Card>
      <CardTitle>Báo cáo thiếu check-in / check-out</CardTitle>
      <div className="mt-3">
        {res.rows && res.rows.length > 0 ? (
          <DataTable
            ariaLabel="Báo cáo thiếu chấm công"
            rows={res.rows}
            keyOf={(r) => `${r.work_date}-${r.employee_code}`}
            emptyTitle="Không có thiếu chấm công"
            emptyDescription="Tất cả nhân viên đã check-in và check-out đầy đủ."
            columns={[
              { key: "date", header: "Ngày", render: (r) => <span className="tnum">{r.work_date}</span> },
              { key: "emp", header: "Nhân viên", render: (r) => `${r.employee_code} — ${r.display_name}` },
              { key: "dept", header: "Phòng ban", render: (r) => r.department },
              { key: "shift", header: "Ca", render: (r) => r.shift },
              { key: "in", header: "Check-in", render: (r) => r.has_checkin ? <Badge tone="success">✓</Badge> : <Badge tone="danger">✗</Badge> },
              { key: "out", header: "Check-out", render: (r) => r.has_checkout ? <Badge tone="success">✓</Badge> : <Badge tone="danger">✗</Badge> },
              { key: "status", header: "Trạng thái", render: (r) => <StatusIndicator status={STATUS_MAP[r.status] ?? "idle"} /> },
            ]}
            cardTitle={(r) => `${r.employee_code} — ${r.display_name}`}
            cardMeta={(r) => `${r.work_date} · ${r.department ?? "—"} / ${r.shift ?? "—"} · In: ${r.has_checkin ? "✓" : "✗"} Out: ${r.has_checkout ? "✓" : "✗"}`}
            cardStatus={(r) => <StatusIndicator status={STATUS_MAP[r.status] ?? "idle"} />}
          />
        ) : (
          <EmptyState title="Không có thiếu chấm công" description="Tất cả nhân viên đã check-in và check-out đầy đủ." />
        )}
      </div>
    </Card>
  );
}