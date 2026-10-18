"use client";

import { useState, useRef, useEffect, useId, type ReactNode, type ChangeEvent } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import { Portal } from "./portal";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: ReactNode;
  description?: string;
}

export interface SelectProps {
  /** Label cho select */
  label: string;
  /** Placeholder */
  placeholder?: string;
  /** Giá trị hiện tại */
  value?: string | string[];
  /** Callback khi thay đổi */
  onChange?: (value: string | string[]) => void;
  /** Các tùy chọn */
  options: SelectOption[];
  /** Cho phép multi-select */
  multiple?: boolean;
  /** Cho phép tìm kiếm */
  searchable?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Disabled */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Hint text */
  hint?: string;
  /** Class thêm */
  className?: string;
  /** ID */
  id?: string;
  /** Cho phép xóa lựa chọn (single) */
  clearable?: boolean;
  /** Max tags hiển thị (multi) */
  maxTags?: number;
  /** Không tìm thấy options */
  notFoundContent?: ReactNode;
  /** Render custom cho option */
  renderOption?: (option: SelectOption, selected: boolean) => ReactNode;
  /** Render custom cho selected tag */
  renderTag?: (option: SelectOption) => ReactNode;
  /** Popup placement */
  placement?: "bottom" | "top" | "auto";
  /** Async options loader */
  asyncOptions?: (search: string) => Promise<SelectOption[]>;
  /** Debounce ms cho async */
  asyncDebounce?: number;
}

/** Select component - native select với styling + multi, searchable, async support */
export function Select({
  label,
  placeholder = "Chọn...",
  value,
  onChange,
  options,
  multiple = false,
  searchable = false,
  loading = false,
  disabled = false,
  error,
  hint,
  className,
  id,
  clearable = false,
  maxTags = 3,
  notFoundContent,
  renderOption,
  renderTag,
  placement = "auto",
  asyncOptions,
  asyncDebounce = 300,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [asyncOpts, setAsyncOpts] = useState<SelectOption[]>([]);
  const [asyncLoading, setAsyncLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const isMulti = multiple;
  const isAsync = !!asyncOptions;

  const currentOptions = isAsync && asyncOptions ? asyncOpts : options;
  const displayValue = Array.isArray(value) ? value : value ? [value] : [];

  // Handle async options
  useEffect(() => {
    if (!isAsync || !searchable) return;
    const timer = setTimeout(async () => {
      setAsyncLoading(true);
      try {
        const opts = await asyncOptions(search);
        setAsyncOpts(opts);
      } finally {
        setAsyncLoading(false);
      }
    }, asyncDebounce);
    return () => clearTimeout(timer);
  }, [search, isAsync, asyncOptions, asyncDebounce]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open && searchable && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open, searchable]);

  const selectedOptions = currentOptions.filter((opt) => displayValue.includes(opt.value));
  const filteredOptions = currentOptions.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()) || opt.value.toLowerCase().includes(search.toLowerCase())
  );

  function handleSelect(option: SelectOption) {
    if (option.disabled) return;

    if (isMulti) {
      const newValue = displayValue.includes(option.value)
        ? displayValue.filter((v) => v !== option.value)
        : [...displayValue, option.value];
      onChange?.(newValue);
    } else {
      onChange?.(option.value);
      setOpen(false);
      setSearch("");
    }
  }

  function handleRemove(value: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (isMulti) {
      onChange?.(displayValue.filter((v) => v !== value));
    } else {
      onChange?.("");
    }
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange?.(isMulti ? [] : "");
    setSearch("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    const enabledOptions = filteredOptions.filter((o) => !o.disabled);
    const currentIndex = enabledOptions.findIndex((o) => displayValue.includes(o.value));

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        break;
      case "ArrowUp":
        e.preventDefault();
        break;
      case "Enter":
        e.preventDefault();
        break;
      case "Escape":
        setOpen(false);
        setSearch("");
        break;
    }
  }

  // Render options for dropdown
  const renderOptions = () => {
    if (filteredOptions.length === 0) {
      return (
        <div className="p-3 text-center text-sm text-slate-500">
          {notFoundContent ?? (isAsync && asyncLoading ? "Đang tải..." : "Không tìm thấy kết quả")}
        </div>
      );
    }
    return filteredOptions.map((opt) => (
      <button
        key={opt.value}
        type="button"
        role="option"
        aria-selected={displayValue.includes(opt.value)}
        aria-disabled={opt.disabled}
        disabled={opt.disabled}
        onClick={() => handleSelect(opt)}
        onMouseDown={(e) => e.preventDefault()}
        className={cn(
          "w-full px-3 py-2 text-left text-sm",
          "hover:bg-slate-50 focus:bg-slate-50",
          "first:rounded-t-lg last:rounded-b-lg",
          displayValue.includes(opt.value) ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "text-slate-700",
          opt.disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {renderOption ? (
          renderOption(opt, displayValue.includes(opt.value))
        ) : (
          <div className="flex items-center gap-2">
            {opt.icon && <span>{opt.icon}</span>}
            <span className="truncate">{opt.label}</span>
            {opt.description && <span className="text-xs text-slate-400 ml-auto">{opt.description}</span>}
            {displayValue.includes(opt.value) && !isMulti && (
              <Icon name="check" size={14} className="text-[var(--brand)] ml-auto" />
            )}
          </div>
        )}
      </button>
    ));
  };

  return (
    <div ref={containerRef} className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={selectId} className="text-sm font-medium text-slate-700">
        {label}
      </label>

      <div className="relative">
        <div
          id={selectId}
          role={isMulti ? "combobox" : "listbox"}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-multiselectable={isMulti}
          aria-disabled={disabled}
          aria-invalid={error ? true : undefined}
          className={cn(
            "relative",
            "focus-within:ring-2 focus-within:ring-[var(--brand)] focus-within:ring-offset-2"
          )}
        >
          {/* Trigger */}
          <button
            type="button"
            onClick={() => !disabled && setOpen((v) => !v)}
            disabled={disabled}
            className={cn(
              "w-full flex items-center gap-2",
              "h-10 rounded-lg border bg-white px-3 text-sm",
              "focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50",
              error ? "border-red-500" : "border-slate-300",
              "hover:not(:disabled):border-slate-400"
            )}
            aria-label={label}
          >
            {/* Selected values */}
            <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
              {isMulti ? (
                displayValue.length > 0 ? (
                  <>
                    {selectedOptions.slice(0, maxTags).map((opt) => (
                      <span
                        key={opt.value}
                        className="inline-flex items-center gap-1 rounded bg-[var(--brand-soft)] text-[var(--brand-strong)] text-xs px-2 py-0.5"
                      >
                        {renderTag ? renderTag(opt) : opt.label}
                        <button
                          type="button"
                          onClick={(e) => handleRemove(opt.value, e)}
                          className="ml-1 p-0.5 hover:bg-[var(--brand)] hover:text-white rounded"
                          aria-label={`Xóa ${opt.label}`}
                        >
                          <Icon name="x" size={12} />
                        </button>
                      </span>
                    ))}
                    {displayValue.length > maxTags && (
                      <span className="inline-flex items-center rounded bg-slate-100 text-slate-600 text-xs px-2 py-0.5">
                        +{displayValue.length - maxTags} khác
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-slate-400">{placeholder}</span>
                )
              ) : (
                displayValue[0] ? (
                  <>
                    {selectedOptions[0] && (
                      <span className="truncate">{renderOption ? renderOption(selectedOptions[0], true) : selectedOptions[0].label}</span>
                    )}
                    {!selectedOptions[0] && displayValue[0] && (
                      <span className="truncate text-slate-500">{displayValue[0]}</span>
                    )}
                  </>
                ) : (
                  <span className="text-slate-400 truncate">{placeholder}</span>
                )
              )}

              {/* Search input (when open and searchable) */}
              {open && searchable && (
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 min-w-[100px] bg-transparent border-none outline-none text-sm"
                  placeholder={placeholder}
                  aria-label="Tìm kiếm"
                  autoComplete="off"
                />
              )}
            </div>

            {/* Icons */}
            <div className="flex items-center gap-1">
              {isMulti && displayValue.length > 0 && clearable && !disabled && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                  aria-label="Xóa tất cả"
                >
                  <Icon name="x" size={16} />
                </button>
              )}
              {loading || asyncLoading ? (
                <span className="animate-spin text-[var(--info)]">
                  <Icon name="refresh" size={16} />
                </span>
              ) : (
                <Icon
                  name={open ? "chevron-up" : "chevron-down"}
                  size={18}
                  className="text-slate-500 transition-transform"
                />
              )}
            </div>
          </button>

          {/* Dropdown */}
          {open && (
            <Portal>
              <div
                role="listbox"
                aria-multiselectable={isMulti}
                className={cn(
                  "absolute z-50 mt-1 min-w-[200px] max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg",
                  "animate-fade-in"
                )}
                style={{
                  width: containerRef.current?.offsetWidth,
                }}
              >
                {/* Search input in dropdown */}
                {searchable && !isMulti && (
                  <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                    <input
                      ref={inputRef}
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
                      placeholder="Tìm kiếm..."
                      autoComplete="off"
                    />
                  </div>
                )}

                {/* Options */}
                {renderOptions()}

                {/* Load more indicator for async */}
                {isAsync && asyncLoading && (
                  <div className="p-2 text-center text-sm text-slate-500">
                    <span className="flex items-center justify-center gap-1">
                      <span className="animate-spin">
                        <Icon name="refresh" size={14} />
                      </span>
                      Đang tải thêm...
                    </span>
                  </div>
                )}
              </div>
            </Portal>
            )}
        </div>

        {error && (
          <p id={`${selectId}-error`} role="alert" className="flex items-center gap-1 text-sm text-red-600">
            <Icon name="x" size={14} /> {error}
          </p>
        )}
        {hint && !error && <p id={`${selectId}-hint`} className="text-sm text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

/** Simple Select - wrapper cho native select (dùng cho form đơn giản) */
export interface SimpleSelectProps {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
}

export function SimpleSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "— Chọn —",
  error,
  hint,
  disabled,
  required,
  className,
  id,
}: SimpleSelectProps) {
  const selectId = id ?? `select-${label}`;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={selectId} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
          className={cn(
            "h-10 w-full appearance-none rounded-lg border bg-white pl-3 pr-9 text-sm",
            "focus-visible:outline-2 focus-visible:outline-[var(--brand)]",
            error ? "border-red-500" : "border-slate-300",
            disabled && "bg-slate-50 cursor-not-allowed"
          )}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500">
          <Icon name="chevron-down" />
        </span>
      </div>
      {error ? (
        <p id={`${selectId}-error`} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${selectId}-hint`} className="text-sm text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}