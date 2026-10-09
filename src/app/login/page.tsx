import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/features/auth/login-form";
import { LoadingState } from "@/components/ui/states";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-16">
      <h1 className="mb-4 text-xl font-bold">AI Face Attendance</h1>
      <Suspense fallback={<LoadingState message="Đang kiểm tra phiên đăng nhập…" />}>
        <LoginCheck />
      </Suspense>
    </main>
  );
}

async function LoginCheck() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  return <LoginForm />;
}
