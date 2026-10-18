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
    primary: "bg-[var(--brand)] text-white hover:brightness-110",
    secondary: "border border-slate-300 bg-white hover:bg-slate-50",
    ghost: "hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };

  const BADGE_COLORS = {
    default: "bg-slate-500",
    danger: "bg-red-500",
    warning: "bg-amber-500",
    success: "bg-green-500",
  };

  return (
    <button
      className={cn(
        "relative inline-flex items-center justify-center rounded-lg",
        "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
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
            "absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 rounded-full",
            "text-[10px] font-medium text-white px-1",
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