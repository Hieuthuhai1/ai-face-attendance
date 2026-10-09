import { Suspense } from "react";
import { getProviderHealth } from "@/server/face/service";
import { getTodayStatus } from "@/features/attendance/actions";
import { CheckInFlow } from "@/features/attendance/checkin-flow";
import { LoadingState } from "@/components/ui/states";

export default function CheckInPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Chấm công</h1>
      <Suspense fallback={<LoadingState message="Đang tải ca hôm nay…" />}>
        <CheckInData />
      </Suspense>
    </main>
  );
}

async function CheckInData() {
  const [status, health] = await Promise.all([getTodayStatus(), getProviderHealth()]);
  return <CheckInFlow status={status} providerDemo={health.demo && health.configured} />;
}
