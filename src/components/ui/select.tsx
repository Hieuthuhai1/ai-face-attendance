import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

/** Select native có style + chevron, label thật (dùng cho form lọc/dialog). */
export function SelectField({ label, error, id, className, children, ...rest }: SelectFieldProps) {
  const selectId = id ?? `select-${label}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          className={cn(
            "h-10 w-full appearance-none rounded-lg border bg-white pl-3 pr-9 text-sm",
            "focus-visible:outline-2 focus-visible:outline-[var(--brand)]",
            error ? "border-red-500" : "border-slate-300",
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500">
          <Icon name="chevron-down" />
        </span>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
