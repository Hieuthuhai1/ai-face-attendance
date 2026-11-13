import { Suspense } from "react";
import { PageHeader } from "@/components/app/app-shell";
import { getProviderHealth } from "@/server/face/public";
import { getEmployeeEnrollment } from "@/features/face-enrollment/actions";
import { LoadingState } from "@/components/ui/states";

export async function generateStaticParams() {
  // Placeholder để thoả Cache Components; route vẫn dynamic theo session.
  return [{ id: "static-placeholder" }];
}

export default function EnrollForEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="page-shell-form flex flex-col gap-6">
      <PageHeader
        eyebrow="Quản trị"
        icon="scan-face"
        title="Đăng ký khuôn mặt cho nhân viên"
        description="Chụp mẫu khuôn mặt và xác minh chất lượng trước khi kích hoạt."
      />
      <Suspense fallback={<LoadingState message="Đang tải trạng thái…" />}>
        <EnrollmentData params={params} />
      </Suspense>
    </main>
  );
}

async function EnrollmentData({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [enrollment, health] = await Promise.all([getEmployeeEnrollment(id), getProviderHealth()]);
  const reason = enrollment.state === "none" ? null : enrollment.reason;

  const { EnrollmentWorkflow } = await import("@/features/face-enrollment/enrollment-workflow");

  return (
    <EnrollmentWorkflow
      initialState={enrollment.state}
      statusReason={reason}
      employeeId={id}
      providerDemo={health.demo && health.configured}
      showDevControls={process.env.NODE_ENV !== "production"}
    />
  );
}
