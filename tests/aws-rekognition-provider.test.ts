import { beforeEach, describe, expect, it, vi } from "vitest";
import { AwsRekognitionProvider } from "@/server/face/aws-rekognition";
import type { FaceImageInput, EnrollInput, Verify1to1Input, LivenessInput } from "@/server/face/types";

// Use vi.hoisted for hoisted mocks
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock("@aws-sdk/client-rekognition", () => {
  // Define the mock class inside the factory to avoid hoisting issues
  class MockRekognitionClient {
    send = mockSend;
  }

  return {
    RekognitionClient: MockRekognitionClient,
    ListCollectionsCommand: vi.fn(),
    IndexFacesCommand: vi.fn(),
    SearchFacesByImageCommand: vi.fn(),
    DeleteFacesCommand: vi.fn(),
    DetectFacesCommand: vi.fn(),
    CreateFaceLivenessSessionCommand: vi.fn(),
    GetFaceLivenessSessionResultsCommand: vi.fn(),
  };
});

describe("AwsRekognitionProvider", () => {
  let provider: AwsRekognitionProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockReset();
    provider = new AwsRekognitionProvider({
      region: "ap-southeast-1",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      collectionId: "attendance-faces-test",
      verifyThreshold: 0.72,
      reviewBandLow: 0.6,
    });
  });

  const createFaceImageInput = (data: string): FaceImageInput => ({
    data,
    mimeType: "image/jpeg",
  });

  const createEnrollInput = (images: FaceImageInput[]): EnrollInput => ({
    employeeId: "emp-123",
    images,
  });

  const createVerifyInput = (image: FaceImageInput, subjectId = "face-123"): Verify1to1Input => ({
    providerSubjectId: subjectId,
    image,
  });

  const createLivenessInput = (image: FaceImageInput, sessionId?: string): LivenessInput => ({
    image,
    sessionId,
  });

  describe("checkAvailability", () => {
    it("trả về success khi ListCollections thành công", async () => {
      mockSend.mockResolvedValueOnce({ CollectionIds: ["test"] });
      const result = await provider.checkAvailability();
      expect(result.ok).toBe(true);
      expect(result.code).toBe("success");
      expect(result.data?.available).toBe(true);
    });

    it("trả về provider_unavailable khi ListCollections thất bại", async () => {
      const error = new Error("Network error");
      error.name = "ServiceUnavailableException";
      mockSend.mockRejectedValueOnce(error);
      const result = await provider.checkAvailability();
      expect(result.ok).toBe(false);
      expect(result.code).toBe("provider_unavailable");
    });
  });

  describe("assessImageQuality", () => {
    it("trả về quality score khi detect face thành công", async () => {
      mockSend.mockResolvedValueOnce({
        FaceDetails: [
          {
            Quality: { Brightness: 80, Sharpness: 80 },
            Pose: { Yaw: 5, Pitch: 5 },
            EyesOpen: { Value: true },
            Confidence: 95,
          },
        ],
      });
      const result = await provider.assessImageQuality({ image: createFaceImageInput("test") });
      expect(result.ok).toBe(true);
      expect(result.code).toBe("success");
      expect(result.data?.quality).toBeGreaterThan(0.8);
      expect(result.data?.issues).toEqual([]);
    });

    it("phát hiện ảnh quá tối", async () => {
      mockSend.mockResolvedValueOnce({
        FaceDetails: [
          {
            Quality: { Brightness: 20, Sharpness: 80 },
            Pose: { Yaw: 0, Pitch: 0 },
            EyesOpen: { Value: true },
            Confidence: 95,
          },
        ],
      });
      const result = await provider.assessImageQuality({ image: createFaceImageInput("test") });
      expect(result.ok).toBe(true);
      expect(result.data?.issues).toContain("too_dark");
      expect(result.data?.quality).toBeLessThan(1.0);
    });

    it("phát hiện ảnh mờ", async () => {
      mockSend.mockResolvedValueOnce({
        FaceDetails: [
          {
            Quality: { Brightness: 80, Sharpness: 30 },
            Pose: { Yaw: 0, Pitch: 0 },
            EyesOpen: { Value: true },
            Confidence: 95,
          },
        ],
      });
      const result = await provider.assessImageQuality({ image: createFaceImageInput("test") });
      expect(result.ok).toBe(true);
      expect(result.data?.issues).toContain("blurry");
    });

    it("trả về poor_image_quality khi không detect được face", async () => {
      mockSend.mockResolvedValueOnce({ FaceDetails: [] });
      const result = await provider.assessImageQuality({ image: createFaceImageInput("test") });
      expect(result.ok).toBe(false);
      expect(result.code).toBe("poor_image_quality");
      expect(result.data?.issues).toContain("no_face_detected");
    });

    it("map AWS error sang poor_image_quality khi InvalidParameterException về quality", async () => {
      const error = new Error("InvalidParameterException: quality filter failed");
      error.name = "InvalidParameterException";
      mockSend.mockRejectedValueOnce(error);
      const result = await provider.assessImageQuality({ image: createFaceImageInput("test") });
      expect(result.ok).toBe(false);
      expect(result.code).toBe("poor_image_quality");
    });
  });

  describe("enrollFace", () => {
    it("enroll thành công với 2 ảnh quality cao", async () => {
      // Quality check cho ảnh đầu tiên
      mockSend.mockResolvedValueOnce({
        FaceDetails: [
          {
            Quality: { Brightness: 80, Sharpness: 80 },
            Pose: { Yaw: 0, Pitch: 0 },
            EyesOpen: { Value: true },
            Confidence: 95,
          },
        ],
      });
      // IndexFaces response
      mockSend.mockResolvedValueOnce({
        FaceRecords: [
          {
            Face: { FaceId: "face-abc-123", Confidence: 95 },
          },
        ],
      });

      const result = await provider.enrollFace(
        createEnrollInput([createFaceImageInput("img1"), createFaceImageInput("img2")])
      );
      expect(result.ok).toBe(true);
      expect(result.code).toBe("success");
      expect(result.data?.providerSubjectId).toBe("face-abc-123");
      expect(result.data?.quality).toBe(0.9);
    });

    it("từ chối khi ít hơn 2 ảnh", async () => {
      const result = await provider.enrollFace(createEnrollInput([createFaceImageInput("img1")]));
      expect(result.ok).toBe(false);
      expect(result.code).toBe("poor_image_quality");
    });

    it("từ chối khi quality ảnh đầu tiên quá thấp", async () => {
      mockSend.mockResolvedValueOnce({
        FaceDetails: [
          {
            Quality: { Brightness: 10, Sharpness: 10 },
            Pose: { Yaw: 0, Pitch: 0 },
            EyesOpen: { Value: true },
            Confidence: 50,
          },
        ],
      });
      const result = await provider.enrollFace(
        createEnrollInput([createFaceImageInput("img1"), createFaceImageInput("img2")])
      );
      expect(result.ok).toBe(false);
      expect(result.code).toBe("poor_image_quality");
    });

    it("map InvalidParameterException về quality", async () => {
      mockSend.mockResolvedValueOnce({
        FaceDetails: [
          {
            Quality: { Brightness: 80, Sharpness: 80 },
            Pose: { Yaw: 0, Pitch: 0 },
            EyesOpen: { Value: true },
            Confidence: 95,
          },
        ],
      });
      const error = new Error("InvalidParameterException: Image quality too low");
      error.name = "InvalidParameterException";
      mockSend.mockRejectedValueOnce(error);
      const result = await provider.enrollFace(
        createEnrollInput([createFaceImageInput("img1"), createFaceImageInput("img2")])
      );
      expect(result.ok).toBe(false);
      expect(result.code).toBe("poor_image_quality");
    });
  });

  describe("startLivenessSession", () => {
    it("tạo session thành công", async () => {
      mockSend.mockResolvedValueOnce({ SessionId: "session-123" });
      const result = await provider.startLivenessSession();
      expect(result.ok).toBe(true);
      expect(result.code).toBe("success");
      expect(result.data?.sessionId).toBe("session-123");
    });
  });

  describe("checkLiveness", () => {
    it("active liveness: trả về pass khi session SUCCESS", async () => {
      mockSend.mockResolvedValueOnce({ Status: "SUCCESS", SessionId: "session-123" });
      const result = await provider.checkLiveness(createLivenessInput(createFaceImageInput("test"), "session-123"));
      expect(result.ok).toBe(true);
      expect(result.code).toBe("success");
      expect(result.data?.status).toBe("pass");
    });

    it("active liveness: trả về fail khi session FAILED", async () => {
      mockSend.mockResolvedValueOnce({ Status: "FAILED", SessionId: "session-123" });
      const result = await provider.checkLiveness(createLivenessInput(createFaceImageInput("test"), "session-123"));
      expect(result.ok).toBe(true);
      expect(result.code).toBe("liveness_failed");
      expect(result.data?.status).toBe("fail");
    });

    it("passive liveness: pass khi eyes open, pose tốt, sharpness cao", async () => {
      mockSend.mockResolvedValueOnce({
        FaceDetails: [
          {
            Quality: { Sharpness: 80 },
            Pose: { Yaw: 10, Pitch: 5 },
            EyesOpen: { Value: true },
          },
        ],
      });
      const result = await provider.checkLiveness(createLivenessInput(createFaceImageInput("test")));
      expect(result.ok).toBe(true);
      expect(result.code).toBe("success");
      expect(result.data?.status).toBe("pass");
    });

    it("passive liveness: fail khi eyes closed", async () => {
      mockSend.mockResolvedValueOnce({
        FaceDetails: [
          {
            Quality: { Sharpness: 80 },
            Pose: { Yaw: 0, Pitch: 0 },
            EyesOpen: { Value: false },
          },
        ],
      });
      const result = await provider.checkLiveness(createLivenessInput(createFaceImageInput("test")));
      expect(result.ok).toBe(true);
      expect(result.code).toBe("liveness_failed");
      expect(result.data?.status).toBe("fail");
    });

    it("passive liveness: unknown khi sharpness thấp", async () => {
      mockSend.mockResolvedValueOnce({
        FaceDetails: [
          {
            Quality: { Sharpness: 20 },
            Pose: { Yaw: 0, Pitch: 0 },
            EyesOpen: { Value: true },
          },
        ],
      });
      const result = await provider.checkLiveness(createLivenessInput(createFaceImageInput("test")));
      expect(result.ok).toBe(true);
      expect(result.data?.status).toBe("unknown");
    });

    it("passive liveness: unknown khi pose quá nghiêng", async () => {
      mockSend.mockResolvedValueOnce({
        FaceDetails: [
          {
            Quality: { Sharpness: 80 },
            Pose: { Yaw: 50, Pitch: 10 },
            EyesOpen: { Value: true },
          },
        ],
      });
      const result = await provider.checkLiveness(createLivenessInput(createFaceImageInput("test")));
      expect(result.ok).toBe(true);
      expect(result.data?.status).toBe("unknown");
    });

    it("trả về poor_image_quality khi không detect face", async () => {
      mockSend.mockResolvedValueOnce({ FaceDetails: [] });
      const result = await provider.checkLiveness(createLivenessInput(createFaceImageInput("test")));
      expect(result.ok).toBe(false);
      expect(result.code).toBe("poor_image_quality");
    });
  });

  describe("verifyFace", () => {
    it("verify success khi match face đúng employee", async () => {
      mockSend.mockResolvedValueOnce({
        FaceMatches: [
          {
            Face: { FaceId: "face-123" },
            Similarity: 95,
          },
        ],
      });
      const result = await provider.verifyFace(createVerifyInput(createFaceImageInput("test"), "face-123"));
      expect(result.ok).toBe(true);
      expect(result.code).toBe("success");
      expect(result.data?.match).toBe(true);
      expect(result.data?.confidence).toBe(0.95);
      expect(result.data?.liveness).toBe("pass");
    });

    it("low_confidence khi similarity trong review band", async () => {
      mockSend.mockResolvedValueOnce({
        FaceMatches: [
          {
            Face: { FaceId: "face-123" },
            Similarity: 65, // 0.65 - giữa reviewBandLow (0.6) và verifyThreshold (0.72)
          },
        ],
      });
      const result = await provider.verifyFace(createVerifyInput(createFaceImageInput("test"), "face-123"));
      expect(result.ok).toBe(true);
      expect(result.code).toBe("low_confidence");
      expect(result.data?.match).toBe(true);
      expect(result.data?.confidence).toBe(0.65);
    });

    it("no_match khi similarity dưới review band", async () => {
      mockSend.mockResolvedValueOnce({
        FaceMatches: [
          {
            Face: { FaceId: "face-123" },
            Similarity: 50, // 0.5 - dưới reviewBandLow (0.6)
          },
        ],
      });
      const result = await provider.verifyFace(createVerifyInput(createFaceImageInput("test"), "face-123"));
      expect(result.ok).toBe(true);
      expect(result.code).toBe("no_match");
      expect(result.data?.match).toBe(false);
    });

    it("no_match khi match face khác employee (wrong face)", async () => {
      mockSend.mockResolvedValueOnce({
        FaceMatches: [
          {
            Face: { FaceId: "face-456" }, // Khác face-123
            Similarity: 95,
          },
        ],
      });
      const result = await provider.verifyFace(createVerifyInput(createFaceImageInput("test"), "face-123"));
      expect(result.ok).toBe(true);
      expect(result.code).toBe("no_match");
      expect(result.data?.match).toBe(false);
    });

    it("no_match khi không có face matches", async () => {
      mockSend.mockResolvedValueOnce({ FaceMatches: [] });
      const result = await provider.verifyFace(createVerifyInput(createFaceImageInput("test"), "face-123"));
      expect(result.ok).toBe(true);
      expect(result.code).toBe("no_match");
      expect(result.data?.match).toBe(false);
    });

    it("enrollment_missing khi InvalidParameterException về FaceId", async () => {
      const error = new Error("InvalidParameterException: FaceId not found");
      error.name = "InvalidParameterException";
      mockSend.mockRejectedValueOnce(error);
      const result = await provider.verifyFace(createVerifyInput(createFaceImageInput("test"), "face-123"));
      expect(result.ok).toBe(false);
      expect(result.code).toBe("enrollment_missing");
    });
  });

  describe("removeEnrollment", () => {
    it("xóa thành công", async () => {
      mockSend.mockResolvedValueOnce({});
      const result = await provider.removeEnrollment("face-123");
      expect(result.ok).toBe(true);
      expect(result.code).toBe("success");
    });

    it("idempotent khi face không tồn tại (ResourceNotFoundException)", async () => {
      const error = new Error("ResourceNotFoundException: Face not found");
      error.name = "ResourceNotFoundException";
      mockSend.mockRejectedValueOnce(error);
      const result = await provider.removeEnrollment("face-123");
      expect(result.ok).toBe(true);
      expect(result.code).toBe("success");
    });
  });

  describe("getHealth", () => {
    it("trả về configured true khi healthy", async () => {
      mockSend.mockResolvedValueOnce({ CollectionIds: ["test"] });
      const health = await provider.getHealth();
      expect(health.configured).toBe(true);
      expect(health.provider).toBe("aws-rekognition");
      expect(health.demo).toBe(false);
    });

    it("trả về configured false khi unhealthy", async () => {
      mockSend.mockRejectedValueOnce(new Error("Connection refused"));
      const health = await provider.getHealth();
      expect(health.configured).toBe(false);
      expect(health.message).toContain("unavailable");
    });
  });

  describe("Error mapping", () => {
    it("map UnauthorizedException -> unauthorized", async () => {
      const error = new Error("InvalidAccessKeyId");
      error.name = "UnauthorizedException";
      mockSend.mockRejectedValueOnce(error);
      const result = await provider.checkAvailability();
      expect(result.code).toBe("unauthorized");
    });

    it("map ThrottlingException -> rate_limited", async () => {
      const error = new Error("Rate exceeded");
      error.name = "ThrottlingException";
      mockSend.mockRejectedValueOnce(error);
      const result = await provider.checkAvailability();
      expect(result.code).toBe("rate_limited");
    });

    it("map RequestTimeoutException -> timeout", async () => {
      const error = new Error("Request timeout");
      error.name = "RequestTimeoutException";
      mockSend.mockRejectedValueOnce(error);
      const result = await provider.checkAvailability();
      expect(result.code).toBe("timeout");
    });

    it("map ResourceNotFoundException -> enrollment_missing", async () => {
      const error = new Error("Resource not found");
      error.name = "ResourceNotFoundException";
      mockSend.mockRejectedValueOnce(error);
      const result = await provider.checkAvailability();
      expect(result.code).toBe("enrollment_missing");
    });
  });
});