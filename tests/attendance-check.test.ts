import { describe, expect, it } from "vitest";
import { decideVerification, resolveShiftFor, wallDateString } from "@/server/attendance/decision";

const DAY = {
  id: "a1", shift_id: "s1", effective_from: "2026-10-01", effective_to: null,
  shift: { start_time: "08:00", end_time: "17:00", overnight: false },
};
const NIGHT_YESTERDAY = {
  id: "a2", shift_id: "s2", effective_from: "2026-10-01", effective_to: "2026-10-08",
  shift: { start_time: "22:00", end_time: "06:00", overnight: true },
};
const T = { threshold: 0.72, reviewBandLow: 0.6 };

describe("verify decision (không kết luận gian lận từ confidence)", () => {
  it("pass + cao → success", () => {
    expect(decideVerification({ liveness: "pass", confidence: 0.95, ...T })).toEqual({ outcome: "success" });
  });
  it("pass + trong band → review (HR rà soát)", () => {
    expect(decideVerification({ liveness: "pass", confidence: 0.65, ...T })).toEqual({
      outcome: "review", reason: "LOW_CONFIDENCE",
    });
  });
  it("unknown liveness + cao → review", () => {
    expect(decideVerification({ liveness: "unknown", confidence: 0.9, ...T })).toEqual({
      outcome: "review", reason: "LIVENESS_UNKNOWN",
    });
  });
  it("liveness fail → failed (ghi failed, cho thử lại/fallback)", () => {
    expect(decideVerification({ liveness: "fail", confidence: 0.9, ...T })).toEqual({
      outcome: "failed", reason: "LIVENESS_FAILED",
    });
  });
  it("confidence thấp → failed NO_MATCH", () => {
    expect(decideVerification({ liveness: "pass", confidence: 0.2, ...T })).toEqual({
      outcome: "failed", reason: "NO_MATCH",
    });
  });
});

describe("resolveShiftFor (ca qua đêm)", () => {
  const TZ = "Asia/Ho_Chi_Minh";
  it("wall date theo timezone", () => {
    expect(wallDateString(new Date("2026-10-09T01:00:00Z"), TZ)).toBe("2026-10-09");
  });
  it("ca ngày hôm nay", () => {
    const r = resolveShiftFor(new Date("2026-10-09T02:00:00Z"), 540, [DAY], TZ);
    expect(r?.work_date).toBe("2026-10-09");
    expect(r?.assignment_id).toBe("a1");
  });
  it("phân ca đêm đã hết hiệu lực hôm qua → null", () => {
    const r = resolveShiftFor(new Date("2026-10-09T18:00:00Z"), 60, [NIGHT_YESTERDAY], TZ);
    expect(r).toBeNull(); // effective_to 08/10, event wall 10/10 01:00 → không ca
  });
  it("01:00 ca đêm còn hiệu lực hôm qua → work_date hôm qua", () => {
    const night = { ...NIGHT_YESTERDAY, effective_to: "2026-10-09" };
    const r = resolveShiftFor(new Date("2026-10-09T18:30:00Z"), 90, [night], TZ);
    expect(r?.work_date).toBe("2026-10-09");
  });
  it("không phân ca → null (NO_SHIFT)", () => {
    expect(resolveShiftFor(new Date("2026-10-09T02:00:00Z"), 540, [], TZ)).toBeNull();
  });
});
