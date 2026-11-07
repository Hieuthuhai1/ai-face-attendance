"use client";

import { useId, type ReactNode } from "react";

/** Tooltip CSS-only: hiện khi hover/focus, có role + aria-describedby. */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className="group relative inline-flex" aria-describedby={id}>
      {children}
      <span
        role="tooltip"
        id={id}
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--navy-900)] px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-[var(--shadow-popover)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
