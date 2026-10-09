import "server-only";
import { getFaceProvider } from "./index";
import type { ProviderHealth } from "./types";

export class ProviderTimeoutError extends Error {
  readonly code = "PROVIDER_TIMEOUT";
  constructor(ms: number) {
    super(`Face provider quá thời gian chờ (${ms}ms).`);
  }
}

/** Bọc mọi gọi provider bằng timeout — provider treo không được treo request. */
export async function withProviderTimeout<T>(task: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ProviderTimeoutError(ms)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const PROVIDER_TIMEOUT_MS = Number(process.env.FACE_PROVIDER_TIMEOUT_MS ?? 8000);

/** Health công khai (không chứa secret): UI/banner + trang HR dùng để hiển thị trạng thái. */
export function getProviderHealth(env = process.env): ProviderHealth {
  const configured = (env.FACE_PROVIDER ?? "mock").toLowerCase();
  const nodeEnv = env.NODE_ENV ?? "development";
  if (configured === "mock") {
    if (nodeEnv === "production") {
      return {
        configured: false,
        provider: "mock",
        demo: true,
        message: "NOT CONFIGURED — chưa có face provider production.",
      };
    }
    return {
      configured: true,
      provider: "mock",
      demo: true,
      message: "DEMO local/test — không dùng chấm công thật.",
    };
  }
  try {
    const p = getFaceProvider(env);
    return { configured: true, provider: p.name, demo: p.isDemo, message: "Sẵn sàng." };
  } catch {
    return {
      configured: false,
      provider: configured,
      demo: false,
      message: "NOT CONFIGURED — kiểm tra credentials/region.",
    };
  }
}
