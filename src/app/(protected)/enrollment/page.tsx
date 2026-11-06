import { Suspense } from "react";
import { PageHeader } from "@/components/app/app-shell";
import { getProviderHealth } from "@/server/face/public";
import { getMyEnrollment } from "@/features/face-enrollment/actions";
import { LoadingState } from "@/components/ui/states";

export default function EnrollmentPage() {
  return (
    <main className="flex-1 flex flex-col gap-6 px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Đăng ký khuôn mặt"
        description="Đăng ký khuôn mặt cho hệ thống chấm công"
      />
      <Suspense fallback={<LoadingState message="Đang tải trạng thái…" />}>
        <EnrollmentData />
      </Suspense>
    </main>
  );
}

async function EnrollmentData() {
  const [enrollment, health] = await Promise.all([getMyEnrollment(), getProviderHealth()]);
  const reason = enrollment.state === "none" ? null : enrollment.reason;

  // Dynamic import client component to avoid SSR issues
  const { EnrollmentRedesigned } = await import("@/features/face-enrollment/enrollment-redesigned");

  return (
    <EnrollmentRedesigned
      initialState={enrollment.state}
      statusReason={reason}
      providerDemo={health.demo && health.configured}
      showDevControls={process.env.NODE_ENV !== "production"}
    />
  );
}
