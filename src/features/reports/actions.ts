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
    .select("work_date, first_in, last_out, late_min, early_leave_min, total_work_min, status, work_shifts(name)", { count: "exact" })
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
  status: string;
}

function baseReportQuery(supabase: Db, scope: Scope, f: ReportFilters) {
  let q = supabase
    .from("attendance_daily_summaries")
    .select(
      "work_date, first_in, last_out, late_min, early_leave_min, total_work_min, status, employees!inner(employee_code, department_id, profiles!employees_profile_id_fkey(display_name), departments!employees_department_id_fkey(name)), work_shifts(name)",
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

const CSV_HEADERS = ["Ngay", "Ma NV", "Ho ten", "Phong ban", "Ca", "Check-in", "Check-out", "Tre (phut)", "Ve som (phut)", "Lam viec (phut)", "Trang thai"];

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
    r.late_min, r.early_leave_min, r.total_work_min, r.status,
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
