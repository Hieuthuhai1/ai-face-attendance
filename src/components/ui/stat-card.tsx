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

const TONES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "text-slate-700",
  success: "text-[var(--success)]",
  warning: "text-[var(--warning)]",
  danger: "text-[var(--danger)]",
  info: "text-[var(--info)]",
};

/** Thẻ số liệu: số tabular-nums + icon + nhãn; toàn bộ thẻ là link khi có href. */
export function StatCard({ label, value, icon, tone = "neutral", href, hint }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className={`tnum text-2xl font-bold ${TONES[tone]}`}>{value}</p>
        <span className="text-slate-400">
          <Icon name={icon} size={20} />
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
    </>
  );
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {href ? (
        <Link href={href} className="block focus-visible:outline-2" aria-label={`${label}: ${value}`}>
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}
