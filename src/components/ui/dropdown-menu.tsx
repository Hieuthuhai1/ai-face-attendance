"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./button";

/** Menu dropdown actions: Esc đóng, click-outside đóng, role=menu/menuitem. */
export function DropdownMenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
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
  }, [open ]);

  return (
    <div ref={ref} className="relative inline-block">
      <Button
        variant="secondary"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-md"
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
      className={`flex w-full items-center px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:bg-slate-50 ${
        danger ? "text-red-700" : "text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
