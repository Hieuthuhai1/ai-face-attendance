import type {
  EnrollResult,
  FaceFixture,
  FaceRecognitionProvider,
  LivenessResult,
  VerifyResult,
} from "./types";

/**
 * MockFaceRecognitionProvider — CHỈ cho development/test.
 * Kết quả xác định theo fixture, không nhận diện thật, không liveness thật.
 */
export class MockFaceRecognitionProvider implements FaceRecognitionProvider {
  readonly name = "mock";
  readonly isDemo = true;

  async enroll(input: { employeeId: string; images: FaceFixture[] }): Promise<EnrollResult> {
    const good = input.images.filter((i) => i === "good").length;
    if (good < 2) {
      throw new Error("MOCK_LOW_QUALITY");
    }
    return { providerSubjectId: `mock_${input.employeeId}`, quality: 0.9 };
  }

  async checkLiveness(input: { image: FaceFixture }): Promise<LivenessResult> {
    // Mock KHÔNG có liveness thật: chỉ ánh xạ fixture để test pipeline.
    if (input.image === "liveness-fail") {
      return { status: "fail", providerReference: "mock_ref_liveness" };
    }
    if (input.image === "blurry") {
      return { status: "unknown", providerReference: "mock_ref_liveness" };
    }
    return { status: "pass", providerReference: "mock_ref_liveness" };
  }

  async verify1to1(input: {
    providerSubjectId: string;
    image: FaceFixture;
  }): Promise<VerifyResult> {
    const ref = `mock_ref_${input.image}`;
    switch (input.image) {
      case "good":
        return { match: true, confidence: 0.95, liveness: "pass", providerReference: ref };
      case "blurry":
        return { match: false, confidence: 0.65, liveness: "unknown", providerReference: ref };
      case "no-match":
        return { match: false, confidence: 0.2, liveness: "pass", providerReference: ref };
      case "liveness-fail":
        return { match: false, confidence: 0.4, liveness: "fail", providerReference: ref };
    }
  }

  async deleteSubject(): Promise<void> {
    return;
  }
}
