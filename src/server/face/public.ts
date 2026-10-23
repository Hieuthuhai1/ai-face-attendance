/**
 * Public face provider utilities — KHÔNG dùng server-only.
 * Chỉ chứa hàm health check và các tiện ích có thể dùng ở client/server.
 */

import type { ProviderHealth } from "./types";

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
    // Không thể gọi getFaceProvider ở đây vì nó dùng server-only
    // Chỉ kiểm tra có key không
    return { configured: true, provider: "aws-rekognition", demo: false, message: "Credentials cấu hình — kiểm tra runtime." };
  }

  return { configured: false, provider: configured, demo: false, message: `Unknown provider: ${configured}` };
}