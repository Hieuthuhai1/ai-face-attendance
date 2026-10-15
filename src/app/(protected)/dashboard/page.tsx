import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { getTodayStatus } from "@/features/attendance/actions";
import { getPersonalHistory } from "@/features/reports/actions";
import { getDashboard } from "@/features/reports/actions";
import { hasRole, REVIEW_ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/app/app-shell";

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

const DAY_STATUS_MAP = {
  present: "ontime",
  late: "late",
  early_leave: "early_leave",
  absent: "absent",
  incomplete: "needs_review",
} as const;

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ forbidden?: string; date?: string }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6">
      <Suspense fallback={<LoadingState message="Đang tải tổng quan…" />}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<{ forbidden?: string; date?: string }>;
}) {
  const { profile } = await requireUser();
  const params = await searchParams;
  const supabase = await createClient();
  const name = profile.display_name || profile.email;
  const isReviewer = hasRole(profile.role, REVIEW_ROLES);
  const isHr = profile.role === "hr_admin" || profile.role === "system_admin";

  const [status, history] = await Promise.all([
    getTodayStatus(),
    getPersonalHistory(new Date().toISOString().slice(0, 7), 1),
  ]);
  const recentMine = history.rows.slice(0, 5);

  let reviewer: {
    stats: Awaited<ReturnType<typeof getDashboard>>;
    pendingEnroll: number;
    pendingAdj: number;
    pendingLeave: number;
    recentEvents: Array<{ event_type: string; status: string; occurred_at: string; who: string }>;
    day: string;
  } | null = null;

  if (isReviewer) {
    const day = params.date ?? new Date().toISOString().slice(0, 10);
    const stats = await getDashboard(day);
    const [{ count: pendingEnroll }, { count: pendingAdj }, { count: pendingLeave }, { data: events }] =
      await Promise.all([
        supabase.from("face_enrollments").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("attendance_adjustment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase
          .from("attendance_events")
          .select("event_type, status, occurred_at, employees!inner(employee_code, profiles!employees_profile_id_fkey(display_name))")
          .order("occurred_at", { ascending: false })
          .limit(8),
      ]);
    reviewer = {
      stats,
      pendingEnroll: pendingEnroll ?? 0,
      pendingAdj: pendingAdj ?? 0,
      pendingLeave: pendingLeave ?? 0,
      recentEvents: ((events ?? []) as unknown as Array<Record<string, unknown>>).map((e) => {
        const emp = e.employees as { employee_code: string; profiles: { display_name: string } | null };
        return {
          event_type: e.event_type as string,
          status: e.status as string,
          occurred_at: e.occurred_at as string,
          who: `${emp?.employee_code ?? "?"} — ${emp?.profiles?.display_name ?? ""}`,
        };
      }),
      day,
    };
  }

  const todayStr = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" });
  const lastIn =
    status.eligible && status.lastEvent?.event_type === "check_in" ? status.lastEvent.occurred_at : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Xin chào, ${name}`}
        description={`${todayStr} · Vai trò: ${profile.role}`}
      />

      {params.forbidden ? (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          Bạn không có quyền truy cập trang vừa rồi.
        </p>
      ) : null}

      {/* Của tôi hôm nay */}
      <section aria-label="Hôm nay của tôi" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ca hôm nay"
          value={status.eligible && status.shift ? status.shift.name : "Không có ca"}
          icon="calendar"
          href="/check-in"
          hint={status.eligible && status.shift ? `${status.shift.start_time}–${status.shift.end_time}` : undefined}
        />
        <StatCard
          label="Giờ vào"
          value={fmtTime(lastIn)}
          icon="clock"
          tone="info"
          href="/history"
        />
        <StatCard
          label="Trạng thái"
          value={
            !status.eligible
              ? "Chưa đủ điều kiện"
              : status.canCheckOut
                ? "Đã vào, chưa ra"
                : status.canCheckIn
                  ? "Chờ chấm công"
                  : "Hoàn tất hôm nay"
          }
          icon={status.canCheckOut ? "flag" : "check"}
          tone={status.canCheckOut ? "warning" : "success"}
          href="/check-in"
        />
        <StatCard label="Chấm công" value={status.canCheckIn ? "Vào" : status.canCheckOut ? "Ra" : "—"} icon="camera" tone="neutral" href="/check-in" hint="Mở trang chấm công" />
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/check-in">
          <Button disabled={!status.eligible || (!status.canCheckIn && !status.canCheckOut)}>
            {status.canCheckOut ? "Chấm công ra" : "Chấm công vào"}
          </Button>
        </Link>
        <Link href="/history">
          <Button variant="secondary">Lịch sử của tôi</Button>
        </Link>
      </div>

      {/* Lịch sử gần đây của tôi */}
      <Card>
        <CardTitle>Công gần đây</CardTitle>
        <div className="mt-2 flex flex-col divide-y divide-slate-100">
          {recentMine.length === 0 ? (
            <EmptyState title="Chưa có bản ghi" description="Chấm công xong sẽ hiện ở đây." />
          ) : (
            recentMine.map((r) => (
              <div key={r.work_date} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="tnum font-medium">{fmtDate(r.work_date + "T00:00:00")} · {r.shift_name}</span>
                <span className="tnum text-slate-500">
                  {fmtTime(r.first_in)} – {fmtTime(r.last_out)}
                </span>
                <StatusIndicator status={DAY_STATUS_MAP[r.status as keyof typeof DAY_STATUS_MAP] ?? "idle"} />
              </div>
            ))
          )}
        </div>
      </Card>

      {/* HR/Manager */}
      {reviewer ? (
        <>
          <form method="get" className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Ngày xem
              <input type="date" name="date" defaultValue={reviewer.day} className="h-10 rounded-lg border border-slate-300 px-3" />
            </label>
            <Button type="submit" variant="secondary" size="sm">Xem</Button>
          </form>
          <section aria-label="Tổng quan tổ chức" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Nhân sự" value={reviewer.stats.totalActive} icon="users" href="/admin/employees" />
            <StatCard label="Đã chấm công" value={reviewer.stats.checkedIn} icon="check" tone="success" href="/reports" />
            <StatCard label="Đi trễ" value={reviewer.stats.late} icon="clock" tone="warning" href="/reports" />
            <StatCard label="Về sớm" value={reviewer.stats.earlyLeave} icon="clock" tone="warning" href="/reports" />
            <StatCard label="Vắng (có ca)" value={reviewer.stats.absent} icon="x" tone="danger" href="/reports" />
            <StatCard label="Chờ rà soát" value={reviewer.stats.pendingReview} icon="flag" tone="info" href="/reports" />
          </section>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Enroll chờ duyệt" value={reviewer.pendingEnroll} icon="shield" tone="warning" href="/admin/enrollments" />
            <StatCard label="Chỉnh công chờ" value={reviewer.pendingAdj} icon="file" tone="warning" href="/adjustments" />
            <StatCard label="Đơn nghỉ chờ" value={reviewer.pendingLeave} icon="calendar" tone="warning" href="/leave" />
          </div>
          <Card>
            <CardTitle>Sự kiện gần đây</CardTitle>
            <div className="mt-2 flex flex-col divide-y divide-slate-100">
              {reviewer.recentEvents.length === 0 ? (
                <EmptyState title="Chưa có sự kiện" description="Sự kiện chấm công mới nhất sẽ hiện ở đây." />
              ) : (
                reviewer.recentEvents.map((e, i) => (
                  <div key={`${e.occurred_at}-${i}`} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="truncate">{e.who}</span>
                    <span className="tnum shrink-0 text-slate-500">
                      {e.event_type === "check_in" ? "Vào" : "Ra"} · {fmtTime(e.occurred_at)}
                    </span>
                    <StatusIndicator
                      status={e.status === "success" ? "success" : e.status === "failed" ? "error" : "pending"}
                    />
                  </div>
                ))
              )}
            </div>
          </Card>
        </>
      ) : null}

      {isHr ? (
        <Card>
          <CardTitle>Quản trị</CardTitle>
          <CardDescription>Nhân sự, ca làm, xác minh khuôn mặt, audit.</CardDescription>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/admin/employees"><Button size="sm">Nhân viên</Button></Link>
            <Link href="/admin/shifts"><Button size="sm" variant="secondary">Ca làm</Button></Link>
            <Link href="/admin/enrollments"><Button size="sm" variant="secondary">Xác minh khuôn mặt</Button></Link>
            <Link href="/audit"><Button size="sm" variant="secondary">Audit</Button></Link>
            <Link href="/reports"><Button size="sm" variant="secondary">Báo cáo</Button></Link>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
