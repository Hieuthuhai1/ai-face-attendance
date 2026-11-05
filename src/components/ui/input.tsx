import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, id, className, ...rest }: InputProps) {
  const inputId = id ?? `input-${label ?? "field"}`;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-[13px] font-medium text-[var(--text-2)]">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-10 w-full rounded-[var(--radius-control)] border bg-white px-3.5 text-sm text-[var(--navy-700)]",
          "shadow-[0_1px_2px_rgb(27_37_75_/_0.04)] transition-colors",
          "placeholder:text-[var(--text-3)]",
          "hover:border-[var(--border-strong)]",
          "focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]",
          "disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-3)]",
          error ? "border-[var(--danger)]" : "border-[var(--border-strong)]",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="flex items-center gap-1 text-xs font-medium text-[var(--danger)]">
          <Icon name="x" size={13} /> {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-[var(--text-3)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
