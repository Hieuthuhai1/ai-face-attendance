"use client";

import { useState } from "react";
import type { getTodayStatus } from "@/features/attendance/actions";
import { FaceVerificationFlow } from "@/features/face-verification";
import { Button } from "@/components/ui/button";

type TodayStatus = Awaited<ReturnType<typeof getTodayStatus>>;

export function CheckInClient({
  status,
  providerDemo,
  showDevControls = false,
}: {
  status: TodayStatus;
  providerDemo: boolean;
  showDevControls?: boolean;
}) {
  const [direction, setDirection] = useState<"check_in" | "check_out">(
    status.eligible && status.canCheckOut ? "check_out" : "check_in",
  );

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
      <div className="mb-4 flex gap-2" role="group" aria-label="Chọn hành động">
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
        providerDemo={providerDemo}
        showDevControls={showDevControls}
        status={status}
      />
    </div>
  );
}
