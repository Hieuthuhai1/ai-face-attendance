import "server-only";
import { MockFaceRecognitionProvider } from "./mock";
import { AwsRekognitionProvider } from "./aws-rekognition";
import type { FaceRecognitionProvider, ProviderHealth } from "./types";

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
  const configured = (env.FACE_PROVIDER ?? "mock").toLowerCase();
  const nodeEnv = env.NODE_ENV ?? "development";
  const allowMockInProd = (env.ALLOW_MOCK_IN_PRODUCTION ?? "false").toLowerCase() === "true";

  if (configured === "mock") {
    if (nodeEnv === "production" && !allowMockInProd) {
      return {
        configured: false,
        provider: "mock",
        demo: true,
        message: "NOT CONFIGURED — production cần FACE_PROVIDER thật hoặc ALLOW_MOCK_IN_PRODUCTION=true.",
      };
    }
    return {
      configured: true,
      provider: "mock",
      demo: true,
      message: nodeEnv === "production" ? "DEMO (ALLOW_MOCK_IN_PRODUCTION=true) — KHÔNG dùng chấm công thật." : "DEMO local/test — không dùng chấm công thật.",
    };
  }

  if (configured === "aws-rekognition") {
    const hasKeys = !!(env.FACE_PROVIDER_API_KEY && env.FACE_PROVIDER_SECRET_KEY);
    if (!hasKeys) {
      return { configured: false, provider: "aws-rekognition", demo: false, message: "NOT CONFIGURED — thiếu API key/secret" };
    }
    try {
      const p = getFaceProvider(env);
      return { configured: true, provider: p.name, demo: p.isDemo, message: "Sẵn sàng." };
    } catch {
      return { configured: false, provider: "aws-rekognition", demo: false, message: "NOT CONFIGURED — kiểm tra credentials/region" };
    }
  }

  return { configured: false, provider: configured, demo: false, message: `Unknown provider: ${configured}` };
}