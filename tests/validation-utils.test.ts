import { describe, expect, it } from "vitest";
import { idempotencyKeySchema, loginSchema } from "@/lib/validation";
import { newIdempotencyKey } from "@/lib/idempotency";
import { cn } from "@/lib/cn";
import { UI_STATUS } from "@/lib/status";

describe("validation (F-04)", () => {
  it("login từ chối email sai và password rỗng, báo tiếng Việt", () => {
    const r = loginSchema.safeParse({ email: "not-an-email", password: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/Email|mật khẩu/);
    }
    expect(loginSchema.safeParse({ email: "nv@cty.vn", password: "s3cret" }).success).toBe(true);
  });

  it("idempotency key đúng định dạng evt_<uuid>", () => {
    expect(idempotencyKeySchema.safeParse(newIdempotencyKey()).success).toBe(true);
    expect(idempotencyKeySchema.safeParse("evt_duplicate").success).toBe(false);
  });
});

describe("lib utils", () => {
  it("cn nối class, bỏ falsy", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("mọi UiStatus đều có label + icon (không chỉ màu)", () => {
    for (const meta of Object.values(UI_STATUS)) {
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.icon.length).toBeGreaterThan(0);
    }
  });
});
