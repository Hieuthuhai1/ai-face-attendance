import { describe, expect, it } from "vitest";
import {
  formatDateOnly,
  formatDateTimeInZone,
  formatDurationMinutes,
  formatShortDateInZone,
  formatTimeInZone,
} from "@/lib/datetime";

describe("datetime formatting theo múi giờ", () => {
  it("giờ UTC 06:47 → 13:47 Asia/Ho_Chi_Minh", () => {
    expect(formatTimeInZone("2026-11-04T06:47:28Z")).toBe("13:47");
  });

  it("có giây khi cần", () => {
    expect(formatTimeInZone("2026-11-04T06:47:28Z", undefined, true)).toBe("13:47:28");
  });

  it("ngày qua mốc nửa đêm theo giờ Việt Nam", () => {
    expect(formatShortDateInZone("2026-11-03T18:00:00Z")).toBe("04/11/2026");
  });

  it("date-time đầy đủ theo giờ Việt Nam", () => {
    expect(formatDateTimeInZone("2026-11-04T06:47:28Z")).toBe("04/11/2026 13:47");
  });

  it("tôn trọng timeZone truyền vào", () => {
    expect(formatTimeInZone("2026-11-04T06:47:28Z", "UTC")).toBe("06:47");
  });

  it("giá trị không hợp lệ trả về —", () => {
    expect(formatTimeInZone("not-a-date")).toBe("—");
    expect(formatShortDateInZone("not-a-date")).toBe("—");
    expect(formatDateOnly("not-a-date")).toBe("—");
  });

  it("ngày thuần YYYY-MM-DD không bị lệch múi giờ", () => {
    expect(formatDateOnly("2026-10-09")).toBe("09/10/2026");
    expect(formatDateOnly("2026-10-09T07:58:00+07:00")).toBe("09/10/2026");
    expect(formatDateOnly(null)).toBe("—");
  });

  it("tổng thời gian làm việc dạng 8h32", () => {
    expect(formatDurationMinutes(544)).toBe("9h04");
    expect(formatDurationMinutes(0)).toBe("0h00");
    expect(formatDurationMinutes(null)).toBe("0h00");
  });
});
