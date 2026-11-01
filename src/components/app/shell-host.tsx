import type { ReactNode } from "react";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/server/auth";
import { AppShell } from "./app-shell";
import { LocaleBootstrap } from "./language-provider";
import { signOut } from "@/features/auth/actions";
import { LOCALE_COOKIE, normalizeLocale, type Locale } from "@/lib/i18n/config";
import type { Role } from "@/types/db";

/**
 * Async server child — chạy trong Suspense để không chặn prerender tĩnh.
 * `connection()` khai báo dynamic tường minh (đọc cookies phía dưới).
 */
export async function ShellHost({ children }: { children: ReactNode }) {
  // Đọc session là dynamic — khai báo sớm để không bị prerender tĩnh.
  await connection();
  let user: { displayName: string; email: string; role: Role } | null = null;
  let profileLocale: Locale = "vi";
  try {
    const { profile } = await requireUser();
    user = { displayName: profile.display_name, email: profile.email, role: profile.role };
    profileLocale = normalizeLocale(profile.locale);
  } catch {
    user = null;
  }

  const hasLocaleCookie = Boolean((await cookies()).get(LOCALE_COOKIE));

  return (
    <AppShell user={user} onLogout={signOut}>
      {!hasLocaleCookie && user ? <LocaleBootstrap locale={profileLocale} /> : null}
      {children}
    </AppShell>
  );
}
