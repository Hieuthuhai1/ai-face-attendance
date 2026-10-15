import { Suspense } from "react";
import { requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { LeaveForm, LeaveList, type LeaveRow } from "@/features/workflow/leave-panels";
import { Card, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/states";

export default function LeavePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Đơn nghỉ</h1>
      <Suspense fallback={<LoadingState message="Đang tải…" />}>
        <LeaveData />
      </Suspense>
    </main>
  );
}

async function LeaveData() {
  const { userId, profile } = await requireUser();
  const supabase = await createClient();
  const { data: emp } = await supabase.from("employees").select("id").eq("profile_id", userId).single();
  const empId = (emp as { id: string } | null)?.id ?? "";

  const { data: mine } = await supabase
    .from("leave_requests")
    .select("id, leave_type, start_date, end_date, reason, status")
    .eq("employee_id", empId)
    .order("start_date", { ascending: false })
    .limit(50);

  const isReviewer = profile.role === "manager" || profile.role === "hr_admin" || profile.role === "system_admin";
  let queue: LeaveRow[] = [];
  if (isReviewer) {
    const { data } = await supabase
      .from("leave_requests")
      .select("id, leave_type, start_date, end_date, reason, status, employee_id, employees!inner(employee_code, manager_id)")
      .eq("organization_id", profile.organization_id ?? "")
      .eq("status", "pending")
      .order("start_date", { ascending: true })
      .limit(100);
    const rows = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      leave_type: r.leave_type as string,
      start_date: r.start_date as string,
      end_date: r.end_date as string,
      reason: (r.reason as string) ?? null,
      status: r.status as string,
      employee_code: ((r.employees as { employee_code?: string } | null)?.employee_code) ?? "?",
      manager_id: ((r.employees as { manager_id?: string } | null)?.manager_id) ?? null,
    }));
    queue = (profile.role === "manager" ? rows.filter((r) => r.manager_id === empId) : rows)
      .map((r) => ({
        id: r.id, leave_type: r.leave_type, start_date: r.start_date,
        end_date: r.end_date, reason: r.reason, status: r.status,
        employee_code: r.employee_code,
      }));
  }

  const toRow = (r: Record<string, unknown>): LeaveRow => ({
    id: r.id as string,
    leave_type: r.leave_type as string,
    start_date: r.start_date as string,
    end_date: r.end_date as string,
    reason: (r.reason as string) ?? null,
    status: r.status as string,
  });

  return (
    <div className="flex flex-col gap-4">
      <LeaveForm />
      <Card>
        <CardTitle>Đơn của tôi</CardTitle>
        <div className="mt-3">
          <LeaveList rows={((mine ?? []) as unknown as Array<Record<string, unknown>>).map(toRow)} reviewable={false} />
        </div>
      </Card>
      {isReviewer ? (
        <Card>
          <CardTitle>Hàng đợi duyệt</CardTitle>
          <div className="mt-3">
            <LeaveList rows={queue} reviewable />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
