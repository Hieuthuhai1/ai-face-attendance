"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  key: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  badge?: string | number;
}

export interface TabsProps {
  /** Danh sách các tab */
  items: TabItem[];
  /** Tab đang active */
  value: string;
  /** Callback khi chuyển tab */
  onChange: (key: string) => void;
  /** Kích thước */
  size?: "sm" | "md" | "lg";
  /** Variant hiển thị */
  variant?: "line" | "enclosed" | "soft";
  /** Class thêm */
  className?: string;
  /** Hướng layout */
  orientation?: "horizontal" | "vertical";
  /** Callback trước khi chuyển tab (trả về false để ngăn chặn) */
  beforeChange?: (currentKey: string, nextKey: string) => boolean | Promise<boolean>;
}

/** Tabs component accessible, keyboard navigation, multiple variants */
export function Tabs({
  items,
  value,
  onChange,
  size = "md",
  variant = "line",
  className,
  orientation = "horizontal",
  beforeChange,
}: TabsProps) {
  const [focusedIndex, setFocusedIndex] = useState(
    items.findIndex((item) => item.key === value)
  );

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const enabledIndices = items
      .map((item, i) => (!item.disabled ? i : -1))
      .filter((i) => i !== -1);
    const currentEnabledIndex = enabledIndices.indexOf(index);

    let nextEnabledIndex = currentEnabledIndex;

    switch (e.key) {
      case orientation === "vertical" ? "ArrowDown" : "ArrowRight":
        e.preventDefault();
        nextEnabledIndex = (currentEnabledIndex + 1) % enabledIndices.length;
        break;
      case orientation === "vertical" ? "ArrowUp" : "ArrowLeft":
        e.preventDefault();
        nextEnabledIndex =
          (currentEnabledIndex - 1 + enabledIndices.length) % enabledIndices.length;
        break;
      case "Home":
        e.preventDefault();
        nextEnabledIndex = 0;
        break;
      case "End":
        e.preventDefault();
        nextEnabledIndex = enabledIndices.length - 1;
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (!items[index].disabled) {
          activateTab(index);
        }
        return;
      default:
        return;
    }

    const nextIndex = enabledIndices[nextEnabledIndex];
    setFocusedIndex(nextIndex);
  };

  const activateTab = async (index: number) => {
    const item = items[index];
    if (item.disabled) return;

    if (beforeChange) {
      const allowed = await beforeChange(value, item.key);
      if (!allowed) return;
    }

    onChange(item.key);
    setFocusedIndex(index);
  };

  const SIZE_CLASSES = {
    sm: "px-2 py-1.5 text-xs",
    md: "px-3 py-2 text-sm",
    lg: "px-4 py-2.5 text-base",
  };

  const VARIANT_CLASSES = {
    line: {
      base: "border-b-2 transition-colors",
      active: "border-[var(--brand)] text-[var(--brand-strong)]",
      inactive: "border-transparent text-[var(--text-3)] hover:border-[var(--border-strong)] hover:text-[var(--text-1)]",
    },
    enclosed: {
      base: "rounded-lg transition-all",
      active: "bg-[var(--brand)] text-white shadow-[0_6px_14px_-8px_rgba(37,99,235,0.9)]",
      inactive: "text-[var(--text-2)] hover:bg-[var(--surface-subtle)]",
    },
    soft: {
      base: "rounded-lg transition-all",
      active: "bg-[var(--brand-soft)] text-[var(--brand-strong)]",
      inactive: "text-[var(--text-3)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-1)]",
    },
  };

  const variantClasses = VARIANT_CLASSES[variant];
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div
      role="tablist"
      aria-orientation={orientation}
      className={cn(
        "flex gap-1",
        orientation === "vertical" ? "flex-col" : "",
        className
      )}
    >
      {items.map((item, index) => (
        <button
          key={item.key}
          role="tab"
          aria-selected={item.key === value}
          aria-controls={`panel-${item.key}`}
          id={`tab-${item.key}`}
          tabIndex={item.key === value ? 0 : -1}
          disabled={item.disabled}
          onClick={() => activateTab(index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onFocus={() => setFocusedIndex(index)}
          className={cn(
            "relative inline-flex items-center gap-1.5 font-semibold",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            sizeClass,
            variantClasses.base,
            item.key === value ? variantClasses.active : variantClasses.inactive,
            orientation === "vertical" && "w-full justify-start"
          )}
        >
          {item.icon && <span aria-hidden="true" className="inline-flex items-center">{item.icon}</span>}
          <span>{item.label}</span>
          {item.badge !== undefined && item.badge !== "" && (
            <span
              className={cn(
                "inline-flex h-4 min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
                item.key === value
                  ? variant === "enclosed"
                    ? "bg-white/20 text-white"
                    : "bg-[var(--brand)] text-white"
                  : "bg-[var(--surface-subtle)] text-[var(--text-2)]"
              )}
            >
              {item.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** TabPanel - nội dung của tab */
export interface TabPanelProps {
  /** Key của tab tương ứng */
  key: string;
  /** Tab đang active */
  value: string;
  /** Nội dung */
  children: ReactNode;
  /** Class thêm */
  className?: string;
}

export function TabPanel({ key, value, children, className }: TabPanelProps) {
  if (key !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`panel-${key}`}
      aria-labelledby={`tab-${key}`}
      className={cn("mt-4 animate-fade-in", className)}
    >
      {children}
    </div>
  );
}

/** Tabs compound component - dùng dễ dàng hơn */
export function TabsRoot({ children, ...props }: TabsProps & { children: ReactNode }) {
  // This is a placeholder for compound component pattern
  // Can be expanded if needed
  return <Tabs {...props}>{children}</Tabs>;
}
