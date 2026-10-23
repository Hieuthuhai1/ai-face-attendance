/**
 * FaceRecognitionProvider — abstraction chạy SERVER-SIDE ONLY.
 * Không import module này từ client component. Không trả template về frontend.
 */

export type LivenessStatus = "pass" | "fail" | "unknown";

/** Kết quả enrollment chuẩn hóa. */
export interface EnrollResult {
  providerSubjectId: string;
  quality: number; // 0..1
}

/** Kết quả verify 1:1 chuẩn hóa. */
export interface VerifyResult {
  match: boolean;
  confidence: number; // 0..1
  liveness: LivenessStatus;
  providerReference: string; // mã tham chiếu tối thiểu, không phải template
}

/** Kết quả liveness check chuẩn hóa. */
export interface LivenessResult {
  status: LivenessStatus;
  providerReference: string;
}

/** Provider health check. */
export interface ProviderHealth {
  /** false khi production chưa cấu hình provider thật (fail closed). */
  configured: boolean;
  provider: string;
  demo: boolean;
  message: string;
}

/** Provider capabilities — chỉ implement những gì provider thực sự hỗ trợ. */
export interface ProviderCapabilities {
  enroll: boolean;
  verify1to1: boolean;
  verify1toN: boolean;
  liveness: boolean;
  qualityAssessment: boolean;
  deleteSubject: boolean;
}

/** Loại lỗi chuẩn hóa cho enrollment/verify. */
export type FaceResultCode =
  | "success"
  | "no_match"
  | "low_confidence"
  | "poor_image_quality"
  | "liveness_failed"
  | "enrollment_missing"
  | "provider_unavailable"
  | "manual_review_required"
  | "timeout"
  | "invalid_input"
  | "rate_limited"
  | "not_configured";

/** Kết quả operation chuẩn hóa. */
export interface FaceOperationResult<T = unknown> {
  ok: boolean;
  code: FaceResultCode;
  message: string;
  data?: T;
}

/** Fixture cho mock/testing — KHÔNG dùng production. */
export type FaceFixture = "good" | "blurry" | "no-match" | "liveness-fail";

/** Input ảnh thực tế cho provider production (Blob/base64). */
export interface FaceImageInput {
  /** Base64 encoded JPEG/PNG hoặc Buffer/Blob. */
  data: string | Buffer | Blob;
  /** MIME type: image/jpeg | image/png */
  mimeType: "image/jpeg" | "image/png";
}

/** Enrollment input cho provider thật. */
export interface EnrollInput {
  employeeId: string;
  images: FaceImageInput[];
}

/** Verify 1:1 input cho provider thật. */
export interface Verify1to1Input {
  providerSubjectId: string;
  image: FaceImageInput;
}

/** Liveness check input cho provider thật. */
export interface LivenessInput {
  image: FaceImageInput;
  sessionId?: string; // cho active liveness challenge
}

export interface FaceRecognitionProvider {
  readonly name: string;
  /** True khi provider này KHÔNG dùng được cho chấm công thật. */
  readonly isDemo: boolean;
  /** Capabilities mà provider này hỗ trợ. */
  readonly capabilities: ProviderCapabilities;

  /** Kiểm tra provider sẵn sàng (health check). */
  checkAvailability(): Promise<FaceOperationResult<{ available: boolean }>>;

  /** Đánh giá chất lượng ảnh (nếu provider hỗ trợ). */
  assessImageQuality(input: { image: FaceImageInput }): Promise<FaceOperationResult<{ quality: number; issues: string[] }>>;

  /** Đăng ký khuôn mặt — tạo subject/template ở provider. */
  enrollFace(input: EnrollInput): Promise<FaceOperationResult<EnrollResult>>;

  /** Xác minh 1:1 — so sánh ảnh live với subject đã enroll. */
  verifyFace(input: Verify1to1Input): Promise<FaceOperationResult<VerifyResult>>;

  /** Liveness/anti-spoof check (capability riêng, có thể không hỗ trợ). */
  checkLiveness(input: LivenessInput): Promise<FaceOperationResult<LivenessResult>>;

  /** Xóa subject/template khỏi provider. */
  removeEnrollment(providerSubjectId: string): Promise<FaceOperationResult<void>>;

  /** Health check cho monitoring. */
  getHealth(): Promise<ProviderHealth>;
}
