import Link from "next/link";
import { Icon, type IconName } from "./icon";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: IconName;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  href?: string;
  hint?: string;
}

const TONES: Record<NonNullable<StatCardProps["tone"]>, { value: string; icon: string }> = {
  neutral: { value: "text-[var(--navy-800)]", icon: "bg-[var(--surface-muted)] text-[var(--text-2)]" },
  success: { value: "text-[var(--success)]", icon: "bg-[var(--success-bg)] text-[var(--success)]" },
  warning: { value: "text-[var(--warning)]", icon: "bg-[var(--warning-bg)] text-[var(--warning)]" },
  danger: { value: "text-[var(--danger)]", icon: "bg-[var(--danger-bg)] text-[var(--danger)]" },
  info: { value: "text-[var(--brand-strong)]", icon: "bg-[var(--brand-soft)] text-[var(--brand)]" },
};

/** Thẻ số liệu: số tabular-nums + icon + nhãn; toàn bộ thẻ là link khi có href. */
export function StatCard({ label, value, icon, tone = "neutral", href, hint }: StatCardProps) {
  const toneClass = TONES[tone];
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
      {hint ? <p className="mt-3 truncate text-xs text-[var(--text-3)]">{hint}</p> : null}
    </>
  );
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]">
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
