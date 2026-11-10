import { Suspense } from "react";
import { PageHeader } from "@/components/app/app-shell";
import { requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { UnifiedRequestForm, MyRequests, ApprovalQueue } from "@/features/workflow/unified-panels";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { LoadingState } from "@/components/ui/states";

export default function RequestsPage() {
  return (
    <main className="page-shell flex flex-col gap-6">
      <PageHeader
        eyebrow="Trung tâm yêu cầu"
        icon="inbox"
        title="Yêu cầu của tôi"
        description="Gửi đơn nghỉ, chỉnh công và theo dõi trạng thái duyệt trong một nơi."
      />
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

  const counts = {
    pending: myRows.filter((row) => row.status === "pending").length,
    approved: myRows.filter((row) => row.status === "approved").length,
    rejected: myRows.filter((row) => row.status === "rejected").length,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatusSummary label="Tổng yêu cầu" value={myRows.length} icon="inbox" tone="brand" />
        <StatusSummary label="Chờ duyệt" value={counts.pending} icon="clock" tone="warning" />
        <StatusSummary label="Đã duyệt" value={counts.approved} icon="check" tone="success" />
        <StatusSummary label="Từ chối" value={counts.rejected} icon="x" tone="danger" />
      </div>

      <UnifiedRequestForm />

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Đơn của tôi</CardTitle>
            <p className="mt-1 text-[13px] text-[var(--text-2)]">
              Tất cả đơn nghỉ và yêu cầu chỉnh công bạn đã gửi.
            </p>
          </div>
          <Badge tone="brand">{myRows.length} yêu cầu</Badge>
        </div>
        <div className="mt-4">
          <MyRequests rows={myRows} />
        </div>
      </Card>

      {isReviewer ? (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Hàng đợi duyệt</CardTitle>
              <p className="mt-1 text-[13px] text-[var(--text-2)]">
                Yêu cầu đang chờ bạn hoặc HR xử lý.
              </p>
            </div>
            <Badge tone={queueRows.length > 0 ? "warning" : "success"}>
              <Icon name="clock" size={12} /> {queueRows.length} chờ duyệt
            </Badge>
          </div>
          <div className="mt-4">
            <ApprovalQueue rows={queueRows} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function StatusSummary({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: "inbox" | "clock" | "check" | "x";
  tone: "brand" | "warning" | "success" | "danger";
}) {
  const toneClass =
    tone === "warning"
      ? "bg-[var(--warning-bg)] text-[var(--warning)] ring-[var(--warning-border)]"
      : tone === "success"
        ? "bg-[var(--success-bg)] text-[var(--success)] ring-[var(--success-border)]"
        : tone === "danger"
          ? "bg-[var(--danger-bg)] text-[var(--danger)] ring-[var(--danger-border)]"
          : "bg-[var(--brand-soft)] text-[var(--brand)] ring-blue-100";
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-xs)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-[9px] ring-1 ring-inset ${toneClass}`}>
          <Icon name={icon} size={14} />
        </span>
      </div>
      <p className="tnum mt-1.5 text-[22px] font-bold leading-none text-[var(--navy-900)]">{value}</p>
    </div>
  );
}