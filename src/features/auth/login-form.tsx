"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { signIn } from "@/features/auth/actions";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const res = await signIn(
      String(formData.get("email") ?? ""),
      String(formData.get("password") ?? ""),
    );
    // signIn thành công thì redirect (không tới dòng này).
    if (res && !res.ok) {
      setError(res.message);
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardTitle>Đăng nhập</CardTitle>
      <CardDescription>Web chấm công nội bộ. Liên hệ HR nếu chưa có tài khoản.</CardDescription>
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
