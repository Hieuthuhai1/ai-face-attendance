import type { ReactNode } from "react";
import { requireUser } from "@/server/auth";
import { AppShell } from "./app-shell";
import { signOut } from "@/features/auth/actions";
import type { Role } from "@/types/db";

/**
 * Async server child — chạy trong Suspense để không chặn prerender tĩnh.
 * `connection()` khai báo dynamic tường minh (đọc cookies phía dưới).
 */
export async function ShellHost({ children }: { children: ReactNode }) {
  let user: { displayName: string; email: string; role: Role } | null = null;
  try {
    const { profile } = await requireUser();
    user = { displayName: profile.display_name, email: profile.email, role: profile.role };
  } catch {
    user = null;
  }
  return (
    <AppShell user={user} onLogout={signOut}>
      {children}
    </AppShell>
  );
}
