import { Suspense } from "react";
import { requireRole } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { ApprovalCenter } from "@/features/workflow/approval-center";
import { LoadingState } from "@/components/ui/states";

export default function ApprovalPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">Trung tâm duyệt</h1>
      <Suspense fallback={<LoadingState message="Đang tải…" />}>
        <ApprovalData />
      </Suspense>
    </main>
  );
}

async function ApprovalData() {
  const { profile } = await requireRole(["manager", "hr_admin", "system_admin"]);
  const supabase = await createClient();

  // Fetch pending leave requests
  const { data: leaveQueue } = await supabase
    .from("leave_requests")
    .select("id, leave_type, start_date, end_date, reason, status, created_at, employee_id, employees!inner(employee_code, department_id, manager_id, departments!employees_department_id_fkey(name))")
    .eq("organization_id", profile.organization_id ?? "")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);

  // Fetch pending adjustment requests
  const { data: adjQueue } = await supabase
    .from("attendance_adjustment_requests")
    .select("id, work_date, requested_in, requested_out, reason, status, created_at, employee_id, employees!inner(employee_code, department_id, manager_id, departments!employees_department_id_fkey(name))")
    .eq("organization_id", profile.organization_id ?? "")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);

  const leaveRows = ((leaveQueue ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    type: "leave" as const,
    leave_type: r.leave_type as string,
    start_date: r.start_date as string,
    end_date: r.end_date as string,
    reason: (r.reason as string) ?? null,
    status: r.status as string,
    employee_code: ((r.employees as { employee_code?: string } | null)?.employee_code) ?? "?",
    department: ((r.employees as { departments?: { name?: string } | null } | null)?.departments?.name) ?? "—",
    employee_id: ((r.employees as { id?: string } | null)?.id) ?? "",
    created_at: r.created_at as string,
  }));

  const adjRows = ((adjQueue ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    type: "adjustment" as const,
    work_date: r.work_date as string,
    requested_in: (r.requested_in as string) ?? null,
    requested_out: (r.requested_out as string) ?? null,
    reason: r.reason as string,
    status: r.status as string,
    employee_code: ((r.employees as { employee_code?: string } | null)?.employee_code) ?? "?",
    department: ((r.employees as { departments?: { name?: string } | null } | null)?.departments?.name) ?? "—",
    employee_id: ((r.employees as { id?: string } | null)?.id) ?? "",
    created_at: r.created_at as string,
  }));

  const allRows = [...leaveRows, ...adjRows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return <ApprovalCenter rows={allRows} />;
}