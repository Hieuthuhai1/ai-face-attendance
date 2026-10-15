"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { signInWithOAuth, signInWithPassword } from "@/features/auth/actions";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const oauthFailed = useSearchParams().get("error") === "oauth";

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const res = await signInWithPassword(
      String(formData.get("email") ?? ""),
      String(formData.get("password") ?? ""),
    );
    // signIn thành công thì redirect (không tới dòng này).
    if (res && !res.ok) {
      setError(res.message);
      setLoading(false);
    }
  }

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

  return (
    <Card className="w-full max-w-sm">
      <CardTitle>Đăng nhập</CardTitle>
      <CardDescription>Web chấm công nội bộ. Liên hệ HR nếu chưa có tài khoản.</CardDescription>
      {oauthFailed ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          ✕ Đăng nhập Google thất bại hoặc bị hủy. Thử lại hoặc dùng email/mật khẩu.
        </p>
      ) : null}
      <div className="mt-4">
        <Button variant="secondary" onClick={onGoogle} loading={oauthLoading} aria-label="Đăng nhập bằng Google">
          <span aria-hidden="true">G</span> Đăng nhập bằng Google
        </Button>
      </div>
      <div className="my-4 flex items-center gap-2 text-xs text-slate-500" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200" />
        <span>Hoặc</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(new FormData(e.currentTarget));
        }}
      >
        <Input label="Email công việc" name="email" type="email" autoComplete="email" required />
        <Input label="Mật khẩu" name="password" type="password" autoComplete="current-password" required />
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            ✕ {error}
          </p>
        ) : null}
        <Button type="submit" loading={loading}>
          Đăng nhập
        </Button>
      </form>
    </Card>
  );
}
