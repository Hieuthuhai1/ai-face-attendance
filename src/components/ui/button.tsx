import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "soft";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--brand)] text-white shadow-sm shadow-blue-900/15 hover:bg-[var(--brand-strong)] active:bg-[var(--brand-deep)]",
  secondary:
    "border border-[var(--border-strong)] bg-white text-[var(--navy-700)] shadow-sm hover:border-slate-300 hover:bg-[var(--surface-muted)]",
  danger:
    "bg-[var(--danger)] text-white shadow-sm shadow-red-900/10 hover:bg-red-800 active:bg-red-900",
  ghost:
    "text-[var(--text-2)] hover:bg-[var(--surface-subtle)] hover:text-[var(--navy-700)]",
  soft:
    "bg-[var(--brand-soft)] text-[var(--brand-strong)] hover:bg-blue-100 active:bg-blue-200/70",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold tracking-[-0.01em]",
        "transition-all duration-150 active:translate-y-px",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <>
          <Icon name="refresh" size={size === "sm" ? 14 : 16} className="animate-spin" />
          <span>Đang xử lý…</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
