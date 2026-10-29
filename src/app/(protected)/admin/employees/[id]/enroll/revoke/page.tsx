import { Suspense } from "react";
import { requireRole } from "@/server/auth";
import { LoadingState } from "@/components/ui/states";
import { RevokeEnrollmentClient } from "./revoke-client";

export default function RevokeEnrollmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">Thu hồi đăng ký khuôn mặt</h1>
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
