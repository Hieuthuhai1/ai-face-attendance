"use client";

import type { ReactNode } from "react";
import { Button } from "./button";
import { Icon } from "./icon";

export interface DialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

/** Dialog đơn giản: overlay + focus vào nút đóng khi mở. */
export function Dialog({ open, title, children, onClose }: DialogProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--navy-900)]/45 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-[var(--radius-card)] border border-white/60 bg-white p-6 shadow-[var(--shadow-dialog)] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-[-0.01em] text-[var(--navy-800)]">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Đóng" autoFocus>
            <Icon name="x" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
