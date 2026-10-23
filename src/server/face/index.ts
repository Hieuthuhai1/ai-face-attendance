import "server-only";
import { MockFaceRecognitionProvider } from "./mock";
import { AwsRekognitionProvider } from "./aws-rekognition";
import type { FaceRecognitionProvider, ProviderHealth } from "./types";
import { getProviderHealth as getPublicProviderHealth } from "./public";

export class ProviderNotConfiguredError extends Error {
  readonly code = "PROVIDER_NOT_CONFIGURED";
  constructor(message?: string) {
    super(message ?? "Face provider chưa được cấu hình cho môi trường này.");
  }
}

/**
 * Factory fail-closed: production KHÔNG BAO GIỜ dùng mock MẶC ĐỊNH.
 * Chưa cấu hình provider thật → throw, caller trả lỗi chứ không verify.
 * CHỈ khi set ALLOW_MOCK_IN_PRODUCTION=true mới cho phép mock trên production (DEMO/test).
 */
export function getFaceProvider(env = process.env): FaceRecognitionProvider {
  const configured = (env.FACE_PROVIDER ?? "mock").toLowerCase();
  const nodeEnv = env.NODE_ENV ?? "development";
  const allowMockInProd = (env.ALLOW_MOCK_IN_PRODUCTION ?? "false").toLowerCase() === "true";

  if (configured === "mock") {
    if (nodeEnv === "production" && !allowMockInProd) {
      throw new ProviderNotConfiguredError();
    }
    return new MockFaceRecognitionProvider();
  }

  if (configured === "aws-rekognition") {
    const accessKeyId = env.FACE_PROVIDER_API_KEY;
    const secretAccessKey = env.FACE_PROVIDER_SECRET_KEY;
    const region = env.FACE_PROVIDER_REGION ?? "ap-southeast-1";
    const collectionId = env.FACE_COLLECTION_ID ?? "attendance-faces";

    if (!accessKeyId || !secretAccessKey) {
      throw new ProviderNotConfiguredError("FACE_PROVIDER_API_KEY và FACE_PROVIDER_SECRET_KEY là bắt buộc cho aws-rekognition");
    }

    return new AwsRekognitionProvider({
      region,
      accessKeyId,
      secretAccessKey,
      collectionId,
      verifyThreshold: Number(env.VERIFY_THRESHOLD ?? 0.72),
      reviewBandLow: Number(env.REVIEW_BAND_LOW ?? 0.6),
    });
  }

  throw new ProviderNotConfiguredError(`Unknown provider: ${configured}`);
}

/** Health check công khai (không chứa secret): UI/banner + trang HR dùng để hiển thị trạng thái. */
export function getProviderHealth(env = process.env): ProviderHealth {
  return getPublicProviderHealth(env);
}