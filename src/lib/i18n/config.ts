export type Locale = "vi" | "en";

export const LOCALE_COOKIE = "app_locale";
export const DEFAULT_LOCALE: Locale = "vi";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LOCALE_LABELS: Record<Locale, { native: string; english: string }> = {
  vi: { native: "Tiếng Việt", english: "Vietnamese" },
  en: { native: "English", english: "English" },
};

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === "en" ? "en" : "vi";
}

export function isLocale(value: unknown): value is Locale {
  return value === "vi" || value === "en";
}
