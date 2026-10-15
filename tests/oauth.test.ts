import { describe, expect, it } from "vitest";
import { isOAuthProvider, sanitizeNextParam } from "@/features/auth/oauth";

describe("oauth helpers", () => {
  it("chỉ cho phép provider đã duyệt", () => {
    expect(isOAuthProvider("google")).toBe(true);
    expect(isOAuthProvider("facebook")).toBe(false);
    expect(isOAuthProvider("")).toBe(false);
  });

  it("sanitizeNextParam chặn open-redirect", () => {
    expect(sanitizeNextParam(null)).toBe("/dashboard");
    expect(sanitizeNextParam("/dashboard")).toBe("/dashboard");
    expect(sanitizeNextParam("/admin/employees?page=2")).toBe("/admin/employees?page=2");
    expect(sanitizeNextParam("https://evil.test/phish")).toBe("/dashboard");
    expect(sanitizeNextParam("//evil.test/x")).toBe("/dashboard");
    expect(sanitizeNextParam("/\\evil.test")).toBe("/dashboard");
    expect(sanitizeNextParam("javascript:alert(1)")).toBe("/dashboard");
    expect(sanitizeNextParam("")).toBe("/dashboard");
  });
});
