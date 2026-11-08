import type { ReactNode } from "react";
import { LiveClock } from "@/components/app/live-clock";
import { Icon } from "@/components/ui/icon";
import { APP_TZ } from "@/config/app";

const DATE_FMT = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: APP_TZ,
});

const HOUR_FMT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hour12: false,
  timeZone: APP_TZ,
});

/** Lời chào theo giờ Việt Nam (không phụ thuộc timezone của trình duyệt/server). */
export function greetingForNow(now: Date = new Date()): string {
  const hour = Number(HOUR_FMT.format(now));
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

export function DashboardHeader({
  name,
  title = "Tổng quan",
  roleLabel,
  actions,
  showClock = true,
}: {
  name: string;
  title?: string;
  roleLabel?: string;
  actions?: ReactNode;
  showClock?: boolean;
}) {
  const now = new Date();
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--brand)]">
          <Icon name="sparkles" size={14} />
          <span className="truncate">
            {greetingForNow(now)}, {name}
          </span>
        </p>
        <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-[-0.03em] text-[var(--navy-900)] sm:text-[30px]">
          {title}
        </h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-[var(--text-2)]">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="calendar" size={14} className="text-[var(--text-3)]" />
            {DATE_FMT.format(now)}
          </span>
          {roleLabel ? (
            <>
              <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[var(--border-strong)]" />
              <span>{roleLabel}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {showClock ? <LiveClock /> : null}
        {actions}
      </div>
    </header>
  );
}
