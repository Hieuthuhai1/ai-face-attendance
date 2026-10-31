/**
 * Luật tính công dùng chung (Phase 3) — hàm thuần, chạy server-side.
 * Múi giờ lấy từ organization (mặc định Asia/Ho_Chi_Minh). Client time không dùng.
 */

export function parseTimeToMinutes(hhmm: string): number {
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(hhmm);
  if (!m) throw new Error(`INVALID_TIME:${hhmm}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`INVALID_TIME:${hhmm}`);
  return h * 60 + min;
}

/** Phút từ đầu ngày theo wall-clock của timeZone (dùng Intl, không tin giờ client). */
export function wallMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return get("hour") * 60 + get("minute");
}

/**
 * Trễ (phút) trong cùng ngày làm: grace chỉ là ngưỡng miễn trừ, KHÔNG trừ vào
 * số phút báo cáo. Ví dụ ca 08:00, check-in 09:00, grace 5 → trễ 60 phút.
 * Ca qua đêm: check-in sau nửa đêm (trước 12:00) được cộng 24h để so đúng.
 */
export function minutesLate(
  actual: Date,
  shiftStart: string,
  graceMin: number,
  roundingMin: number,
  timeZone: string,
  overnight = false,
): number {
  const start = parseTimeToMinutes(shiftStart);
  let actualMin = wallMinutes(actual, timeZone);
  if (overnight && actualMin < 12 * 60 && actualMin < start) actualMin += 1440;
  const diff = actualMin - start;
  if (diff <= graceMin) return 0;
  return Math.floor(diff / roundingMin) * roundingMin;
}

/**
 * Về sớm (phút) trong cùng ngày làm: grace chỉ là ngưỡng miễn trừ, KHÔNG trừ
 * vào số phút báo cáo. Ví dụ ca kết thúc 17:00, check-out 16:00, grace 5 →
 * về sớm 60 phút.
 */
export function minutesEarlyLeave(
  actual: Date,
  shiftEnd: string,
  graceMin: number,
  roundingMin: number,
  timeZone: string,
): number {
  const diff = parseTimeToMinutes(shiftEnd) - wallMinutes(actual, timeZone);
  if (diff <= graceMin) return 0;
  return Math.floor(diff / roundingMin) * roundingMin;
}

/** ISO instant của 00:00 wall-clock ngày `dateStr` theo timeZone (tránh lệch UTC). */
export function zonedStartOfDayIso(dateStr: string, timeZone: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  const offsetMin = wallMinutes(new Date(utcMidnight + 12 * 3600000), timeZone) - 12 * 60;
  return new Date(utcMidnight - offsetMin * 60000).toISOString();
}

/** Độ dài ca (phút); ca qua đêm cộng 24h. */
export function shiftDurationMinutes(start: string, end: string, overnight: boolean): number {
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  if (overnight && e <= s) return e + 1440 - s;
  return Math.max(0, e - s);
}

/**
 * Event sau nửa đêm có thuộc work_date hôm trước không (ca qua đêm).
 * eventMinutes: wall-clock phút của event; shiftEnd: giờ kết thúc ca.
 */
export function isOvernightSpill(
  eventMinutes: number,
  shiftEnd: string,
  overnight: boolean,
  bufferMin = 120,
): boolean {
  if (!overnight) return false;
  return eventMinutes <= parseTimeToMinutes(shiftEnd) + bufferMin;
}
