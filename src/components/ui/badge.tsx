import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: Tone };

const TONES: Record<Tone, string> = {
  neutral: "bg-[var(--surface-muted)] text-[var(--text-2)] ring-[var(--border)]",
  success: "bg-[var(--success-bg)] text-[var(--success-strong)] ring-[var(--success-border)]",
  warning: "bg-[var(--warning-bg)] text-[var(--warning-strong)] ring-[var(--warning-border)]",
  danger: "bg-[var(--danger-bg)] text-[var(--danger-strong)] ring-[var(--danger-border)]",
  info: "bg-[var(--info-bg)] text-[var(--info-strong)] ring-[var(--info-border)]",
  brand: "bg-[var(--brand-soft)] text-[var(--brand-strong)] ring-blue-200",
};

export function Badge({
  tone = "neutral",
  className,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        TONES[tone],
        className,
      )}
      {...rest}
    />
  );
}
