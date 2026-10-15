"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isOAuthProvider } from "@/features/auth/oauth";
import { loginSchema } from "@/lib/validation";

export type AuthResult = { ok: true } | { ok: false; message: string };

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { ok: false, message: "Email hoặc mật khẩu chưa đúng." };
  redirect("/dashboard");
}

/**
 * Wrapper cho <form action> (progressive enhancement): submit hoạt động ngay cả
 * trước khi hydrate, credentials đi bằng POST — không bao giờ lọt vào URL.
 */
export async function signInPasswordAction(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  return signInWithPassword(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
}

export async function signInWithOAuth(provider: string): Promise<AuthResult> {
  if (!isOAuthProvider(provider)) {
    return { ok: false, message: "Phương thức đăng nhập chưa được hỗ trợ." };
  }
  const supabase = await createClient();
  // Origin từ request hiện tại; Supabase kiểm tra lại với allowlist redirect URLs
  // nên origin lạ không thể dùng để rò rỉ code về domain khác.
  const origin =
    (await headers()).get("origin") ?? "http://127.0.0.1:3000";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/callback?next=/dashboard`, scopes: "email profile" },
  });
  if (error || !data.url) {
    return { ok: false, message: "Đăng nhập Google chưa được cấu hình, liên hệ admin." };
  }
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
