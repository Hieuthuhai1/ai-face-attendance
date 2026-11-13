import { Suspense } from "react";
import { PageHeader } from "@/components/app/app-shell";
import { requireRole } from "@/server/auth";
import { LoadingState } from "@/components/ui/states";
import { RevokeEnrollmentClient } from "./revoke-client";

export default function RevokeEnrollmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="page-shell-narrow flex flex-col gap-6">
      <PageHeader
        eyebrow="Quản trị"
        icon="shield"
        title="Thu hồi đăng ký khuôn mặt"
        description="Thu hồi dữ liệu đăng ký của nhân viên; thao tác được ghi audit."
      />
      <Suspense fallback={<LoadingState message="Đang tải…" />}>
        <RevokeData params={params} />
      </Suspense>
    </main>
  );
}

async function RevokeData({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["hr_admin", "system_admin"]);
  const { id } = await params;
  return <RevokeEnrollmentClient employeeId={id} />;
}
