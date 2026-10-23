"use client";

import { Suspense, useState, useEffect } from "react";
import { getProviderHealth } from "@/server/face/public";
import { getTodayStatus } from "@/features/attendance/actions";
import { FaceVerificationFlow } from "@/features/face-verification";
import { LoadingState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";

export default function CheckInPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">Chấm công</h1>
      <Suspense fallback={<LoadingState message="Đang tải trạng thái…" />}>
        <CheckInClient />
      </Suspense>
    </main>
  );
}

function CheckInClient() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getTodayStatus>> | null>(null);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof getProviderHealth>> | null>(null);
  const [direction, setDirection] = useState<"check_in" | "check_out">("check_in");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [s, h] = await Promise.all([getTodayStatus(), getProviderHealth()]);
      setStatus(s);
      setHealth(h);
      // Default direction based on what's available
      if (s.canCheckOut) setDirection("check_out");
      else if (s.canCheckIn) setDirection("check_in");
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading || !status || !health) {
    return <LoadingState message="Đang tải trạng thái…" />;
  }

  if (!status.eligible) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
        <p className="text-lg font-semibold text-slate-900">Không đủ điều kiện</p>
        <p className="mt-2 text-slate-600">Tài khoản chưa đủ điều kiện chấm công. Liên hệ HR.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-4" role="group" aria-label="Chọn hành động">
        <Button
          variant={direction === "check_in" ? "primary" : "secondary"}
          onClick={() => setDirection("check_in")}
          disabled={!status.canCheckIn}
        >
          Chấm công vào
        </Button>
        <Button
          variant={direction === "check_out" ? "primary" : "secondary"}
          onClick={() => setDirection("check_out")}
          disabled={!status.canCheckOut}
        >
          Chấm công ra
        </Button>
      </div>
      <FaceVerificationFlow
        direction={direction}
        shift={status.shift}
        providerDemo={health.demo && health.configured}
        status={status}
      />
    </div>
  );
}