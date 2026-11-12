"use client";

import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon name */
  icon: IconName;
  /** Kích thước */
  size?: "sm" | "md" | "lg";
  /** Variant */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** Tooltip/aria-label */
  label: string;
  /** Loading */
  loading?: boolean;
  /** Badge count */
  badge?: number;
  /** Badge color */
  badgeColor?: "default" | "danger" | "warning" | "success";
}

/** Icon Button - nút chỉ có icon, có tooltip/label */
export function IconButton({
  icon,
  size = "md",
  variant = "secondary",
  label,
  loading = false,
  badge,
  badgeColor = "default",
  className,
  disabled,
  children,
  ...rest
}: IconButtonProps) {
  const SIZE_CLASSES = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  const VARIANT_CLASSES = {
    primary: "bg-[var(--brand)] text-white shadow-[0_8px_18px_-10px_rgba(37,99,235,0.9)] hover:bg-[var(--brand-strong)]",
    secondary:
      "border border-[var(--border)] bg-white text-[var(--text-1)] shadow-[var(--shadow-xs)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]",
    ghost: "text-[var(--text-2)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-1)]",
    danger: "bg-[var(--danger)] text-white hover:bg-[var(--danger-strong)]",
  };

  const BADGE_COLORS = {
    default: "bg-[var(--text-3)]",
    danger: "bg-[var(--danger)]",
    warning: "bg-[var(--warning)]",
    success: "bg-[var(--success)]",
  };

  return (
    <button
      className={cn(
        "relative inline-flex items-center justify-center rounded-[var(--radius-control)]",
        "transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className
      )}
      disabled={disabled ?? loading}
      aria-label={label}
      aria-busy={loading}
      {...rest}
    >
      {loading ? (
        <span className="animate-spin">
          <Icon name="refresh" size={size === "sm" ? 14 : 18} />
        </span>
      ) : (
        <Icon name={icon} size={size === "sm" ? 16 : size === "md" ? 18 : 20} />
      )}

      {badge && badge > 0 && (
        <span
          className={cn(
            "absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1",
            "text-[11px] font-semibold text-white",
            BADGE_COLORS[badgeColor]
          )}
          aria-label={`${badge} thông báo`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

/** Icon Button Group - nhóm các icon button */
export interface IconButtonGroupProps {
  children: React.ReactNode;
  className?: string;
  vertical?: boolean;
}

export function IconButtonGroup({ children, className, vertical = false }: IconButtonGroupProps) {
  return (
    <div
      className={cn(
        "inline-flex",
        vertical ? "flex-col" : "",
        className
      )}
      role="group"
    >
      {children}
    </div>
  );
}

/** Floating Action Button (FAB) */
export interface FabProps extends Omit<IconButtonProps, "size" | "variant"> {
  /** Vị trí fixed */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** Extended FAB (có text) */
  extended?: boolean;
  /** Label cho extended */
  extendedLabel?: string;
}

export function Fab({
  icon,
  label,
  extended = false,
  extendedLabel,
  position = "bottom-right",
  className,
  ...props
}: FabProps) {
  const POSITION_CLASSES = {
    "bottom-right": "fixed bottom-6 right-6",
    "bottom-left": "fixed bottom-6 left-6",
    "top-right": "fixed top-6 right-6",
    "top-left": "fixed top-6 left-6",
  };

  return (
    <IconButton
      icon={icon}
      label={label}
      size="lg"
      variant="primary"
      className={cn(
        "shadow-lg",
        POSITION_CLASSES[position],
        extended && "px-4 gap-2",
        className
      )}
      {...props}
    >
      {extended && extendedLabel && <span className="font-medium">{extendedLabel}</span>}
    </IconButton>
  );
}
