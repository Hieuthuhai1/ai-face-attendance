"use server";

import { requireRole, requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { MAX_EXPORT_ROWS, monthRange, toCsv, validateRange } from "@/lib/reports/csv";
import type { Role } from "@/types/db";

type Db = Awaited<ReturnType<typeof createClient>>;
const PAGE_SIZE = 20;
const REVIEW: Role[] = ["manager", "hr_admin", "system_admin"];

interface Scope {
  orgId: string;
  employeeIds: string[] | null; // null = toàn org (HR theo org), mảng = giới hạn team/cá nhân
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

// ============================ personal history ============================

export interface HistoryRow {
  work_date: string;
  shift_name: string;
  first_in: string | null;
  last_out: string | null;
  late_min: number;
  early_leave_min: number;
  total_work_min: number;
  overtime_min: number;
  status: string;
  adjustment_status: string | null;
}

export async function getPersonalHistory(month: string, page: number): Promise<{
  rows: HistoryRow[];
  total: number;
  page: number;
  pageSize: number;
  month: string;
}> {
  const { userId } = await requireUser();
  const supabase = await createClient();
  const me = await myEmployee(supabase, userId);
  const range = monthRange(month) ?? monthRange(new Date().toISOString().slice(0, 7));
  const r = range as { from: string; to: string };
  const p = Math.max(1, page || 1);
  if (!me) return { rows: [], total: 0, page: p, pageSize: PAGE_SIZE, month };

  const { data, count } = await supabase
    .from("attendance_daily_summaries")
    .select("work_date, first_in, last_out, late_min, early_leave_min, total_work_min, overtime_min, status, work_shifts(name)", { count: "exact" })
    .eq("employee_id", me.id)
    .gte("work_date", r.from)
    .lte("work_date", r.to)
    .order("work_date", { ascending: false })
    .range((p - 1) * PAGE_SIZE, p * PAGE_SIZE - 1);

  const { data: adjustments } = await supabase
    .from("attendance_adjustment_requests")
    .select("work_date, status")
    .eq("employee_id", me.id)
    .gte("work_date", r.from)
    .lte("work_date", r.to);
  const adjByDate = new Map(
    ((adjustments ?? []) as Array<{ work_date: string; status: string }>).map((a) => [a.work_date, a.status]),
  );

  const rows: HistoryRow[] = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((s) => ({
    work_date: s.work_date as string,
    shift_name: ((s.work_shifts as { name?: string } | null)?.name) ?? "—",
    first_in: (s.first_in as string) ?? null,
    last_out: (s.last_out as string) ?? null,
    late_min: (s.late_min as number) ?? 0,
    early_leave_min: (s.early_leave_min as number) ?? 0,
    total_work_min: (s.total_work_min as number) ?? 0,
    overtime_min: (s.overtime_min as number) ?? 0,
    status: s.status as string,
    adjustment_status: adjByDate.get(s.work_date as string) ?? null,
  }));
  return { rows, total: count ?? 0, page: p, pageSize: PAGE_SIZE, month };
}

// ============================ dashboard ============================

export interface DashboardStats {
  date: string;
  totalActive: number;
  checkedIn: number;
  late: number;
  earlyLeave: number;
  absent: number;
  pendingReview: number;
}

export async function getDashboard(date: string): Promise<DashboardStats> {
  const { userId, profile } = await requireRole(REVIEW);
  const supabase = await createClient();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const scope = await reportScope(supabase, userId, profile.role, profile.organization_id ?? "");

  let empQuery = supabase
    .from("employees")
    .select("id")
    .eq("organization_id", scope.orgId)
    .eq("employment_status", "active");
  if (scope.employeeIds) empQuery = empQuery.in("id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: employees } = await empQuery;
  const ids = ((employees ?? []) as Array<{ id: string }>).map((e) => e.id);

  // Nhân viên có phân ca phủ ngày xem (vắng chỉ kết luận khi có shift data).
  const { data: assigned } = await supabase
    .from("shift_assignments")
    .select("employee_id")
    .eq("organization_id", scope.orgId)
    .lte("effective_from", day)
    .or(`effective_to.is.null,effective_to.gte.${day}`)
    .in("employee_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const assignedIds = new Set(((assigned ?? []) as Array<{ employee_id: string }>).map((a) => a.employee_id));

  let sumQuery = supabase
    .from("attendance_daily_summaries")
    .select("employee_id, status, first_in")
    .eq("organization_id", scope.orgId)
    .eq("work_date", day);
  if (scope.employeeIds) {
    sumQuery = sumQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data: summaries } = await sumQuery;
  const sums = (summaries ?? []) as Array<{ employee_id: string; status: string; first_in: string | null }>;
  const checkedIds = new Set(sums.filter((s) => s.first_in !== null).map((s) => s.employee_id));

  let evQuery = supabase
    .from("attendance_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", scope.orgId)
    .in("status", ["pending_review", "fallback"])
    .gte("occurred_at", `${day}T00:00:00`);
  if (scope.employeeIds) {
    evQuery = evQuery.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { count: pendingReview } = await evQuery;

  const absent = [...assignedIds].filter((id) => !checkedIds.has(id)).length;
  return {
    date: day,
    totalActive: ids.length,
    checkedIn: checkedIds.size,
    late: sums.filter((s) => s.status === "late").length,
    earlyLeave: sums.filter((s) => s.status === "early_leave").length,
    absent,
    pendingReview: pendingReview ?? 0,
  };
}

// ============================ analytics ============================

export interface KPIData {
  label: string;
  value: number;
  change?: number; // % change vs previous period
  trend?: "up" | "down" | "neutral";
}

export interface TimeTrendPoint {
  hour: number;
  checkins: number;
  checkouts: number;
}

export interface ShiftDistributionPoint {
  shift: string;
  count: number;
}

export interface DepartmentAttendancePoint {
  department: string;
  present: number;
  late: number;
  early_leave: number;
  absent: number;
  incomplete: number;
}

export interface ExceptionItem {
  type: "unverified" | "missing_checkout" | "pending_review" | "pending_adjustment" | "ai_exception";
  severity: "high" | "medium" | "low";
  employee_code: string;
  employee_name: string;
  department: string;
  date: string;
  shift?: string;
  detail: string;
  link?: string;
}

export interface AnalyticsData {
  kpis: KPIData[];
  timeTrend: TimeTrendPoint[];
  shiftDistribution: ShiftDistributionPoint[];
  departmentAttendance: DepartmentAttendancePoint[];
  exceptions: ExceptionItem[];
}

export async function getDashboardKPIs(date: string): Promise<KPIData[]> {
  const stats = await getDashboard(date);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const prevDay = new Date(day + "T00:00:00");
  prevDay.setDate(prevDay.getDate() - 1);
  const prevDayStr = prevDay.toISOString().slice(0, 10);
  const prevStats = await getDashboard(prevDayStr);

  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  return [
    { label: "Tổng nhân viên", value: stats.totalActive, change: calcChange(stats.totalActive, prevStats.totalActive), trend: stats.totalActive >= prevStats.totalActive ? "up" : "down" },
    { label: "Đã check-in", value: stats.checkedIn, change: calcChange(stats.checkedIn, prevStats.checkedIn), trend: stats.checkedIn >= prevStats.checkedIn ? "up" : "down" },
    { label: "Chưa check-in", value: stats.totalActive - stats.checkedIn, change: calcChange(stats.totalActive - stats.checkedIn, prevStats.totalActive - prevStats.checkedIn), trend: stats.checkedIn <= prevStats.checkedIn ? "up" : "down" },
    { label: "Đi muộn", value: stats.late, change: calcChange(stats.late, prevStats.late), trend: stats.late <= prevStats.late ? "down" : "up" },
    { label: "Về sớm", value: stats.earlyLeave, change: calcChange(stats.earlyLeave, prevStats.earlyLeave), trend: stats.earlyLeave <= prevStats.earlyLeave ? "down" : "up" },
    { label: "Vắng mặt", value: stats.absent, change: calcChange(stats.absent, prevStats.absent), trend: stats.absent <= prevStats.absent ? "down" : "up" },
    { label: "Đang nghỉ", value: 0, change: 0, trend: "neutral" },
    { label: "Chờ xử lý", value: stats.pendingReview, change: calcChange(stats.pendingReview, prevStats.pendingReview), trend: stats.pendingReview <= prevStats.pendingReview ? "down" : "up" },
  ];
}

export async function getLiveActivity(limit = 20, scope: Scope, supabase: Db) {
  const { data } = await supabase
    .from("attendance_events")
    .select("employee_id, event_type, status, occurred_at, method, confidence, liveness_status, employees!inner(employee_code, display_name, departments(name))")
    .eq("organization_id", scope.orgId)
    .in("employee_id", scope.employeeIds?.length ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"])
    .order("occurred_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getExceptions(scope: Scope, supabase: Db): Promise<ExceptionItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const exceptions: ExceptionItem[] = [];

  // 1. Unverified face events (pending_review)
  const { data: unverified } = await supabase
    .from("attendance_events")
    .select("employee_id, event_type, occurred_at, method, confidence, liveness_status, employees!inner(employee_code, profiles!employees_profile_id_fkey(display_name), departments(name))")
    .eq("organization_id", scope.orgId)
    .in("employee_id", scope.employeeIds?.length ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("status", "pending_review")
    .gte("occurred_at", `${today}T00:00:00`)
    .order("occurred_at", { ascending: false })
    .limit(50);

  for (const e of (unverified ?? []) as Array<Record<string, unknown>>) {
    const emp = e.employees as { employee_code: string; profiles: { display_name: string } | null; departments: { name: string } | null } | null;
    exceptions.push({
      type: "unverified",
      severity: "high",
      employee_code: emp?.employee_code ?? "?",
      employee_name: emp?.profiles?.display_name ?? "—",
      department: emp?.departments?.name ?? "—",
      date: new Date(e.occurred_at as string).toLocaleDateString("vi-VN"),
      detail: `Chấm công ${e.event_type === "check_in" ? "vào" : "ra"} cần rà soát (confidence: ${((e.confidence as number) ?? 0).toFixed(0)}%)`,
      link: `/reports?status=pending_review`,
    });
  }

  // 2. Missing check-out (checked in but not out today)
  const { data: checkedInToday } = await supabase
    .from("attendance_events")
    .select("employee_id, event_type, occurred_at, employees!inner(employee_code, profiles!employees_profile_id_fkey(display_name), departments(name))")
    .eq("organization_id", scope.orgId)
    .in("employee_id", scope.employeeIds?.length ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("event_type", "check_in")
    .eq("status", "success")
    .gte("occurred_at", `${today}T00:00:00`)
    .order("occurred_at", { ascending: false });

  const checkedInIds = new Set(((checkedInToday ?? []) as Array<Record<string, unknown>>).map((e) => e.employee_id as string));
  const { data: checkedOutToday } = await supabase
    .from("attendance_events")
    .select("employee_id")
    .eq("organization_id", scope.orgId)
    .in("employee_id", scope.employeeIds?.length ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("event_type", "check_out")
    .eq("status", "success")
    .gte("occurred_at", `${today}T00:00:00`);
  const checkedOutIds = new Set(((checkedOutToday ?? []) as Array<Record<string, unknown>>).map((e) => e.employee_id as string));

  for (const id of checkedInIds) {
    if (!checkedOutIds.has(id)) {
      const empData = (checkedInToday ?? []).find((e) => e.employee_id === id);
      if (empData) {
        const emp = (empData as Record<string, unknown>).employees as { employee_code: string; profiles: { display_name: string } | null; departments: { name: string } | null } | null;
        exceptions.push({
          type: "missing_checkout",
          severity: "medium",
          employee_code: emp?.employee_code ?? "?",
          employee_name: emp?.profiles?.display_name ?? "—",
          department: emp?.departments?.name ?? "—",
          date: today,
          detail: "Đã check-in nhưng chưa check-out hôm nay",
          link: `/history?month=${today.slice(0, 7)}`,
        });
      }
    }
  }

  // 3. Pending adjustments
  const { data: pendingAdj } = await supabase
    .from("attendance_adjustment_requests")
    .select("id, work_date, employee_id, employees!inner(employee_code, profiles!employees_profile_id_fkey(display_name), departments(name))")
    .eq("organization_id", scope.orgId)
    .in("employee_id", scope.employeeIds?.length ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);

  for (const a of (pendingAdj ?? []) as Array<Record<string, unknown>>) {
    const emp = a.employees as { employee_code: string; profiles: { display_name: string } | null; departments: { name: string } | null } | null;
    exceptions.push({
      type: "pending_adjustment",
      severity: "medium",
      employee_code: emp?.employee_code ?? "?",
      employee_name: emp?.profiles?.display_name ?? "—",
      department: emp?.departments?.name ?? "—",
      date: a.work_date as string,
      detail: "Yêu cầu chỉnh công chờ duyệt",
      link: `/adjustments`,
    });
  }

  // 4. Pending leave requests
  const { data: pendingLeave } = await supabase
    .from("leave_requests")
    .select("id, start_date, end_date, employee_id, employees!inner(employee_code, profiles!employees_profile_id_fkey(display_name), departments(name))")
    .eq("organization_id", scope.orgId)
    .in("employee_id", scope.employeeIds?.length ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);

  for (const l of (pendingLeave ?? []) as Array<Record<string, unknown>>) {
    const emp = l.employees as { employee_code: string; profiles: { display_name: string } | null; departments: { name: string } | null } | null;
    exceptions.push({
      type: "pending_adjustment",
      severity: "medium",
      employee_code: emp?.employee_code ?? "?",
      employee_name: emp?.profiles?.display_name ?? "—",
      department: emp?.departments?.name ?? "—",
      date: l.start_date as string,
      detail: `Đơn nghỉ ${l.start_date === l.end_date ? l.start_date : `${l.start_date} → ${l.end_date}`} chờ duyệt`,
      link: `/leave`,
    });
  }

  // 5. AI exceptions (failed liveness or low confidence)
  const { data: aiExceptions } = await supabase
    .from("attendance_events")
    .select("employee_id, event_type, occurred_at, method, confidence, liveness_status, employees!inner(employee_code, profiles!employees_profile_id_fkey(display_name), departments(name))")
    .eq("organization_id", scope.orgId)
    .in("employee_id", scope.employeeIds?.length ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"])
    .in("status", ["failed"])
    .or("liveness_status.eq.fail,confidence.lt.0.5")
    .gte("occurred_at", `${today}T00:00:00`)
    .order("occurred_at", { ascending: false })
    .limit(20);

  for (const e of (aiExceptions ?? []) as Array<Record<string, unknown>>) {
    const emp = e.employees as { employee_code: string; profiles: { display_name: string } | null; departments: { name: string } | null } | null;
    exceptions.push({
      type: "ai_exception",
      severity: "high",
      employee_code: emp?.employee_code ?? "?",
      employee_name: emp?.profiles?.display_name ?? "—",
      department: emp?.departments?.name ?? "—",
      date: new Date(e.occurred_at as string).toLocaleDateString("vi-VN"),
      detail: `NHẬN DIỆN THẤT BẠI: ${e.liveness_status === "fail" ? "Liveness fail" : `Confidence thấp (${((e.confidence as number) ?? 0).toFixed(0)}%)`}`,
      link: `/reports?status=failed`,
    });
  }

  return exceptions.slice(0, 50);
}

export async function getTimeTrend(date: string, scope: Scope, supabase: Db): Promise<TimeTrendPoint[]> {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const trend: TimeTrendPoint[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const start = `${day}T${String(hour).padStart(2, "0")}:00:00`;
    const end = `${day}T${String(hour).padStart(2, "0")}:59:59`;

    const { count: checkins } = await supabase
      .from("attendance_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", scope.orgId)
      .in("employee_id", scope.employeeIds?.length ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("event_type", "check_in")
      .gte("occurred_at", start)
      .lte("occurred_at", end);

    const { count: checkouts } = await supabase
      .from("attendance_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", scope.orgId)
      .in("employee_id", scope.employeeIds?.length ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("event_type", "check_out")
      .gte("occurred_at", start)
      .lte("occurred_at", end);

    trend.push({ hour, checkins: checkins ?? 0, checkouts: checkouts ?? 0 });
  }
  return trend;
}

export async function getShiftDistribution(date: string, scope: Scope, supabase: Db): Promise<ShiftDistributionPoint[]> {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("attendance_daily_summaries")
    .select("shift_id, work_shifts(name)")
    .eq("organization_id", scope.orgId)
    .eq("work_date", day)
    .in("employee_id", scope.employeeIds?.length ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const name = ((row.work_shifts as { name?: string } | null)?.name) ?? "Không phân ca";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([shift, count]) => ({ shift, count }));
}

export async function getDepartmentAttendance(date: string, scope: Scope, supabase: Db): Promise<DepartmentAttendancePoint[]> {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("attendance_daily_summaries")
    .select("status, employees!inner(department_id, departments!employees_department_id_fkey(name))")
    .eq("organization_id", scope.orgId)
    .eq("work_date", day)
    .in("employee_id", scope.employeeIds?.length ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);

  const deptMap = new Map<string, DepartmentAttendancePoint>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const emp = row.employees as { department_id: string; departments: { name: string } | null } | null;
    const deptName = emp?.departments?.name ?? "Chưa phân phòng";
    const dept = deptMap.get(deptName) ?? { department: deptName, present: 0, late: 0, early_leave: 0, absent: 0, incomplete: 0 };
    const status = row.status as string;
    if (status === "present") dept.present++;
    else if (status === "late") dept.late++;
    else if (status === "early_leave") dept.early_leave++;
    else if (status === "absent") dept.absent++;
    else if (status === "incomplete") dept.incomplete++;
    deptMap.set(deptName, dept);
  }
  return Array.from(deptMap.values());
}

export async function getFullDashboardData(date: string): Promise<AnalyticsData> {
  const { userId, profile } = await requireRole(REVIEW);
  const supabase = await createClient();
  const scope = await reportScope(supabase, userId, profile.role, profile.organization_id ?? "");

  const [kpis, timeTrend, shiftDistribution, departmentAttendance, exceptions] = await Promise.all([
    getDashboardKPIs(date),
    getTimeTrend(date, scope, supabase),
    getShiftDistribution(date, scope, supabase),
    getDepartmentAttendance(date, scope, supabase),
    getExceptions(scope, supabase),
  ]);

  return { kpis, timeTrend, shiftDistribution, departmentAttendance, exceptions };
}

// ============================ report + export ============================

export interface ReportFilters {
  from: string;
  to: string;
  departmentId?: string;
  employeeId?: string;
  shiftId?: string;
  status?: string;
  page?: number;
}

export interface ReportRow {
  work_date: string;
  employee_code: string;
  display_name: string;
  department: string;
  shift: string;
  first_in: string | null;
  last_out: string | null;
  late_min: number;
  early_leave_min: number;
  total_work_min: number;
  overtime_min: number;
  status: string;
}

export interface DepartmentSummaryRow {
  department: string;
  total_employees: number;
  present: number;
  late: number;
  early_leave: number;
  absent: number;
  incomplete: number;
  avg_work_min: number;
  total_overtime_min: number;
}

export interface EmployeeSummaryRow {
  employee_code: string;
  display_name: string;
  department: string;
  total_days: number;
  present: number;
  late: number;
  early_leave: number;
  absent: number;
  incomplete: number;
  total_work_min: number;
  total_overtime_min: number;
  avg_work_min: number;
}

export interface LateEarlyReportRow {
  work_date: string;
  employee_code: string;
  display_name: string;
  department: string;
  shift: string;
  late_min: number;
  early_leave_min: number;
  status: string;
}

export interface MissingCheckReportRow {
  work_date: string;
  employee_code: string;
  display_name: string;
  department: string;
  shift: string;
  has_checkin: boolean;
  has_checkout: boolean;
  status: string;
}

function baseReportQuery(supabase: Db, scope: Scope, f: ReportFilters) {
  let q = supabase
    .from("attendance_daily_summaries")
    .select(
      "work_date, first_in, last_out, late_min, early_leave_min, total_work_min, overtime_min, status, employees!inner(employee_code, department_id, profiles!employees_profile_id_fkey(display_name), departments!employees_department_id_fkey(name)), work_shifts(name)",
      { count: "exact" },
    )
    .eq("organization_id", scope.orgId)
    .gte("work_date", f.from)
    .lte("work_date", f.to);
  if (scope.employeeIds) {
    q = q.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (f.employeeId) q = q.eq("employee_id", f.employeeId);
  if (f.shiftId) q = q.eq("shift_id", f.shiftId);
  if (f.status) q = q.eq("status", f.status);
  if (f.departmentId) q = q.eq("employees.department_id", f.departmentId);
  return q.order("work_date", { ascending: false }).order("employee_id", { ascending: true });
}

function toReportRows(data: unknown): ReportRow[] {
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((s) => {
    const emp = s.employees as {
      employee_code: string;
      profiles: { display_name: string } | null;
      departments: { name: string } | null;
    };
    return {
      work_date: s.work_date as string,
      employee_code: emp?.employee_code ?? "?",
      display_name: emp?.profiles?.display_name ?? "",
      department: (emp?.departments as { name?: string } | null)?.name ?? "—",
      shift: ((s.work_shifts as { name?: string } | null)?.name) ?? "—",
      first_in: (s.first_in as string) ?? null,
      last_out: (s.last_out as string) ?? null,
      late_min: (s.late_min as number) ?? 0,
      early_leave_min: (s.early_leave_min as number) ?? 0,
      total_work_min: (s.total_work_min as number) ?? 0,
      overtime_min: (s.overtime_min as number) ?? 0,
      status: s.status as string,
    };
  });
}

export async function getReport(filters: ReportFilters): Promise<{
  ok: boolean;
  rows?: ReportRow[];
  total?: number;
  page?: number;
  message?: string;
}> {
  const { userId, profile } = await requireRole(REVIEW);
  const v = validateRange(filters.from, filters.to);
  if (!v.ok) return { ok: false, message: v.message };
  const supabase = await createClient();
  const scope = await reportScope(supabase, userId, profile.role, profile.organization_id ?? "");
  // Manager không được xem NV ngoài team qua filter employeeId.
  if (profile.role === "manager" && filters.employeeId && !scope.employeeIds?.includes(filters.employeeId)) {
    return { ok: false, message: "Nhân viên nằm ngoài phạm vi quản lý của bạn." };
  }
  const p = Math.max(1, filters.page || 1);
  const { data, count } = await baseReportQuery(supabase, scope, { ...filters, from: v.from, to: v.to })
    .range((p - 1) * PAGE_SIZE, p * PAGE_SIZE - 1);
  return { ok: true, rows: toReportRows(data), total: count ?? 0, page: p };
}

const CSV_HEADERS = ["Ngay", "Ma NV", "Ho ten", "Phong ban", "Ca", "Check-in", "Check-out", "Tre (phut)", "Ve som (phut)", "Lam viec (phut)", "Gio them (phut)", "Trang thai"];

export async function exportCsv(filters: ReportFilters): Promise<
  { ok: true; csv: string; filename: string; count: number } | { ok: false; message: string }
> {
  const { userId, profile } = await requireRole(REVIEW);
  const v = validateRange(filters.from, filters.to);
  if (!v.ok) return { ok: false, message: v.message };
  const supabase = await createClient();
  const scope = await reportScope(supabase, userId, profile.role, profile.organization_id ?? "");
  if (profile.role === "manager" && filters.employeeId && !scope.employeeIds?.includes(filters.employeeId)) {
    return { ok: false, message: "Nhân viên nằm ngoài phạm vi quản lý của bạn." };
  }
  const { data, count } = await baseReportQuery(supabase, scope, { ...filters, from: v.from, to: v.to })
    .range(0, MAX_EXPORT_ROWS - 1);
  const rows = toReportRows(data).map((r) => [
    r.work_date, r.employee_code, r.display_name, r.department, r.shift,
    r.first_in ? new Date(r.first_in).toLocaleString("vi-VN") : "",
    r.last_out ? new Date(r.last_out).toLocaleString("vi-VN") : "",
    r.late_min, r.early_leave_min, r.total_work_min, r.overtime_min, r.status,
  ]);
  await supabase.from("audit_logs").insert({
    organization_id: scope.orgId,
    actor_id: userId,
    action: "report.export",
    resource_type: "attendance_report",
    resource_id: `${v.from}_${v.to}`,
    metadata: { filters, rows: rows.length, total: count ?? 0 },
  });
  const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  return { ok: true, csv: toCsv(CSV_HEADERS, rows), filename: `cham-cong_${v.from}_${v.to}_${stamp}.csv`, count: rows.length };
}

// ============================ summary reports ============================

export interface DepartmentSummaryRow {
  department: string;
  total_employees: number;
  present: number;
  late: number;
  early_leave: number;
  absent: number;
  incomplete: number;
  avg_work_min: number;
  total_overtime_min: number;
}

export async function getDepartmentSummary(filters: ReportFilters): Promise<{
  ok: boolean;
  rows?: DepartmentSummaryRow[];
  total?: number;
  message?: string;
}> {
  const { userId, profile } = await requireRole(REVIEW);
  const v = validateRange(filters.from, filters.to);
  if (!v.ok) return { ok: false, message: v.message };
  const supabase = await createClient();
  const scope = await reportScope(supabase, userId, profile.role, profile.organization_id ?? "");
  if (profile.role === "manager" && filters.employeeId && !scope.employeeIds?.includes(filters.employeeId)) {
    return { ok: false, message: "Nhân viên nằm ngoài phạm vi quản lý của bạn." };
  }

  let q = supabase
    .from("attendance_daily_summaries")
    .select(
      "work_date, status, total_work_min, overtime_min, employees!inner(department_id, departments!employees_department_id_fkey(name))",
      { count: "exact" },
    )
    .eq("organization_id", scope.orgId)
    .gte("work_date", v.from)
    .lte("work_date", v.to);
  if (scope.employeeIds) {
    q = q.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (filters.employeeId) q = q.eq("employee_id", filters.employeeId);
  if (filters.shiftId) q = q.eq("shift_id", filters.shiftId);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.departmentId) q = q.eq("employees.department_id", filters.departmentId);

  const { data, count } = await q;

  const deptMap = new Map<string, DepartmentSummaryRow>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const emp = row.employees as { department_id: string; departments: { name: string } | null } | null;
    const deptName = emp?.departments?.name ?? "Chưa phân phòng";
    const d = deptMap.get(deptName) ?? { department: deptName, total_employees: 0, present: 0, late: 0, early_leave: 0, absent: 0, incomplete: 0, avg_work_min: 0, total_overtime_min: 0 };
    const status = row.status as string;
    d.total_employees++;
    if (status === "present") d.present++;
    else if (status === "late") d.late++;
    else if (status === "early_leave") d.early_leave++;
    else if (status === "absent") d.absent++;
    else if (status === "incomplete") d.incomplete++;
    d.avg_work_min += (row.total_work_min as number) ?? 0;
    d.total_overtime_min += (row.overtime_min as number) ?? 0;
    deptMap.set(deptName, d);
  }

  const rows = Array.from(deptMap.values()).map((d) => ({
    ...d,
    avg_work_min: d.total_employees > 0 ? Math.round(d.avg_work_min / d.total_employees) : 0,
  }));

  return { ok: true, rows, total: count ?? 0 };
}

export interface EmployeeSummaryRow {
  employee_code: string;
  display_name: string;
  department: string;
  total_days: number;
  present: number;
  late: number;
  early_leave: number;
  absent: number;
  incomplete: number;
  total_work_min: number;
  total_overtime_min: number;
  avg_work_min: number;
}

export async function getEmployeeSummary(filters: ReportFilters): Promise<{
  ok: boolean;
  rows?: EmployeeSummaryRow[];
  total?: number;
  message?: string;
}> {
  const { userId, profile } = await requireRole(REVIEW);
  const v = validateRange(filters.from, filters.to);
  if (!v.ok) return { ok: false, message: v.message };
  const supabase = await createClient();
  const scope = await reportScope(supabase, userId, profile.role, profile.organization_id ?? "");
  if (profile.role === "manager" && filters.employeeId && !scope.employeeIds?.includes(filters.employeeId)) {
    return { ok: false, message: "Nhân viên nằm ngoài phạm vi quản lý của bạn." };
  }

  let q = supabase
    .from("attendance_daily_summaries")
    .select(
      "work_date, status, total_work_min, overtime_min, employees!inner(employee_code, department_id, profiles!employees_profile_id_fkey(display_name), departments!employees_department_id_fkey(name))",
      { count: "exact" },
    )
    .eq("organization_id", scope.orgId)
    .gte("work_date", v.from)
    .lte("work_date", v.to);
  if (scope.employeeIds) {
    q = q.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (filters.employeeId) q = q.eq("employee_id", filters.employeeId);
  if (filters.shiftId) q = q.eq("shift_id", filters.shiftId);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.departmentId) q = q.eq("employees.department_id", filters.departmentId);

  const { data, count } = await q;

  const empMap = new Map<string, EmployeeSummaryRow>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const emp = row.employees as {
      employee_code: string;
      department_id: string;
      profiles: { display_name: string } | null;
      departments: { name: string } | null;
    };
    const key = emp?.employee_code ?? "?";
    const e = empMap.get(key) ?? { employee_code: key, display_name: emp?.profiles?.display_name ?? "", department: emp?.departments?.name ?? "—", total_days: 0, present: 0, late: 0, early_leave: 0, absent: 0, incomplete: 0, total_work_min: 0, total_overtime_min: 0, avg_work_min: 0 };
    const status = row.status as string;
    e.total_days++;
    if (status === "present") e.present++;
    else if (status === "late") e.late++;
    else if (status === "early_leave") e.early_leave++;
    else if (status === "absent") e.absent++;
    else if (status === "incomplete") e.incomplete++;
    e.total_work_min += (row.total_work_min as number) ?? 0;
    e.total_overtime_min += (row.overtime_min as number) ?? 0;
    empMap.set(key, e);
  }

  const rows = Array.from(empMap.values()).map((e) => ({
    ...e,
    avg_work_min: e.total_days > 0 ? Math.round(e.total_work_min / e.total_days) : 0,
  }));

  return { ok: true, rows, total: count ?? 0 };
}

export interface LateEarlyReportRow {
  work_date: string;
  employee_code: string;
  display_name: string;
  department: string;
  shift: string;
  late_min: number;
  early_leave_min: number;
  status: string;
}

export async function getLateEarlyReport(filters: ReportFilters): Promise<{
  ok: boolean;
  rows?: LateEarlyReportRow[];
  total?: number;
  message?: string;
}> {
  const { userId, profile } = await requireRole(REVIEW);
  const v = validateRange(filters.from, filters.to);
  if (!v.ok) return { ok: false, message: v.message };
  const supabase = await createClient();
  const scope = await reportScope(supabase, userId, profile.role, profile.organization_id ?? "");
  if (profile.role === "manager" && filters.employeeId && !scope.employeeIds?.includes(filters.employeeId)) {
    return { ok: false, message: "Nhân viên nằm ngoài phạm vi quản lý của bạn." };
  }

  let q = supabase
    .from("attendance_daily_summaries")
    .select(
      "work_date, late_min, early_leave_min, status, employees!inner(employee_code, department_id, profiles!employees_profile_id_fkey(display_name), departments!employees_department_id_fkey(name)), work_shifts(name)",
      { count: "exact" },
    )
    .eq("organization_id", scope.orgId)
    .gte("work_date", v.from)
    .lte("work_date", v.to)
    .or("late_min.gt.0,early_leave_min.gt.0");
  if (scope.employeeIds) {
    q = q.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (filters.employeeId) q = q.eq("employee_id", filters.employeeId);
  if (filters.shiftId) q = q.eq("shift_id", filters.shiftId);
  if (filters.departmentId) q = q.eq("employees.department_id", filters.departmentId);

  const { data: rows, count: total } = await q.order("work_date", { ascending: false });

  const result = ((rows ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    work_date: r.work_date as string,
    employee_code: ((r.employees as { employee_code?: string } | null)?.employee_code) ?? "?",
    display_name: ((r.employees as { profiles: { display_name?: string } | null } | null)?.profiles?.display_name) ?? "",
    department: ((r.employees as { departments: { name?: string } | null } | null)?.departments?.name) ?? "—",
    shift: ((r.work_shifts as { name?: string } | null)?.name) ?? "—",
    late_min: (r.late_min as number) ?? 0,
    early_leave_min: (r.early_leave_min as number) ?? 0,
    status: r.status as string,
  }));

  return { ok: true, rows: result, total: total ?? 0 };
}

export interface MissingCheckReportRow {
  work_date: string;
  employee_code: string;
  display_name: string;
  department: string;
  shift: string;
  has_checkin: boolean;
  has_checkout: boolean;
  status: string;
}

export async function getMissingCheckReport(filters: ReportFilters): Promise<{
  ok: boolean;
  rows?: MissingCheckReportRow[];
  total?: number;
  message?: string;
}> {
  const { userId, profile } = await requireRole(REVIEW);
  const v = validateRange(filters.from, filters.to);
  if (!v.ok) return { ok: false, message: v.message };
  const supabase = await createClient();
  const scope = await reportScope(supabase, userId, profile.role, profile.organization_id ?? "");
  if (profile.role === "manager" && filters.employeeId && !scope.employeeIds?.includes(filters.employeeId)) {
    return { ok: false, message: "Nhân viên nằm ngoài phạm vi quản lý của bạn." };
  }

  // Lấy summaries có first_in hoặc last_out null
  let q = supabase
    .from("attendance_daily_summaries")
    .select(
      "work_date, first_in, last_out, status, employees!inner(employee_code, department_id, profiles!employees_profile_id_fkey(display_name), departments!employees_department_id_fkey(name)), work_shifts(name)",
      { count: "exact" },
    )
    .eq("organization_id", scope.orgId)
    .gte("work_date", v.from)
    .lte("work_date", v.to)
    .or("first_in.is.null,last_out.is.null");
  if (scope.employeeIds) {
    q = q.in("employee_id", scope.employeeIds.length > 0 ? scope.employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (filters.employeeId) q = q.eq("employee_id", filters.employeeId);
  if (filters.shiftId) q = q.eq("shift_id", filters.shiftId);
  if (filters.departmentId) q = q.eq("employees.department_id", filters.departmentId);

  const { data: rows, count: total } = await q.order("work_date", { ascending: false });

  const result = ((rows ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    work_date: r.work_date as string,
    employee_code: ((r.employees as { employee_code?: string } | null)?.employee_code) ?? "?",
    display_name: ((r.employees as { profiles: { display_name?: string } | null } | null)?.profiles?.display_name) ?? "",
    department: ((r.employees as { departments: { name?: string } | null } | null)?.departments?.name) ?? "—",
    shift: ((r.work_shifts as { name?: string } | null)?.name) ?? "—",
    has_checkin: (r.first_in as string) !== null,
    has_checkout: (r.last_out as string) !== null,
    status: r.status as string,
  }));

  return { ok: true, rows: result, total: total ?? 0 };
}