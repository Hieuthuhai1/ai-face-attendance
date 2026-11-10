import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, id, className, ...rest }: TextareaProps) {
  const textareaId = id ?? `textarea-${label ?? "field"}`;
  const describedBy = error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={textareaId} className="text-[13px] font-semibold text-[var(--text-2)]">
          {label}
        </label>
      ) : null}
      <textarea
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-24 w-full rounded-[var(--radius-control)] border bg-white px-3.5 py-2.5 text-sm text-[var(--text-1)]",
          "shadow-[var(--shadow-xs)] transition-colors",
          "placeholder:text-[var(--text-3)]",
          "hover:border-[var(--border-strong)]",
          "focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]",
          "disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-3)]",
          error ? "border-[var(--danger)]" : "border-[var(--border)]",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={`${textareaId}-error`} role="alert" className="flex items-center gap-1 text-xs font-medium text-[var(--danger-strong)]">
          <Icon name="x" size={13} /> {error}
        </p>
      ) : hint ? (
        <p id={`${textareaId}-hint`} className="text-xs text-[var(--text-3)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ label, error, hint, id, className, ...rest }: InputProps) {
  const inputId = id ?? `input-${label ?? "field"}`;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-[13px] font-semibold text-[var(--text-2)]">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-10 w-full rounded-[var(--radius-control)] border bg-white px-3.5 text-sm text-[var(--text-1)]",
          "shadow-[var(--shadow-xs)] transition-colors",
          "placeholder:text-[var(--text-3)]",
          "hover:border-[var(--border-strong)]",
          "focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]",
          "disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-3)]",
          error ? "border-[var(--danger)]" : "border-[var(--border)]",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="flex items-center gap-1 text-xs font-medium text-[var(--danger-strong)]">
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
