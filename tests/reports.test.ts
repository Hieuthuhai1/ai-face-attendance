import { describe, expect, it } from "vitest";
import { escapeCsvCell, monthRange, toCsv, validateRange } from "@/lib/reports/csv";

describe("csv escape (chống formula injection)", () => {
  it("tiền tố ' cho ô bắt đầu = + - @ tab", () => {
    expect(escapeCsvCell("=cmd|'/C calc'!A0")).toBe("'=cmd|'/C calc'!A0");
    expect(escapeCsvCell("+123")).toBe("'+123");
    expect(escapeCsvCell("-2+3")).toBe("'-2+3");
    expect(escapeCsvCell("@evil")).toBe("'@evil");
    expect(escapeCsvCell("\t=1+1")).toMatch(/^'/);
  });
  it("ô thường giữ nguyên; null → rỗng", () => {
    expect(escapeCsvCell("NV001")).toBe("NV001");
    expect(escapeCsvCell(42)).toBe("42");
    expect(escapeCsvCell(null)).toBe("");
  });
  it("quote chuẩn khi có phẩy/quote/xuống dòng", () => {
    expect(escapeCsvCell('a"b,c')).toBe('"a""b,c"');
    expect(toCsv(["a", "b"], [["x", "=1+1"]])).toBe('a,b\r\nx,\'=1+1');
  });
});

describe("khoảng ngày", () => {
  it("monthRange biên tháng (kể cả nhuận)", () => {
    expect(monthRange("2026-10")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(monthRange("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(monthRange("2026-13")).toBeNull();
    expect(monthRange("10-2026")).toBeNull();
  });
  it("validateRange: thứ tự + giới hạn 62 ngày", () => {
    expect(validateRange("2026-10-01", "2026-10-31").ok).toBe(true);
    expect(validateRange("2026-10-31", "2026-10-01").ok).toBe(false);
    expect(validateRange("2026-01-01", "2026-12-31").ok).toBe(false);
    expect(validateRange("01-10-2026", "2026-10-31").ok).toBe(false);
  });
});
