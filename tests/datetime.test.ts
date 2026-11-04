import { describe, expect, it } from "vitest";
import {
  formatDateTimeInZone,
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
  });
});
