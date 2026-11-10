import { Suspense } from "react";
import { PageHeader } from "@/components/app/app-shell";
import { requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { LeaveForm, LeaveList, type LeaveRow } from "@/features/workflow/leave-panels";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { LoadingState } from "@/components/ui/states";

export default function LeavePage() {
  return (
    <main className="page-shell flex flex-col gap-6">
      <PageHeader
        eyebrow="Nghỉ phép"
        icon="calendar"
        title="Đơn nghỉ"
        description="Gửi đơn nghỉ và theo dõi trạng thái duyệt của quản lý/HR."
      />
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

  const mineRows = ((mine ?? []) as unknown as Array<Record<string, unknown>>).map(toRow);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand">{mineRows.length} đơn của tôi</Badge>
        <Badge tone={mineRows.some((row) => row.status === "pending") ? "warning" : "success"}>
          <Icon name="clock" size={12} /> {mineRows.filter((row) => row.status === "pending").length} chờ duyệt
        </Badge>
        {isReviewer ? (
          <Badge tone={queue.length > 0 ? "warning" : "success"}>
            <Icon name="inbox" size={12} /> {queue.length} trong hàng đợi
          </Badge>
        ) : null}
      </div>

      <LeaveForm />

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Đơn của tôi</CardTitle>
            <p className="mt-1 text-[13px] text-[var(--text-2)]">
              Các đơn nghỉ đã gửi và phản hồi từ người duyệt.
            </p>
          </div>
          <Badge tone="neutral">{mineRows.length} bản ghi</Badge>
        </div>
        <div className="mt-4">
          <LeaveList rows={mineRows} reviewable={false} />
        </div>
      </Card>

      {isReviewer ? (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Hàng đợi duyệt</CardTitle>
              <p className="mt-1 text-[13px] text-[var(--text-2)]">
                Đơn nghỉ đang chờ bạn hoặc HR xử lý.
              </p>
            </div>
            <Badge tone={queue.length > 0 ? "warning" : "success"}>{queue.length} chờ duyệt</Badge>
          </div>
          <div className="mt-4">
            <LeaveList rows={queue} reviewable />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
