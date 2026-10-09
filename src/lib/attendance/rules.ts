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

/** Trễ (phút), đã trừ grace, làm tròn xuống theo rounding. */
export function minutesLate(
  actual: Date,
  shiftStart: string,
  graceMin: number,
  roundingMin: number,
  timeZone: string,
): number {
  const diff = wallMinutes(actual, timeZone) - parseTimeToMinutes(shiftStart) - graceMin;
  if (diff <= 0) return 0;
  return Math.floor(diff / roundingMin) * roundingMin;
}

/** Về sớm (phút), đã trừ grace, làm tròn xuống theo rounding. */
export function minutesEarlyLeave(
  actual: Date,
  shiftEnd: string,
  graceMin: number,
  roundingMin: number,
  timeZone: string,
): number {
  const diff = parseTimeToMinutes(shiftEnd) - graceMin - wallMinutes(actual, timeZone);
  if (diff <= 0) return 0;
  return Math.floor(diff / roundingMin) * roundingMin;
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
