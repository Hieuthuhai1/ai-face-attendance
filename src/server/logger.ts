/**
 * Server logger với redact tự động.
 * KHÔNG BAO GIỜ ghi frame/ảnh/template/biometric payload hay secret vào log.
 */

const SENSITIVE_KEYS = new Set([
  "image",
  "frame",
  "photo",
  "template",
  "embedding",
  "biometric",
  "apikey",
  "api_key",
  "secret",
  "password",
  "token",
]);

export const REDACTED = "[REDACTED]";

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key.toLowerCase())) return REDACTED;
  return redact(value);
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(k, v);
    }
    return out;
  }
  return value;
}

export type LogLevel = "info" | "warn" | "error";

function emit(level: LogLevel, message: string, meta?: unknown): void {
  const payload = {
    level,
    message,
    ...(meta !== undefined ? { meta: redact(meta) } : {}),
    at: new Date().toISOString(),
  };
  if (level === "error") console.error(JSON.stringify(payload));
  else if (level === "warn") console.warn(JSON.stringify(payload));
  else console.log(JSON.stringify(payload));
}

export const logger = {
  info: (message: string, meta?: unknown) => emit("info", message, meta),
  warn: (message: string, meta?: unknown) => emit("warn", message, meta),
  error: (message: string, meta?: unknown) => emit("error", message, meta),
};
