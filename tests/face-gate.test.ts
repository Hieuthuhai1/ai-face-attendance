import { describe, expect, it } from "vitest";
import { getFaceProvider, ProviderNotConfiguredError } from "@/server/face";
import { MockFaceRecognitionProvider } from "@/server/face/mock";

describe("getFaceProvider gate (F-01, F-02)", () => {
  it("trả mock ở development", () => {
    const p = getFaceProvider({ FACE_PROVIDER: "mock", NODE_ENV: "development" } as never);
    expect(p).toBeInstanceOf(MockFaceRecognitionProvider);
    expect(p.isDemo).toBe(true);
  });

  it("fail closed ở production khi FACE_PROVIDER=mock", () => {
    expect(() =>
      getFaceProvider({ FACE_PROVIDER: "mock", NODE_ENV: "production" } as never),
    ).toThrow(ProviderNotConfiguredError);
  });

  it("fail closed ở production khi thiếu cấu hình", () => {
    expect(() => getFaceProvider({ NODE_ENV: "production" } as never)).toThrow(
      ProviderNotConfiguredError,
    );
  });

  it("mock enroll yêu cầu đủ ảnh đạt chất lượng", async () => {
    const p = new MockFaceRecognitionProvider();
    await expect(p.enroll({ employeeId: "u1", images: ["good", "blurry"] })).rejects.toThrow(
      "MOCK_LOW_QUALITY",
    );
    const ok = await p.enroll({ employeeId: "u1", images: ["good", "good"] });
    expect(ok.providerSubjectId).toBe("mock_u1");
  });
});
