import "server-only";

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