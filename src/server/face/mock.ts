import type {
  EnrollResult,
  EnrollInput,
  FaceImageInput,
  FaceOperationResult,
  FaceRecognitionProvider,
  LivenessResult,
  ProviderCapabilities,
  ProviderHealth,
  Verify1to1Input,
  VerifyResult,
  LivenessInput,
} from "./types";

/**
 * MockFaceRecognitionProvider — CHỈ cho development/test.
 * Kết quả xác định theo fixture, không nhận diện thật, không liveness thật.
 * UI gắn nhãn "DEMO – không dùng chấm công thật".
 */
export class MockFaceRecognitionProvider implements FaceRecognitionProvider {
  readonly name = "mock";
  readonly isDemo = true;
  readonly capabilities: ProviderCapabilities = {
    enroll: true,
    verify1to1: true,
    verify1toN: false,
    liveness: true,
    qualityAssessment: true,
    deleteSubject: true,
  };

  async checkAvailability(): Promise<FaceOperationResult<{ available: boolean }>> {
    return { ok: true, code: "success", message: "Mock provider available", data: { available: true } };
  }

  async assessImageQuality(input: { image: FaceImageInput }): Promise<FaceOperationResult<{ quality: number; issues: string[] }>> {
    // Mock: nếu data chứa "blurry" thì quality thấp
    const dataStr = typeof input.image.data === "string" ? input.image.data : "";
    if (dataStr.includes("blurry")) {
      return { ok: true, code: "success", message: "Quality assessed", data: { quality: 0.3, issues: ["blurry"] } };
    }
    return { ok: true, code: "success", message: "Quality assessed", data: { quality: 0.9, issues: [] } };
  }

  async enrollFace(input: EnrollInput): Promise<FaceOperationResult<EnrollResult>> {
    // Mock: kiểm tra số lượng ảnh "good"
    const goodCount = input.images.filter((img) => {
      const dataStr = typeof img.data === "string" ? img.data : "";
      return dataStr.includes("good") || dataStr === "";
    }).length;

    if (goodCount < 2) {
      return { ok: false, code: "poor_image_quality", message: "MOCK_LOW_QUALITY: cần ít nhất 2 ảnh đạt chất lượng" };
    }
    return {
      ok: true,
      code: "success",
      message: "Enrolled successfully",
      data: { providerSubjectId: `mock_${input.employeeId}`, quality: 0.85 },
    };
  }

  async checkLiveness(input: LivenessInput): Promise<FaceOperationResult<LivenessResult>> {
    // Mock: kiểm tra fixture trong data
    const dataStr = typeof input.image.data === "string" ? input.image.data : "";
    if (dataStr.includes("liveness-fail")) {
      return { ok: true, code: "liveness_failed", message: "Liveness check failed", data: { status: "fail", providerReference: "mock_ref_liveness" } };
    }
    if (dataStr.includes("blurry")) {
      return { ok: true, code: "success", message: "Liveness unknown", data: { status: "unknown", providerReference: "mock_ref_liveness" } };
    }
    return { ok: true, code: "success", message: "Liveness passed", data: { status: "pass", providerReference: "mock_ref_liveness" } };
  }

  async verifyFace(input: Verify1to1Input): Promise<FaceOperationResult<VerifyResult>> {
    // Mock: kiểm tra fixture trong data
    const dataStr = typeof input.image.data === "string" ? input.image.data : "";
    let result: VerifyResult;

    if (dataStr.includes("good") || dataStr === "") {
      result = { match: true, confidence: 0.9, liveness: "pass", providerReference: "mock_ref_good" };
    } else if (dataStr.includes("blurry")) {
      result = { match: true, confidence: 0.6, liveness: "unknown", providerReference: "mock_ref_blurry" };
    } else if (dataStr.includes("no-match")) {
      result = { match: false, confidence: 0.35, liveness: "pass", providerReference: "mock_ref_no_match" };
    } else if (dataStr.includes("liveness-fail")) {
      result = { match: false, confidence: 0.4, liveness: "fail", providerReference: "mock_ref_liveness_fail" };
    } else {
      result = { match: true, confidence: 0.9, liveness: "pass", providerReference: "mock_ref_good" };
    }

    const code = result.match ? (result.confidence >= 0.72 ? "success" : "low_confidence") : "no_match";
    return { ok: true, code, message: "Verify completed", data: result };
  }

  async removeEnrollment(providerSubjectId: string): Promise<FaceOperationResult<void>> {
    return { ok: true, code: "success", message: "Subject removed", data: undefined };
  }

  async getHealth(): Promise<ProviderHealth> {
    return { configured: true, provider: "mock", demo: true, message: "DEMO — không dùng chấm công thật" };
  }
}