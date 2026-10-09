import { Suspense } from "react";
import { requireRole } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { ShiftManager } from "@/features/hr/shift-manager";
import { LoadingState } from "@/components/ui/states";

export default function ShiftsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Quản lý ca làm & phân ca</h1>
      <Suspense fallback={<LoadingState message="Đang tải ca làm…" />}>
        <ShiftData />
      </Suspense>
    </main>
  );
}

async function ShiftData() {
  const { profile } = await requireRole(["hr_admin", "system_admin"]);
  const supabase = await createClient();
  const orgId = profile.organization_id ?? "";

  const [{ data: shifts }, { data: assignments }, { data: employees }] = await Promise.all([
    supabase.from("work_shifts").select("*").eq("organization_id", orgId).order("start_time"),
    supabase
      .from("shift_assignments")
      .select("id, effective_from, effective_to, employee_id, shift_id, employees!inner(employee_code), work_shifts!inner(name)")
      .eq("organization_id", orgId)
      .order("effective_from", { ascending: false })
      .limit(100),
    supabase.from("employees").select("id, employee_code").eq("organization_id", orgId).eq("employment_status", "active").order("employee_code"),
  ]);

  return (
    <ShiftManager
      shifts={(shifts ?? []).map((s) => ({
        id: s.id as string,
        name: s.name as string,
        start_time: (s.start_time as string).slice(0, 5),
        end_time: (s.end_time as string).slice(0, 5),
        overnight: s.overnight as boolean,
        grace_in_min: s.grace_in_min as number,
        grace_out_min: s.grace_out_min as number,
        rounding_min: s.rounding_min as number,
      }))}
      assignments={((assignments ?? []) as unknown as Array<Record<string, unknown>>).map((a) => ({
        id: a.id as string,
        employee_code: ((a.employees as { employee_code?: string } | null)?.employee_code) ?? "?",
        shift_name: ((a.work_shifts as { name?: string } | null)?.name) ?? "?",
        effective_from: a.effective_from as string,
        effective_to: (a.effective_to as string) ?? null,
      }))}
      employees={(employees ?? []).map((e) => ({ id: e.id as string, employee_code: e.employee_code as string }))}
    />
  );
}
