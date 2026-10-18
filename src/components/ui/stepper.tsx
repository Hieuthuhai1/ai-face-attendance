"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";

export interface Step {
  key: string;
  label: string;
  description?: string;
  icon?: IconName;
  disabled?: boolean;
  optional?: boolean;
}

export interface StepperProps {
  /** Danh sách các bước */
  steps: Step[];
  /** Bước hiện tại (0-indexed) */
  currentStep: number;
  /** Callback khi click vào bước (nếu cho phép) */
  onStepClick?: (index: number) => void;
  /** Cho phép click để chuyển bước */
  clickable?: boolean;
  /** Hiển thị theo chiều dọc */
  vertical?: boolean;
  /** Hiển thị số thứ tự thay vì icon */
  showNumbers?: boolean;
  /** Class thêm */
  className?: string;
  /** Render custom cho step indicator */
  renderIndicator?: (step: Step, index: number, status: "completed" | "current" | "pending") => ReactNode;
}

/** Status của từng bước */
type StepStatus = "completed" | "current" | "pending";

function getStepStatus(index: number, currentStep: number): StepStatus {
  if (index < currentStep) return "completed";
  if (index === currentStep) return "current";
  return "pending";
}

const STATUS_COLORS: Record<StepStatus, { bg: string; text: string; border: string }> = {
  completed: { bg: "bg-[var(--success)]", text: "text-white", border: "border-[var(--success)]" },
  current: { bg: "bg-[var(--brand)]", text: "text-white", border: "border-[var(--brand)]" },
  pending: { bg: "bg-white", text: "text-slate-400", border: "border-slate-300" },
};

/** Stepper component - hiển thị tiến trình nhiều bước */
export function Stepper({
  steps,
  currentStep,
  onStepClick,
  clickable = false,
  vertical = false,
  showNumbers = false,
  className,
  renderIndicator,
}: StepperProps) {
  return (
    <nav aria-label="Tiến trình" className={cn("flex", vertical ? "flex-col" : "", className)}>
      <ol className={cn("flex", vertical ? "flex-col gap-6" : "flex-1 items-center", "relative")}>
        {/* Đường nối các bước (chỉ hiển thị khi horizontal) */}
        {!vertical && steps.length > 1 && (
          <div
            aria-hidden="true"
            className="absolute top-3 left-0 right-0 -z-10 h-1.5 bg-slate-200"
          >
            <div
              className="h-full bg-[var(--brand)] transition-all duration-300"
              style={{
                width: `${(currentStep / Math.max(1, steps.length - 1)) * 100}%`,
              }}
            />
          </div>
        )}

        {steps.map((step, index) => {
          const status = getStepStatus(index, currentStep);
          const isLast = index === steps.length - 1;
          const isClickable = clickable && !step.disabled && (status === "pending" || status === "current");

          // Đường nối dọc
          const verticalConnector = vertical && !isLast && (
            <div
              aria-hidden="true"
              className="absolute left-3 top-8 bottom-0 w-1.5 bg-slate-200"
              style={{
                height: status === "completed" ? "50%" : "100%",
              }}
            >
              {status === "completed" && (
                <div
                  className="absolute top-0 h-1/2 w-full bg-[var(--brand)] transition-all duration-300"
                />
              )}
            </div>
          );

          return (
            <li
              key={step.key}
              className={cn("relative flex", vertical ? "gap-3" : "flex-1 flex-col items-center")}
            >
              {verticalConnector}

              <button
                type="button"
                role={clickable ? "button" : "listitem"}
                aria-current={status === "current" ? "step" : undefined}
                aria-disabled={step.disabled}
                disabled={step.disabled || !clickable}
                onClick={() => onStepClick?.(index)}
                className={cn(
                  "relative flex items-start gap-3",
                  vertical ? "" : "flex-col items-center",
                  "focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {/* Indicator (number/icon/status) */}
                <div
                  className={cn(
                    "relative flex items-center justify-center shrink-0 rounded-full transition-all duration-200",
                    vertical ? "mt-0.5" : "",
                    showNumbers ? "h-6 w-6 text-sm font-semibold" : "h-6 w-6"
                  )}
                >
                  {renderIndicator ? (
                    renderIndicator(step, index, status)
                  ) : showNumbers ? (
                    <span
                      className={cn(
                        "font-semibold",
                        STATUS_COLORS[status].text
                      )}
                    >
                      {index + 1}
                    </span>
                  ) : step.icon ? (
                    <Icon
                      name={step.icon}
                      size={18}
                      className={cn(STATUS_COLORS[status].text)}
                    />
                  ) : status === "completed" ? (
                    <Icon name="check" size={14} className="text-white" />
                  ) : (
                    <span
                      className={cn(
                        "h-6 w-6 rounded-full border-2 flex items-center justify-center",
                        STATUS_COLORS[status].border,
                        STATUS_COLORS[status].bg
                      )}
                      aria-hidden="true"
                    />
                  )}
                </div>

                {/* Label & Description */}
                <div
                  className={cn(
                    "min-w-0",
                    vertical ? "flex-1" : "text-center mt-2"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "font-medium text-sm",
                        status === "pending" ? "text-slate-400" : "text-slate-900",
                        step.disabled && "opacity-50"
                      )}
                    >
                      {step.label}
                    </span>
                    {step.optional && (
                      <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        Tùy chọn
                      </span>
                    )}
                  </div>
                  {step.description && (
                    <p
                      className={cn(
                        "mt-0.5 text-xs",
                        status === "pending" ? "text-slate-400" : "text-slate-500"
                      )}
                    >
                      {step.description}
                    </p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Stepper compact - dùng cho header hoặc không gian nhỏ */
export interface CompactStepperProps {
  steps: Pick<Step, "key" | "label">[];
  currentStep: number;
  className?: string;
}

export function CompactStepper({ steps, currentStep, className }: CompactStepperProps) {
  return (
    <div className={cn("flex items-center gap-1", className)} role="navigation" aria-label="Tiến trình">
      {steps.map((step, index) => {
        const status = getStepStatus(index, currentStep);
        const isLast = index === steps.length - 1;

        return (
          <div key={step.key} className="flex items-center gap-1">
            <span
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                status === "completed" ? "bg-[var(--success)]" : status === "current" ? "bg-[var(--brand)]" : "bg-slate-300"
              )}
            />
            {!isLast && (
              <span
                className={cn(
                  "h-1 w-8 transition-colors",
                  status === "completed" ? "bg-[var(--success)]" : "bg-slate-200"
                )}
              />
            )}
          </div>
        );
      })}
      <span
        className="ml-2 text-sm font-medium text-slate-700"
        aria-live="polite"
      >
        Bước {currentStep + 1} / {steps.length}
      </span>
    </div>
  );
}

/** StepContent - wrapper cho nội dung từng bước */
export interface StepContentProps {
  /** Bước hiện tại */
  currentStep: number;
  /** Key của step này */
  stepKey: string;
  /** Tất cả steps */
  steps: Pick<Step, "key">[];
  /** Nội dung */
  children: ReactNode;
  /** Class thêm */
  className?: string;
}

export function StepContent({ currentStep, stepKey, steps, children, className }: StepContentProps) {
  const stepIndex = steps.findIndex((s) => s.key === stepKey);
  const isActive = stepIndex === currentStep;

  if (!isActive) return null;

  return (
    <div
      role="tabpanel"
      aria-labelledby={`step-${stepKey}`}
      className={cn("animate-slide-up", className)}
    >
      {children}
    </div>
  );
}

/** Navigation controls cho stepper (Previous/Next/Submit) */
export interface StepperActionsProps {
  /** Bước hiện tại */
  currentStep: number;
  /** Tổng số bước */
  totalSteps: number;
  /** Callback quay lại */
  onPrevious: () => void;
  /** Callback tiếp theo */
  onNext: () => void;
  /** Callback hoàn tất */
  onComplete?: () => void;
  /** Text nút tiếp theo */
  nextLabel?: string;
  /** Text nút hoàn tất */
  completeLabel?: string;
  /** Trạng thái loading */
  loading?: boolean;
  /** Vô hiệu nút next */
  nextDisabled?: boolean;
  /** Class thêm */
  className?: string;
}

import { Button } from "./button";

export function StepperActions({
  currentStep,
  totalSteps,
  onPrevious,
  onNext,
  onComplete,
  nextLabel = "Tiếp theo",
  completeLabel = "Hoàn tất",
  loading = false,
  nextDisabled = false,
  className,
}: StepperActionsProps) {
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className={cn("flex justify-between gap-3 mt-6 pt-4 border-t border-slate-200", className)}>
      <Button
        variant="secondary"
        onClick={onPrevious}
        disabled={currentStep === 0 || loading}
      >
        <Icon name="chevron-left" size={16} /> Quay lại
      </Button>

      <div className="flex-1" />

      {isLastStep && onComplete ? (
        <Button onClick={onComplete} loading={loading}>
          {completeLabel}
        </Button>
      ) : (
        <Button onClick={onNext} loading={loading} disabled={nextDisabled}>
          {nextLabel} <Icon name="chevron-right" size={16} />
        </Button>
      )}
    </div>
  );
}