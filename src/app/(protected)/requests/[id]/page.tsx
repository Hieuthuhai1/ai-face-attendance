import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { UnifiedRequestDetail } from "@/features/workflow/unified-panels";
import { LoadingState } from "@/components/ui/states";
import { notFound } from "next/navigation";

interface RequestDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function RequestDetailPage({ params }: RequestDetailPageProps) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">Chi tiết yêu cầu</h1>
      <Suspense fallback={<LoadingState message="Đang tải…" />}>
        <RequestDetailContent params={params} />
      </Suspense>
    </main>
  );
}

async function RequestDetailContent({ params }: RequestDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Try leave request first
  const { data: leaveReq } = await supabase
    .from("leave_requests")
    .select("id, leave_type, start_date, end_date, reason, status, created_at, reviewed_at, resolution_note, reviewer_id, employee_id, employees!inner(employee_code)")
    .eq("id", id)
    .single();

  if (leaveReq) {
    const row = leaveReq as unknown as Record<string, unknown>;
    const emp = row.employees as { employee_code?: string } | null;
    return (
      <UnifiedRequestDetail
        row={{
          id: row.id as string,
          type: "leave",
          leave_type: row.leave_type as string,
          start_date: row.start_date as string,
          end_date: row.end_date as string,
          reason: (row.reason as string) ?? null,
          status: row.status as string,
          employee_code: emp?.employee_code ?? "—",
          reviewed_at: (row.reviewed_at as string) ?? null,
          resolution_note: (row.resolution_note as string) ?? null,
          created_at: row.created_at as string,
        }}
      />
    );
  }

  // Try adjustment request
  const { data: adjReq } = await supabase
    .from("attendance_adjustment_requests")
    .select("id, work_date, requested_in, requested_out, reason, status, created_at, reviewed_at, resolution_note, reviewer_id, employee_id, employees!inner(employee_code)")
    .eq("id", id)
    .single();

  if (adjReq) {
    const row = adjReq as unknown as Record<string, unknown>;
    const emp = row.employees as { employee_code?: string } | null;
    return (
      <UnifiedRequestDetail
        row={{
          id: row.id as string,
          type: "adjustment",
          work_date: row.work_date as string,
          requested_in: (row.requested_in as string) ?? null,
          requested_out: (row.requested_out as string) ?? null,
          reason: row.reason as string,
          status: row.status as string,
          employee_code: emp?.employee_code ?? "—",
          reviewed_at: (row.reviewed_at as string) ?? null,
          resolution_note: (row.resolution_note as string) ?? null,
          created_at: row.created_at as string,
        }}
      />
    );
  }

  notFound();
}