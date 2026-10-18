"use client";

import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export interface ProgressProps {
  /** Giá trị (0-100) */
  value: number;
  /** Giá trị tối đa */
  max?: number;
  /** Kích thước */
  size?: "sm" | "md" | "lg";
  /** Variant */
  variant?: "default" | "circle" | "ring";
  /** Màu */
  color?: "primary" | "success" | "warning" | "danger" | "info";
  /** Hiển thị label */
  showLabel?: boolean;
  /** Label tùy chỉnh */
  label?: React.ReactNode;
  /** Animated */
  animated?: boolean;
  /** Striped */
  striped?: boolean;
  /** Class thêm */
  className?: string;
  /** Aria label */
  ariaLabel?: string;
}

const COLOR_CLASSES = {
  primary: "bg-[var(--brand)]",
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
  info: "bg-[var(--info)]",
};

const BG_COLOR_CLASSES = {
  primary: "bg-[var(--brand-soft)]",
  success: "bg-[var(--success-bg)]",
  warning: "bg-[var(--warning-bg)]",
  danger: "bg-[var(--danger-bg)]",
  info: "bg-[var(--info-bg)]",
};

const SIZE_CLASSES = {
  sm: { bar: "h-1", circle: "w-12 h-12", ring: "w-12 h-12", stroke: 3 },
  md: { bar: "h-2", circle: "w-16 h-16", ring: "w-16 h-16", stroke: 4 },
  lg: { bar: "h-3", circle: "w-24 h-24", ring: "w-24 h-24", stroke: 5 },
};

/** Progress Bar - thanh tiến trình tuyến tính */
export function Progress({
  value,
  max = 100,
  size = "md",
  variant = "default",
  color = "primary",
  showLabel = false,
  label,
  animated = false,
  striped = false,
  className,
  ariaLabel,
}: ProgressProps) {
  const clampedValue = Math.max(0, Math.min(100, (value / max) * 100));
  const sizeClass = SIZE_CLASSES[size];

  if (variant === "circle" || variant === "ring") {
    const radius = (sizeClass.circle.split("px")[0] as unknown as number) - sizeClass.stroke;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (clampedValue / 100) * circumference;

    return (
      <div className={cn("relative inline-flex", className)} role="progressbar" aria-valuenow={clampedValue} aria-valuemin={0} aria-valuemax={100} aria-label={ariaLabel}>
        <svg className="transform -rotate-90" viewBox={`0 0 ${sizeClass.circle} ${sizeClass.circle}`} style={{ width: sizeClass.circle, height: sizeClass.circle }}>
          <circle
            cx={sizeClass.circle.split("px")[0] / 2}
            cy={sizeClass.circle.split("px")[0] / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={sizeClass.stroke}
            className={BG_COLOR_CLASSES[color]}
          />
          <circle
            cx={sizeClass.circle.split("px")[0] / 2}
            cy={sizeClass.circle.split("px")[0] / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={sizeClass.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn(COLOR_CLASSES[color], "transition-all duration-500 ease-out", animated && "animate-pulse")}
            style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))" }}
          />
        </svg>
        {(showLabel || label) && (
          <div className="absolute inset-0 flex items-center justify-center">
            {label ?? <span className="text-sm font-bold text-slate-900">{Math.round(clampedValue)}%</span>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      className={cn("w-full rounded-full overflow-hidden bg-[var(--surface-muted)]", sizeClass.bar, className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300 ease-out",
          COLOR_CLASSES[color],
          animated && "animate-pulse",
          striped && "bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:20px_100%] animate-[stripe_1s_linear_infinite]"
        )}
        style={{ width: `${clampedValue}%` }}
      >
        {showLabel && clampedValue > 15 && (
          <span className="flex h-full items-center justify-center text-xs font-medium text-white opacity-90">
            {label ?? `${Math.round(clampedValue)}%`}
          </span>
        )}
      </div>
    </div>
  );
}

/** Progress Steps - tiến trình các bước */
export interface ProgressStep {
  key: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  status?: "completed" | "current" | "pending" | "error";
}

export interface ProgressStepsProps {
  steps: ProgressStep[];
  currentStep: number;
  size?: "sm" | "md" | "lg";
  color?: "primary" | "success" | "warning" | "danger" | "info";
  className?: string;
  vertical?: boolean;
  showDescriptions?: boolean;
}

const STEP_STATUS_COLORS = {
  completed: "text-[var(--success)]",
  current: "text-[var(--brand)]",
  pending: "text-slate-400",
  error: "text-[var(--danger)]",
};

const STEP_STATUS_BG = {
  completed: "bg-[var(--success)]",
  current: "bg-[var(--brand)]",
  pending: "bg-slate-200",
  error: "bg-[var(--danger)]",
};

export function ProgressSteps({
  steps,
  currentStep,
  size = "md",
  color = "primary",
  className,
  vertical = false,
  showDescriptions = true,
}: ProgressStepsProps) {
  const SIZE_CONFIG = {
    sm: { indicator: 24, font: "text-xs", gap: 2, line: 2 },
    md: { indicator: 32, font: "text-sm", gap: 3, line: 3 },
    lg: { indicator: 40, font: "text-base", gap: 4, line: 4 },
  };

  const config = SIZE_CONFIG[size];

  const getStatus = (index: number) => {
    if (index < currentStep) return "completed";
    if (index === currentStep) return "current";
    return "pending";
  };

  return (
    <div className={cn("flex", vertical ? "flex-col" : "", className)} role="list" aria-label="Tiến trình">
      {steps.map((step, index) => {
        const status = getStatus(index);
        const isLast = index === steps.length - 1;

        return (
          <div key={step.key} className={cn("flex", vertical ? "flex-col gap-2" : "flex-1 flex-col items-center")} role="listitem">
            <div className={cn("flex items-start gap-2", vertical ? "" : "flex-col items-center")}>
              {/* Connector line */}
              {!isLast && !vertical && (
                <div
                  className={cn("w-full h-px flex-1", STEP_STATUS_BG[status === "completed" ? "completed" : "pending"])}
                  style={{ marginTop: config.indicator / 2 }}
                  aria-hidden="true"
                />
              )}
              {vertical && !isLast && (
                <div
                  className={cn("h-full w-px absolute left-[50%] transform -translate-x-1/2", STEP_STATUS_BG[status === "completed" ? "completed" : "pending"])}
                  style={{ top: config.indicator, bottom: 0 }}
                  aria-hidden="true"
                />
              )}

              {/* Indicator */}
              <div
                className={cn(
                  "relative flex items-center justify-center shrink-0 rounded-full border-2 flex-shrink-0",
                  STEP_STATUS_BG[status],
                  status === "pending" && "border-slate-300",
                  status !== "pending" && "border-transparent text-white"
                )}
                style={{ width: config.indicator, height: config.indicator }}
              >
                {status === "completed" ? (
                  <Icon name="check" size={config.indicator * 0.5} />
                ) : status === "error" ? (
                  <Icon name="x" size={config.indicator * 0.5} />
                ) : step.icon ? (
                  <span className={cn(STEP_STATUS_COLORS[status], "font-bold")} style={{ fontSize: config.indicator * 0.4 }}>
                    {step.icon}
                  </span>
                ) : (
                  <span className={cn(STEP_STATUS_COLORS[status], "font-bold")} style={{ fontSize: config.indicator * 0.4 }}>
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Label & Description */}
              <div className={cn("text-center", vertical ? "text-left" : "")}>
                <span className={cn("font-medium", config.font, STEP_STATUS_COLORS[status])}>{step.label}</span>
                {showDescriptions && step.description && (
                  <p className={cn("mt-0.5 text-slate-500", config.font)}>{step.description}</p>
                )}
              </div>
            </div>

            {/* Vertical connector */}
            {vertical && !isLast && (
              <div
                className={cn("w-px h-full", STEP_STATUS_BG[status === "completed" ? "completed" : "pending"])}
                style={{ marginLeft: config.indicator / 2 }}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Skeleton Progress - loading state cho progress */
export function ProgressSkeleton({ size = "md", variant = "default", className }: { size?: "sm" | "md" | "lg"; variant?: "default" | "circle"; className?: string }) {
  const SIZE_CONFIG = {
    sm: { bar: "h-1", circle: "w-12 h-12" },
    md: { bar: "h-2", circle: "w-16 h-16" },
    lg: { bar: "h-3", circle: "w-24 h-24" },
  };
  const config = SIZE_CONFIG[size];

  if (variant === "circle") {
    return (
      <div className={cn("relative inline-flex", className)}>
        <div className={cn("rounded-full", config.circle, "skeleton")} />
      </div>
    );
  }

  return <div className={cn("w-full rounded-full skeleton", config.bar, className)} />;
}