import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

/** Tiêu đề section trong dashboard: icon nhỏ + tiêu đề + mô tả + action. */
export function SectionHeading({
  id,
  title,
  description,
  action,
  icon,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <h2
          id={id}
          className="flex items-center gap-2 text-[15px] font-bold tracking-[-0.015em] text-[var(--navy-900)]"
        >
          {icon ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--brand-soft)] text-[var(--brand)]">
              <Icon name={icon} size={14} />
            </span>
          ) : null}
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-3)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
