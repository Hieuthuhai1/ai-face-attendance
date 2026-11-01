import { describe, expect, it } from "vitest";
import { translateText } from "@/lib/i18n/translate";

describe("i18n translateText", () => {
  it("translates common UI terms", () => {
    expect(translateText("Hủy", "en")).toBe("Cancel");
    expect(translateText("Thao tác", "en")).toBe("Actions");
    expect(translateText("Nhân viên", "en")).toBe("Employee");
    expect(translateText("Hồ sơ cá nhân", "en")).toBe("Personal profile");
  });

  it("translates weekdays inside dates", () => {
    expect(translateText("Thứ Bảy, 31/10/2026", "en")).toBe("Saturday, 31/10/2026");
    expect(translateText("Chủ Nhật, 01/11/2026", "en")).toBe("Sunday, 01/11/2026");
    expect(translateText("tháng 10 2026", "en")).toBe("October 2026");
  });

  it("translates late/early values", () => {
    expect(translateText("Trễ 60′", "en")).toBe("Late 60′");
    expect(translateText("Đi muộn 15′", "en")).toBe("Late 15′");
    expect(translateText("Về sớm 60′", "en")).toBe("Early 60′");
    expect(translateText("Sớm 5′", "en")).toBe("Early 5′");
  });

  it("translates dynamic labels", () => {
    expect(translateText("Cập nhật: 16:00", "en")).toBe("Updated: 16:00");
    expect(translateText("Khớp 95%", "en")).toBe("Match 95%");
    expect(translateText("Thông báo, 3 chưa đọc", "en")).toBe("Notifications, 3 unread");
  });

  it("keeps Vietnamese when locale is vi", () => {
    expect(translateText("Hủy", "vi")).toBe("Hủy");
    expect(translateText("Thứ Bảy, 31/10/2026", "vi")).toBe("Thứ Bảy, 31/10/2026");
  });

  it("preserves surrounding whitespace", () => {
    expect(translateText("  Hủy  ", "en")).toBe("  Cancel  ");
  });
});
