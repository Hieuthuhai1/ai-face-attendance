import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "soft" | "inverse" | "glass";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--brand)] text-white shadow-[0_8px_18px_-10px_rgba(37,99,235,0.9)] hover:bg-[var(--brand-strong)] active:bg-[var(--brand-deep)]",
  secondary:
    "border border-[var(--border)] bg-white text-[var(--text-1)] shadow-[var(--shadow-xs)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] active:bg-[var(--surface-subtle)]",
  danger:
    "bg-[var(--danger)] text-white shadow-[0_8px_18px_-10px_rgba(239,68,68,0.9)] hover:bg-[var(--danger-strong)] active:bg-red-700",
  ghost:
    "text-[var(--text-2)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-1)]",
  soft:
    "bg-[var(--brand-soft)] text-[var(--brand-strong)] hover:bg-blue-100 active:bg-blue-200/70",
  // Dùng trên nền tối (hero card): trắng nổi bật + focus ring sáng.
  inverse:
    "bg-white text-[var(--navy-900)] shadow-[0_14px_30px_-14px_rgba(2,6,23,0.7)] hover:bg-slate-100 active:bg-slate-200 focus-visible:ring-white/45",
  // Nút phụ dạng kính trên nền tối.
  glass:
    "border border-white/25 bg-white/10 text-white backdrop-blur-sm hover:border-white/40 hover:bg-white/[0.16] active:bg-white/20 focus-visible:ring-white/35",
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
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]",
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
