import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { AppShell, type ShellUser } from "./app-shell";
import { signOut } from "@/features/auth/actions";
import type { Role } from "@/types/db";

/** Đọc session nhẹ, KHÔNG redirect — route guard vẫn do proxy + requireRole. */
async function currentUser(): Promise<ShellUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, email, role")
      .eq("id", user.id)
      .single();
    const p = profile as { display_name: string; email: string; role: Role } | null;
    if (!p) return null;
    return { displayName: p.display_name, email: p.email, role: p.role };
  } catch {
    return null;
  }
}

/** Async server child — chạy trong Suspense để không chặn prerender tĩnh. */
export async function ShellHost({ children }: { children: ReactNode }) {
  const user = await currentUser();
  return (
    <AppShell user={user} onLogout={signOut}>
      {children}
    </AppShell>
  );
}
