"use client";

import { useState } from "react";
import type { getTodayStatus } from "@/features/attendance/actions";
import { FaceVerificationRedesigned } from "@/features/face-verification/face-verification-redesigned";
import { Icon } from "@/components/ui/icon";

type TodayStatus = Awaited<ReturnType<typeof getTodayStatus>>;

export function CheckInClient({
  status,
  providerDemo,
  showDevControls = false,
  employeeName,
  employeeCode,
  department,
}: {
  status: TodayStatus;
  providerDemo: boolean;
  showDevControls?: boolean;
  employeeName?: string;
  employeeCode?: string;
  department?: string | null;
}) {
  const [direction, setDirection] = useState<"check_in" | "check_out">(
    status.eligible && status.canCheckOut ? "check_out" : "check_in",
  );

  const identity = { employeeName, employeeCode, department };

  if (!status.eligible) {
    return (
      <FaceVerificationRedesigned
        direction="check_in"
        status={status}
        providerDemo={providerDemo}
        showDevControls={showDevControls}
        {...identity}
      />
    );
  }

  const options = [
    {
      value: "check_in" as const,
      label: "Chấm công vào",
      hint: "Bắt đầu ca làm",
      icon: "arrow-right" as const,
      disabled: !status.canCheckIn,
    },
    {
      value: "check_out" as const,
      label: "Chấm công ra",
      hint: "Kết thúc ca làm",
      icon: "logout" as const,
      disabled: !status.canCheckOut,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
        <div
          role="group"
          aria-label="Chọn hành động chấm công"
          className="grid grid-cols-2 gap-1.5 rounded-[calc(var(--radius-card)-6px)] bg-[var(--surface-muted)] p-1"
        >
          {options.map((option) => {
            const active = direction === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setDirection(option.value)}
                disabled={option.disabled}
                className={`flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-[13px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-45 ${
                  active
                    ? "bg-white text-[var(--navy-800)] shadow-[var(--shadow-xs)] ring-1 ring-inset ring-[var(--border)]"
                    : "text-[var(--text-2)] hover:text-[var(--navy-800)]"
                }`}
              >
                <Icon name={option.icon} size={15} className={active ? "text-[var(--brand)]" : ""} />
                <span className="whitespace-nowrap">{option.label}</span>
              </button>
            );
          })}
        </div>
        <p className="px-1.5 text-[11.5px] text-[var(--text-3)] sm:px-0 sm:text-right">
          {status.canCheckOut
            ? "Bạn đang trong ca — chọn “Chấm công ra” khi kết thúc."
            : status.canCheckIn
              ? "Sẵn sàng vào ca — xác minh khuôn mặt để bắt đầu."
              : "Chưa đến thời gian chấm công của ca hôm nay."}
        </p>
      </div>

      <FaceVerificationRedesigned
        key={direction}
        direction={direction}
        shift={status.shift}
        providerDemo={providerDemo}
        showDevControls={showDevControls}
        status={status}
        {...identity}
        onComplete={() => setDirection(direction === "check_in" ? "check_out" : "check_in")}
      />
    </div>
  );
}
