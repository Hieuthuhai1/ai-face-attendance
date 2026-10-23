import { Suspense } from "react";
import { getProviderHealth } from "@/server/face/public";
import { getMyEnrollment } from "@/features/face-enrollment/actions";
import { LoadingState } from "@/components/ui/states";

export async function generateStaticParams() {
  // Return a dummy param to satisfy Cache Components requirement
  // This path will not be used in production since the page is dynamic
  return [{ id: "static-placeholder" }];
}

export default function EnrollmentPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">Đăng ký khuôn mặt</h1>
      <Suspense fallback={<LoadingState message="Đang tải trạng thái…" />}>
        <EnrollmentData />
      </Suspense>
    </main>
  );
}

async function EnrollmentData() {
  const [enrollment, health] = await Promise.all([getMyEnrollment(), getProviderHealth()]);
  const state = enrollment.state === "none" ? "none" : enrollment.state;

  // Dynamic import client component to avoid SSR issues
  const { EnrollmentWorkflow } = await import("@/features/face-enrollment/enrollment-workflow");

  return <EnrollmentWorkflow initialState={state} providerDemo={health.demo && health.configured} />;
}