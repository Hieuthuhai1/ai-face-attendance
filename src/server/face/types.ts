/**
 * FaceRecognitionProvider — abstraction chạy SERVER-SIDE ONLY.
 * Không import module này từ client component. Không trả template về frontend.
 */

export type LivenessStatus = "pass" | "fail" | "unknown";

export interface EnrollResult {
  providerSubjectId: string;
  quality: number; // 0..1
}

export interface VerifyResult {
  match: boolean;
  confidence: number; // 0..1
  liveness: LivenessStatus;
  providerReference: string; // mã tham chiếu tối thiểu, không phải template
}

export type FaceFixture = "good" | "blurry" | "no-match" | "liveness-fail";

export interface LivenessResult {
  status: LivenessStatus;
  providerReference: string;
}

export interface ProviderHealth {
  /** false khi production chưa cấu hình provider thật (fail closed). */
  configured: boolean;
  provider: string;
  demo: boolean;
  message: string;
}

export interface FaceRecognitionProvider {
  readonly name: string;
  /** True khi provider này KHÔNG dùng được cho chấm công thật. */
  readonly isDemo: boolean;
  enroll(input: { employeeId: string; images: FaceFixture[] }): Promise<EnrollResult>;
  /** Liveness/anti-spoof là bước riêng, chạy trước verify 1:1. */
  checkLiveness(input: { image: FaceFixture }): Promise<LivenessResult>;
  verify1to1(input: {
    providerSubjectId: string;
    image: FaceFixture;
  }): Promise<VerifyResult>;
  deleteSubject(providerSubjectId: string): Promise<void>;
}
