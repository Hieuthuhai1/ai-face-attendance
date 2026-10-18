"use client";

import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";

interface VerificationStep {
  id: string;
  label: string;
  icon: string;
  status: "pending" | "active" | "completed" | "failed";
}

const STEPS: VerificationStep[] = [
  { id: "detect", label: "Phát hiện khuôn mặt", icon: "camera", status: "pending" },
  { id: "liveness", label: "Kiểm tra liveness", icon: "shield", status: "pending" },
  { id: "match", label: "Đối chiếu khuôn mặt", icon: "user", status: "pending" },
  { id: "save", label: "Lưu bản ghi", icon: "save", status: "pending" },
];

interface CameraProgressIndicatorProps {
  currentStep: number;
  className?: string;
}

export function CameraProgressIndicator({ currentStep, className }: CameraProgressIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)} role="progressbar" aria-valuenow={currentStep + 1} aria-valuemin={1} aria-valuemax={STEPS.length} aria-label="Tiến trình xác minh khuôn mặt">
      {STEPS.map((step, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;
        const isFailed = step.status === "failed";

        return (
          <div key={step.id} className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  isCompleted || isActive
                    ? "bg-[var(--brand)] text-white"
                    : isFailed
                    ? "bg-[var(--danger)] text-white"
                    : "bg-slate-100 text-slate-400"
                )}
              >
                {isCompleted ? (
                  <Icon name="check" size={14} />
                ) : isFailed ? (
                  <Icon name="x" size={14} />
                ) : (
                  <Icon name={step.icon} size={14} />
                )}
              </span>
              <span
                className={cn(
                  "text-sm font-medium hidden sm:block",
                  isActive ? "text-[var(--brand)] font-semibold" : "text-slate-500"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-1 flex-1 max-w-20 transition-colors",
                  isCompleted ? "bg-[var(--success)]" : "bg-slate-200"
                )}
                style={{ width: isCompleted ? "100%" : 0 }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface DetailedProgressProps {
  step: "idle" | "detecting" | "liveness" | "matching" | "saving" | "success" | "error";
  message?: string;
  errorCode?: string;
  className?: string;
}

const STEP_MESSAGES = {
  idle: "Sẵn sàng chấm công",
  detecting: "Đang phát hiện khuôn mặt...",
  liveness: "Đang kiểm tra liveness...",
  matching: "Đang đối chiếu khuôn mặt...",
  saving: "Đang lưu bản ghi...",
  success: "Xác minh thành công",
  error: "Xác minh thất bại",
};

const STEP_ICONS = {
  idle: "camera",
  detecting: "camera",
  liveness: "shield",
  matching: "user",
  saving: "save",
  success: "check",
  error: "x",
};

const STEP_COLORS = {
  idle: "text-slate-500",
  detecting: "text-[var(--info)]",
  liveness: "text-[var(--info)]",
  matching: "text-[var(--info)]",
  saving: "text-[var(--info)]",
  success: "text-[var(--success)]",
  error: "text-[var(--danger)]",
};

export function DetailedProgressIndicator({ step, message, errorCode, className }: DetailedProgressProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 py-4", className)} role="status" aria-live="polite">
      <div className="relative">
        <div className="flex items-center justify-center gap-3">
          <span
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full transition-colors",
              STEP_COLORS[step]
            )}
          >
            <Icon name={STEP_ICONS[step]} size={28} />
          </span>
        </div>

        <p className="mt-3 text-lg font-medium text-center" style={{ color: STEP_COLORS[step].replace("text-", "") }}>
          {message || STEP_MESSAGES[step]}
        </p>

        {step === "detecting" || step === "liveness" || step === "matching" || step === "saving" ? (
          <div className="mt-4 w-48 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--brand)] rounded-full animate-pulse"
              style={{ width: step === "detecting" ? "25%" : step === "liveness" ? "50%" : step === "matching" ? "75%" : "90%" }}
            />
          </div>
        ) : null}

        {errorCode && (
          <p className="mt-2 text-sm text-slate-500 text-center font-mono">
            Mã lỗi: {errorCode}
          </p>
        )}

        {step === "error" && message && (
          <div className="mt-4 p-3 w-full max-w-md bg-[var(--danger-bg)] border border-[var(--danger)] rounded-lg text-center">
            <p className="text-sm text-[var(--danger)]">{message}</p>
            <p className="mt-1 text-xs text-slate-500">Bấm &apos;Thử lại&apos; để chụp lại hoặc &apos;Phương thức thay thế&apos; để dùng PIN</p>
          </div>
        )}
      </div>
    </div>
  );
}