import { Suspense } from "react";
import { PageHeader } from "@/components/app/app-shell";
import { requireRole } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { EmployeeManager, type EmployeeRow } from "@/features/hr/employee-manager";
import { ErrorState, LoadingState } from "@/components/ui/states";

const PAGE_SIZE = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ["active", "inactive", "terminated"] as const;
type EmployeeStatus = (typeof STATUSES)[number];

interface EmployeeSearchParams {
  q?: string;
  page?: string;
  status?: string;
  departmentId?: string;
}

export default function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<EmployeeSearchParams>;
}) {
  return (
    <main className="page-shell flex flex-col gap-6">
      <PageHeader
        title="Quản lý nhân viên"
        description="Tra cứu hồ sơ, phòng ban và trạng thái làm việc của nhân viên trong tổ chức."
      />
      <Suspense fallback={<LoadingState message="Đang tải danh sách nhân viên…" />}>
        <EmployeeData searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function EmployeeData({
  searchParams,
}: {
  searchParams: Promise<EmployeeSearchParams>;
}) {
  const { profile } = await requireRole(["hr_admin", "system_admin"]);
  const params = await searchParams;
  const orgId = profile.organization_id ?? "";

  // Bỏ ký tự có thể phá cú pháp `.or()` của PostgREST.
  const q = (params.q ?? "").replace(/[(),]/g, " ").trim();
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const status = STATUSES.includes(params.status as EmployeeStatus)
    ? (params.status as EmployeeStatus)
    : "all";
  const departmentId = UUID_RE.test(params.departmentId ?? "") ? (params.departmentId as string) : "";

  const supabase = await createClient();

  // Tải song song dữ liệu nền; tìm theo tên/email cần map profile_id trước.
  const [{ data: profiles }, { data: departments }, { data: allEmployees }, { data: linked }, { data: managerLookup }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, display_name, is_active")
        .eq("organization_id", orgId)
        .order("email"),
      supabase
        .from("departments")
        .select("id, name")
        .eq("organization_id", orgId)
        .order("name"),
      supabase
        .from("employees")
        .select("id, employee_code")
        .eq("organization_id", orgId)
        .eq("employment_status", "active")
        .order("employee_code"),
      supabase.from("employees").select("profile_id").eq("organization_id", orgId),
      // Quản lý trực tiếp: tra riêng thay vì self-join
      // `employees!employees_manager_id_fkey` (không có trong schema cache
      // của PostgREST → PGRST200 làm hỏng toàn bộ truy vấn).
      supabase.from("employees").select("id, employee_code").eq("organization_id", orgId),
    ]);

  const profileRows = (profiles ?? []) as Array<{
    id: string;
    email: string;
    display_name: string;
    is_active: boolean;
  }>;

  const qLower = q.toLocaleLowerCase("vi");
  const matchedProfileIds = q
    ? profileRows
        .filter(
          (p) =>
            (p.display_name ?? "").toLocaleLowerCase("vi").includes(qLower) ||
            (p.email ?? "").toLocaleLowerCase("vi").includes(qLower),
        )
        .map((p) => p.id)
    : [];

  let query = supabase
    .from("employees")
    .select(
      "id, organization_id, profile_id, employee_code, department_id, manager_id, title, employment_status, hired_at, terminated_at, departments(name), profiles!employees_profile_id_fkey(display_name, email, is_active)",
      { count: "exact" },
    )
    .eq("organization_id", orgId);

  if (q) {
    const parts = [`employee_code.ilike.%${q}%`, `title.ilike.%${q}%`];
    if (matchedProfileIds.length > 0) {
      parts.push(`profile_id.in.(${matchedProfileIds.join(",")})`);
    }
    query = query.or(parts.join(","));
  }
  if (status !== "all") query = query.eq("employment_status", status);
  if (departmentId) query = query.eq("department_id", departmentId);

  const { data: employees, count, error } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (error) {
    return (
      <ErrorState
        title="Không tải được danh sách nhân viên"
        description="Vui lòng thử lại sau hoặc kiểm tra kết nối cơ sở dữ liệu."
      />
    );
  }

  const linkedIds = new Set((linked ?? []).map((r) => r.profile_id as string | null));
  const managerCodes = new Map(
    (managerLookup ?? []).map((m) => [m.id as string, m.employee_code as string]),
  );
  const rows: EmployeeRow[] = ((employees ?? []) as unknown as Array<Record<string, unknown>>).map((e) => ({
    id: e.id as string,
    employee_code: e.employee_code as string,
    title: (e.title as string) ?? "",
    employment_status: e.employment_status as EmployeeRow["employment_status"],
    department_id: (e.department_id as string) ?? null,
    department_name: ((e.departments as { name?: string } | null)?.name) ?? "—",
    manager_id: (e.manager_id as string) ?? null,
    manager_code: managerCodes.get((e.manager_id as string) ?? "") ?? "—",
    display_name: ((e.profiles as { display_name?: string } | null)?.display_name) ?? "",
    email: ((e.profiles as { email?: string } | null)?.email) ?? "",
    profile_active: ((e.profiles as { is_active?: boolean } | null)?.is_active) ?? true,
    hired_at: (e.hired_at as string | null) ?? null,
    phone: null,
  }));

  return (
    <EmployeeManager
      key={[q, status, departmentId, page].join("|")}
      rows={rows}
      total={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      q={q}
      status={status}
      departmentId={departmentId}
      departments={(departments ?? []).map((d) => ({ id: d.id as string, name: d.name as string }))}
      managers={(allEmployees ?? []).map((m) => ({ id: m.id as string, employee_code: m.employee_code as string }))}
      freeProfiles={profileRows
        .filter((p) => p.is_active && !linkedIds.has(p.id))
        .map((p) => ({ id: p.id, email: p.email, display_name: p.display_name ?? "" }))}
    />
  );
}
