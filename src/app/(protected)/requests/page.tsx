import { Suspense } from "react";
import { requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { UnifiedRequestForm, MyRequests, ApprovalQueue } from "@/features/workflow/unified-panels";
import { Card, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/states";

export default function RequestsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">Yêu cầu của tôi</h1>
      <Suspense fallback={<LoadingState message="Đang tải…" />}>
        <RequestsData />
      </Suspense>
    </main>
  );
}

async function RequestsData() {
  const { userId, profile } = await requireUser();
  const supabase = await createClient();
  const { data: emp } = await supabase.from("employees").select("id").eq("profile_id", userId).single();
  const empId = (emp as { id: string } | null)?.id ?? "";

  // Fetch leave requests
  const { data: leaveMine } = await supabase
    .from("leave_requests")
    .select("id, leave_type, start_date, end_date, reason, status, created_at, reviewed_at, resolution_note, reviewer_id")
    .eq("employee_id", empId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Fetch adjustment requests
  const { data: adjMine } = await supabase
    .from("attendance_adjustment_requests")
    .select("id, work_date, requested_in, requested_out, reason, status, created_at, reviewed_at, resolution_note, reviewer_id")
    .eq("employee_id", empId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Unified rows for my requests
  const myRows: Array<{
    id: string;
    type: "leave" | "adjustment";
    leave_type?: string;
    start_date?: string;
    end_date?: string;
    work_date?: string;
    requested_in?: string | null;
    requested_out?: string | null;
    reason: string | null;
    status: string;
    employee_code?: string;
    manager_id?: string | null;
    created_at: string;
    reviewed_at: string | null;
    resolution_note: string | null;
  }> = [
    ...((leaveMine ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      type: "leave" as const,
      leave_type: r.leave_type as string,
      start_date: r.start_date as string,
      end_date: r.end_date as string,
      reason: (r.reason as string) ?? null,
      status: r.status as string,
      created_at: r.created_at as string,
      reviewed_at: (r.reviewed_at as string) ?? null,
      resolution_note: (r.resolution_note as string) ?? null,
    })),
    ...((adjMine ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      type: "adjustment" as const,
      work_date: r.work_date as string,
      requested_in: (r.requested_in as string) ?? null,
      requested_out: (r.requested_out as string) ?? null,
      reason: r.reason as string,
      status: r.status as string,
      created_at: r.created_at as string,
      reviewed_at: (r.reviewed_at as string) ?? null,
      resolution_note: (r.resolution_note as string) ?? null,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Check if user is reviewer
  const isReviewer = profile.role === "manager" || profile.role === "hr_admin" || profile.role === "system_admin";
  let queueRows: typeof myRows = [];

  if (isReviewer) {
    // Fetch pending leave requests for approval
    const { data: leaveQueue } = await supabase
      .from("leave_requests")
      .select("id, leave_type, start_date, end_date, reason, status, created_at, employee_id, employees!inner(employee_code, manager_id)")
      .eq("organization_id", profile.organization_id ?? "")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100);

    // Fetch pending adjustment requests for approval
    const { data: adjQueue } = await supabase
      .from("attendance_adjustment_requests")
      .select("id, work_date, requested_in, requested_out, reason, status, created_at, employee_id, employees!inner(employee_code, manager_id)")
      .eq("organization_id", profile.organization_id ?? "")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100);

    const leaveRows = ((leaveQueue ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      type: "leave" as const,
      leave_type: r.leave_type as string,
      start_date: r.start_date as string,
      end_date: r.end_date as string,
      reason: (r.reason as string) ?? null,
      status: r.status as string,
      employee_code: ((r.employees as { employee_code?: string } | null)?.employee_code) ?? "?",
      manager_id: ((r.employees as { manager_id?: string } | null)?.manager_id) ?? null,
      created_at: r.created_at as string,
      reviewed_at: null,
      resolution_note: null,
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
      manager_id: ((r.employees as { manager_id?: string } | null)?.manager_id) ?? null,
      created_at: r.created_at as string,
      reviewed_at: null,
      resolution_note: null,
    }));

    const allRows = [...leaveRows, ...adjRows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    queueRows = profile.role === "manager"
      ? allRows.filter((r) => r.manager_id === empId)
      : allRows;
  }

  return (
    <div className="flex flex-col gap-4">
      <UnifiedRequestForm />
      <Card>
        <CardTitle>Đơn của tôi</CardTitle>
        <div className="mt-3">
          <MyRequests rows={myRows} />
        </div>
      </Card>
      {isReviewer ? (
        <Card>
          <CardTitle>Hàng đợi duyệt</CardTitle>
          <div className="mt-3">
            <ApprovalQueue rows={queueRows} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}