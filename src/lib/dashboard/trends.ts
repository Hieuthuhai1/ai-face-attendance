/**
 * Tổng hợp dữ liệu chấm công theo ngày / tuần / tháng.
 *
 * Thuần hàm (không I/O) để test được: nhận đúng các bản ghi đọc từ
 * `attendance_daily_summaries`, `shift_assignments`, `leave_requests` và
 * `employees` rồi trả về chuỗi ngày + bucket.
 *
 * Quy ước số liệu (không suy diễn ngoài dữ liệu):
 * - `assigned`: nhân viên active có phân ca phủ ngày đó.
 * - `checked_in`: có summary với `first_in` khác null.
 * - `present` / `late` / `early_leave`: theo `status` của summary.
 * - `on_leave`: nhân viên active có đơn nghỉ đã duyệt phủ ngày đó.
 * - `absent`: `assigned - checked_in - (nghỉ phép có ca)` (không âm).
 * - `attendance_rate`: checked_in / assigned (null nếu chưa phân ca).
 * - `on_time_rate`: present / checked_in (null nếu chưa ai chấm công).
 */

export type TrendGranularity = "week" | "month";

export interface AttendanceSummaryRow {
  employee_id: string;
  work_date: string;
  status: string;
  first_in: string | null;
}

export interface ShiftAssignmentRow {
  employee_id: string;
  effective_from: string;
  effective_to: string | null;
}

export interface LeaveRangeRow {
  employee_id: string;
  start_date: string;
  end_date: string;
}

export interface TrendDay {
  date: string;
  label: string;
  assigned: number;
  checked_in: number;
  present: number;
  late: number;
  early_leave: number;
  absent: number;
  on_leave: number;
  attendance_rate: number | null;
  on_time_rate: number | null;
}

export type TrendTotals = Omit<TrendDay, "date" | "label">;

export interface TrendBucket extends TrendTotals {
  key: string;
  label: string;
  from: string;
  to: string;
}

const DAY_MS = 86_400_000;
const MAX_SPAN_DAYS = 400;

export function parseISODate(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function formatISODate(ms: number): string {
  const d = new Date(ms);
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${month}-${day}`;
}

export function addDays(date: string, delta: number): string {
  const ms = parseISODate(date);
  if (Number.isNaN(ms)) return date;
  return formatISODate(ms + delta * DAY_MS);
}

/** Danh sách ngày liên tiếp [from, to] (bao gồm hai đầu), tối đa 400 ngày. */
export function listDates(from: string, to: string): string[] {
  const start = parseISODate(from);
  const end = parseISODate(to);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];
  const total = Math.floor((end - start) / DAY_MS) + 1;
  if (total > MAX_SPAN_DAYS) {
    return Array.from({ length: MAX_SPAN_DAYS }, (_, i) => formatISODate(start + i * DAY_MS));
  }
  return Array.from({ length: total }, (_, i) => formatISODate(start + i * DAY_MS));
}

/** Thứ Hai đầu tuần của ngày truyền vào. */
export function startOfWeek(date: string): string {
  const ms = parseISODate(date);
  if (Number.isNaN(ms)) return date;
  const weekday = new Date(ms).getUTCDay(); // 0 = Chủ nhật
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return formatISODate(ms + offset * DAY_MS);
}

export function startOfMonth(date: string): string {
  const ms = parseISODate(date);
  if (Number.isNaN(ms)) return date;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function dayLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

function weekLabel(weekStart: string): string {
  return `Tuần ${dayLabel(weekStart)}`;
}

function monthLabel(monthStart: string): string {
  const [year, month] = monthStart.split("-");
  return `Tháng ${Number(month)}/${year}`;
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

interface DayStat {
  checked_in: number;
  present: number;
  late: number;
  early_leave: number;
}

export function buildTrendDays(input: {
  from: string;
  to: string;
  activeEmployeeIds: string[];
  assignments: ShiftAssignmentRow[];
  summaries: AttendanceSummaryRow[];
  leaves: LeaveRangeRow[];
}): TrendDay[] {
  const dates = listDates(input.from, input.to);
  if (dates.length === 0) return [];

  const active = new Set(input.activeEmployeeIds);
  const assignmentsByEmployee = new Map<string, ShiftAssignmentRow[]>();
  for (const row of input.assignments) {
    if (!active.has(row.employee_id)) continue;
    const list = assignmentsByEmployee.get(row.employee_id) ?? [];
    list.push(row);
    assignmentsByEmployee.set(row.employee_id, list);
  }

  const leavesByEmployee = new Map<string, LeaveRangeRow[]>();
  for (const row of input.leaves) {
    if (!active.has(row.employee_id)) continue;
    const list = leavesByEmployee.get(row.employee_id) ?? [];
    list.push(row);
    leavesByEmployee.set(row.employee_id, list);
  }

  const statsByDate = new Map<string, DayStat>();
  for (const row of input.summaries) {
    if (!active.has(row.employee_id)) continue;
    const stat = statsByDate.get(row.work_date) ?? {
      checked_in: 0,
      present: 0,
      late: 0,
      early_leave: 0,
    };
    if (row.first_in !== null) stat.checked_in += 1;
    if (row.status === "present") stat.present += 1;
    else if (row.status === "late") stat.late += 1;
    else if (row.status === "early_leave") stat.early_leave += 1;
    statsByDate.set(row.work_date, stat);
  }

  const employeeIds = [...active];
  const days: TrendDay[] = [];

  for (const date of dates) {
    let assigned = 0;
    let onLeave = 0;
    let onLeaveAssigned = 0;

    for (const employeeId of employeeIds) {
      const ranges = assignmentsByEmployee.get(employeeId);
      const isAssigned =
        ranges?.some(
          (r) => r.effective_from <= date && (r.effective_to === null || r.effective_to >= date),
        ) ?? false;

      const isOnLeave =
        leavesByEmployee
          .get(employeeId)
          ?.some((l) => l.start_date <= date && l.end_date >= date) ?? false;

      if (isAssigned) assigned += 1;
      if (isOnLeave) {
        onLeave += 1;
        if (isAssigned) onLeaveAssigned += 1;
      }
    }

    const stat = statsByDate.get(date) ?? {
      checked_in: 0,
      present: 0,
      late: 0,
      early_leave: 0,
    };

    const absent = Math.max(0, assigned - stat.checked_in - onLeaveAssigned);

    days.push({
      date,
      label: dayLabel(date),
      assigned,
      checked_in: stat.checked_in,
      present: stat.present,
      late: stat.late,
      early_leave: stat.early_leave,
      absent,
      on_leave: onLeave,
      attendance_rate: rate(stat.checked_in, assigned),
      on_time_rate: rate(stat.present, stat.checked_in),
    });
  }

  return days;
}

export function sumTrendDays(days: TrendDay[]): TrendTotals {
  const totals: TrendTotals = {
    assigned: 0,
    checked_in: 0,
    present: 0,
    late: 0,
    early_leave: 0,
    absent: 0,
    on_leave: 0,
    attendance_rate: null,
    on_time_rate: null,
  };

  for (const day of days) {
    totals.assigned += day.assigned;
    totals.checked_in += day.checked_in;
    totals.present += day.present;
    totals.late += day.late;
    totals.early_leave += day.early_leave;
    totals.absent += day.absent;
    totals.on_leave += day.on_leave;
  }

  totals.attendance_rate = rate(totals.checked_in, totals.assigned);
  totals.on_time_rate = rate(totals.present, totals.checked_in);
  return totals;
}

/** Gộp chuỗi ngày thành bucket tuần (thứ Hai) hoặc tháng. */
export function bucketTrendDays(days: TrendDay[], granularity: TrendGranularity): TrendBucket[] {
  const buckets = new Map<string, TrendBucket>();

  for (const day of days) {
    const key = granularity === "week" ? startOfWeek(day.date) : startOfMonth(day.date);
    const existing = buckets.get(key);
    if (existing) {
      existing.to = day.date;
      accumulate(existing, day);
      continue;
    }
    buckets.set(key, {
      key,
      label: granularity === "week" ? weekLabel(key) : monthLabel(key),
      from: day.date,
      to: day.date,
      assigned: day.assigned,
      checked_in: day.checked_in,
      present: day.present,
      late: day.late,
      early_leave: day.early_leave,
      absent: day.absent,
      on_leave: day.on_leave,
      attendance_rate: null,
      on_time_rate: null,
    });
  }

  return [...buckets.values()]
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((bucket) => ({
      ...bucket,
      attendance_rate: rate(bucket.checked_in, bucket.assigned),
      on_time_rate: rate(bucket.present, bucket.checked_in),
    }));
}

function accumulate(target: TrendBucket, day: TrendDay): void {
  target.assigned += day.assigned;
  target.checked_in += day.checked_in;
  target.present += day.present;
  target.late += day.late;
  target.early_leave += day.early_leave;
  target.absent += day.absent;
  target.on_leave += day.on_leave;
}

export function takeLast<T>(items: T[], count: number): T[] {
  return count >= items.length ? items : items.slice(items.length - count);
}
