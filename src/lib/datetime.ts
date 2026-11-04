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
