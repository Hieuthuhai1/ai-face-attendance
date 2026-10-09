/** Mã lỗi API ổn định — client chỉ nhận code + message, không nhận chi tiết nội bộ. */
export const ERROR_CODES = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "PROVIDER_NOT_CONFIGURED",
  "PROVIDER_UNAVAILABLE",
  "VERIFICATION_FAILED",
  "NEEDS_REVIEW",
  "DUPLICATE_EVENT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string };
}

export function apiError(code: ErrorCode, message: string): ApiErrorBody {
  return { error: { code, message } };
}
