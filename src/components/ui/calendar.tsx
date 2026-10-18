"use client";

import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import { Tooltip } from "./tooltip";
import { Button } from "./button";
import { DatePicker } from "./calendar";

export interface CalendarDate {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isInRange: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  disabled: boolean;
}

export interface CalendarProps {
  mode?: "single" | "range" | "multiple";
  selected?: Date | null;
  range?: { from: Date | null; to: Date | null };
  selectedDates?: Date[];
  onSelect?: (date: Date | null) => void;
  onRangeSelect?: (range: { from: Date | null; to: Date | null }) => void;
  onMultipleSelect?: (dates: Date[]) => void;
  displayMonth?: Date;
  onMonthChange?: (month: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  highlightedDates?: Map<string, { color?: string; label?: string; dot?: boolean }>;
  showWeekNumbers?: boolean;
  locale?: string;
  showToday?: boolean;
  disablePast?: boolean;
  disableFuture?: boolean;
  className?: string;
  renderDay?: (date: CalendarDate) => ReactNode;
  onCellClick?: (point: CalendarDate) => void;
}

const DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function Calendar({
  mode = "single",
  selected,
  range,
  selectedDates = [],
  onSelect,
  onRangeSelect,
  onMultipleSelect,
  displayMonth: controlledMonth,
  onMonthChange,
  minDate,
  maxDate,
  disabledDates = [],
  highlightedDates,
  showWeekNumbers = false,
  locale = "vi-VN",
  showToday = true,
  disablePast = false,
  disableFuture = false,
  className,
  renderDay,
  onCellClick,
}: CalendarProps) {
  const [internalMonth, setInternalMonth] = useState(controlledMonth ?? new Date());
  const displayMonth = controlledMonth ?? internalMonth;

  const monthKey = useMemo(
    () => `${displayMonth.getFullYear()}-${displayMonth.getMonth()}`,
    [displayMonth]
  );

  const days = useMemo(() => {
    const firstDayOfMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
    const lastDayOfMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0);
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();
    const daysInPrevMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 0).getDate();

    const result: CalendarDate[] = [];

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), -i);
      result.push(createCalendarDate(date, false));
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), i);
      result.push(createCalendarDate(date, true));
    }

    const remaining = 42 - result.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, i);
      result.push(createCalendarDate(date, false));
    }

    return result;
  }, [displayMonth, mode, selected, range, selectedDates, minDate, maxDate, disabledDates, highlightedDates, disablePast, disableFuture]);

  function createCalendarDate(date: Date, isCurrentMonth: boolean): CalendarDate {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    const highlight = highlightedDates?.get(dateKey);

    const isToday = checkDate.getTime() === today.getTime();
    const isSelected = mode === "single" && selected && checkDate.getTime() === selected.getTime();
    const isInRange =
      mode === "range" &&
      range?.from &&
      range?.to &&
      checkDate >= new Date(range.from.setHours(0, 0, 0, 0)) &&
      checkDate <= new Date(range.to.setHours(0, 0, 0, 0));
    const isRangeStart =
      mode === "range" && range?.from && checkDate.getTime() === new Date(range.from.setHours(0, 0, 0, 0)).getTime();
    const isRangeEnd =
      mode === "range" && range?.to && checkDate.getTime() === new Date(range.to.setHours(0, 0, 0, 0)).getTime();
    const isMultipleSelected = mode === "multiple" && selectedDates.some((d) => checkDate.getTime() === d.getTime());

    let disabled = !isCurrentMonth;
    if (minDate && checkDate < new Date(minDate.setHours(0, 0, 0, 0))) disabled = true;
    if (maxDate && checkDate > new Date(maxDate.setHours(0, 0, 0, 0))) disabled = true;
    if (disablePast && checkDate < today) disabled = true;
    if (disableFuture && checkDate > today) disabled = true;
    if (disabledDates.some((d) => checkDate.getTime() === new Date(d).setHours(0, 0, 0, 0))) disabled = true;

    return {
      date,
      isCurrentMonth,
      isToday,
      isSelected,
      isInRange,
      isRangeStart,
      isRangeEnd,
      disabled,
    };
  }

  function handleDayClick(day: CalendarDate) {
    if (day.disabled) return;

    const date = new Date(day.date);
    date.setHours(0, 0, 0, 0);

    switch (mode) {
      case "single":
        onSelect?.(date);
        break;
      case "range":
        if (!range?.from || (range.from && range.to)) {
          onRangeSelect?.({ from: date, to: null });
        } else if (range.from && !range.to) {
          const from = new Date(range.from);
          from.setHours(0, 0, 0, 0);
          if (date < from) {
            onRangeSelect?.({ from: date, to: range.from });
          } else {
            onRangeSelect?.({ from: range.from, to: date });
          }
        }
        break;
      case "multiple":
        const existing = selectedDates.find((d) => d.getTime() === date.getTime());
        if (existing) {
          onMultipleSelect?.(selectedDates.filter((d) => d.getTime() !== date.getTime()));
        } else {
          onMultipleSelect?.([...selectedDates, date]);
        }
        break;
    }
  }

  function handleMonthChange(delta: number) {
    const newMonth = new Date(displayMonth);
    newMonth.setMonth(displayMonth.getMonth() + delta);
    if (!controlledMonth) setInternalMonth(newMonth);
    onMonthChange?.(newMonth);
  }

  function handleYearChange(delta: number) {
    const newMonth = new Date(displayMonth);
    newMonth.setFullYear(displayMonth.getFullYear() + delta);
    if (!controlledMonth) setInternalMonth(newMonth);
    onMonthChange?.(newMonth);
  }

  const monthName = displayMonth.toLocaleDateString(locale, { month: "long", year: "numeric" });

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleMonthChange(-1)}
            aria-label="Tháng trước"
            disabled={minDate && new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1) <= new Date(minDate.setHours(0, 0, 0, 0))}
          >
            <Icon name="chevron-left" size={18} />
          </Button>
          <span className="font-medium text-slate-900 min-w-[160px] text-center">{monthName}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleMonthChange(1)}
            aria-label="Tháng sau"
            disabled={maxDate && new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0) >= new Date(maxDate.setHours(0, 0, 0, 0))}
          >
            <Icon name="chevron-right" size={18} />
          </Button>
        </div>

        {showToday && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const today = new Date();
              if (!controlledMonth) setInternalMonth(today);
              onMonthChange?.(today);
            }}
          >
            Hôm nay
          </Button>
        )}
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1" role="row">
        {DAYS.map((day, i) => (
          <div
            key={day}
            role="columnheader"
            className="text-center text-xs font-medium text-slate-500 py-2"
            aria-label={day}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div role="grid" aria-label={`${monthName} calendar`} className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          const isWeekend = index % 7 === 0 || index % 7 === 6;
          const highlight = highlightedDates?.get(
            `${day.date.getFullYear()}-${day.date.getMonth() + 1}-${day.date.getDate()}`
          );

          if (renderDay) {
            return (
              <div key={index} role="gridcell">
                {renderDay(day)}
              </div>
            );
          }

          return (
            <Tooltip
              label={
                highlight?.label
                  ? `${day.date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })} - ${highlight.label}`
                  : day.date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })
              }
            >
              <button
                key={index}
                type="button"
                role="gridcell"
                aria-label={day.date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                aria-selected={day.isSelected || day.isRangeStart || day.isRangeEnd || day.isMultipleSelected}
                aria-disabled={day.disabled}
                disabled={day.disabled}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "relative aspect-square flex flex-col items-center justify-center text-sm font-medium transition-colors",
                  "rounded-lg",
                  "focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2",
                  day.disabled && "text-slate-300 cursor-not-allowed",
                  !day.disabled && "hover:bg-slate-100",
                  day.isCurrentMonth ? "text-slate-900" : "text-slate-300",
                  isWeekend && "text-red-500",
                  day.isToday && !day.isSelected && "ring-2 ring-[var(--brand)]",
                  day.isSelected && "bg-[var(--brand)] text-white",
                  day.isRangeStart &&
                    "bg-[var(--brand)] text-white rounded-l-full rounded-r-none",
                  day.isRangeEnd &&
                    "bg-[var(--brand)] text-white rounded-r-full rounded-l-none",
                  day.isInRange &&
                    !day.isRangeStart &&
                    !day.isRangeEnd &&
                    "bg-[var(--brand-soft)] text-[var(--brand-strong)]",
                  day.isMultipleSelected &&
                    "bg-[var(--success-bg)] text-[var(--success)]",
                  highlight?.dot && "after:content-[''] after:absolute after:bottom-1 after:h-1.5 after:w-1.5 after:rounded-full after:bg-current"
                )}
              >
                {day.date.getDate()}
                {highlight?.dot && !renderDay && (
                  <span
                    className="absolute bottom-1 h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: highlight.color ?? "currentColor" }}
                    aria-hidden="true"
                  />
                )}
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Legend */}
      {(highlightedDates && highlightedDates.size > 0) || showToday || mode === "range" || mode === "multiple"} && (
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-600">
          {showToday && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded border-2 border-[var(--brand)]" />
              Hôm nay
            </span>
          )}
          {mode === "range" && (
            <>
              <span className="flex items-center gap-1">
                <span className="w-6 h-6 rounded-l-full bg-[var(--brand-soft)] border border-[var(--brand)]" />
                Bắt đầu
              </span>
              <span className="flex items-center gap-1">
                <span className="w-6 h-6 rounded-r-full bg-[var(--brand-soft)] border border-[var(--brand)]" />
                Kết thúc
              </span>
              <span className="flex items-center gap-1">
                <span className="w-6 h-6 bg-[var(--brand-soft)]" />
                Trong khoảng
              </span>
            </>
          )}
          {mode === "multiple" && (
            <span className="flex items-center gap-1">
              <span className="w-6 h-6 rounded bg-[var(--success-bg)]" />
              Đã chọn
            </span>
          )}
          {highlightedDates && (
            Array.from(highlightedDates.entries())
              .filter(([_, v]) => v.label)
              .map(([_, v]) => (
                <span key={v.label} className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: v.color ?? "currentColor" }} />
                  {v.label}
                </span>
              ))
          )}
        </div>
      )
    </div>
  );
}

/** DatePicker - Calendar trong popover/dropdown */
export interface DatePickerProps {
  label: string;
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  hint?: string;
  mode?: "single" | "range";
  range?: { from: Date | null; to: Date | null };
  onRangeChange?: (range: { from: Date | null; to: Date | null }) => void;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  className?: string;
  id?: string;
}

/** DatePicker wrapper - cần Popover component để hoạt động hoàn chỉnh */
export function DatePicker({
  label,
  value,
  onChange,
  placeholder = "Chọn ngày",
  disabled,
  error,
  hint,
  mode = "single",
  range,
  onRangeChange,
  minDate,
  maxDate,
  disabledDates,
  className,
  id,
}: DatePickerProps) {
  const inputId = id ?? `datepicker-${label}`;
  const displayValue = mode === "range"
    ? range?.from && range?.to
      ? `${range.from.toLocaleDateString("vi-VN")} - ${range.to.toLocaleDateString("vi-VN")}`
      : range?.from
      ? `${range.from.toLocaleDateString("vi-VN")} - ...`
      : ""
    : value
    ? value.toLocaleDateString("vi-VN")
    : "";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          readOnly
          value={displayValue}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cn(
            "h-10 w-full rounded-lg border bg-white px-3 pr-10 text-sm",
            "focus-visible:outline-2 focus-visible:outline-[var(--brand)]",
            error ? "border-red-500" : "border-slate-300",
            disabled && "bg-slate-50 cursor-not-allowed"
          )}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
          <Icon name="calendar" size={18} />
        </span>
      </div>
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="flex items-center gap-1 text-sm text-red-600">
          <Icon name="x" size={14} /> {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}