/**
 * Định dạng ngày/giờ theo múi giờ của ứng dụng (mặc định Asia/Ho_Chi_Minh).
 *
 * Vì sao cần: các Server Component chạy trên Vercel theo UTC. Nếu dùng
 * `toLocaleTimeString()` không truyền `timeZone`, giờ vào/ra sẽ hiển thị theo
 * UTC (lệch 7 giờ so với giờ Việt Nam) trong khi receipt ở client lại theo múi
 * giờ trình duyệt. Mọi nơi hiển thị giờ chấm công phải dùng helper này.
 */

import { APP_TZ } from "@/config/app";

type DateInput = string | Date;

function toDate(value: DateInput): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTimeInZone(
  value: DateInput,
  timeZone: string = APP_TZ,
  withSeconds = false,
): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    hour12: false,
  }).format(date);
}

export function formatDateInZone(value: DateInput, timeZone: string = APP_TZ): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatShortDateInZone(value: DateInput, timeZone: string = APP_TZ): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTimeInZone(value: DateInput, timeZone: string = APP_TZ): string {
  const date = toDate(value);
  if (!date) return "—";
  return `${formatShortDateInZone(date, timeZone)} ${formatTimeInZone(date, timeZone)}`;
}

/**
 * Định dạng chuỗi ngày thuần `YYYY-MM-DD` (work_date, hired_at) → `dd/mm/yyyy`.
 * Không dùng `new Date()` để tránh lệch ngày khi server chạy UTC.
 */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Tổng thời gian làm việc từ số phút → `8h32` (ngắn, dùng trong bảng).
 * Giá trị âm/không hợp lệ trả về `0h00`.
 */
export function formatDurationMinutes(minutes: number | null | undefined): string {
  const total = minutes == null || !Number.isFinite(minutes) ? 0 : Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

/**
 * Ngày hôm nay (YYYY-MM-DD) theo múi giờ ứng dụng.
 * Server chạy UTC nên `new Date().toISOString().slice(0, 10)` sẽ lệch ngày
 * trong khoảng 00:00–07:00 giờ Việt Nam — dùng helper này cho `work_date`.
 */
export function todayInZone(timeZone: string = APP_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
