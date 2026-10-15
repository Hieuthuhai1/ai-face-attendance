"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<() => void>();
const DEFAULT_MS = 4000;

function emit() {
  listeners.forEach((l) => l());
}

function push(message: string, tone: ToastTone, ms = DEFAULT_MS) {
  const id = nextId++;
  items = [...items.slice(-2), { id, message, tone }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, ms);
}

/** API dùng từ client component/event: toast("Đã lưu", "success"). */
export const toast = {
  success: (message: string) => push(message, "success"),
  error: (message: string) => push(message, "error"),
  info: (message: string) => push(message, "info"),
};

/** Dùng trong tests để cô lập. */
export function resetToastsForTests(): { subscribe: (l: () => void) => () => void; snapshot: () => ToastItem[] } {
  items = [];
  return {
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    snapshot: () => items,
  };
}

const TONE: Record<ToastTone, { icon: IconName; classes: string }> = {
  success: { icon: "check", classes: "border-green-300 bg-green-50 text-green-800" },
  error: { icon: "x", classes: "border-red-300 bg-red-50 text-red-800" },
  info: { icon: "info", classes: "border-sky-300 bg-sky-50 text-sky-800" },
};

function useToasts(): ToastItem[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => items,
    () => items,
  );
}

/** Host toast — đặt 1 lần trong layout/shell (R3 sẽ lồng vào AppShell). */
export function Toaster({ children }: { children?: ReactNode }): ReactNode {
  const list = useToasts();
  return (
    <>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
        {list.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-md ${TONE[t.tone].classes}`}
          >
            <Icon name={TONE[t.tone].icon} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}
