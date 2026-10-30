"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const TIME_FMT = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Ho_Chi_Minh",
});

const DATE_FMT = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

/** Đồng hồ giờ Việt Nam, render an toàn với SSR (--:--:-- trước khi hydrate). */
export function LiveClock({
  className,
  showDate = false,
}: {
  className?: string;
  showDate?: boolean;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const raf = window.requestAnimationFrame(tick);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm",
        className,
      )}
      title="Giờ Việt Nam"
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-50" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--success)]" />
      </span>
      <span className="tnum text-sm font-semibold text-slate-900">
        {now ? TIME_FMT.format(now) : "--:--:--"}
      </span>
      {showDate ? (
        <span className="text-xs text-slate-500">{now ? DATE_FMT.format(now) : ""}</span>
      ) : null}
      <span className="sr-only">Giờ Việt Nam</span>
    </div>
  );
}
