import { Suspense } from "react";
import { requireUser } from "@/server/auth";
import { getProviderHealth } from "@/server/face/service";
import { getMyEnrollment } from "@/features/face-enrollment/actions";
import { EnrollmentFlow, type EnrollmentState } from "@/features/face-enrollment/enrollment-flow";
import { LoadingState } from "@/components/ui/states";

export default function EnrollmentPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Đăng ký khuôn mặt</h1>
      <Suspense fallback={<LoadingState message="Đang tải trạng thái…" />}>
        <EnrollmentData />
      </Suspense>
    </main>
  );
}

async function EnrollmentData() {
  await requireUser();
  const [enrollment, health] = await Promise.all([getMyEnrollment(), getProviderHealth()]);
  const state: EnrollmentState = enrollment.state === "none" ? "none" : enrollment.state;
  return <EnrollmentFlow initialState={state} providerDemo={health.demo && health.configured} />;
}
