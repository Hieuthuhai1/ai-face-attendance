import { describe, expect, it } from "vitest";
import { getFaceProvider, ProviderNotConfiguredError } from "@/server/face";
import { MockFaceRecognitionProvider } from "@/server/face/mock";
import type { FaceImageInput } from "@/server/face/types";

const img = (fixture: string): FaceImageInput => ({ data: fixture, mimeType: "image/jpeg" as const });

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

  it("mock enrollFace yêu cầu ít nhất 2 ảnh good", async () => {
    const p = new MockFaceRecognitionProvider();
    const fail = await p.enrollFace({ employeeId: "u1", images: [img("good"), img("blurry")] });
    expect(fail.ok).toBe(false);
    expect(fail.code).toBe("poor_image_quality");
    const ok = await p.enrollFace({ employeeId: "u1", images: [img("good"), img("good")] });
    expect(ok.ok).toBe(true);
    expect(ok.data?.providerSubjectId).toBe("mock_u1");
  });
});
