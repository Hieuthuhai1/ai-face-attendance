import { Suspense } from "react";
import { PageHeader } from "@/components/app/app-shell";
import { connection } from "next/server";
import { getProviderHealth } from "@/server/face/public";
import { getTodayStatus } from "@/features/attendance/actions";
import { LoadingState } from "@/components/ui/states";
import { CheckInClient } from "./check-in-client";

export default function CheckInPage() {
  return (
    <main className="page-shell flex flex-col gap-6">
      <PageHeader
        title="Chấm công"
        description="Xác minh khuôn mặt và chấm công vào"
      />
      <Suspense fallback={<LoadingState message="Đang tải trạng thái…" />}>
        <CheckInData />
      </Suspense>
    </main>
  );
}

async function CheckInData() {
  await connection();
  const [status, health] = await Promise.all([getTodayStatus(), getProviderHealth()]);
  return <CheckInClient status={status} providerDemo={health.demo && health.configured} showDevControls={process.env.NODE_ENV !== "production"} />;
}
