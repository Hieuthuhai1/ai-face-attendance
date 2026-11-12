import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: IconName;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "brand";
  href?: string;
  hint?: string;
  /** % thay đổi so với kỳ trước (hiển thị chip nhỏ). */
  change?: number;
  /** Hướng thay đổi: "up" là cải thiện, "down" là xấu đi. */
  trend?: "up" | "down" | "neutral";
  /** Nhãn cho chip thay đổi, ví dụ "so với hôm qua". */
  changeLabel?: string;
}

const TONES: Record<NonNullable<StatCardProps["tone"]>, { value: string; icon: string }> = {
  neutral: { value: "text-[var(--navy-900)]", icon: "bg-[var(--surface-subtle)] text-[var(--text-2)]" },
  success: { value: "text-[var(--success-strong)]", icon: "bg-[var(--success-bg)] text-[var(--success)]" },
  warning: { value: "text-[var(--warning-strong)]", icon: "bg-[var(--warning-bg)] text-[var(--warning)]" },
  danger: { value: "text-[var(--danger-strong)]", icon: "bg-[var(--danger-bg)] text-[var(--danger)]" },
  info: { value: "text-[var(--brand-strong)]", icon: "bg-[var(--brand-soft)] text-[var(--brand)]" },
  brand: {
    value: "text-[var(--navy-900)]",
    icon: "[background-image:var(--brand-gradient)] text-white shadow-[0_10px_20px_-12px_rgba(37,99,235,0.9)]",
  },
};

const TREND_CLASSES: Record<NonNullable<StatCardProps["trend"]>, string> = {
  up: "bg-[var(--success-bg)] text-[var(--success-strong)]",
  down: "bg-[var(--danger-bg)] text-[var(--danger-strong)]",
  neutral: "bg-[var(--surface-muted)] text-[var(--text-2)]",
};

/** Thẻ số liệu: số tabular-nums + icon + nhãn; toàn bộ thẻ là link khi có href. */
export function StatCard({
  label,
  value,
  icon,
  tone = "neutral",
  href,
  hint,
  change,
  trend = "neutral",
  changeLabel,
}: StatCardProps) {
  const toneClass = TONES[tone];
  const showChange = typeof change === "number" && change !== 0;
  const body = (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium leading-tight text-[var(--text-3)]">
            {label}
          </p>
          <p
            className={`tnum mt-2.5 text-[28px] font-bold leading-none tracking-[-0.03em] sm:text-[30px] ${toneClass.value}`}
          >
            {value}
          </p>
        </div>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-icon)] sm:h-11 sm:w-11 ${toneClass.icon}`}
        >
          <Icon name={icon} size={21} />
        </span>
      </div>
      {(showChange || hint) && (
        <div className="mt-auto flex min-w-0 flex-wrap items-center gap-1.5 pt-3.5">
          {showChange ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                TREND_CLASSES[trend],
              )}
              title={changeLabel}
            >
              <Icon name={trend === "up" ? "arrow-up" : trend === "down" ? "arrow-down" : "more-horizontal"} size={11} />
              {change > 0 ? "+" : ""}
              {change}%
            </span>
          ) : null}
          {hint ? (
            <p title={hint} className="line-clamp-2 min-w-0 flex-1 text-xs leading-snug text-[var(--text-3)]">
              {hint}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
  return (
    <div className="group h-full rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-1 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-card-hover)] sm:p-5">
      {href ? (
        <Link href={href} className="block h-full rounded-lg focus-visible:outline-none" aria-label={`${label}: ${value}`}>
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}
