"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

export interface DropdownMenuProps {
  /** Nội dung trigger mặc định (nếu không truyền `trigger`). */
  label?: ReactNode;
  /**
   * Trigger tuỳ biến. Dùng khi cần nút riêng (avatar, chuông thông báo…)
   * để tránh lồng `<button>` trong `<button>`.
   */
  trigger?: (state: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode;
  className?: string;
  menuClassName?: string;
  align?: "start" | "end";
}

/** Menu dropdown actions: Esc đóng, click-outside đóng, role=menu/menuitem. */
export function DropdownMenu({
  label,
  trigger,
  children,
  className,
  menuClassName,
  align = "end",
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const toggle = () => setOpen((v) => !v);

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      {trigger ? (
        trigger({ open, toggle })
      ) : (
        <Button
          variant="secondary"
          size="sm"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggle}
        >
          {label}
        </Button>
      )}
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-50 mt-2 min-w-48 origin-top overflow-hidden rounded-[14px] border border-[var(--border)] bg-white p-1.5 shadow-[var(--shadow-popover)] animate-scale-in",
            align === "end" ? "right-0" : "left-0",
            menuClassName,
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function DropdownItem({
  children,
  onSelect,
  danger,
}: {
  children: ReactNode;
  onSelect: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]",
        danger
          ? "text-[var(--danger-strong)] hover:bg-[var(--danger-bg)]"
          : "text-[var(--text-1)] hover:bg-[var(--surface-muted)]",
      )}
    >
      {children}
    </button>
  );
}
