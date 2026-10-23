import { beforeEach, describe, expect, it } from "vitest";
import { getFaceProvider, ProviderNotConfiguredError } from "@/server/face";
import { MockFaceRecognitionProvider } from "@/server/face/mock";
import { withProviderTimeout, ProviderTimeoutError } from "@/server/face/service";
import type { FaceImageInput, FaceOperationResult, EnrollResult, VerifyResult } from "@/server/face/types";

describe("FaceRecognitionProvider contract", () => {
  describe("getFaceProvider factory", () => {
    it("trả mock ở development", () => {
      const p = getFaceProvider({ FACE_PROVIDER: "mock", NODE_ENV: "development" } as never);
      expect(p).toBeInstanceOf(MockFaceRecognitionProvider);
      expect(p.isDemo).toBe(true);
      expect(p.name).toBe("mock");
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

    it("cho phép mock production khi ALLOW_MOCK_IN_PRODUCTION=true", () => {
      const p = getFaceProvider({
        FACE_PROVIDER: "mock",
        NODE_ENV: "production",
        ALLOW_MOCK_IN_PRODUCTION: "true",
      } as never);
      expect(p).toBeInstanceOf(MockFaceRecognitionProvider);
    });

    it("throw khi provider không xác định", () => {
      expect(() => getFaceProvider({ FACE_PROVIDER: "unknown", NODE_ENV: "development" } as never)).toThrow(
        ProviderNotConfiguredError,
      );
    });

    it("throw aws-rekognition khi thiếu credentials", () => {
      expect(() =>
        getFaceProvider({ FACE_PROVIDER: "aws-rekognition", NODE_ENV: "development" } as never),
      ).toThrow(ProviderNotConfiguredError);
    });
  });

  describe("MockFaceRecognitionProvider", () => {
    let provider: MockFaceRecognitionProvider;

    beforeEach(() => {
      provider = new MockFaceRecognitionProvider();
    });

    it("capabilities đúng", () => {
      expect(provider.capabilities).toEqual({
        enroll: true,
        verify1to1: true,
        verify1toN: false,
        liveness: true,
        qualityAssessment: true,
        deleteSubject: true,
      });
    });

    it("checkAvailability trả success", async () => {
      const result = await provider.checkAvailability();
      expect(result.ok).toBe(true);
      expect(result.code).toBe("success");
      expect(result.data?.available).toBe(true);
    });

    it("assessImageQuality trả quality score", async () => {
      const input: FaceImageInput = { data: "good_image", mimeType: "image/jpeg" };
      const result = await provider.assessImageQuality({ image: input });
      expect(result.ok).toBe(true);
      expect(result.code).toBe("success");
      expect(result.data?.quality).toBeGreaterThan(0.5);
    });

    it("assessImageQuality phát hiện blurry", async () => {
      const input: FaceImageInput = { data: "blurry_image", mimeType: "image/jpeg" };
      const result = await provider.assessImageQuality({ image: input });
      expect(result.ok).toBe(true);
      expect(result.data?.quality).toBeLessThan(0.5);
      expect(result.data?.issues).toContain("blurry");
    });

    it("enrollFace yêu cầu ít nhất 2 ảnh good", async () => {
      const input = {
        employeeId: "u1",
        images: [
          { data: "good_1", mimeType: "image/jpeg" as const },
          { data: "good_2", mimeType: "image/jpeg" as const },
        ],
      };
      const result = await provider.enrollFace(input);
      expect(result.ok).toBe(true);
      expect(result.code).toBe("success");
      expect(result.data?.providerSubjectId).toBe("mock_u1");
      expect(result.data?.quality).toBe(0.85);
    });

    it("enrollFace từ chối khi ít hơn 2 ảnh good", async () => {
      const input = {
        employeeId: "u1",
        images: [{ data: "good_1", mimeType: "image/jpeg" as const }],
      };
      const result = await provider.enrollFace(input);
      expect(result.ok).toBe(false);
      expect(result.code).toBe("poor_image_quality");
    });

    it("checkLiveness pass cho ảnh good", async () => {
      const input: FaceImageInput = { data: "good_image", mimeType: "image/jpeg" };
      const result = await provider.checkLiveness({ image: input });
      expect(result.ok).toBe(true);
      expect(result.code).toBe("success");
      expect(result.data?.status).toBe("pass");
    });

    it("checkLiveness fail cho liveness-fail fixture", async () => {
      const input: FaceImageInput = { data: "liveness-fail_image", mimeType: "image/jpeg" };
      const result = await provider.checkLiveness({ image: input });
      expect(result.ok).toBe(true);
      expect(result.code).toBe("liveness_failed");
      expect(result.data?.status).toBe("fail");
    });

    it("checkLiveness unknown cho blurry fixture", async () => {
      const input: FaceImageInput = { data: "blurry_image", mimeType: "image/jpeg" };
      const result = await provider.checkLiveness({ image: input });
      expect(result.ok).toBe(true);
      expect(result.data?.status).toBe("unknown");
    });

    it("verifyFace success cho good fixture", async () => {
      const input = { providerSubjectId: "mock_u1", image: { data: "good_image", mimeType: "image/jpeg" as const } };
      const result = await provider.verifyFace(input);
      expect(result.ok).toBe(true);
      expect(result.code).toBe("success");
      expect(result.data?.match).toBe(true);
      expect(result.data?.confidence).toBe(0.9);
      expect(result.data?.liveness).toBe("pass");
    });

    it("verifyFace low_confidence cho blurry fixture", async () => {
      const input = { providerSubjectId: "mock_u1", image: { data: "blurry_image", mimeType: "image/jpeg" as const } };
      const result = await provider.verifyFace(input);
      expect(result.ok).toBe(true);
      expect(result.code).toBe("low_confidence");
      expect(result.data?.match).toBe(true);
      expect(result.data?.confidence).toBe(0.6);
    });

    it("verifyFace no_match cho no-match fixture", async () => {
      const input = { providerSubjectId: "mock_u1", image: { data: "no-match_image", mimeType: "image/jpeg" as const } };
      const result = await provider.verifyFace(input);
      expect(result.ok).toBe(true);
      expect(result.code).toBe("no_match");
      expect(result.data?.match).toBe(false);
    });

    it("removeEnrollment success", async () => {
      const result = await provider.removeEnrollment("mock_u1");
      expect(result.ok).toBe(true);
      expect(result.code).toBe("success");
    });

    it("getHealth trả demo info", async () => {
      const health = await provider.getHealth();
      expect(health.configured).toBe(true);
      expect(health.provider).toBe("mock");
      expect(health.demo).toBe(true);
    });
  });

  describe("withProviderTimeout", () => {
    it("resolve khi task hoàn thành trước timeout", async () => {
      const task = Promise.resolve("done");
      const result = await withProviderTimeout(task, 100);
      expect(result).toBe("done");
    });

    it("reject ProviderTimeoutError khi task quá timeout", async () => {
      const hanging = new Promise<never>(() => {});
      await expect(withProviderTimeout(hanging, 20)).rejects.toBeInstanceOf(ProviderTimeoutError);
    });

    it("timeout error có code PROVIDER_TIMEOUT", async () => {
      const hanging = new Promise<never>(() => {});
      try {
        await withProviderTimeout(hanging, 20);
      } catch (e) {
        expect(e).toBeInstanceOf(ProviderTimeoutError);
        expect((e as ProviderTimeoutError).code).toBe("PROVIDER_TIMEOUT");
      }
    });
  });

  describe("Type safety", () => {
    it("FaceOperationResult type có ok, code, message, data", () => {
      const success: FaceOperationResult<EnrollResult> = {
        ok: true,
        code: "success",
        message: "OK",
        data: { providerSubjectId: "test", quality: 0.9 },
      };
      expect(success.ok).toBe(true);
      expect(success.data?.providerSubjectId).toBe("test");

      const fail: FaceOperationResult<VerifyResult> = {
        ok: false,
        code: "no_match",
        message: "No match",
      };
      expect(fail.ok).toBe(false);
      expect(fail.code).toBe("no_match");
    });

    it("FaceResultCode union bao gồm tất cả error codes", () => {
      const codes: Array<FaceOperationResult<unknown>["code"]> = [
        "success",
        "no_match",
        "low_confidence",
        "poor_image_quality",
        "liveness_failed",
        "enrollment_missing",
        "provider_unavailable",
        "manual_review_required",
        "timeout",
        "invalid_input",
        "rate_limited",
        "not_configured",
      ];
      expect(codes.length).toBe(12);
    });
  });
});