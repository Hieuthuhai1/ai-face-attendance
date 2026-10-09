"use client";

import type { ReactNode } from "react";
import { Button } from "./button";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Đóng" autoFocus>
            ✕
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
