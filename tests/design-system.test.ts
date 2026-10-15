import { describe, expect, it, vi } from "vitest";
import { pageItems } from "@/components/ui/pagination";
import { resetToastsForTests, toast } from "@/components/ui/toast";

describe("pagination items", () => {
  it("ít trang: liệt kê hết", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("nhiều trang: rút gọn 2 đầu + quanh trang hiện tại", () => {
    expect(pageItems(1, 12)).toEqual([1, 2, "…", 11, 12]);
    expect(pageItems(6, 12)).toEqual([1, 2, "…", 5, 6, 7, "…", 11, 12]);
    expect(pageItems(12, 12)).toEqual([1, 2, "…", 11, 12]);
  });
});

describe("toast store", () => {
  it("push + tự đóng sau timeout (fake timers)", () => {
    vi.useFakeTimers();
    try {
      const { snapshot } = resetToastsForTests();
      toast.success("Đã lưu");
      expect(snapshot().map((t) => t.message)).toEqual(["Đã lưu"]);
      vi.advanceTimersByTime(5000);
      expect(snapshot()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});
