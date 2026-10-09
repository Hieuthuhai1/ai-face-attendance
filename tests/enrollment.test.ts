import { describe, expect, it } from "vitest";
import { analyzeQuality } from "@/lib/face/quality";
import { checkRateLimit, resetRateLimits } from "@/server/rate-limit";
import { getProviderHealth, withProviderTimeout, ProviderTimeoutError } from "@/server/face/service";
import { MockFaceRecognitionProvider } from "@/server/face/mock";

function solid(w: number, h: number, v: number): number[] {
  return new Array(w * h).fill(v);
}

function checker(w: number, h: number): number[] {
  const a = new Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = (x + y) % 2 === 0 ? 30 : 220;
  return a;
}

describe("quality checks (trung thực: sáng/mờ/size, không phải liveness)", () => {
  it("ảnh tối bị từ chối với hướng dẫn cụ thể", () => {
    const r = analyzeQuality(solid(320, 240, 10), 320, 240);
    expect(r.ok).toBe(false);
    expect(r.issues.join()).toMatch(/Thiếu sáng/);
  });

  it("ảnh phẳng (mờ) bị từ chối dù đủ sáng", () => {
    const r = analyzeQuality(solid(320, 240, 128), 320, 240);
    expect(r.ok).toBe(false);
    expect(r.issues.join()).toMatch(/mờ/);
  });

  it("ảnh đủ sáng + chi tiết được chấp nhận", () => {
    const r = analyzeQuality(checker(320, 240), 320, 240);
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("ảnh quá nhỏ bị từ chối", () => {
    const r = analyzeQuality(solid(160, 120, 128), 160, 120);
    expect(r.ok).toBe(false);
    expect(r.issues.join()).toMatch(/quá nhỏ/);
  });
});

describe("rate limiter", () => {
  it("chặn sau max lượt trong window, mở lại sau window", () => {
    resetRateLimits();
    expect(checkRateLimit("u1", 2, 1000, 0).allowed).toBe(true);
    expect(checkRateLimit("u1", 2, 1000, 500).allowed).toBe(true);
    const third = checkRateLimit("u1", 2, 1000, 900);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
    expect(checkRateLimit("u1", 2, 1000, 1500).allowed).toBe(true);
  });
});

describe("provider service", () => {
  it("timeout khi provider treo", async () => {
    const hanging = new Promise<never>(() => {});
    await expect(withProviderTimeout(hanging, 20)).rejects.toBeInstanceOf(ProviderTimeoutError);
  });

  it("mock: liveness rời theo fixture", async () => {
    const p = new MockFaceRecognitionProvider();
    expect((await p.checkLiveness({ image: "good" })).status).toBe("pass");
    expect((await p.checkLiveness({ image: "liveness-fail" })).status).toBe("fail");
    expect((await p.checkLiveness({ image: "blurry" })).status).toBe("unknown");
  });

  it("health: mock ở dev configured+demo; production NOT CONFIGURED", () => {
    const dev = getProviderHealth({ NODE_ENV: "development", FACE_PROVIDER: "mock" } as never);
    expect(dev).toMatchObject({ configured: true, demo: true });
    const prod = getProviderHealth({ NODE_ENV: "production", FACE_PROVIDER: "mock" } as never);
    expect(prod.configured).toBe(false);
    expect(prod.message).toMatch(/NOT CONFIGURED/);
  });
});
