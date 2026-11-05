import { describe, expect, it } from "vitest";
import {
  findTrail,
  isActiveItem,
  isPublicRoute,
  navForRole,
  primaryMobileNav,
} from "@/components/app/nav";

describe("nav theo role", () => {
  it("employee không thấy công cụ HR", () => {
    const hrefs = navForRole("employee").map((i) => i.href);
    expect(hrefs).toContain("/check-in");
    expect(hrefs).not.toContain("/admin/employees");
    expect(hrefs).not.toContain("/audit");
    expect(hrefs).not.toContain("/reports");
  });

  it("manager thấy báo cáo nhưng không thấy admin", () => {
    const hrefs = navForRole("manager").map((i) => i.href);
    expect(hrefs).toContain("/reports");
    expect(hrefs).not.toContain("/admin/employees");
  });

  it("hr thấy đủ module quản trị", () => {
    const hrefs = navForRole("hr_admin").map((i) => i.href);
    expect(hrefs).toContain("/admin/employees");
    expect(hrefs).toContain("/audit");
  });

  it("mobile tối đa 5 mục, ưu tiên chấm công", () => {
    const mobile = primaryMobileNav("employee");
    expect(mobile.length).toBeLessThanOrEqual(5);
    expect(mobile[0]?.href).toBe("/check-in");
  });
});

describe("active + breadcrumb + public routes", () => {
  it("isActiveItem đúng trang và trang con, không nhầm prefix", () => {
    expect(isActiveItem("/admin/employees", "/admin/employees")).toBe(true);
    expect(isActiveItem("/reports", "/report")).toBe(false);
    expect(isActiveItem("/dashboard", "/admin/employees")).toBe(false);
  });

  it("findTrail trả nhóm + nhãn", () => {
    expect(findTrail("/admin/shifts")).toEqual({ group: "Quản trị nhân sự", label: "Ca làm việc" });
    expect(findTrail("/settings/profile")).toEqual({ group: "Hệ thống", label: "Tài khoản" });
    expect(findTrail("/nope")).toBeNull();
  });

  it("isActiveItem không bật nhầm Cài đặt khi ở Tài khoản", () => {
    expect(isActiveItem("/settings/profile", "/settings")).toBe(false);
    expect(isActiveItem("/settings/profile", "/settings/profile")).toBe(true);
    expect(isActiveItem("/settings", "/settings")).toBe(true);
  });

  it("route công khai không shell", () => {
    expect(isPublicRoute("/")).toBe(true);
    expect(isPublicRoute("/login")).toBe(true);
    expect(isPublicRoute("/auth/callback")).toBe(true);
    expect(isPublicRoute("/dashboard")).toBe(false);
  });
});
