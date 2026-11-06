import { Suspense } from "react";
import { PageHeader } from "@/components/app/app-shell";
import { requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { AdjustmentForm, AdjustmentQueue, MyAdjustments, type AdjustmentRow } from "@/features/workflow/adjustment-panels";
import { Card, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/states";

export default function AdjustmentsPage() {
  return (
    <main className="flex-1 flex flex-col gap-6 px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Chỉnh sửa công"
        description="Yêu cầu chỉnh sửa thời gian làm việc"
      />
      <Suspense fallback={<LoadingState message="Đang tải…" />}>
        <AdjustmentsData />
      </Suspense>
    </main>
  );
}

function toRow(r: Record<string, unknown>): AdjustmentRow {
  const emp = r.employees as { employee_code?: string } | null;
  return {
    id: r.id as string,
    work_date: r.work_date as string,
    requested_in: (r.requested_in as string) ?? null,
    requested_out: (r.requested_out as string) ?? null,
    reason: r.reason as string,
    status: r.status as string,
    employee_code: emp?.employee_code,
    resolution_note: (r.resolution_note as string) ?? null,
  };
}

async function AdjustmentsData() {
  const { userId, profile } = await requireUser();
  const supabase = await createClient();
  const { data: emp } = await supabase.from("employees").select("id").eq("profile_id", userId).single();
  const empId = (emp as { id: string } | null)?.id ?? "";

  const { data: mine } = await supabase
    .from("attendance_adjustment_requests")
    .select("id, work_date, requested_in, requested_out, reason, status, resolution_note")
    .eq("employee_id", empId)
    .order("work_date", { ascending: false })
    .limit(50);

  const isReviewer = profile.role === "manager" || profile.role === "hr_admin" || profile.role === "system_admin";
  let queue: AdjustmentRow[] = [];
  if (isReviewer) {
    const q = supabase
      .from("attendance_adjustment_requests")
      .select("id, work_date, requested_in, requested_out, reason, status, employee_id, employees!inner(employee_code, manager_id)")
      .eq("organization_id", profile.organization_id ?? "")
      .eq("status", "pending")
      .order("work_date", { ascending: true })
      .limit(100);
    const { data } = await q;
    const rows = ((data ?? []) as unknown as Array<Record<string, unknown>>).map(toRow);
    queue = profile.role === "manager"
      ? rows.filter((r, i) => ((data as unknown as Array<Record<string, unknown>>)[i]?.employees as { manager_id?: string })?.manager_id === empId)
      : rows;
  }

  return (
    <div className="flex flex-col gap-4">
      <AdjustmentForm />
      <Card>
        <CardTitle>Yêu cầu của tôi</CardTitle>
        <div className="mt-3">
          <MyAdjustments rows={((mine ?? []) as unknown as Array<Record<string, unknown>>).map(toRow)} />
        </div>
      </Card>
      {isReviewer ? (
        <Card>
          <CardTitle>Hàng đợi duyệt</CardTitle>
          <div className="mt-3">
            <AdjustmentQueue rows={queue} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
