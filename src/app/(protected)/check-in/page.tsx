import { Suspense } from "react";
import { getProviderHealth } from "@/server/face/public";
import { getTodayStatus } from "@/features/attendance/actions";
import { LoadingState } from "@/components/ui/states";
import { CheckInClient } from "./check-in-client";

export default function CheckInPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">Chấm công</h1>
      <Suspense fallback={<LoadingState message="Đang tải trạng thái…" />}>
        <CheckInData />
      </Suspense>
    </main>
  );
}

async function CheckInData() {
  const [status, health] = await Promise.all([getTodayStatus(), getProviderHealth()]);
  return <CheckInClient status={status} providerDemo={health.demo && health.configured} showDevControls={process.env.NODE_ENV !== "production"} />;
}
