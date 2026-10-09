import { describe, expect, it, vi } from "vitest";
import { logger, REDACTED } from "@/server/logger";

function lastPayload(spy: { mock: { calls: unknown[][] } }): string {
  return String(spy.mock.calls[0]?.[0] ?? "");
}

describe("logger redact (F-03)", () => {
  it("redact field nhạy cảm lồng nhau, giữ field thường", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("verify attempt", {
      employeeId: "u1",
      image: "base64...",
      nested: { template: [0.1], confidence: 0.9 },
    });
    const parsed = JSON.parse(lastPayload(spy)) as {
      meta: Record<string, unknown>;
    };
    expect(parsed.meta.employeeId).toBe("u1");
    expect(parsed.meta.image).toBe(REDACTED);
    expect((parsed.meta.nested as Record<string, unknown>).template).toBe(REDACTED);
    expect((parsed.meta.nested as Record<string, unknown>).confidence).toBe(0.9);
    spy.mockRestore();
  });
});
