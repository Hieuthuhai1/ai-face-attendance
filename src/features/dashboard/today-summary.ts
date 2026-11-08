import { APP_TZ } from "@/config/app";
import { minutesEarlyLeave, minutesLate } from "@/lib/attendance/rules";

/** Tone badge dùng chung cho trạng thái ca / lượt chấm công. */
export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

export interface TodayEvent {
  event_type: string;
  status: string;
  occurred_at: string;
  method: string;
  confidence: number | null;
  liveness_status: string | null;
}

export interface TodayShift {
  name: string;
  start_time: string;
  end_time: string;
  overnight: boolean;
  grace_in_min: number;
  grace_out_min: number;
  rounding_min: number;
}

export interface TodaySummaryRow {
  total_work_min: number;
  late_min: number;
  first_in: string | null;
  last_out: string | null;
}

export interface TodayStatusInput {
  shift: TodayShift | null;
  events: TodayEvent[];
  canCheckIn: boolean;
  canCheckOut: boolean;
}

export interface TodaySummary {
  events: TodayEvent[];
  firstIn: TodayEvent | null;
  lastOut: TodayEvent | null;
  workedMin: number;
  lateMinutes: number;
  earlyMinutes: number;
  firstInLabel: string;
  lastOutLabel: string;
  isOpen: boolean;
  completed: boolean;
  statusLabel: string;
  statusTone: BadgeTone;
}

const TIME_FMT = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: APP_TZ,
});

export function formatTime(value: string): string {
  return TIME_FMT.format(new Date(value));
}

export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "0h00";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function minutesBetween(from: string, to: string): number {
  const diff = new Date(to).getTime() - new Date(from).getTime();
  return Number.isFinite(diff) ? Math.max(0, Math.round(diff / 60000)) : 0;
}

/**
 * Tổng hợp số liệu "hôm nay" từ dữ liệu server.
 *
 * Logic giữ nguyên như bản cũ: lượt `failed` vẫn hiện trong timeline nhưng
 * không được tính vào giờ vào/ra; ca đang mở tính từ lượt vào gần nhất để
 * không cộng khoảng nghỉ giữa hai lượt; summary server được ưu tiên khi đã chốt.
 */
export function summarizeToday(
  status: TodayStatusInput,
  todayRow: TodaySummaryRow | null,
  now: Date = new Date(),
): TodaySummary {
  const events = [...status.events].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const countedEvents = events.filter((event) => event.status !== "failed");
  const firstIn = countedEvents.find((event) => event.event_type === "check_in") ?? null;
  const lastIn = [...countedEvents].reverse().find((event) => event.event_type === "check_in") ?? null;
  // Chỉ coi là đã ra khi lượt gần nhất là check-out. Nếu người dùng check-in
  // lại sau khi đã ra, lượt ra cũ không được hiển thị như giờ ra hiện tại.
  const lastOut =
    countedEvents.length > 0 && countedEvents[countedEvents.length - 1]?.event_type === "check_out"
      ? countedEvents[countedEvents.length - 1] ?? null
      : null;

  // Ca đang mở: tính từ lượt vào gần nhất để không cộng khoảng nghỉ giữa 2 lượt.
  const sessionStart = lastOut ? firstIn : (lastIn ?? firstIn);
  const computedWorked = sessionStart
    ? minutesBetween(sessionStart.occurred_at, lastOut?.occurred_at ?? now.toISOString())
    : 0;
  const workedMin =
    lastOut && todayRow && todayRow.total_work_min > 0 ? todayRow.total_work_min : computedWorked;

  const isOpen = status.canCheckOut;
  const completed = lastOut !== null;
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
          status.shift.end_time,
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
  // Khi ca đang mở, không lấy early/last_out cũ từ summary của lượt trước.
  const earlyMinutes = lastOut ? computedEarly : 0;
  const firstInLabel = firstIn
    ? formatTime(firstIn.occurred_at)
    : todayRow?.first_in
      ? formatTime(todayRow.first_in)
      : "--:--";
  const lastOutLabel = lastOut
    ? formatTime(lastOut.occurred_at)
    : !status.canCheckOut && todayRow?.last_out
      ? formatTime(todayRow.last_out)
      : "--:--";

  return {
    events,
    firstIn,
    lastOut,
    workedMin,
    lateMinutes,
    earlyMinutes,
    firstInLabel,
    lastOutLabel,
    isOpen,
    completed,
    statusLabel,
    statusTone,
  };
}
