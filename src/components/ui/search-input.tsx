"use client";

import { useState, useRef, useEffect, type ReactNode, type ChangeEvent } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import { Button } from "./button";

export interface SearchInputProps {
  /** Placeholder */
  placeholder?: string;
  /** Giá trị hiện tại */
  value: string;
  /** Callback khi thay đổi */
  onChange: (value: string) => void;
  /** Callback khi submit (Enter) */
  onSubmit?: (value: string) => void;
  /** Loading state */
  loading?: boolean;
  /** Disabled */
  disabled?: boolean;
  /** Hiển thị nút clear */
  clearable?: boolean;
  /** Hiển thị nút search */
  showSearchButton?: boolean;
  /** Debounce ms */
  debounce?: number;
  /** Class thêm */
  className?: string;
  /** ID */
  id?: string;
  /** Label (sr-only) */
  label?: string;
  /** Gợi ý tìm kiếm */
  suggestions?: string[];
  /** Callback khi chọn gợi ý */
  onSuggestionClick?: (suggestion: string) => void;
}

/** Search Input - input tìm kiếm với debounce, clear, suggestions */
export function SearchInput({
  placeholder = "Tìm kiếm...",
  value,
  onChange,
  onSubmit,
  loading = false,
  disabled = false,
  clearable = true,
  showSearchButton = false,
  debounce = 300,
  className,
  id,
  label = "Tìm kiếm",
  suggestions,
  onSuggestionClick,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debouncedValue, setDebouncedValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Sync local value with prop
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setLocalValue((prev) => value);
  }, [value]);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(localValue);
      onChange(localValue);
    }, debounce);
    return () => clearTimeout(timer);
  }, [localValue, debounce, onChange]);

  // Handle outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    setShowSuggestions(true);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLocalValue("");
    onChange("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setShowSuggestions(false);
      inputRef.current?.blur();
    } else if (e.key === "Enter") {
      onSubmit?.(localValue);
      setShowSuggestions(false);
    }
  };

  const handleFocus = () => {
    if (suggestions && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const filteredSuggestions = suggestions
    ?.filter((s) => s.toLowerCase().includes(localValue.toLowerCase()))
    .slice(0, 5);

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="search"
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={placeholder}
          disabled={disabled}
          aria-autocomplete={suggestions ? "list" : "none"}
          aria-controls={suggestions ? `${id}-suggestions` : undefined}
          aria-expanded={showSuggestions && filteredSuggestions && filteredSuggestions.length > 0}
          className={cn(
            "w-full h-10 rounded-lg border bg-white px-3 pr-12 text-sm",
            "focus-visible:outline-2 focus-visible:outline-[var(--brand)]",
            loading ? "border-[var(--info)] bg-[var(--info-bg)]" : disabled ? "border-slate-200 bg-slate-50 cursor-not-allowed" : "border-slate-300",
            "placeholder:text-slate-400"
          )}
        />
        {loading && (
          <span className="absolute right-10 top-1/2 -translate-y-1/2 text-[var(--info)] animate-spin">
            <Icon name="refresh" size={18} />
          </span>
        )}
        {clearable && value && !loading && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded"
            aria-label="Xóa tìm kiếm"
          >
            <Icon name="x" size={16} />
          </button>
        )}
        {showSearchButton && (
          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2"
            aria-label="Tìm kiếm"
            disabled={disabled || !value.trim()}
          >
            <Icon name="search" size={16} />
          </Button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions && filteredSuggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          id={`${id}-suggestions`}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg animate-fade-in"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              role="option"
              onClick={() => {
                setLocalValue(suggestion);
                onChange(suggestion);
                onSuggestionClick?.(suggestion);
                setShowSuggestions(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 focus:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
            >
              <span className="flex items-center gap-2">
                <Icon name="search" size={14} className="text-slate-400" />
                <span>{suggestion}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Search Input with Filter - kết hợp search + filter button */
export interface SearchWithFilterProps extends SearchInputProps {
  /** Các filter options */
  filters?: Array<{ key: string; label: string; options: Array<{ value: string; label: string }> }>;
  /** Filter values hiện tại */
  filterValues?: Record<string, string>;
  /** Callback khi thay đổi filter */
  onFilterChange?: (key: string, value: string) => void;
  /** Filter button label */
  filterLabel?: string;
}

export function SearchWithFilter({
  filters,
  filterValues,
  onFilterChange,
  filterLabel = "Bộ lọc",
  ...props
}: SearchWithFilterProps) {
  const [showFilters, setShowFilters] = useState(false);

  if (!filters || filters.length === 0) {
    return <SearchInput {...props} />;
  }

  const activeFilterCount = filters.filter((f) => filterValues?.[f.key]).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <SearchInput {...props} />
        </div>
        <Button
          variant="secondary"
          onClick={() => setShowFilters(!showFilters)}
          className={cn("h-10", activeFilterCount > 0 && "border-[var(--brand)] text-[var(--brand)]")}
          aria-expanded={showFilters}
          aria-controls={`${props.id}-filters`}
        >
          <Icon name="filter" size={18} className="mr-1" />
          {filterLabel}
          {activeFilterCount > 0 && (
            <span className="ml-1.5 h-5 min-w-5 rounded-full bg-[var(--brand)] text-white text-[10px] font-medium flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {showFilters && (
        <div
          id={`${props.id}-filters`}
          className="animate-slide-down rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
          role="region"
          aria-label="Bộ lọc"
        >
          <div className="flex flex-wrap gap-3">
            {filters.map((filter) => (
              <div key={filter.key} className="min-w-[180px] flex-1">
                <label className="text-xs font-medium text-slate-600 mb-1 block">{filter.label}</label>
                <select
                  value={filterValues?.[filter.key] ?? ""}
                  onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
                >
                  <option value="">Tất cả</option>
                  {filter.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowFilters(false)}>
              Đóng
            </Button>
            <Button size="sm" onClick={() => filters.forEach((f) => onFilterChange?.(f.key, ""))}>
              Xóa lọc
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}