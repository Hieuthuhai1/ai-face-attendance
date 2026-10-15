import { Suspense } from "react";
import { requireRole } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { EmployeeManager, type EmployeeRow } from "@/features/hr/employee-manager";
import { LoadingState } from "@/components/ui/states";

const PAGE_SIZE = 20;

export default function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Quản lý nhân viên</h1>
      <Suspense fallback={<LoadingState message="Đang tải danh sách…" />}>
        <EmployeeData searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function EmployeeData({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const { profile } = await requireRole(["hr_admin", "system_admin"]);
  const params = await searchParams;
  const q = (params.q ?? "").replace(/,/g, " ").trim();
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const status = params.status === "inactive" ? "inactive" : "all";

  const supabase = await createClient();
  let query = supabase
    .from("employees")
    .select(
      "id, organization_id, profile_id, employee_code, department_id, manager_id, title, employment_status, hired_at, terminated_at, departments(name), manager:employees!employees_manager_id_fkey(employee_code), profiles!employees_profile_id_fkey(display_name, email, is_active)",
      { count: "exact" },
    )
    .eq("organization_id", profile.organization_id ?? "")
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.or(`employee_code.ilike.%${q}%,title.ilike.%${q}%`);
  if (status === "inactive") query = query.neq("employment_status", "active");

  const [{ data: employees, count }, { data: departments }, { data: allEmployees }, { data: profiles }] =
    await Promise.all([
      query,
      supabase.from("departments").select("id, name").eq("organization_id", profile.organization_id ?? "").order("name"),
      supabase.from("employees").select("id, employee_code").eq("organization_id", profile.organization_id ?? "").eq("employment_status", "active").order("employee_code"),
      supabase.from("profiles").select("id, email, display_name").eq("organization_id", profile.organization_id ?? "").eq("is_active", true).order("email"),
    ]);

  const { data: linked } = await supabase.from("employees").select("profile_id").eq("organization_id", profile.organization_id ?? "");
  const linkedIds = new Set((linked ?? []).map((r) => r.profile_id));

  const rows: EmployeeRow[] = ((employees ?? []) as unknown as Array<Record<string, unknown>>).map((e) => ({
    id: e.id as string,
    employee_code: e.employee_code as string,
    title: (e.title as string) ?? "",
    employment_status: e.employment_status as EmployeeRow["employment_status"],
    department_id: (e.department_id as string) ?? null,
    department_name: ((e.departments as { name?: string } | null)?.name) ?? "—",
    manager_id: (e.manager_id as string) ?? null,
    manager_code: ((e.manager as { employee_code?: string } | null)?.employee_code) ?? "—",
    display_name: ((e.profiles as { display_name?: string } | null)?.display_name) ?? "",
    email: ((e.profiles as { email?: string } | null)?.email) ?? "",
    profile_active: ((e.profiles as { is_active?: boolean } | null)?.is_active) ?? true,
  }));

  return (
    <EmployeeManager
      rows={rows}
      total={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      q={q}
      status={status}
      departments={(departments ?? []).map((d) => ({ id: d.id as string, name: d.name as string }))}
      managers={(allEmployees ?? []).map((m) => ({ id: m.id as string, employee_code: m.employee_code as string }))}
      freeProfiles={(profiles ?? [])
        .filter((p) => !linkedIds.has(p.id as string))
        .map((p) => ({ id: p.id as string, email: p.email as string, display_name: (p.display_name as string) ?? "" }))}
    />
  );
}
