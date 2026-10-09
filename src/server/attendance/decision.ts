import { parseTimeToMinutes } from "@/lib/attendance/rules";

/** Quyết định verify: success / review (không phải gian lận) / failed. Thuần túy. */
export type VerifyDecision =
  | { outcome: "success" }
  | { outcome: "review"; reason: "LOW_CONFIDENCE" | "LIVENESS_UNKNOWN" }
  | { outcome: "failed"; reason: "LIVENESS_FAILED" | "NO_MATCH" };

export function decideVerification(input: {
  liveness: "pass" | "fail" | "unknown";
  confidence: number;
  threshold: number;
  reviewBandLow: number;
}): VerifyDecision {
  if (input.liveness === "fail") return { outcome: "failed", reason: "LIVENESS_FAILED" };
  if (input.confidence < input.reviewBandLow) return { outcome: "failed", reason: "NO_MATCH" };
  if (input.liveness === "unknown" || input.confidence < input.threshold) {
    return {
      outcome: "review",
      reason: input.liveness === "unknown" ? "LIVENESS_UNKNOWN" : "LOW_CONFIDENCE",
    };
  }
  return { outcome: "success" };
}

/** Ngày wall-clock YYYY-MM-DD theo timezone tổ chức. */
export function wallDateString(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export interface ResolvableAssignment {
  id: string;
  shift_id: string;
  effective_from: string;
  effective_to: string | null;
  shift: { start_time: string; end_time: string; overnight: boolean };
}

export interface ResolvedShift {
  assignment_id: string;
  shift_id: string;
  work_date: string;
  shift: ResolvableAssignment["shift"];
}

/**
 * Resolve ca tại thời điểm check: ưu tiên ca đêm hôm trước còn spill,
 * sau đó phân ca hiệu lực hôm nay. Thuần túy (dữ liệu do caller query).
 */
export function resolveShiftFor(
  now: Date,
  wallMinutes: number,
  assignments: ResolvableAssignment[],
  timeZone: string,
  spillBufferMin = 120,
): ResolvedShift | null {
  const today = wallDateString(now, timeZone);
  const yesterday = wallDateString(new Date(now.getTime() - 86400000), timeZone);

  const effectiveOn = (a: ResolvableAssignment, d: string) =>
    a.effective_from <= d && (a.effective_to === null || a.effective_to >= d);

  for (const a of assignments) {
    if (!a.shift.overnight || !effectiveOn(a, yesterday)) continue;
    const endMin = parseTimeToMinutes(a.shift.end_time.slice(0, 5));
    if (wallMinutes <= endMin + spillBufferMin) {
      return { assignment_id: a.id, shift_id: a.shift_id, work_date: yesterday, shift: a.shift };
    }
  }
  const todayAssign = assignments.find((a) => effectiveOn(a, today));
  if (!todayAssign) return null;
  return {
    assignment_id: todayAssign.id,
    shift_id: todayAssign.shift_id,
    work_date: today,
    shift: todayAssign.shift,
  };
}
