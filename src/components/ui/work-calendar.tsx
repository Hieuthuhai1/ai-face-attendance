"use client";

import { useState, useMemo, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import { Tooltip } from "./tooltip";
import { Button } from "./button";
import { Badge } from "./badge";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

export interface WorkShift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  overnight: boolean;
  color: string;
}

export interface ShiftAssignment {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  shift_id: string;
  shift: WorkShift;
  effective_from: string;
  effective_to: string | null;
}

export interface CalendarEvent {
  id: string;
  date: string;
  shift: WorkShift;
  employee_id: string;
  employee_code: string;
  employee_name: string;
}

export interface WorkCalendarProps {
  shifts: WorkShift[];
  assignments: CalendarEvent[];
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  viewMode?: "month" | "week" | "day";
  onViewModeChange?: (mode: "month" | "week" | "day") => void;
  shiftsList?: WorkShift[];
  onShiftClick?: (shift: WorkShift) => void;
  className?: string;
}

const DAYS_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function getShiftColor(shiftId: string, shifts: WorkShift[]): string {
  const shift = shifts.find((s) => s.id === shiftId);
  return shift?.color || "#3b82f6";
}

function getEventsForDate(date: Date, assignments: CalendarEvent[]): CalendarEvent[] {
  const dateStr = format(date, "yyyy-MM-dd");
  return assignments.filter((a) => a.date === dateStr);
}

function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatTooltipLabel(date: Date, events: CalendarEvent[], shifts: WorkShift[]): string {
  const lines = [date.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" })];
  if (events.length > 0) {
    events.forEach((e) => {
      lines.push(`${e.employee_name} - ${e.shift.name}`);
    });
  }
  return lines.join("\n");
}

export function WorkCalendar({
  shifts = [],
  assignments = [],
  selectedDate,
  onDateSelect,
  onEventClick,
  viewMode = "month",
  onViewModeChange,
  shiftsList = [],
  onShiftClick,
  className,
}: WorkCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const start = new Date();
    start.setDate(d.getDate() - day);
    start.setHours(0, 0, 0, 0);
    return start;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Month view
  if (viewMode === "month") {
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();
    const daysInPrevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0).getDate();

    const days = useMemo(() => {
      const result: Array<{ date: Date; isCurrentMonth: boolean }> = [];

      for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), -i);
        result.push({ date, isCurrentMonth: false });
      }

      for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
        result.push({ date, isCurrentMonth: true });
      }

      const remaining = 42 - result.length;
      for (let i = 1; i <= remaining; i++) {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, i);
        result.push({ date, isCurrentMonth: false });
      }

      return result;
    }, [currentMonth]);

    return (
      <div className={cn("rounded-xl border border-slate-200 bg-white p-4", className)}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} aria-label="Tháng trước">
              <Icon name="chevron-left" size={18} />
            </Button>
            <span className="font-medium text-slate-900 min-w-[160px] text-center">
              {currentMonth.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} aria-label="Tháng sau">
              <Icon name="chevron-right" size={18} />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onViewModeChange?.("week")}>Tuần</Button>
            <Button variant="outline" size="sm" onClick={() => onViewModeChange?.("day")}>Ngày</Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>Hôm nay</Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1" role="row">
          {DAYS_SHORT.map((day, i) => (
            <div key={day} role="columnheader" className="text-center text-xs font-medium text-slate-500 py-2">{day}</div>
          ))}
        </div>

        <div role="grid" className="grid grid-cols-7 gap-1">
          {Array.from({ length: 42 }).map((_, index) => {
            const dayData = days[index];
            if (!dayData) return <div key={index} />;
            const { date, isCurrentMonth } = dayData;
            const isToday = date.toDateString() === today.toDateString();
            const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
            const events = getEventsForDate(date, assignments);
            const shift = events[0]?.shift;
            const shiftColor = shift ? getShiftColor(shift.id, shifts) : undefined;

            return (
              <Tooltip key={index} label={formatTooltipLabel(date, events, shifts)}>
                <button
                  type="button"
                  role="gridcell"
                  aria-label={date.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" })}
                  aria-selected={isSelected}
                  aria-disabled={!isCurrentMonth}
                  disabled={!isCurrentMonth}
                  onClick={() => isCurrentMonth && onDateSelect?.(date)}
                  className={cn(
                    "relative aspect-square flex flex-col items-center justify-center text-sm font-medium transition-colors",
                    "rounded-lg",
                    "focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2",
                    !isCurrentMonth && "text-slate-300 cursor-not-allowed",
                    isCurrentMonth && "hover:bg-slate-100",
                    isCurrentMonth ? "text-slate-900" : "text-slate-300",
                    isToday && !isSelected && "ring-2 ring-[var(--brand)]",
                    isSelected && "bg-[var(--brand)] text-white"
                  )}
                >
                  <span>{date.getDate()}</span>
                  {shift && (
                    <div className="absolute bottom-0 left-1 right-1 h-1.5 rounded-b" style={{ backgroundColor: shiftColor }} />
                  )}
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  }

  // Week view
  if (viewMode === "week") {
    const { start: weekStart, end: weekEnd } = getWeekRange(currentWeekStart);
    const daysInWeek = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });

    const allDayEvents = assignments.filter((e) => {
      const eventDate = new Date(e.date);
      return eventDate >= weekStart && eventDate <= weekEnd;
    });

    return (
      <div className={cn("rounded-xl border border-slate-200 bg-white p-4", className)}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCurrentWeekStart(new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000))} aria-label="Tuần trước">
              <Icon name="chevron-left" size={18} />
            </Button>
            <span className="font-medium text-slate-900 min-w-[200px] text-center">
              {format(weekStart, "dd/MM", { locale: vi })} - {format(weekEnd, "dd/MM/yyyy", { locale: vi })}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setCurrentWeekStart(new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000))} aria-label="Tuần sau">
              <Icon name="chevron-right" size={18} />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onViewModeChange?.("month")}>Tháng</Button>
            <Button variant="outline" size="sm" onClick={() => onViewModeChange?.("day")}>Ngày</Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentWeekStart(new Date())}>Tuần này</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="grid">
            <thead>
              <tr>
                <th className="w-20 bg-[var(--surface-muted)] px-2 py-2 font-medium text-slate-600 text-center">Giờ</th>
                {DAYS_SHORT.map((day, i) => (
                  <th key={day} scope="col" className="bg-[var(--surface-muted)] px-2 py-2 font-medium text-slate-600 text-center">
                    {day}<br /><span className="text-xs text-slate-400">{format(daysInWeek[i], "dd/MM", { locale: vi })}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 24 }).map((_, hour) => (
                <tr key={hour} className="border-t border-slate-100">
                  <td className="bg-[var(--surface-muted)] px-2 py-1 font-medium text-slate-600 text-center text-xs">
                    {hour.toString().padStart(2, "0")}:00
                  </td>
                  {daysInWeek.map((day, dayIndex) => {
                    const dayStr = format(day, "yyyy-MM-dd");
                    const events = assignments.filter((e) => e.date === dayStr);
                    const hourEvents = events.filter((e) => {
                      const start = new Date(e.date + "T" + e.shift.start_time);
                      const end = new Date(e.date + "T" + e.shift.end_time);
                      const checkHour = new Date(dayStr + "T" + hour.toString().padStart(2, "0") + ":00");
                      return checkHour >= start && checkHour < end;
                    });
                    return (
                      <td key={`${hour}-${dayIndex}`} className="relative p-1">
                        {hourEvents.map((e) => (
                          <div
                            key={e.id}
                            className="absolute inset-x-1 bottom-1 top-1 rounded bg-opacity-90 text-xs text-white truncate px-1 py-0.5"
                            style={{ backgroundColor: getShiftColor(e.shift.id, shifts), zIndex: 10 }}
                            onClick={() => onEventClick?.(e)}
                          >
                            {e.shift.name} - {e.employee_name}
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Day view
  if (viewMode === "day") {
    const viewDate = selectedDate || new Date();
    const dayStr = format(viewDate, "yyyy-MM-dd");
    const dayEvents = assignments.filter((e) => e.date === dayStr);
    const dayName = format(viewDate, "EEEE, dd/MM/yyyy", { locale: vi });

    return (
      <div className={cn("rounded-xl border border-slate-200 bg-white p-4", className)}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCurrentWeekStart(new Date(currentWeekStart.getTime() - 24 * 60 * 60 * 1000))} aria-label="Ngày trước">
              <Icon name="chevron-left" size={18} />
            </Button>
            <h2 className="text-lg font-semibold text-slate-900">{dayName}</h2>
            <Button variant="ghost" size="sm" onClick={() => setCurrentWeekStart(new Date(currentWeekStart.getTime() + 24 * 60 * 60 * 1000))} aria-label="Ngày sau">
              <Icon name="chevron-right" size={18} />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onViewModeChange?.("month")}>Tháng</Button>
            <Button variant="outline" size="sm" onClick={() => onViewModeChange?.("week")}>Tuần</Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentWeekStart(new Date())}>Hôm nay</Button>
          </div>
        </div>

        <div className="space-y-2">
          {Array.from({ length: 24 }).map((_, hour) => {
            const hourStr = hour.toString().padStart(2, "0") + ":00";
            const events = assignments.filter((e) => {
              const start = new Date(e.date + "T" + e.shift.start_time);
              const end = new Date(e.date + "T" + e.shift.end_time);
              const checkHour = new Date(dayStr + "T" + hour.toString().padStart(2, "0") + ":00");
              return checkHour >= start && checkHour < end;
            });

            return (
              <div key={hour} className="flex items-center gap-3">
                <span className="w-16 text-right text-sm text-slate-500 font-mono">{hourStr}</span>
                <div className="flex-1 h-10 relative bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                  {events.map((e) => (
                    <div
                      key={e.id}
                      className="absolute inset-y-0 rounded-r-lg px-2 py-1 text-xs text-white truncate flex items-center"
                      style={{
                        left: 0,
                        right: 0,
                        backgroundColor: getShiftColor(e.shift.id, shifts),
                        zIndex: 10,
                      }}
                      onClick={() => onEventClick?.(e)}
                    >
                      {e.shift.name} - {e.employee_name}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}