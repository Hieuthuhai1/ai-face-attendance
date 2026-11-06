import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: IconName;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
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
  neutral: { value: "text-[var(--navy-800)]", icon: "bg-[var(--surface-muted)] text-[var(--text-2)]" },
  success: { value: "text-[var(--success)]", icon: "bg-[var(--success-bg)] text-[var(--success)]" },
  warning: { value: "text-[var(--warning)]", icon: "bg-[var(--warning-bg)] text-[var(--warning)]" },
  danger: { value: "text-[var(--danger)]", icon: "bg-[var(--danger-bg)] text-[var(--danger)]" },
  info: { value: "text-[var(--brand-strong)]", icon: "bg-[var(--brand-soft)] text-[var(--brand)]" },
};

const TREND_CLASSES: Record<NonNullable<StatCardProps["trend"]>, string> = {
  up: "bg-[var(--success-bg)] text-[var(--success)]",
  down: "bg-[var(--danger-bg)] text-[var(--danger)]",
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
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-[var(--text-2)]">{label}</p>
          <p className={`tnum mt-2 text-[28px] font-bold leading-none tracking-[-0.02em] ${toneClass.value}`}>
            {value}
          </p>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${toneClass.icon}`}>
          <Icon name={icon} size={21} />
        </span>
      </div>
      {(showChange || hint) && (
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-1.5">
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
          {hint ? <p className="min-w-0 flex-1 truncate text-xs text-[var(--text-3)]">{hint}</p> : null}
        </div>
      )}
    </>
  );
  return (
    <div className="h-full rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-card-hover)]">
      {href ? (
        <Link href={href} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-[var(--brand)]" aria-label={`${label}: ${value}`}>
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}
