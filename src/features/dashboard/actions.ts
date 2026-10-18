"use server";

import { requireRole, requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/db";

type Db = Awaited<ReturnType<typeof createClient>>;
const PAGE_SIZE = 20;
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

async function reportScope(
  supabase: Db,
  userId: string,
  role: Role,
  orgId: string,
): Promise<Scope> {
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
}

// ============================================================
// Dashboard Data Types
// ============================================================

export interface DashboardKPI {
  label: string;
  value: number;
  change?: number; // percentage change vs previous period
  trend?: "up" | "down" | "neutral";
  description: string;
  href?: string;
  icon: string;
  color: "primary" | "success" | "warning" | "danger" | "info";
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
}

export interface DashboardData {
  kpis: DashboardKPI[];
  liveActivity: LiveActivityEvent[];
  exceptions: ExceptionItem[];
  timeTrend: TimeTrendPoint[];
  shiftDistribution: ShiftDistributionPoint[];
  departmentAttendance: DepartmentAttendancePoint[];
  lastUpdated: string;
  filters: DashboardFilters;
}

// ============================================================
// Helper functions
// ============================================================

function getDateRange(date: string) {
  const d = new Date(date + "T00:00:00");
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function getPreviousDateRange(date: string) {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() - 1);
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
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
  const day = filters.date ?? new Date().toISOString().slice(0, 10);
  const scope = await reportScope(supabase, userId, profile.role, profile.organization_id ?? "");
  const { start, end } = getDateRange(day);
  const { start: prevStart, end: prevEnd } = getPreviousDateRange(day);

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

    // Get employees with shift assignments for today
    const { data: assigned } = await supabase
      .from("shift_assignments")
      .select("employee_id, work_shifts(name)")
      .eq("organization_id", scope.orgId)
      .lte("effective_from", day)
      .or(`effective_to.is.null,effective_to.gte.${day}`)
      .in("employee_id", empIds.length > 0 ? empIds : ["00000000-0000-0000-0000-000000000000"]);
    const assignedIds = new Set(((assigned ?? []) as Array<{ employee_id: string }>).map((a) => a.employee_id));

    // Get attendance summaries for today
    let sumQuery = supabase
      .from("attendance_daily_summaries")
      .select("employee_id, status, first_in, late_min, early_leave_min")
      .eq("organization_id", scope.orgId)
      .eq("work_date", day);
    if (scope.employeeIds) {
      sumQuery = sumQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }
    const { data: summaries } = await sumQuery;
    const sums = (summaries ?? []) as Array<{ employee_id: string; status: string; first_in: string | null; late_min: number; early_leave_min: number }>;
    const checkedIds = new Set(sums.filter((s) => s.first_in !== null).map((s) => s.employee_id));

    // Get previous day summaries for comparison
    let prevSumQuery = supabase
      .from("attendance_daily_summaries")
      .select("employee_id, status, first_in")
      .eq("organization_id", scope.orgId)
      .eq("work_date", prevStart.split("T")[0]);
    if (scope.employeeIds) {
      prevSumQuery = prevSumQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }
    const { data: prevSummaries } = await prevSumQuery;
    const prevSums = (prevSummaries ?? []) as Array<{ employee_id: string; status: string; first_in: string | null }>;
    const prevCheckedIds = new Set(prevSums.filter((s) => s.first_in !== null).map((s) => s.employee_id));

    // Calculate KPIs
    const checkedIn = checkedIds.size;
    const notCheckedIn = assignedIds.size - checkedIn;
    const late = sums.filter((s) => s.status === "late").length;
    const earlyLeave = sums.filter((s) => s.status === "early_leave").length;
    const absent = [...assignedIds].filter((id) => !checkedIds.has(id)).length;

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
    const { count: pendingReview } = await evQuery;

    // Pending enrollments
    let enrollQuery = supabase
      .from("face_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", scope.orgId)
      .eq("status", "pending");
    if (scope.employeeIds) {
      enrollQuery = enrollQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }
    const { count: pendingEnroll } = await enrollQuery;

    // Pending adjustments
    let adjQuery = supabase
      .from("attendance_adjustment_requests")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", scope.orgId)
      .eq("status", "pending");
    if (scope.employeeIds) {
      adjQuery = adjQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }
    const { count: pendingAdj } = await adjQuery;

    // Pending leave
    let leaveQuery = supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", scope.orgId)
      .eq("status", "pending");
    if (scope.employeeIds) {
      leaveQuery = leaveQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }
    const { count: pendingLeave } = await leaveQuery;

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
    const { count: onLeave } = await onLeaveQuery;

    // Working now (checked in but not checked out)
    let workingNowQuery = supabase
      .from("attendance_events")
      .select("employee_id")
      .eq("organization_id", scope.orgId)
      .eq("event_type", "check_in")
      .eq("status", "success")
      .gte("occurred_at", `${day}T00:00:00`)
      .lte("occurred_at", `${day}T23:59:59`);
    if (scope.employeeIds) {
      workingNowQuery = workingNowQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }
    const { data: checkIns } = await workingNowQuery;
    const checkInIds = new Set(((checkIns ?? []) as Array<{ employee_id: string }>).map((e) => e.employee_id));
    
    let checkOutQuery = supabase
      .from("attendance_events")
      .select("employee_id")
      .eq("organization_id", scope.orgId)
      .eq("event_type", "check_out")
      .eq("status", "success")
      .gte("occurred_at", `${day}T00:00:00`)
      .lte("occurred_at", `${day}T23:59:59`);
    if (scope.employeeIds) {
      checkOutQuery = checkOutQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
    }
    const { data: checkOuts } = await checkOutQuery;
    const checkOutIds = new Set(((checkOuts ?? []) as Array<{ employee_id: string }>).map((e) => e.employee_id));
    
    const workingNow = [...checkInIds].filter(id => !checkOutIds.has(id)).length;

    // Calculate percentage changes
    const prevCheckedIn = prevCheckedIds.size;
    const prevLate = prevSums.filter((s) => s.status === "late").length;
    const prevEarlyLeave = prevSums.filter((s) => s.status === "early_leave").length;
    const prevAbsent = [...assignedIds].filter((id) => !prevCheckedIds.has(id)).length;

    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const kpis: DashboardKPI[] = [
      {
        label: "Tổng nhân viên",
        value: totalActive,
        change: 0,
        trend: "neutral",
        description: "Nhân viên đang hoạt động trong phạm vi",
        icon: "users",
        color: "primary",
        href: "/admin/employees",
      },
      {
        label: "Đã check-in",
        value: checkedIn,
        change: calcChange(checkedIn, prevCheckedIn),
        trend: checkedIn >= prevCheckedIn ? "up" : "down",
        description: `${checkedIn}/${assignedIds.size} nhân viên có ca đã chấm công vào`,
        icon: "check",
        color: "success",
        href: "/reports",
      },
      {
        label: "Chưa check-in",
        value: notCheckedIn,
        change: calcChange(notCheckedIn, assignedIds.size - prevCheckedIn),
        trend: notCheckedIn <= (assignedIds.size - prevCheckedIn) ? "up" : "down",
        description: `${notCheckedIn} nhân viên có ca chưa chấm công vào`,
        icon: "alert",
        color: "warning",
        href: "/reports",
      },
      {
        label: "Đi muộn",
        value: late,
        change: calcChange(late, prevLate),
        trend: late <= prevLate ? "up" : "down",
        description: `${late} nhân viên check-in sau giờ quy định`,
        icon: "clock",
        color: "warning",
        href: "/reports",
      },
      {
        label: "Vắng mặt",
        value: absent,
        change: calcChange(absent, prevAbsent),
        trend: absent <= prevAbsent ? "up" : "down",
        description: `${absent} nhân viên có ca nhưng không check-in`,
        icon: "x",
        color: "danger",
        href: "/reports",
      },
      {
        label: "Đang nghỉ",
        value: onLeave ?? 0,
        change: 0,
        trend: "neutral",
        description: "Nhân viên có đơn nghỉ được duyệt hôm nay",
        icon: "calendar",
        color: "info",
        href: "/leave",
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
        href: "/approvals",
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
  const day = filters.date ?? new Date().toISOString().slice(0, 10);
  const scope = await reportScope(supabase, userId, profile.role, profile.organization_id ?? "");
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
  const day = filters.date ?? new Date().toISOString().slice(0, 10);
  const scope = await reportScope(supabase, userId, profile.role, profile.organization_id ?? "");
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
      .gte("occurred_at", `${day}T00:00:00`)
      .lte("occurred_at", `${day}T23:59:59`);
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
      .gte("occurred_at", `${day}T00:00:00`)
      .lte("occurred_at", `${day}T23:59:59`);
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
  const day = filters.date ?? new Date().toISOString().slice(0, 10);
  const scope = await reportScope(supabase, userId, profile.role, profile.organization_id ?? "");
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
  const day = filters.date ?? new Date().toISOString().slice(0, 10);
  const scope = await reportScope(supabase, userId, profile.role, profile.organization_id ?? "");

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
  const day = filters.date ?? new Date().toISOString().slice(0, 10);
  const scope = await reportScope(supabase, userId, profile.role, profile.organization_id ?? "");

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

// Combined action to fetch all dashboard data in parallel
export async function getFullDashboardData(filters: DashboardFilters): Promise<{
  ok: boolean;
  data?: DashboardData;
  message?: string;
}> {
  const [kpis, liveActivity, exceptions, timeTrend, shiftDistribution, departmentAttendance] = await Promise.all([
    getDashboardKPIs(filters),
    getLiveActivity(filters, 20),
    getExceptions(filters),
    getTimeTrend(filters),
    getShiftDistribution(filters),
    getDepartmentAttendance(filters),
  ]);

  if (!kpis.ok || !liveActivity.ok || !exceptions.ok || !timeTrend.ok || !shiftDistribution.ok || !departmentAttendance.ok) {
    return {
      ok: false,
      message: [kpis, liveActivity, exceptions, timeTrend, shiftDistribution, departmentAttendance]
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
      lastUpdated: new Date().toISOString(),
      filters,
    },
  };
}