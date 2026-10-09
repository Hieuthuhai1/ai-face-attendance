import "server-only";
import { MockFaceRecognitionProvider } from "./mock";
import type { FaceRecognitionProvider } from "./types";

export class ProviderNotConfiguredError extends Error {
  readonly code = "PROVIDER_NOT_CONFIGURED";
  constructor() {
    super("Face provider chưa được cấu hình cho môi trường này.");
  }
}

/**
 * Factory fail-closed: production KHÔNG BAO GIỜ dùng mock.
 * Chưa cấu hình provider thật → throw, caller trả lỗi chứ không verify.
 */
export function getFaceProvider(env = process.env): FaceRecognitionProvider {
  const configured = (env.FACE_PROVIDER ?? "mock").toLowerCase();
  const nodeEnv = env.NODE_ENV ?? "development";

  if (configured === "mock") {
    if (nodeEnv === "production") {
      throw new ProviderNotConfiguredError();
    }
    return new MockFaceRecognitionProvider();
  }
  // Adapter production được đăng ký ở Phase 10.
  throw new ProviderNotConfiguredError();
}
