import { describe, expect, it } from "vitest";
import { config } from "@/proxy";
import { PROTECTED_PREFIXES } from "@/lib/supabase/middleware";

/** Chống drift giữa matcher (static, yêu cầu của Next) và PROTECTED_PREFIXES runtime. */
describe("proxy matcher parity", () => {
  it("mọi prefix đều có matcher tương ứng", () => {
    const matchers = (config.matcher ?? []) as string[];
    for (const p of PROTECTED_PREFIXES) {
      expect(matchers).toContain(`${p}/:path*`);
    }
    expect(matchers.length).toBe(PROTECTED_PREFIXES.length);
  });
});
