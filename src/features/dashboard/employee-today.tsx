import Link from "next/link";
import { connection } from "next/server";
import { getTodayStatus } from "@/features/attendance/actions";
import { getPersonalHistory } from "@/features/reports/actions";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { APP_TZ } from "@/config/app";
import type { Profile } from "@/types/db";
import { DashboardHeader } from "./dashboard-header";
import { QuickActions, EMPLOYEE_QUICK_ACTIONS } from "./quick-actions";
import { SectionHeading } from "./section-heading";
import { TodayHero } from "./today-hero";
import {
  formatDuration,
  formatTime,
  summarizeToday,
  type BadgeTone,
  type TodayEvent,
} from "./today-summary";

const SHORT_DATE_FMT = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

const EVENT_META: Record<string, { label: string; tone: BadgeTone }> = {
  success: { label: "Thành công", tone: "success" },
  pending_review: { label: "Chờ rà soát", tone: "warning" },
  fallback: { label: "Thay thế", tone: "info" },
  failed: { label: "Thất bại", tone: "danger" },
};

const SUMMARY_META: Record<string, { label: string; tone: BadgeTone }> = {
  present: { label: "Đủ công", tone: "success" },
  late: { label: "Đi muộn", tone: "warning" },
  early_leave: { label: "Về sớm", tone: "warning" },
  absent: { label: "Vắng", tone: "danger" },
  incomplete: { label: "Thiếu lượt", tone: "info" },
};

const METHOD_LABELS: Record<string, string> = {
  face: "Khuôn mặt",
  pin_fallback: "PIN thay thế",
  manual: "Thủ công",
};

const METHOD_ICONS: Record<string, IconName> = {
  face: "scan-face",
  pin_fallback: "key",
  manual: "file-text",
};

function todayInTz(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function formatShortDate(value: string): string {
  return SHORT_DATE_FMT.format(new Date(`${value}T12:00:00`));
}

function EventIcon({ event }: { event: TodayEvent }) {
  const isIn = event.event_type === "check_in";
  return (
    <span
      className={
        isIn
          ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--success-bg)] text-[var(--success)] ring-1 ring-inset ring-[var(--success-border)]"
          : "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--info-bg)] text-[var(--info-strong)] ring-1 ring-inset ring-[var(--info-border)]"
      }
    >
      <Icon name={isIn ? "camera" : "logout"} size={16} />
    </span>
  );
}

export async function EmployeeToday({ profile }: { profile: Profile }) {
  await connection();
  const status = await getTodayStatus();

  if (!status.eligible) {
    return (
      <main className="page-shell flex flex-col gap-6">
        <DashboardHeader name={profile.display_name} />
        <Card>
          <EmptyState
            icon="id-card"
            title="Tài khoản chưa gắn với nhân viên"
            description="Liên hệ HR để cập nhật hồ sơ nhân sự trước khi chấm công."
            action={
              <Link href="/requests" className={buttonClassName({ variant: "secondary" })}>
                Gửi yêu cầu
              </Link>
            }
          />
        </Card>
      </main>
    );
  }

  const todayStr = todayInTz();
  const month = todayStr.slice(0, 7);
  const history = await getPersonalHistory(month, 1);
  const todayRow = history.rows.find((row) => row.work_date === todayStr) ?? null;
  const identityRow = history.rows[0] ?? null;

  const summary = summarizeToday(status, todayRow);
  const {
    events,
    firstIn,
    lastOut,
    workedMin,
    lateMinutes,
    earlyMinutes,
    firstInLabel,
    lastOutLabel,
    statusLabel,
    statusTone,
  } = summary;

  const weekRows = history.rows.filter((row) => row.work_date <= todayStr).slice(0, 7);
  const presentDays = weekRows.filter((row) =>
    ["present", "late", "early_leave"].includes(row.status),
  ).length;
  const weekMinutes = weekRows.reduce((sum, row) => sum + row.total_work_min, 0);
  const lateCount = weekRows.filter((row) => row.late_min > 0).length;

  return (
    <main className="page-shell flex flex-col gap-6">
      <DashboardHeader name={profile.display_name} />

      <TodayHero
        employeeName={profile.display_name}
        employeeCode={identityRow?.employee_code}
        department={identityRow?.department_name}
        shift={status.shift}
        statusLabel={statusLabel}
        statusTone={statusTone}
        hasEnrollment={status.hasEnrollment}
        enrollmentState={status.enrollmentState}
        canCheckIn={status.canCheckIn}
        canCheckOut={status.canCheckOut}
        firstInLabel={firstInLabel}
        lastOutLabel={lastOutLabel}
        workedLabel={formatDuration(workedMin)}
        lastEventAt={status.lastEvent ? formatTime(status.lastEvent.occurred_at) : null}
        todayCount={status.todayCount}
      />

      {/* Số liệu nhanh hôm nay */}
      <section aria-labelledby="today-stats-heading" className="flex flex-col gap-3">
        <SectionHeading
          id="today-stats-heading"
          icon="activity"
          title="Chỉ số hôm nay"
          description="Cập nhật theo lượt chấm công thực tế của bạn"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="Giờ vào"
            value={firstInLabel}
            icon="camera"
            tone={firstIn ? "brand" : "neutral"}
            hint={firstIn ? "Lượt vào đầu tiên" : "Chưa có lượt vào"}
          />
          <StatCard
            label="Giờ ra"
            value={lastOutLabel}
            icon="logout"
            tone={lastOut ? "info" : "neutral"}
            hint={lastOut ? "Lượt ra gần nhất" : "Chưa có lượt ra"}
          />
          <StatCard
            label="Thời gian làm việc"
            value={formatDuration(workedMin)}
            icon="clock"
            tone={workedMin > 0 ? "success" : "neutral"}
            hint="Tính đến hiện tại"
          />
          <StatCard
            label="Đi muộn"
            value={lateMinutes > 0 ? `${lateMinutes}′` : "0′"}
            icon="alert"
            tone={lateMinutes > 0 ? "warning" : "neutral"}
            hint={lateMinutes > 0 ? "Có ghi nhận đi muộn" : "Đúng giờ"}
          />
          <StatCard
            label="Về sớm"
            value={earlyMinutes > 0 ? `${earlyMinutes}′` : "0′"}
            icon="arrow-down"
            tone={earlyMinutes > 0 ? "warning" : "neutral"}
            hint={earlyMinutes > 0 ? "Có ghi nhận về sớm" : "Đủ giờ"}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-12">
        {/* Lịch sử chấm công hôm nay */}
        <Card className="flex flex-col xl:col-span-7 2xl:col-span-8">
          <CardHeader
            title="Lịch sử chấm công hôm nay"
            description="Các lượt vào/ra đã ghi nhận trong ngày"
            action={
              <Link
                href="/history"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--brand)] hover:underline"
              >
                Xem tất cả <Icon name="arrow-up-right" size={13} />
              </Link>
            }
          />

          {events.length === 0 ? (
            <EmptyState
              compact
              icon="clock"
              title="Chưa có lượt chấm công"
              description="Bấm “Chấm công vào” ở thẻ ca làm để bắt đầu ngày làm việc."
              action={
                status.canCheckIn ? (
                  <Link
                    href="/check-in"
                    className={buttonClassName({ size: "sm", variant: "soft" })}
                  >
                    <Icon name="camera" size={14} /> Chấm công vào
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
              <div className="hidden grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)] sm:grid">
                <span>Thời gian</span>
                <span>Loại chấm công</span>
                <span>Phương thức</span>
                <span className="text-right">Trạng thái</span>
              </div>
              <ol aria-label="Các lượt chấm công hôm nay" className="divide-y divide-[var(--border)]">
                {events.map((event, index) => {
                  const meta = EVENT_META[event.status] ?? {
                    label: event.status,
                    tone: "neutral" as BadgeTone,
                  };
                  const typeLabel =
                    event.event_type === "check_in" ? "Chấm công vào" : "Chấm công ra";
                  const methodLabel = METHOD_LABELS[event.method] ?? event.method;
                  const confidence =
                    event.confidence !== null && event.confidence !== undefined
                      ? Math.round(event.confidence * 100)
                      : null;

                  return (
                    <li
                      key={`${event.occurred_at}-${index}`}
                      className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-[var(--surface-muted)] sm:grid sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] sm:items-center sm:gap-3"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <EventIcon event={event} />
                        <div className="min-w-0">
                          <p className="tnum text-[15px] font-semibold leading-tight text-[var(--navy-900)]">
                            {formatTime(event.occurred_at)}
                          </p>
                          <p className="mt-0.5 truncate text-[12px] text-[var(--text-3)] sm:hidden">
                            {typeLabel} · {methodLabel}
                            {confidence !== null ? ` · ${confidence}%` : ""}
                          </p>
                        </div>
                      </div>

                      <p className="hidden text-[13px] font-medium text-[var(--text-1)] sm:block">
                        {typeLabel}
                      </p>

                      <div className="hidden min-w-0 items-center gap-1.5 text-[13px] text-[var(--text-2)] sm:flex">
                        <Icon
                          name={METHOD_ICONS[event.method] ?? "camera"}
                          size={14}
                          className="shrink-0 text-[var(--text-3)]"
                        />
                        <span className="truncate">{methodLabel}</span>
                        {confidence !== null ? (
                          <span className="shrink-0 text-[11px] text-[var(--text-3)]">
                            · {confidence}%
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between gap-2 sm:justify-end">
                        <span className="text-[11px] font-medium text-[var(--text-3)] sm:hidden">
                          Trạng thái
                        </span>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </Card>

        {/* Tóm tắt 7 ngày gần đây */}
        <Card className="flex flex-col xl:col-span-5 2xl:col-span-4">
          <CardHeader
            title="Chấm công gần đây"
            description="7 ngày làm việc gần nhất"
            action={
              <Link
                href="/history"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--brand)] hover:underline"
              >
                Chi tiết <Icon name="arrow-up-right" size={13} />
              </Link>
            }
          />

          <dl className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-2.5">
              <dt className="text-[11px] font-medium text-[var(--text-3)]">Có mặt</dt>
              <dd className="tnum mt-1 text-[20px] font-bold leading-none text-[var(--navy-900)]">
                {presentDays}
              </dd>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-2.5">
              <dt className="text-[11px] font-medium text-[var(--text-3)]">Giờ làm</dt>
              <dd className="tnum mt-1 text-[20px] font-bold leading-none text-[var(--navy-900)]">
                {formatDuration(weekMinutes)}
              </dd>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-2.5">
              <dt className="text-[11px] font-medium text-[var(--text-3)]">Đi muộn</dt>
              <dd className="tnum mt-1 text-[20px] font-bold leading-none text-[var(--navy-900)]">
                {lateCount}
              </dd>
            </div>
          </dl>

          {weekRows.length === 0 ? (
            <EmptyState
              compact
              icon="calendar"
              title="Chưa có dữ liệu gần đây"
              description="Các ngày đã chấm công sẽ xuất hiện tại đây."
            />
          ) : (
            <ul className="mt-4 flex flex-col divide-y divide-[var(--border)]">
              {weekRows.map((row) => {
                const meta = SUMMARY_META[row.status] ?? {
                  label: row.status,
                  tone: "neutral" as BadgeTone,
                };
                return (
                  <li key={row.work_date} className="flex items-center gap-2.5 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-subtle)] text-[var(--text-3)]">
                      <Icon name="calendar" size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-[var(--navy-800)]">
                        {formatShortDate(row.work_date)}
                      </p>
                      <p className="tnum mt-0.5 text-[12px] text-[var(--text-3)]">
                        {row.first_in ? formatTime(row.first_in) : "—"} –{" "}
                        {row.last_out ? formatTime(row.last_out) : "—"}
                      </p>
                    </div>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Thao tác nhanh */}
      <section aria-labelledby="quick-actions-heading" className="flex flex-col gap-3">
        <SectionHeading
          id="quick-actions-heading"
          icon="sparkles"
          title="Thao tác nhanh"
          description="Truy cập nhanh các chức năng thường dùng"
        />
        <QuickActions actions={EMPLOYEE_QUICK_ACTIONS} />
      </section>
    </main>
  );
}
