"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n/config";
import { translateText } from "@/lib/i18n/translate";
import { updateLocaleAction } from "@/features/profile/actions";

export interface LanguageContextValue {
  locale: Locale;
  /** Switch the whole app language. Persists to the profile + cookie by default. */
  setLocale: (
    locale: Locale,
    options?: { persist?: boolean; immediate?: boolean },
  ) => Promise<{ ok: true } | { ok: false; message?: string }>;
  /** Translate a known Vietnamese UI string. */
  t: (vietnamese: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"]);
const TRANSLATABLE_ATTRS = ["placeholder", "title", "aria-label", "alt"] as const;

const ORIGINAL_TEXT = new WeakMap<Text, string>();
const TRANSLATED_TEXT = new WeakMap<Text, string>();
const ORIGINAL_ATTRS = new WeakMap<Element, Map<string, string>>();
const TRANSLATED_ATTRS = new WeakMap<Element, Map<string, string>>();

function shouldSkip(element: Element): boolean {
  if (SKIP_TAGS.has(element.tagName)) return true;
  if (element.hasAttribute("data-i18n-skip")) return true;
  return element.closest("[data-i18n-skip]") !== null;
}

function translateTextNode(node: Text, locale: Locale): void {
  const parent = node.parentElement;
  if (!parent || shouldSkip(parent)) return;

  const current = node.nodeValue ?? "";
  if (!current.trim()) return;

  if (locale === "vi") {
    const original = ORIGINAL_TEXT.get(node);
    if (original !== undefined && current !== original) node.nodeValue = original;
    TRANSLATED_TEXT.delete(node);
    return;
  }

  const lastTranslated = TRANSLATED_TEXT.get(node);
  if (lastTranslated !== undefined && current === lastTranslated) return;

  const translated = translateText(current, "en");
  if (translated === current) {
    ORIGINAL_TEXT.delete(node);
    TRANSLATED_TEXT.delete(node);
    return;
  }

  ORIGINAL_TEXT.set(node, current);
  TRANSLATED_TEXT.set(node, translated);
  node.nodeValue = translated;
}

function translateAttributes(element: Element, locale: Locale): void {
  if (shouldSkip(element)) return;

  for (const attr of TRANSLATABLE_ATTRS) {
    const current = element.getAttribute(attr);
    if (current === null || !current.trim()) continue;

    if (locale === "vi") {
      const original = ORIGINAL_ATTRS.get(element)?.get(attr);
      if (original !== undefined && current !== original) element.setAttribute(attr, original);
      continue;
    }

    const lastTranslated = TRANSLATED_ATTRS.get(element)?.get(attr);
    if (lastTranslated !== undefined && current === lastTranslated) continue;

    const translated = translateText(current, "en");
    if (translated === current) continue;

    let originals = ORIGINAL_ATTRS.get(element);
    if (!originals) {
      originals = new Map();
      ORIGINAL_ATTRS.set(element, originals);
    }
    originals.set(attr, current);

    let translatedAttrs = TRANSLATED_ATTRS.get(element);
    if (!translatedAttrs) {
      translatedAttrs = new Map();
      TRANSLATED_ATTRS.set(element, translatedAttrs);
    }
    translatedAttrs.set(attr, translated);
    element.setAttribute(attr, translated);
  }
}

function processNode(node: Node, locale: Locale): void {
  if (node.nodeType === Node.TEXT_NODE) {
    translateTextNode(node as Text, locale);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node as Element;
  if (shouldSkip(element)) return;

  translateAttributes(element, locale);
  for (const child of Array.from(element.childNodes)) processNode(child, locale);
}

function setLocaleCookie(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}

export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => normalizeLocale(initialLocale));
  const localeRef = useRef(locale);
  const observerRef = useRef<MutationObserver | null>(null);
  const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the ref in sync after commit; it is only read from event handlers and
  // observer callbacks, never during render.
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  const connectObserver = useCallback(() => {
    if (typeof document === "undefined" || !document.body) return;
    observerRef.current?.disconnect();

    const attach = () => {
      const observer = new MutationObserver(() => {
        if (localeRef.current !== "en") return;
        if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
        // Wait until React finishes hydrating streamed Suspense boundaries
        // before touching text nodes, otherwise hydration can see mismatched
        // HTML. Hydration mutations keep resetting this timer.
        applyTimerRef.current = setTimeout(() => {
          applyTimerRef.current = null;
          observerRef.current?.disconnect();
          try {
            processNode(document.body, "en");
          } finally {
            if (localeRef.current === "en") attach();
          }
        }, 600);
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...TRANSLATABLE_ATTRS],
      });
      observerRef.current = observer;
    };

    attach();
  }, []);

  const applyNow = useCallback(
    (targetLocale: Locale) => {
      if (typeof document === "undefined" || !document.body) return;
      if (applyTimerRef.current) {
        clearTimeout(applyTimerRef.current);
        applyTimerRef.current = null;
      }
      // Keep the document language in sync for screen readers. This runs after
      // hydration (or from a user event), so it cannot cause an SSR mismatch.
      document.documentElement.lang = targetLocale;
      // Our own text mutations would re-trigger the observer. Disconnect while
      // applying, then reconnect if English is still active.
      observerRef.current?.disconnect();
      try {
        processNode(document.body, targetLocale);
      } finally {
        if (localeRef.current === "en") connectObserver();
      }
    },
    [connectObserver],
  );

  const scheduleApply = useCallback(
    (targetLocale: Locale) => {
      if (typeof window === "undefined") return;
      if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
      applyTimerRef.current = setTimeout(() => {
        applyTimerRef.current = null;
        applyNow(targetLocale);
      }, 600);
    },
    [applyNow],
  );

  const setLocale = useCallback(
    async (
      next: Locale,
      options?: { persist?: boolean; immediate?: boolean },
    ): Promise<{ ok: true } | { ok: false; message?: string }> => {
      const normalized = normalizeLocale(next);
      setLocaleState(normalized);
      localeRef.current = normalized;
      setLocaleCookie(normalized);
      if (options?.immediate === false) scheduleApply(normalized);
      else applyNow(normalized);

      if (options?.persist === false) return { ok: true };

      try {
        return await updateLocaleAction(normalized);
      } catch {
        return {
          ok: false,
          message: "Không thể cập nhật ngôn ngữ. Vui lòng thử lại.",
        };
      }
    },
    [applyNow, scheduleApply],
  );

  const t = useCallback((vietnamese: string) => translateText(vietnamese, locale), [locale]);

  // The root layout is static, so the cookie is read after hydration. This
  // keeps English selected across reloads without blocking prerendering.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
    );
    if (!match) return;
    const cookieLocale = normalizeLocale(decodeURIComponent(match[1]));
    if (cookieLocale !== localeRef.current) {
      setLocaleState(cookieLocale);
      localeRef.current = cookieLocale;
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (locale === "en") {
      connectObserver();
      scheduleApply("en");
    } else {
      applyNow("vi");
      observerRef.current?.disconnect();
    }
    return () => {
      if (applyTimerRef.current) {
        clearTimeout(applyTimerRef.current);
        applyTimerRef.current = null;
      }
      observerRef.current?.disconnect();
    };
  }, [locale, applyNow, scheduleApply, connectObserver]);

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}

/** Applies the saved profile language on first load when no cookie exists yet. */
export function LocaleBootstrap({ locale }: { locale: Locale }) {
  const { locale: current, setLocale } = useLanguage();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    if (current !== locale) void setLocale(locale, { persist: false, immediate: false });
  }, [current, locale, setLocale]);

  return null;
}
