import { Suspense } from "react";
import { requireUser } from "@/server/auth";
import { getProviderHealth } from "@/server/face";
import { getMyEnrollment } from "@/features/face-enrollment/actions";
import { EnrollmentWizard } from "./enrollment-wizard";
import { LoadingState } from "@/components/ui/states";

export default function EnrollmentPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">Đăng ký khuôn mặt</h1>
      <Suspense fallback={<div className="flex h-32 items-center justify-center">Đang tải trạng thái…</div>}>
        <EnrollmentData />
      </Suspense>
    </main>
  );
}

async function EnrollmentData() {
  await requireUser();
  const [enrollment, health] = await Promise.all([getMyEnrollment(), getProviderHealth()]);
  const state = enrollment.state === "none" ? "none" : enrollment.state;
  return <EnrollmentWizard initialState={state} providerDemo={health.demo && health.configured} />;
}