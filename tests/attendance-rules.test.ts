import { describe, expect, it } from "vitest";
import {
  isOvernightSpill,
  minutesEarlyLeave,
  minutesLate,
  parseTimeToMinutes,
  shiftDurationMinutes,
  wallMinutes,
  zonedStartOfDayIso,
} from "@/lib/attendance/rules";

const TZ = "Asia/Ho_Chi_Minh";
// 2026-10-09T01:10:00Z == 08:10+07
const at = (iso: string) => new Date(iso);

describe("attendance rules (Phase 3)", () => {
  it("parse HH:MM, từ chối giờ sai", () => {
    expect(parseTimeToMinutes("08:00")).toBe(480);
    expect(() => parseTimeToMinutes("24:00")).toThrow("INVALID_TIME");
    expect(() => parseTimeToMinutes("8:00")).toThrow("INVALID_TIME");
  });

  it("wall-clock theo timezone tổ chức", () => {
    expect(wallMinutes(at("2026-10-09T01:10:00Z"), TZ)).toBe(490);
  });

  it("đi muộn: grace chỉ miễn trừ, quá grace báo đủ số phút", () => {
    // Trong grace 5' → 0
    expect(minutesLate(at("2026-10-09T01:03:00Z"), "08:00", 5, 1, TZ)).toBe(0);
    // 08:10+07, grace 5 → trễ 10' (không trừ grace khỏi số báo cáo)
    expect(minutesLate(at("2026-10-09T01:10:00Z"), "08:00", 5, 1, TZ)).toBe(10);
    // 09:00+07, ca 08:00 → trễ đúng 60'
    expect(minutesLate(at("2026-10-09T02:00:00Z"), "08:00", 5, 1, TZ)).toBe(60);
    // rounding 5: trễ 12' → 10'
    expect(minutesLate(at("2026-10-09T01:12:00Z"), "08:00", 5, 5, TZ)).toBe(10);
    // Ca qua đêm 22:00-06:00, check-in 00:30 hôm sau → trễ 150'
    expect(minutesLate(at("2026-10-09T17:30:00Z"), "22:00", 10, 1, TZ, true, "06:00")).toBe(150);
  });

  it("về sớm: grace chỉ miễn trừ, quá grace báo đủ số phút", () => {
    // 16:50+07 checkout, hết ca 17:00, grace 5 → về sớm 10'
    expect(minutesEarlyLeave(at("2026-10-09T09:50:00Z"), "17:00", 5, 1, TZ)).toBe(10);
    // 16:00+07 checkout → về sớm đúng 60'
    expect(minutesEarlyLeave(at("2026-10-09T09:00:00Z"), "17:00", 5, 1, TZ)).toBe(60);
    // 17:00 checkout → 0
    expect(minutesEarlyLeave(at("2026-10-09T10:00:00Z"), "17:00", 5, 1, TZ)).toBe(0);
    // Trong grace 5' → 0
    expect(minutesEarlyLeave(at("2026-10-09T09:58:00Z"), "17:00", 5, 1, TZ)).toBe(0);
  });

  it("mốc 00:00 theo timezone tổ chức (không lệch UTC)", () => {
    expect(zonedStartOfDayIso("2026-10-09", TZ)).toBe("2026-10-08T17:00:00.000Z");
  });

  it("độ dài ca, gồm qua đêm", () => {
    expect(shiftDurationMinutes("08:00", "17:00", false)).toBe(540);
    expect(shiftDurationMinutes("22:00", "06:00", true)).toBe(480);
  });

  it("event sau nửa đêm thuộc ca đêm hôm trước (S-06, biên <= gồm buffer)", () => {
    expect(isOvernightSpill(60, "06:00", true)).toBe(true); // 01:00
    expect(isOvernightSpill(480, "06:00", true)).toBe(true); // 08:00 == end+buffer
    expect(isOvernightSpill(600, "06:00", true)).toBe(false); // 10:00 ngoài buffer
    expect(isOvernightSpill(60, "06:00", false)).toBe(false);
  });
});
