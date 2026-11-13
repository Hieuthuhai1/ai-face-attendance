"use server";

import { cache } from "react";
import { requireRole, requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInZone } from "@/lib/datetime";
import { zonedStartOfDayIso } from "@/lib/attendance/rules";
import { APP_TZ } from "@/config/app";
import {
  addDays,
  bucketTrendDays,
  buildTrendDays,
  startOfMonth,
  sumTrendDays,
  takeLast,
  type ShiftAssignmentRow,
  type AttendanceSummaryRow,
  type LeaveRangeRow,
  type TrendBucket,
  type TrendDay,
  type TrendTotals,
} from "@/lib/dashboard/trends";
import type { Role } from "@/types/db";

type Db = Awaited<ReturnType<typeof createClient>>;
const REVIEW_ROLES: Role[] = ["manager", "hr_admin", "system_admin"];

interface Scope {
  orgId: string;
  employeeIds: string[] | null;
  ownEmployeeId: string | null;
}

async function myEmployee(supabase: Db, userId: string) {
  const { data } = await supabase
    .from("employees")
    .select("id, organization_id")
    .eq("profile_id", userId)
    .single();
  return (data as { id: string; organization_id: string } | null) ?? null;
}

/**
 * Phạm vi dữ liệu theo role. Bọc `cache()` để một request (dashboard gọi
 * 8 server action song song) chỉ query employee/team MỘT lần thay vì 9 lần.
 * Client Supabase được tạo bên trong để cache key chỉ gồm tham số ổn định.
 */
const reportScope = cache(
  async (userId: string, role: Role, orgId: string): Promise<Scope> => {
    const supabase = await createClient();
    const me = await myEmployee(supabase, userId);
    if (role === "manager") {
      const { data: team } = await supabase
        .from("employees")
        .select("id")
        .eq("manager_id", me?.id ?? "");
      const ids = ((team ?? []) as Array<{ id: string }>).map((t) => t.id);
      if (me) ids.push(me.id);
      return { orgId, employeeIds: ids, ownEmployeeId: me?.id ?? null };
    }
    return { orgId, employeeIds: null, ownEmployeeId: me?.id ?? null };
  },
);

// ============================================================
// Dashboard Data Types
// ============================================================

export interface DashboardKPI {
  label: string;
  value: number | null;
  change?: number; // percentage change vs previous period
  trend?: "up" | "down" | "neutral";
  description: string;
  href?: string;
  icon: string;
  color: "primary" | "success" | "warning" | "danger" | "info";
  /** Cách hiển thị giá trị: số nguyên hoặc phần trăm. */
  format?: "number" | "percent";
}

export interface LiveActivityEvent {
  id: string;
  employee_code: string;
  display_name: string;
  department: string;
  event_type: "check_in" | "check_out";
  method: "face" | "pin_fallback" | "manual";
  status: "success" | "pending_review" | "failed" | "fallback";
  occurred_at: string;
  confidence?: number | null;
  liveness_status?: string | null;
}

export interface ExceptionItem {
  id: string;
  type: "unverified_checkin" | "missing_checkout" | "off_shift" | "pending_review" | "adjustment_pending";
  employee_code: string;
  display_name: string;
  department: string;
  shift_name: string;
  work_date: string;
  occurred_at?: string;
  detail: string;
  severity: "high" | "medium" | "low";
  href: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  category?: string;
}

export interface ShiftDistributionPoint {
  shift_name: string;
  count: number;
  color: string;
}

export interface DepartmentAttendancePoint {
  department: string;
  present: number;
  late: number;
  absent: number;
  early_leave: number;
}

export interface TimeTrendPoint {
  hour: string;
  check_ins: number;
  check_outs: number;
}

export interface DashboardFilters {
  date?: string;
  departmentId?: string;
  shiftId?: string;
  employeeId?: string;
  status?: string;
  /** Khoảng thời gian cho biểu đồ: hôm nay / 7 ngày / 30 ngày / tháng này. */
  range?: DashboardRange;
  /** Nhóm biểu đồ tuần hay tháng. */
  bucket?: TrendBucketGranularity;
}

export type DashboardRange = "today" | "7d" | "30d" | "month";
export type TrendBucketGranularity = "week" | "month";

export interface DashboardTrends {
  range: { from: string; to: string; label: string };
  daily: TrendDay[];
  period: TrendTotals;
  weekly: TrendBucket[];
  monthly: TrendBucket[];
  /** true khi khối lượng bản ghi vượt giới hạn đọc — số liệu có thể chưa đủ. */
  truncated: boolean;
}

export interface FilterOption {
  id: string;
  label: string;
}

export interface DashboardFilterOptions {
  departments: FilterOption[];
  shifts: FilterOption[];
}

export interface DashboardData {
  kpis: DashboardKPI[];
  liveActivity: LiveActivityEvent[];
  exceptions: ExceptionItem[];
  timeTrend: TimeTrendPoint[];
  shiftDistribution: ShiftDistributionPoint[];
  departmentAttendance: DepartmentAttendancePoint[];
  trends: DashboardTrends;
  filterOptions: DashboardFilterOptions;
  lastUpdated: string;
  filters: DashboardFilters;
}

// ============================================================
// Helper functions
// ============================================================

/**
 * Biên ngày theo múi giờ ứng dụng (không phải UTC).
 *
 * Vì sao: `new Date("2026-11-05T00:00:00")` trên server UTC tạo instant
 * 00:00 UTC = 07:00 giờ Việt Nam, làm sự kiện 00:00–07:00 bị tính sang ngày
 * hôm trước. Dùng helper sẵn có của phần chấm công để khớp `work_date`.
 */
function getDateRange(date: string) {
  const start = zonedStartOfDayIso(date, APP_TZ);
  const end = new Date(new Date(start).getTime() + 86_400_000 - 1).toISOString();
  return { start, end };
}

function getPreviousDateRange(date: string) {
  return getDateRange(addDays(date, -1));
}

const EMPTY_IDS = ["00000000-0000-0000-0000-000000000000"];
/** Số ngày dữ liệu nền để dựng biểu đồ tuần (8 tuần) / tháng (6 tháng). */
const TREND_WINDOW_DAYS = 180;

function resolveDateRange(
  date: string,
  range: DashboardRange = "today",
): { from: string; to: string; label: string } {
  const to = date;
  if (range === "month") {
    return { from: startOfMonth(date), to, label: "Tháng này" };
  }
  if (range === "7d") return { from: addDays(date, -6), to, label: "7 ngày gần nhất" };
  if (range === "30d") return { from: addDays(date, -29), to, label: "30 ngày gần nhất" };
  return { from: date, to, label: "Hôm nay" };
}

interface PagedRows<T> {
  rows: T[];
  truncated: boolean;
}

/**
 * Đọc toàn bộ bản ghi qua phân trang (PostgREST giới hạn số dòng mỗi request).
 * `maxPages` chặn trường hợp bất thường; khi vượt ngưỡng, trả `truncated: true`
 * để UI nói rõ số liệu có thể chưa đầy đủ thay vì hiển thị sai.
 */
async function fetchAllRows<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  pageSize = 1000,
  maxPages = 40,
): Promise<PagedRows<T>> {
  const rows: T[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as T[];
    rows.push(...chunk);
    if (chunk.length < pageSize) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

async function activeEmployeeIds(supabase: Db, scope: Scope): Promise<string[]> {
  let query = supabase
    .from("employees")
    .select("id")
    .eq("organization_id", scope.orgId)
    .eq("employment_status", "active");
  if (scope.employeeIds) {
    query = query.in("id", scope.employeeIds.length > 0 ? scope.employeeIds : EMPTY_IDS);
  }
  const { data } = await query;
  return ((data ?? []) as Array<{ id: string }>).map((e) => e.id);
}

// ============================================================
// Server Actions
// ============================================================

export async function getDashboardKPIs(filters: DashboardFilters): Promise<{
  ok: boolean;
  kpis?: DashboardKPI[];
  message?: string;
}> {
  const { userId, profile } = await requireRole(REVIEW_ROLES);
  const supabase = await createClient();
  const day = filters.date ?? todayInZone();
  const scope = await reportScope(userId, profile.role, profile.organization_id ?? "");
  const { start, end } = getDateRange(day);

  try {
    // Get active employees in scope
    let empQuery = supabase
      .from("employees")
      .select("id")
      .eq("organization_id", scope.orgId)
      .eq("employment_status", "active");
    if (scope.employeeIds) {
      empQuery = empQuery.in("id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }
    const { data: employees } = await empQuery;
    const empIds = ((employees ?? []) as Array<{ id: string }>).map((e) => e.id);
    const totalActive = empIds.length;

    // Các query dưới đây không phụ thuộc nhau → chạy song song.
    // Trước đây chúng chạy tuần tự (12 round-trip) nên TTFB dashboard ~1s.
    let assignedQuery = supabase
      .from("shift_assignments")
      .select("employee_id, work_shifts(name)")
      .eq("organization_id", scope.orgId)
      .lte("effective_from", day)
      .or(`effective_to.is.null,effective_to.gte.${day}`)
      .in("employee_id", empIds.length > 0 ? empIds : ["00000000-0000-0000-0000-000000000000"]);

    // Get attendance summaries for today
    let sumQuery = supabase
      .from("attendance_daily_summaries")
      .select("employee_id, status, first_in, late_min, early_leave_min")
      .eq("organization_id", scope.orgId)
      .eq("work_date", day);
    if (scope.employeeIds) {
      sumQuery = sumQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }

    // Get previous day summaries for comparison
    const prevDay = addDays(day, -1);
    let prevSumQuery = supabase
      .from("attendance_daily_summaries")
      .select("employee_id, status, first_in")
      .eq("organization_id", scope.orgId)
      .eq("work_date", prevDay);
    if (scope.employeeIds) {
      prevSumQuery = prevSumQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }

    // Phân ca của ngày trước (để so sánh tỷ lệ đúng ngữ cảnh, không dùng
    // phân ca hôm nay làm mẫu số cho hôm qua).
    let prevAssignedQuery = supabase
      .from("shift_assignments")
      .select("employee_id")
      .eq("organization_id", scope.orgId)
      .lte("effective_from", prevDay)
      .or(`effective_to.is.null,effective_to.gte.${prevDay}`)
      .in("employee_id", empIds.length > 0 ? empIds : ["00000000-0000-0000-0000-000000000000"]);

    let prevLeaveQuery = supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", scope.orgId)
      .eq("status", "approved")
      .lte("start_date", prevDay)
      .gte("end_date", prevDay);
    if (scope.employeeIds) {
      prevLeaveQuery = prevLeaveQuery.in(
        "employee_id",
        scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"],
      );
    }

    // Pending review events
    let evQuery = supabase
      .from("attendance_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", scope.orgId)
      .in("status", ["pending_review", "fallback"])
      .gte("occurred_at", start)
      .lte("occurred_at", end);
    if (scope.employeeIds) {
      evQuery = evQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }

    // Pending enrollments
    let enrollQuery = supabase
      .from("face_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", scope.orgId)
      .eq("status", "pending");
    if (scope.employeeIds) {
      enrollQuery = enrollQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }

    // Pending adjustments
    let adjQuery = supabase
      .from("attendance_adjustment_requests")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", scope.orgId)
      .eq("status", "pending");
    if (scope.employeeIds) {
      adjQuery = adjQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }

    // Pending leave
    let leaveQuery = supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", scope.orgId)
      .eq("status", "pending");
    if (scope.employeeIds) {
      leaveQuery = leaveQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }

    // On leave today (approved leave covering today)
    let onLeaveQuery = supabase
      .from("leave_requests")
      .select("employee_id", { count: "exact", head: true })
      .eq("organization_id", scope.orgId)
      .eq("status", "approved")
      .lte("start_date", day)
      .gte("end_date", day);
    if (scope.employeeIds) {
      onLeaveQuery = onLeaveQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }

    // Working now (checked in but not checked out)
    let workingNowQuery = supabase
      .from("attendance_events")
      .select("employee_id")
      .eq("organization_id", scope.orgId)
      .eq("event_type", "check_in")
      .eq("status", "success")
      .gte("occurred_at", start)
      .lte("occurred_at", end);
    if (scope.employeeIds) {
      workingNowQuery = workingNowQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }

    let checkOutQuery = supabase
      .from("attendance_events")
      .select("employee_id")
      .eq("organization_id", scope.orgId)
      .eq("event_type", "check_out")
      .eq("status", "success")
      .gte("occurred_at", start)
      .lte("occurred_at", end);
    if (scope.employeeIds) {
      checkOutQuery = checkOutQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }

    const [
      { data: assigned },
      { data: summaries },
      { data: prevSummaries },
      { data: prevAssigned },
      { count: prevOnLeave },
      { count: pendingReview },
      { count: pendingEnroll },
      { count: pendingAdj },
      { count: pendingLeave },
      { count: onLeave },
      { data: checkIns },
      { data: checkOuts },
    ] = await Promise.all([
      assignedQuery,
      sumQuery,
      prevSumQuery,
      prevAssignedQuery,
      prevLeaveQuery,
      evQuery,
      enrollQuery,
      adjQuery,
      leaveQuery,
      onLeaveQuery,
      workingNowQuery,
      checkOutQuery,
    ]);

    const assignedIds = new Set(((assigned ?? []) as Array<{ employee_id: string }>).map((a) => a.employee_id));
    const sums = (summaries ?? []) as Array<{ employee_id: string; status: string; first_in: string | null; late_min: number; early_leave_min: number }>;
    const checkedIds = new Set(sums.filter((s) => s.first_in !== null).map((s) => s.employee_id));
    const prevSums = (prevSummaries ?? []) as Array<{ employee_id: string; status: string; first_in: string | null }>;
    const prevCheckedIds = new Set(prevSums.filter((s) => s.first_in !== null).map((s) => s.employee_id));
    const prevAssignedIds = new Set(
      ((prevAssigned ?? []) as Array<{ employee_id: string }>).map((a) => a.employee_id),
    );

    // Calculate KPIs
    const checkedIn = checkedIds.size;
    const late = sums.filter((s) => s.status === "late").length;

    const onLeaveCount = onLeave ?? 0;

    // Vắng mặt = có ca nhưng không chấm công, trừ người đã có đơn nghỉ duyệt.
    const absent = Math.max(0, assignedIds.size - checkedIn - onLeaveCount);
    // Tỷ lệ chuyên cần = đã chấm công / số nhân viên có ca (null khi chưa phân ca).
    const attendanceRate =
      assignedIds.size > 0 ? Math.round((checkedIn / assignedIds.size) * 100) : null;

    const checkInIds = new Set(((checkIns ?? []) as Array<{ employee_id: string }>).map((e) => e.employee_id));
    const checkOutIds = new Set(((checkOuts ?? []) as Array<{ employee_id: string }>).map((e) => e.employee_id));

    const workingNow = [...checkInIds].filter(id => !checkOutIds.has(id)).length;

    // Calculate percentage changes
    const prevCheckedIn = prevCheckedIds.size;
    const prevLate = prevSums.filter((s) => s.status === "late").length;
    const prevAbsent = Math.max(
      0,
      prevAssignedIds.size - prevCheckedIn - (prevOnLeave ?? 0),
    );
    const prevAttendanceRate =
      prevAssignedIds.size > 0
        ? Math.round((prevCheckedIn / prevAssignedIds.size) * 100)
        : null;

    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const kpis: DashboardKPI[] = [
      {
        label: "Tổng số nhân viên",
        value: totalActive,
        change: 0,
        trend: "neutral",
        description: `${totalActive} nhân viên đang hoạt động trong phạm vi`,
        icon: "users",
        color: "primary",
        href: "/admin/employees",
      },
      {
        label: "Đã chấm công hôm nay",
        value: checkedIn,
        change: calcChange(checkedIn, prevCheckedIn),
        trend: checkedIn >= prevCheckedIn ? "up" : "down",
        description: `${checkedIn}/${assignedIds.size} nhân viên có ca đã chấm công`,
        icon: "user-check",
        color: "success",
        href: "/reports",
      },
      {
        label: "Đi muộn",
        value: late,
        change: calcChange(late, prevLate),
        trend: late <= prevLate ? "up" : "down",
        description: `${late} lượt check-in sau giờ quy định`,
        icon: "clock",
        color: "warning",
        href: "/reports",
      },
      {
        label: "Vắng mặt",
        value: absent,
        change: calcChange(absent, prevAbsent),
        trend: absent <= prevAbsent ? "up" : "down",
        description: `${absent} nhân viên có ca nhưng không chấm công`,
        icon: "x",
        color: "danger",
        href: "/reports",
      },
      {
        label: "Đang nghỉ phép",
        value: onLeaveCount,
        change: 0,
        trend: "neutral",
        description: `${onLeaveCount} nhân viên có đơn nghỉ đã duyệt hôm nay`,
        icon: "calendar",
        color: "info",
        href: "/leave",
      },
      {
        label: "Tỷ lệ chuyên cần",
        value: attendanceRate,
        change:
          attendanceRate !== null && prevAttendanceRate !== null
            ? calcChange(attendanceRate, prevAttendanceRate)
            : 0,
        trend:
          attendanceRate === null || prevAttendanceRate === null
            ? "neutral"
            : attendanceRate >= prevAttendanceRate
              ? "up"
              : "down",
        description:
          assignedIds.size > 0
            ? `Trên ${assignedIds.size} nhân viên có ca hôm nay`
            : "Chưa có nhân viên nào được phân ca hôm nay",
        icon: "chart",
        color: "primary",
        href: "/reports",
        format: "percent",
      },
      {
        label: "Đang làm việc",
        value: workingNow,
        change: 0,
        trend: "neutral",
        description: "Đã check-in nhưng chưa check-out",
        icon: "user",
        color: "success",
        href: "/reports",
      },
      {
        label: "Chờ xử lý",
        value: (pendingReview ?? 0) + (pendingEnroll ?? 0) + (pendingAdj ?? 0) + (pendingLeave ?? 0),
        change: 0,
        trend: "neutral",
        description: "Sự kiện chờ rà soát, enroll, chỉnh công, đơn nghỉ",
        icon: "flag",
        color: "warning",
        href: "/approval",
      },
    ];

    return { ok: true, kpis };
  } catch (error) {
    console.error("getDashboardKPIs error:", error);
    return { ok: false, message: "Không thể tải dữ liệu KPI" };
  }
}

export async function getLiveActivity(filters: DashboardFilters, limit = 20): Promise<{
  ok: boolean;
  events?: LiveActivityEvent[];
  message?: string;
}> {
  const { userId, profile } = await requireRole(REVIEW_ROLES);
  const supabase = await createClient();
  const day = filters.date ?? todayInZone();
  const scope = await reportScope(userId, profile.role, profile.organization_id ?? "");
  const { start, end } = getDateRange(day);

  try {
    let query = supabase
      .from("attendance_events")
      .select(`
        id,
        event_type,
        method,
        status,
        occurred_at,
        confidence,
        liveness_status,
        employee_id,
        employees!inner(
          employee_code,
          profile_id,
          department_id,
          departments(name),
          profiles!employees_profile_id_fkey(display_name)
        )
      `)
      .eq("organization_id", scope.orgId)
      .gte("occurred_at", start)
      .lte("occurred_at", end)
      .order("occurred_at", { ascending: false })
      .limit(limit);

    if (scope.employeeIds) {
      query = query.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }
    if (filters.departmentId) {
      query = query.eq("employees.department_id", filters.departmentId);
    }
    if (filters.shiftId) {
      // Would need to join shift_assignments, skipping for simplicity
    }
    if (filters.employeeId) {
      query = query.eq("employee_id", filters.employeeId);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const events: LiveActivityEvent[] = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((e) => {
      const emp = e.employees as {
        employee_code: string;
        profiles: { display_name: string } | null;
        departments: { name: string } | null;
      };
      return {
        id: e.id as string,
        employee_code: emp?.employee_code ?? "?",
        display_name: emp?.profiles?.display_name ?? "",
        department: emp?.departments?.name ?? "—",
        event_type: e.event_type as "check_in" | "check_out",
        method: e.method as "face" | "pin_fallback" | "manual",
        status: e.status as "success" | "pending_review" | "failed" | "fallback",
        occurred_at: e.occurred_at as string,
        confidence: (e.confidence as number) ?? null,
        liveness_status: (e.liveness_status as string) ?? null,
      };
    });

    return { ok: true, events };
  } catch (error) {
    console.error("getLiveActivity error:", error);
    return { ok: false, message: "Không thể tải hoạt động gần đây" };
  }
}

export async function getExceptions(filters: DashboardFilters): Promise<{
  ok: boolean;
  exceptions?: ExceptionItem[];
  message?: string;
}> {
  const { userId, profile } = await requireRole(REVIEW_ROLES);
  const supabase = await createClient();
  const day = filters.date ?? todayInZone();
  const scope = await reportScope(userId, profile.role, profile.organization_id ?? "");
  const { start, end } = getDateRange(day);

  try {
    const exceptions: ExceptionItem[] = [];

    // 1. Unverified check-ins (pending_review + fallback)
    let unverifiedQuery = supabase
      .from("attendance_events")
      .select(`
        id,
        event_type,
        status,
        occurred_at,
        employee_id,
        employees!inner(
          employee_code,
          profile_id,
          department_id,
          departments(name),
          profiles!employees_profile_id_fkey(display_name),
          shift_assignments!employee_id(
            work_shifts(name),
            effective_from,
            effective_to
          )
        )
      `)
      .eq("organization_id", scope.orgId)
      .in("status", ["pending_review", "fallback"])
      .gte("occurred_at", start)
      .lte("occurred_at", end);
    if (scope.employeeIds) {
      unverifiedQuery = unverifiedQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }
    const { data: unverified } = await unverifiedQuery;
    ((unverified ?? []) as unknown as Array<Record<string, unknown>>).forEach((e) => {
      const emp = e.employees as {
        employee_code: string;
        profiles: { display_name: string } | null;
        departments: { name: string } | null;
        shift_assignments: Array<{ work_shifts: { name: string } | null; effective_from: string; effective_to: string | null }> | null;
      };
      const shiftName = emp?.shift_assignments?.[0]?.work_shifts?.name ?? "—";
      exceptions.push({
        id: `unverified-${e.id}`,
        type: "unverified_checkin",
        employee_code: emp?.employee_code ?? "?",
        display_name: emp?.profiles?.display_name ?? "",
        department: emp?.departments?.name ?? "—",
        shift_name: shiftName,
        work_date: day,
        occurred_at: e.occurred_at as string,
        detail: `Chấm công ${e.event_type === "check_in" ? "vào" : "ra"} ${e.status === "pending_review" ? "độ khớp thấp" : "phương thức thay thế"} cần rà soát`,
        severity: "high",
        href: `/reports?date=${day}&status=pending_review`,
      });
    });

    // 2. Missing check-out (checked in but no check-out)
    let checkInQuery = supabase
      .from("attendance_events")
      .select("employee_id, occurred_at, employees!inner(employee_code, profile_id, department_id, departments(name), profiles!employees_profile_id_fkey(display_name), shift_assignments!employee_id(work_shifts(name), effective_from, effective_to))")
      .eq("organization_id", scope.orgId)
      .eq("event_type", "check_in")
      .eq("status", "success")
      .gte("occurred_at", start)
      .lte("occurred_at", end);
    if (scope.employeeIds) {
      checkInQuery = checkInQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }
    const { data: checkIns } = await checkInQuery;

    let checkOutQuery = supabase
      .from("attendance_events")
      .select("employee_id")
      .eq("organization_id", scope.orgId)
      .eq("event_type", "check_out")
      .eq("status", "success")
      .gte("occurred_at", start)
      .lte("occurred_at", end);
    if (scope.employeeIds) {
      checkOutQuery = checkOutQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }
    const { data: checkOuts } = await checkOutQuery;
    const checkOutIds = new Set(((checkOuts ?? []) as Array<{ employee_id: string }>).map((e) => e.employee_id));

    ((checkIns ?? []) as unknown as Array<Record<string, unknown>>).forEach((e) => {
      if (!checkOutIds.has(e.employee_id as string)) {
        const emp = e.employees as {
          employee_code: string;
          profiles: { display_name: string } | null;
          departments: { name: string } | null;
          shift_assignments: Array<{ work_shifts: { name: string } | null; effective_from: string; effective_to: string | null }> | null;
        };
        const shiftName = emp?.shift_assignments?.[0]?.work_shifts?.name ?? "—";
        exceptions.push({
          id: `missing-checkout-${e.employee_id}`,
          type: "missing_checkout",
          employee_code: emp?.employee_code ?? "?",
          display_name: emp?.profiles?.display_name ?? "",
          department: emp?.departments?.name ?? "—",
          shift_name: shiftName,
          work_date: day,
          occurred_at: e.occurred_at as string,
          detail: "Đã check-in nhưng chưa check-out",
          severity: "medium",
          href: `/reports?date=${day}`,
        });
      }
    });

    // 3. Pending review events
    let pendingReviewQuery = supabase
      .from("attendance_events")
      .select(`
        id,
        event_type,
        status,
        occurred_at,
        employee_id,
        employees!inner(
          employee_code,
          profile_id,
          department_id,
          departments(name),
          profiles!employees_profile_id_fkey(display_name),
          shift_assignments!employee_id(work_shifts(name))
        )
      `)
      .eq("organization_id", scope.orgId)
      .eq("status", "pending_review")
      .gte("occurred_at", start)
      .lte("occurred_at", end);
    if (scope.employeeIds) {
      pendingReviewQuery = pendingReviewQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }
    const { data: pendingReview } = await pendingReviewQuery;
    ((pendingReview ?? []) as unknown as Array<Record<string, unknown>>).forEach((e) => {
      const emp = e.employees as {
        employee_code: string;
        profiles: { display_name: string } | null;
        departments: { name: string } | null;
        shift_assignments: Array<{ work_shifts: { name: string } | null }> | null;
      };
      const shiftName = emp?.shift_assignments?.[0]?.work_shifts?.name ?? "—";
      exceptions.push({
        id: `pending-review-${e.id}`,
        type: "pending_review",
        employee_code: emp?.employee_code ?? "?",
        display_name: emp?.profiles?.display_name ?? "",
        department: emp?.departments?.name ?? "—",
        shift_name: shiftName,
        work_date: day,
        occurred_at: e.occurred_at as string,
        detail: `Chấm công ${e.event_type === "check_in" ? "vào" : "ra"} độ khớp thấp cần HR rà soát`,
        severity: "high",
        href: `/reports?date=${day}&status=pending_review`,
      });
    });

    // 4. Adjustment requests pending
    let adjQuery = supabase
      .from("attendance_adjustment_requests")
      .select(`
        id,
        work_date,
        reason,
        employee_id,
        employees!inner(
          employee_code,
          profile_id,
          department_id,
          departments(name),
          profiles!employees_profile_id_fkey(display_name),
          shift_assignments!employee_id(work_shifts(name))
        )
      `)
      .eq("organization_id", scope.orgId)
      .eq("status", "pending")
      .eq("work_date", day);
    if (scope.employeeIds) {
      adjQuery = adjQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }
    const { data: pendingAdj } = await adjQuery;
    ((pendingAdj ?? []) as unknown as Array<Record<string, unknown>>).forEach((a) => {
      const emp = a.employees as {
        employee_code: string;
        profiles: { display_name: string } | null;
        departments: { name: string } | null;
        shift_assignments: Array<{ work_shifts: { name: string } | null }> | null;
      };
      const shiftName = emp?.shift_assignments?.[0]?.work_shifts?.name ?? "—";
      exceptions.push({
        id: `adj-${a.id}`,
        type: "adjustment_pending",
        employee_code: emp?.employee_code ?? "?",
        display_name: emp?.profiles?.display_name ?? "",
        department: emp?.departments?.name ?? "—",
        shift_name: shiftName,
        work_date: a.work_date as string,
        detail: `Yêu cầu chỉnh công: ${a.reason}`,
        severity: "medium",
        href: `/adjustments`,
      });
    });

    return { ok: true, exceptions };
  } catch (error) {
    console.error("getExceptions error:", error);
    return { ok: false, message: "Không thể tải trung tâm ngoại lệ" };
  }
}

export async function getTimeTrend(filters: DashboardFilters): Promise<{
  ok: boolean;
  trend?: TimeTrendPoint[];
  message?: string;
}> {
  const { userId, profile } = await requireRole(REVIEW_ROLES);
  const supabase = await createClient();
  const day = filters.date ?? todayInZone();
  const scope = await reportScope(userId, profile.role, profile.organization_id ?? "");
  const { start, end } = getDateRange(day);

  try {
    let query = supabase
      .from("attendance_events")
      .select("event_type, occurred_at, employee_id")
      .eq("organization_id", scope.orgId)
      .eq("status", "success")
      .gte("occurred_at", start)
      .lte("occurred_at", end);
    if (scope.employeeIds) {
      query = query.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }

    const { data, error } = await query;
    if (error) throw error;

    const events = (data ?? []) as Array<{ event_type: string; occurred_at: string; employee_id: string }>;
    
    // Group by hour
    const hourMap = new Map<string, { check_ins: number; check_outs: number }>();
    for (let h = 0; h < 24; h++) {
      const hourLabel = `${h.toString().padStart(2, "0")}:00`;
      hourMap.set(hourLabel, { check_ins: 0, check_outs: 0 });
    }

    events.forEach((e) => {
      const hour = new Date(e.occurred_at).getHours();
      const hourLabel = `${hour.toString().padStart(2, "0")}:00`;
      const entry = hourMap.get(hourLabel);
      if (entry) {
        if (e.event_type === "check_in") entry.check_ins++;
        else entry.check_outs++;
      }
    });

    const trend: TimeTrendPoint[] = Array.from(hourMap.entries()).map(([hour, counts]) => ({
      hour,
      check_ins: counts.check_ins,
      check_outs: counts.check_outs,
    }));

    return { ok: true, trend };
  } catch (error) {
    console.error("getTimeTrend error:", error);
    return { ok: false, message: "Không thể tải xu hướng giờ" };
  }
}

export async function getShiftDistribution(filters: DashboardFilters): Promise<{
  ok: boolean;
  distribution?: ShiftDistributionPoint[];
  message?: string;
}> {
  const { userId, profile } = await requireRole(REVIEW_ROLES);
  const supabase = await createClient();
  const day = filters.date ?? todayInZone();
  const scope = await reportScope(userId, profile.role, profile.organization_id ?? "");

  try {
    // Get shifts with employee counts for today
    const { data: shifts } = await supabase
      .from("work_shifts")
      .select(`
        id,
        name,
        shift_assignments!inner(
          employee_id,
          effective_from,
          effective_to,
          employees!inner(organization_id, employment_status)
        )
      `)
      .eq("organization_id", scope.orgId)
      .eq("is_active", true);

    if (!shifts) return { ok: true, distribution: [] };

    const colors = [
      "var(--brand)",
      "var(--success)",
      "var(--warning)",
      "var(--danger)",
      "var(--info)",
      "var(--teal-accent)",
    ];

    const distribution: ShiftDistributionPoint[] = [];
    let colorIndex = 0;

    for (const shift of shifts) {
      const assignments = (shift as any).shift_assignments ?? [];
      const activeAssignments = assignments.filter((a: any) => 
        a.employees?.employment_status === "active" &&
        a.effective_from <= day &&
        (!a.effective_to || a.effective_to >= day)
      );
      
      if (activeAssignments.length > 0) {
        distribution.push({
          shift_name: shift.name,
          count: activeAssignments.length,
          color: colors[colorIndex % colors.length],
        });
        colorIndex++;
      }
    }

    return { ok: true, distribution };
  } catch (error) {
    console.error("getShiftDistribution error:", error);
    return { ok: false, message: "Không thể tải phân bổ ca làm" };
  }
}

export async function getDepartmentAttendance(filters: DashboardFilters): Promise<{
  ok: boolean;
  attendance?: DepartmentAttendancePoint[];
  message?: string;
}> {
  const { userId, profile } = await requireRole(REVIEW_ROLES);
  const supabase = await createClient();
  const day = filters.date ?? todayInZone();
  const scope = await reportScope(userId, profile.role, profile.organization_id ?? "");

  try {
    // Get departments
    const { data: departments } = await supabase
      .from("departments")
      .select("id, name")
      .eq("organization_id", scope.orgId)
      .order("name");

    if (!departments) return { ok: true, attendance: [] };

    const attendance: DepartmentAttendancePoint[] = [];

    for (const dept of departments) {
      // Get employees in this department
      let empQuery = supabase
        .from("employees")
        .select("id")
        .eq("organization_id", scope.orgId)
        .eq("department_id", dept.id)
        .eq("employment_status", "active");
      if (scope.employeeIds) {
        empQuery = empQuery.in("id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
      }
      const { data: employees } = await empQuery;
      const empIds = ((employees ?? []) as Array<{ id: string }>).map((e) => e.id);
      const totalInDept = empIds.length;

      if (totalInDept === 0) {
        attendance.push({
          department: dept.name,
          present: 0,
          late: 0,
          absent: 0,
          early_leave: 0,
        });
        continue;
      }

      // Get shift assignments for today
      const { data: assigned } = await supabase
        .from("shift_assignments")
        .select("employee_id")
        .eq("organization_id", scope.orgId)
        .lte("effective_from", day)
        .or(`effective_to.is.null,effective_to.gte.${day}`)
        .in("employee_id", empIds.length > 0 ? empIds : ["00000000-0000-0000-0000-000000000000"]);
      const assignedIds = new Set(((assigned ?? []) as Array<{ employee_id: string }>).map((a) => a.employee_id));

      // Get summaries
      let sumQuery = supabase
        .from("attendance_daily_summaries")
        .select("employee_id, status, first_in")
        .eq("organization_id", scope.orgId)
        .eq("work_date", day)
        .in("employee_id", empIds.length > 0 ? empIds : ["00000000-0000-0000-0000-000000000000"]);
      const { data: summaries } = await sumQuery;
      const sums = (summaries ?? []) as Array<{ employee_id: string; status: string; first_in: string | null }>;
      const checkedIds = new Set(sums.filter((s) => s.first_in !== null).map((s) => s.employee_id));

      const present = sums.filter((s) => s.status === "present").length;
      const late = sums.filter((s) => s.status === "late").length;
      const early_leave = sums.filter((s) => s.status === "early_leave").length;
      const absent = [...assignedIds].filter((id) => !checkedIds.has(id)).length;

      attendance.push({
        department: dept.name,
        present,
        late,
        absent,
        early_leave,
      });
    }

    return { ok: true, attendance };
  } catch (error) {
    console.error("getDepartmentAttendance error:", error);
    return { ok: false, message: "Không thể tải chấm công theo phòng ban" };
  }
}

/**
 * Chuỗi số liệu chấm công theo ngày + tổng hợp tuần/tháng cho dashboard.
 *
 * Dữ liệu lấy từ `attendance_daily_summaries` (đọc phân trang), phân ca và đơn
 * nghỉ đã duyệt. Không suy diễn thêm: ngày không có phân ca thì tỷ lệ = null.
 */
export async function getAttendanceTrends(filters: DashboardFilters): Promise<{
  ok: boolean;
  trends?: DashboardTrends;
  message?: string;
}> {
  const { userId, profile } = await requireRole(REVIEW_ROLES);
  const supabase = await createClient();
  const day = filters.date ?? todayInZone();
  const scope = await reportScope(userId, profile.role, profile.organization_id ?? "");
  const range = resolveDateRange(day, filters.range ?? "today");
  const windowFrom = addDays(range.to, -(TREND_WINDOW_DAYS - 1));
  const trendFrom = windowFrom < range.from ? windowFrom : range.from;
  const scopedIds = scope.employeeIds;

  try {
    const employeeIds = await activeEmployeeIds(supabase, scope);
    let truncated = false;
    let assignments: ShiftAssignmentRow[] = [];
    let summaries: AttendanceSummaryRow[] = [];
    let leaves: LeaveRangeRow[] = [];

    if (employeeIds.length > 0) {
      const [assignmentRows, summaryRows, leaveRows] = await Promise.all([
        fetchAllRows<ShiftAssignmentRow>((from, to) => {
          let query = supabase
            .from("shift_assignments")
            .select("employee_id, effective_from, effective_to")
            .eq("organization_id", scope.orgId)
            .order("effective_from", { ascending: true })
            .range(from, to);
          if (scopedIds) {
            query = query.in("employee_id", scopedIds.length > 0 ? scopedIds : EMPTY_IDS);
          }
          return query as unknown as PromiseLike<{
            data: unknown;
            error: { message: string } | null;
          }>;
        }),
        fetchAllRows<AttendanceSummaryRow>((from, to) => {
          let query = supabase
            .from("attendance_daily_summaries")
            .select("employee_id, work_date, status, first_in")
            .eq("organization_id", scope.orgId)
            .gte("work_date", trendFrom)
            .lte("work_date", range.to)
            .order("work_date", { ascending: true })
            .range(from, to);
          if (scopedIds) {
            query = query.in("employee_id", scopedIds.length > 0 ? scopedIds : EMPTY_IDS);
          }
          return query as unknown as PromiseLike<{
            data: unknown;
            error: { message: string } | null;
          }>;
        }),
        fetchAllRows<LeaveRangeRow>((from, to) => {
          let query = supabase
            .from("leave_requests")
            .select("employee_id, start_date, end_date")
            .eq("organization_id", scope.orgId)
            .eq("status", "approved")
            .lte("start_date", range.to)
            .gte("end_date", trendFrom)
            .order("start_date", { ascending: true })
            .range(from, to);
          if (scopedIds) {
            query = query.in("employee_id", scopedIds.length > 0 ? scopedIds : EMPTY_IDS);
          }
          return query as unknown as PromiseLike<{
            data: unknown;
            error: { message: string } | null;
          }>;
        }),
      ]);

      assignments = assignmentRows.rows;
      summaries = summaryRows.rows;
      leaves = leaveRows.rows;
      truncated = assignmentRows.truncated || summaryRows.truncated || leaveRows.truncated;
    }

    const windowDays = buildTrendDays({
      from: trendFrom,
      to: range.to,
      activeEmployeeIds: employeeIds,
      assignments,
      summaries,
      leaves,
    });
    const daily = windowDays.filter((d) => d.date >= range.from);

    return {
      ok: true,
      trends: {
        range,
        daily,
        period: sumTrendDays(daily),
        weekly: takeLast(bucketTrendDays(windowDays, "week"), 8),
        monthly: takeLast(bucketTrendDays(windowDays, "month"), 6),
        truncated,
      },
    };
  } catch (error) {
    console.error("getAttendanceTrends error:", error);
    return { ok: false, message: "Không thể tải xu hướng chấm công" };
  }
}

/** Danh mục phòng ban / ca làm cho bộ lọc (chỉ đọc). */
export async function getDashboardFilterOptions(): Promise<DashboardFilterOptions> {
  const { profile } = await requireRole(REVIEW_ROLES);
  const supabase = await createClient();
  const orgId = profile.organization_id ?? "";

  const [departments, shifts] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name"),
    supabase
      .from("work_shifts")
      .select("id, name")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("name"),
  ]);

  return {
    departments: ((departments.data ?? []) as Array<{ id: string; name: string }>).map((d) => ({
      id: d.id,
      label: d.name,
    })),
    shifts: ((shifts.data ?? []) as Array<{ id: string; name: string }>).map((s) => ({
      id: s.id,
      label: s.name,
    })),
  };
}

// Combined action to fetch all dashboard data in parallel
export async function getFullDashboardData(filters: DashboardFilters): Promise<{
  ok: boolean;
  data?: DashboardData;
  message?: string;
}> {
  const [kpis, liveActivity, exceptions, timeTrend, shiftDistribution, departmentAttendance, trends, filterOptions] = await Promise.all([
    getDashboardKPIs(filters),
    getLiveActivity(filters, 20),
    getExceptions(filters),
    getTimeTrend(filters),
    getShiftDistribution(filters),
    getDepartmentAttendance(filters),
    getAttendanceTrends(filters),
    getDashboardFilterOptions(),
  ]);

  if (!kpis.ok || !liveActivity.ok || !exceptions.ok || !timeTrend.ok || !shiftDistribution.ok || !departmentAttendance.ok || !trends.ok) {
    return {
      ok: false,
      message: [kpis, liveActivity, exceptions, timeTrend, shiftDistribution, departmentAttendance, trends]
        .filter(r => !r.ok)
        .map(r => r.message)
        .join("; "),
    };
  }

  return {
    ok: true,
    data: {
      kpis: kpis.kpis!,
      liveActivity: liveActivity.events!,
      exceptions: exceptions.exceptions!,
      timeTrend: timeTrend.trend!,
      shiftDistribution: shiftDistribution.distribution!,
      departmentAttendance: departmentAttendance.attendance!,
      trends: trends.trends!,
      filterOptions,
      lastUpdated: new Date().toISOString(),
      filters,
    },
  };
}