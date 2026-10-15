"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { signInPasswordAction, signInWithOAuth, type AuthResult } from "@/features/auth/actions";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const oauthFailed = useSearchParams().get("error") === "oauth";
  const [state, formAction, pending] = useActionState<AuthResult | null, FormData>(
    signInPasswordAction,
    null,
  );

  async function onGoogle() {
    setOauthLoading(true);
    setError(null);
    const res = await signInWithOAuth("google");
    // Thành công thì redirect sang Google (không tới dòng này).
    if (res && !res.ok) {
      setError(res.message);
      setOauthLoading(false);
    }
  }

  const formError = state && !state.ok ? state.message : null;

  return (
    <Card className="w-full max-w-sm">
      <CardTitle>Đăng nhập</CardTitle>
      <CardDescription>Web chấm công nội bộ. Liên hệ HR nếu chưa có tài khoản.</CardDescription>
      {oauthFailed ? (
        <p role="alert" className="mt-2 flex items-center gap-1 text-sm text-red-600">
          <Icon name="x" size={14} /> Đăng nhập Google thất bại hoặc bị hủy. Thử lại hoặc dùng email/mật khẩu.
        </p>
      ) : null}
      <div className="mt-4">
        <Button variant="secondary" onClick={onGoogle} loading={oauthLoading} aria-label="Đăng nhập với Google">
          <span aria-hidden="true">G</span> Đăng nhập với Google
        </Button>
      </div>
      <div className="my-4 flex items-center gap-2 text-xs text-slate-500" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200" />
        <span>Hoặc</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <form action={formAction} className="flex flex-col gap-3">
        <Input label="Email công việc" name="email" type="email" autoComplete="email" required />
        <Input label="Mật khẩu" name="password" type="password" autoComplete="current-password" required />
        {error || formError ? (
          <p role="alert" className="flex items-center gap-1 text-sm text-red-600">
            <Icon name="x" size={14} /> {error ?? formError}
          </p>
        ) : null}
        <Button type="submit" loading={pending}>
          Đăng nhập
        </Button>
      </form>
    </Card>
  );
}
