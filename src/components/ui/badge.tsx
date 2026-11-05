import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: Tone };

const TONES: Record<Tone, string> = {
  neutral: "bg-[var(--surface-muted)] text-[var(--text-2)] ring-1 ring-[var(--border)]",
  success: "bg-[var(--success-bg)] text-[var(--success)] ring-1 ring-green-100",
  warning: "bg-[var(--warning-bg)] text-[var(--warning)] ring-1 ring-amber-100",
  danger: "bg-[var(--danger-bg)] text-[var(--danger)] ring-1 ring-red-100",
  info: "bg-[var(--info-bg)] text-[var(--info)] ring-1 ring-blue-100",
  brand: "bg-[var(--brand-soft)] text-[var(--brand-strong)] ring-1 ring-blue-100",
};

export function Badge({
  tone = "neutral",
  className,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        TONES[tone],
        className,
      )}
      {...rest}
    />
  );
}
