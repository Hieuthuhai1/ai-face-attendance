/** OAuth helpers — thuần túy, unit-test được. */

export const OAUTH_PROVIDERS = ["google"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Chống open-redirect sau OAuth callback: chỉ chấp nhận path nội bộ
 * (bắt đầu bằng đúng 1 dấu `/`, không `//`, không scheme).
 */
export function sanitizeNextParam(next: string | null): string {
  if (!next) return "/dashboard";
  if (!next.startsWith("/")) return "/dashboard";
  if (next.startsWith("//")) return "/dashboard";
  if (/[\\]/.test(next)) return "/dashboard";
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(next)) return "/dashboard";
  return next;
}
