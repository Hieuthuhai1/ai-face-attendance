import Link from "next/link";
import { connection } from "next/server";
import { getTodayStatus } from "@/features/attendance/actions";
import { getPersonalHistory } from "@/features/reports/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/app/app-shell";
import { LiveClock } from "@/components/app/live-clock";
import { APP_TZ } from "@/config/app";
import { minutesEarlyLeave, minutesLate } from "@/lib/attendance/rules";
import type { Profile } from "@/types/db";

type TodayStatus = Awaited<ReturnType<typeof getTodayStatus>>;
type TodayEvent = Extract<TodayStatus, { eligible: true }>["events"][number];
type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const TIME_FMT = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: APP_TZ,
});
const DATE_FMT = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: APP_TZ,
});
const HOUR_FMT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hour12: false,
  timeZone: APP_TZ,
});
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

function minutesBetween(from: string, to: string): number {
  const diff = new Date(to).getTime() - new Date(from).getTime();
  return Number.isFinite(diff) ? Math.max(0, Math.round(diff / 60000)) : 0;
}

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "0h00";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function formatTime(value: string): string {
  return TIME_FMT.format(new Date(value));
}

function formatShortDate(value: string): string {
  return SHORT_DATE_FMT.format(new Date(`${value}T12:00:00`));
}

function greetingForNow(): string {
  const hour = Number(HOUR_FMT.format(new Date()));
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

function EventIcon({ event }: { event: TodayEvent }) {
  const isIn = event.event_type === "check_in";
  return (
    <span
      className={
        isIn
          ? "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--success-bg)] text-[var(--success)]"
          : "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--info-bg)] text-[var(--info)]"
      }
    >
      <Icon name={isIn ? "camera" : "logout"} size={15} />
    </span>
  );
}

export async function EmployeeToday({ profile }: { profile: Profile }) {
  await connection();
  const status = await getTodayStatus();
  const todayStr = todayInTz();
  const month = todayStr.slice(0, 7);

  if (!status.eligible) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6">
        <PageHeader title="Hôm nay" description="Tổng quan chấm công của bạn" />
        <Card>
          <EmptyState
            title="Tài khoản chưa gắn với nhân viên"
            description="Liên hệ HR để cập nhật hồ sơ nhân sự trước khi chấm công."
            action={
              <Link href="/requests">
                <Button variant="secondary">Gửi yêu cầu</Button>
              </Link>
            }
          />
        </Card>
      </main>
    );
  }

  const history = await getPersonalHistory(month, 1);
  const todayRow = history.rows.find((r) => r.work_date === todayStr) ?? null;

  const events = [...status.events].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  // Lượt failed vẫn hiện trong timeline nhưng không được tính là giờ vào/ra.
  const countedEvents = events.filter((e) => e.status !== "failed");
  const firstIn = countedEvents.find((e) => e.event_type === "check_in") ?? null;
  const lastOut = [...countedEvents].reverse().find((e) => e.event_type === "check_out") ?? null;

  const computedWorked = firstIn
    ? minutesBetween(firstIn.occurred_at, lastOut?.occurred_at ?? new Date().toISOString())
    : 0;
  const workedMin =
    todayRow && todayRow.total_work_min > 0 ? todayRow.total_work_min : computedWorked;

  const isOpen = status.canCheckOut;
  const completed = lastOut !== null;
  const shiftLabel = status.shift ? status.shift.name : "Chưa có ca làm";
  const statusLabel = !status.shift
    ? "Ngoài ca làm"
    : isOpen
      ? "Đang trong ca"
      : completed
        ? "Đã hoàn thành"
        : "Chưa chấm công";
  const statusTone: BadgeTone = !status.shift
    ? "neutral"
    : isOpen
      ? "success"
      : completed
        ? "info"
        : "warning";

  const weekRows = history.rows.filter((r) => r.work_date <= todayStr).slice(0, 7);
  const presentDays = weekRows.filter((r) =>
    ["present", "late", "early_leave"].includes(r.status),
  ).length;
  const weekMinutes = weekRows.reduce((sum, r) => sum + r.total_work_min, 0);
  const lateCount = weekRows.filter((r) => r.late_min > 0).length;

  // Ưu tiên số liệu server đã chốt, nhưng vẫn tính dự phòng từ event để trang
  // Hôm nay đúng ngay sau khi chấm công (kể cả khi summary chưa kịp cập nhật).
  const computedLate =
    firstIn && status.shift
      ? minutesLate(
          new Date(firstIn.occurred_at),
          status.shift.start_time,
          status.shift.grace_in_min,
          status.shift.rounding_min,
          APP_TZ,
          status.shift.overnight,
        )
      : 0;
  const computedEarly =
    lastOut && status.shift
      ? minutesEarlyLeave(
          new Date(lastOut.occurred_at),
          status.shift.end_time,
          status.shift.grace_out_min,
          status.shift.rounding_min,
          APP_TZ,
        )
      : 0;
  const lateMinutes = Math.max(todayRow?.late_min ?? 0, computedLate);
  const earlyMinutes = Math.max(todayRow?.early_leave_min ?? 0, computedEarly);
  const firstInLabel = firstIn ? formatTime(firstIn.occurred_at) : todayRow?.first_in ? formatTime(todayRow.first_in) : "--:--";
  const lastOutLabel = lastOut ? formatTime(lastOut.occurred_at) : todayRow?.last_out ? formatTime(todayRow.last_out) : "--:--";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6">
      <PageHeader
        title="Hôm nay"
        description={`${greetingForNow()}, ${profile.display_name} · ${DATE_FMT.format(new Date())}`}
        actions={<LiveClock />}
      />

      {/* Trạng thái ca làm + hành động chính */}
      <Card className="relative overflow-hidden border-[var(--brand)]/15 bg-gradient-to-br from-[var(--brand-soft)] via-white to-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[var(--brand)]/[0.07] blur-2xl"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--brand)]">
              <Icon name="clock" size={14} /> Ca làm hôm nay
            </p>
            <h2 className="mt-2 truncate text-2xl font-bold text-slate-900">{shiftLabel}</h2>
            {status.shift ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                <Icon name="clock" size={14} />
                <span className="tnum">
                  {status.shift.start_time} – {status.shift.end_time}
                </span>
                {status.shift.overnight ? <span className="text-slate-400">· qua đêm</span> : null}
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">
                Liên hệ quản lý nếu bạn cần được phân ca hôm nay.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge tone={statusTone}>{statusLabel}</Badge>
              {status.hasEnrollment ? (
                <Badge tone="success">
                  <Icon name="check" size={12} /> Khuôn mặt sẵn sàng
                </Badge>
              ) : status.enrollmentState === "pending" ? (
                <Badge tone="warning">Khuôn mặt chờ duyệt</Badge>
              ) : (
                <Badge tone="warning">Chưa đăng ký khuôn mặt</Badge>
              )}
              {status.lastEvent ? (
                <span className="text-xs text-slate-500">
                  Cập nhật {formatTime(status.lastEvent.occurred_at)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            {status.canCheckOut ? (
              <Link href="/check-in">
                <Button size="lg" className="w-full sm:w-auto">
                  <Icon name="logout" size={18} /> Chấm công ra
                </Button>
              </Link>
            ) : status.canCheckIn ? (
              <Link href="/check-in">
                <Button size="lg" className="w-full sm:w-auto">
                  <Icon name="camera" size={18} /> Chấm công vào
                </Button>
              </Link>
            ) : !status.hasEnrollment ? (
              <Link href="/enrollment">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  <Icon name="scan-face" size={18} /> Đăng ký khuôn mặt
                </Button>
              </Link>
            ) : (
              <Link href="/history">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  <Icon name="clock" size={18} /> Xem lịch sử
                </Button>
              </Link>
            )}
            <p className="text-xs text-slate-500">Xác minh 1:1 · Không lưu ảnh thô</p>
          </div>
        </div>
      </Card>

      {/* Số liệu nhanh hôm nay */}
      <section aria-label="Số liệu hôm nay" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Giờ vào"
          value={firstInLabel}
          icon="camera"
          tone={firstIn ? "success" : "neutral"}
          hint="Lượt vào đầu tiên"
        />
        <StatCard
          label="Giờ ra"
          value={lastOutLabel}
          icon="logout"
          tone={lastOut ? "info" : "neutral"}
          hint="Lượt ra gần nhất"
        />
        <StatCard label="Thời gian làm" value={formatDuration(workedMin)} icon="clock" tone="neutral" hint="Tính đến hiện tại" />
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
          icon="clock"
          tone={earlyMinutes > 0 ? "warning" : "neutral"}
          hint={earlyMinutes > 0 ? "Có ghi nhận về sớm" : "Đủ giờ"}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Timeline hôm nay */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Lịch sử hôm nay</CardTitle>
            <Link href="/history" className="text-xs font-medium text-[var(--brand)] hover:underline">
              Xem tất cả
            </Link>
          </div>

          {events.length === 0 ? (
            <EmptyState
              title="Chưa có lượt chấm công"
              description="Bấm “Chấm công vào” để bắt đầu ngày làm việc."
            />
          ) : (
            <ol className="mt-4" aria-label="Các lượt chấm công hôm nay">
              {events.map((event, index) => {
                const meta = EVENT_META[event.status] ?? { label: event.status, tone: "neutral" as BadgeTone };
                return (
                  <li key={`${event.occurred_at}-${index}`} className="relative flex gap-3 pb-5 last:pb-0">
                    {index < events.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className="absolute left-4 top-8 h-[calc(100%-1.5rem)] w-px bg-slate-200"
                      />
                    ) : null}
                    <EventIcon event={event} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">
                          {event.event_type === "check_in" ? "Chấm công vào" : "Chấm công ra"}
                        </p>
                        <span className="tnum text-sm font-semibold text-slate-700">
                          {formatTime(event.occurred_at)}
                        </span>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {METHOD_LABELS[event.method] ?? event.method}
                        {event.confidence !== null && event.confidence !== undefined
                          ? ` · Khớp ${Math.round(event.confidence * 100)}%`
                          : ""}
                        {event.liveness_status ? ` · Liveness: ${event.liveness_status}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        {/* Tóm tắt 7 ngày gần đây */}
        <Card>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Chấm công gần đây</CardTitle>
            <Link href="/history" className="text-xs font-medium text-[var(--brand)] hover:underline">
              Chi tiết
            </Link>
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-[var(--surface-muted)] p-2.5">
              <dt className="text-[11px] font-medium text-slate-500">Có mặt</dt>
              <dd className="tnum mt-1 text-lg font-bold text-slate-900">{presentDays}</dd>
            </div>
            <div className="rounded-lg bg-[var(--surface-muted)] p-2.5">
              <dt className="text-[11px] font-medium text-slate-500">Giờ làm</dt>
              <dd className="tnum mt-1 text-lg font-bold text-slate-900">{formatDuration(weekMinutes)}</dd>
            </div>
            <div className="rounded-lg bg-[var(--surface-muted)] p-2.5">
              <dt className="text-[11px] font-medium text-slate-500">Đi muộn</dt>
              <dd className="tnum mt-1 text-lg font-bold text-slate-900">{lateCount}</dd>
            </div>
          </dl>

          {weekRows.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Chưa có dữ liệu chấm công gần đây.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {weekRows.map((row) => {
                const meta = SUMMARY_META[row.status] ?? { label: row.status, tone: "neutral" as BadgeTone };
                return (
                  <li key={row.work_date} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="text-slate-600">{formatShortDate(row.work_date)}</span>
                    <span className="tnum text-xs text-slate-500">
                      {row.first_in ? formatTime(row.first_in) : "—"} –{" "}
                      {row.last_out ? formatTime(row.last_out) : "—"}
                    </span>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Thao tác nhanh */}
      <section aria-label="Thao tác nhanh" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/check-in", icon: "camera", title: "Chấm công", desc: "Xác minh khuôn mặt" },
          { href: "/history", icon: "clock", title: "Lịch sử", desc: "Bảng công của bạn" },
          { href: "/requests", icon: "file", title: "Yêu cầu", desc: "Chỉnh công, nghỉ phép" },
          { href: "/enrollment", icon: "scan-face", title: "Khuôn mặt", desc: "Trạng thái đăng ký" },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[var(--brand)]/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
                <Icon name={action.icon} size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                <p className="truncate text-xs text-slate-500">{action.desc}</p>
              </div>
              <Icon
                name="chevron-right"
                size={16}
                className="ml-auto shrink-0 text-slate-300 transition group-hover:text-[var(--brand)]"
              />
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
