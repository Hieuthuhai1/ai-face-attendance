"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./tooltip";

export interface HeatmapDataPoint {
  x: string; // column key (e.g., date, hour, day of week)
  y: string; // row key (e.g., employee, department, shift)
  value: number; // numeric value
  label?: string; // custom label for tooltip
  color?: string; // custom color override
  meta?: Record<string, unknown>; // additional metadata for tooltip
}

export interface HeatmapProps {
  /** Dữ liệu heatmap */
  data: HeatmapDataPoint[];
  /** Các giá trị unique cho trục X (columns) */
  xLabels: string[];
  /** Các giá trị unique cho trục Y (rows) */
  yLabels: string[];
  /** Key truy cập x từ data point */
  xKey?: keyof HeatmapDataPoint;
  /** Key truy cập y từ data point */
  yKey?: keyof HeatmapDataPoint;
  /** Key truy cập value từ data point */
  valueKey?: keyof HeatmapDataPoint;
  /** Chiều cao ô */
  cellSize?: number;
  /** Khoảng cách giữa các ô */
  gap?: number;
  /** Màu gradient (từ thấp đến cao) */
  colors?: string[];
  /** Giá trị tối thiểu cho color scale */
  minValue?: number;
  /** Giá trị tối đa cho color scale */
  maxValue?: number;
  /** Hiển thị giá trị trong ô */
  showValues?: boolean;
  /** Formatter cho giá trị hiển thị */
  valueFormatter?: (value: number) => string;
  /** Tooltip custom */
  renderTooltip?: (point: HeatmapDataPoint, color: string) => ReactNode;
  /** Click vào ô */
  onCellClick?: (point: HeatmapDataPoint) => void;
  /** Class thêm */
  className?: string;
  /** Label trục X */
  xAxisLabel?: string;
  /** Label trục Y */
  yAxisLabel?: string;
  /** Hiển thị legend color scale */
  showLegend?: boolean;
  /** Legend labels */
  legendLabels?: [string, string]; // [low, high]
  /** Chế độ color: sequential | diverging | categorical */
  colorMode?: "sequential" | "diverging" | "categorical";
  /** Mid value cho diverging */
  midValue?: number;
}

/** Heatmap component - hiển thị mật độ/giá trị theo ma trận */
export function Heatmap({
  data,
  xLabels,
  yLabels,
  xKey = "x",
  yKey = "y",
  valueKey = "value",
  cellSize = 28,
  gap = 2,
  colors = [
    "#f0fdf4", // success lightest
    "#dcfce7",
    "#bbf7d0",
    "#86efac",
    "#4ade80",
    "#22c55e",
    "#16a34a",
    "#15803d", // success darkest
  ],
  minValue,
  maxValue,
  showValues = false,
  valueFormatter = (v) => v.toLocaleString("vi-VN"),
  renderTooltip,
  onCellClick,
  className,
  xAxisLabel,
  yAxisLabel,
  showLegend = true,
  legendLabels = ["Thấp", "Cao"],
  colorMode = "sequential",
  midValue,
}: HeatmapProps) {
  // Tạo map để lookup nhanh
  const dataMap = new Map<string, HeatmapDataPoint>();
  let computedMin = Infinity;
  let computedMax = -Infinity;

  data.forEach((point) => {
    const key = `${point[xKey]}-${point[yKey]}`;
    dataMap.set(key, point);
    if (point.value < computedMin) computedMin = point.value;
    if (point.value > computedMax) computedMax = point.value;
  });

  const finalMin = minValue ?? (colorMode === "diverging" ? -Math.max(Math.abs(computedMin), Math.abs(computedMax)) : computedMin);
  const finalMax = maxValue ?? computedMax;
  const finalMid = midValue ?? (colorMode === "diverging" ? 0 : (finalMin + finalMax) / 2);

  // Color scale function
  const getColor = (value: number): string => {
    if (colorMode === "diverging") {
      const normalized = (value - finalMin) / (finalMax - finalMin);
      const midNormalized = (finalMid - finalMin) / (finalMax - finalMin);
      if (normalized <= midNormalized) {
        // Blue to white
        const t = normalized / midNormalized;
        return interpolateColor("#eff6ff", "#ffffff", t); // brand-soft to white
      } else {
        // White to red
        const t = (normalized - midNormalized) / (1 - midNormalized);
        return interpolateColor("#ffffff", "#fef2f2", t); // white to danger-bg
      }
    } else if (colorMode === "categorical") {
      return colors[Math.min(Math.floor(value), colors.length - 1)];
    } else {
      // Sequential
      const normalized = finalMax === finalMin ? 0 : (value - finalMin) / (finalMax - finalMin);
      const index = Math.min(Math.floor(normalized * (colors.length - 1)), colors.length - 1);
      return colors[index];
    }
  };

  function interpolateColor(color1: string, color2: string, factor: number): string {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    if (!c1 || !c2) return color1;
    const r = Math.round(c1.r + (c2.r - c1.r) * factor);
    const g = Math.round(c1.g + (c2.g - c1.g) * factor);
    const b = Math.round(c1.b + (c2.b - c1.b) * factor);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
  }

  function getTextColor(bgColor: string): string {
    // Simple luminance check
    const rgb = hexToRgb(bgColor);
    if (!rgb) return "var(--text-1)";
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.5 ? "var(--text-1)" : "white";
  }

  const hasData = data.length > 0;

  if (!hasData) {
    return (
      <div className={cn("rounded-xl border border-slate-200 bg-white p-8", className)}>
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <svg className="text-slate-300" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <p>Không có dữ liệu heatmap</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto", className)}>
      {yAxisLabel && (
        <div className="mb-2 text-sm font-medium text-slate-700 text-right pr-2">{yAxisLabel}</div>
      )}

      <div className="flex">
        {/* Y Axis Labels */}
        <div className="flex flex-col justify-start">
          {yLabels.map((label) => (
            <div
              key={label}
              className="text-right text-xs text-slate-500 pr-2 select-none"
              style={{ height: cellSize, lineHeight: `${cellSize}px` }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Heatmap Grid */}
        <div className="flex flex-col">
          {/* X Axis Labels Top */}
          {xAxisLabel && (
            <div className="flex gap-[2px] pl-2 mb-1">
              <div style={{ width: 80 }} />
              {xLabels.map((label) => (
                <div
                  key={label}
                  className="text-center text-xs font-medium text-slate-600"
                  style={{ width: cellSize }}
                >
                  {label}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-[2px] pl-2">
            <div style={{ width: 80 }} />
            {xLabels.map((xLabel) => (
              <div key={xLabel} className="flex flex-col gap-[2px]">
                {yLabels.map((yLabel) => {
                  const point = dataMap.get(`${xLabel}-${yLabel}`);
                  const value = point?.[valueKey] ?? 0;
                  const color = point ? getColor(point[valueKey] as number) : colors[0];
                  const hasValue = !!point;

                  return (
                    <Tooltip
                      key={`${xLabel}-${yLabel}`}
                      label={
                        renderTooltip
                          ? renderTooltip(point!, color)
                          : (
                              <div>
                                <div className="font-medium">{xLabel} / {yLabel}</div>
                                <div className="text-sm text-slate-600">
                                  Giá trị: {valueFormatter(value)}
                                </div>
                                {point?.meta && (
                                  <div className="mt-1 text-xs text-slate-500">
                                    {Object.entries(point.meta)
                                      .map(([k, v]) => `${k}: ${v}`)
                                      .join(" | ")}
                                  </div>
                                )}
                              </div>
                            )
                      }
                    >
                      <button
                        type="button"
                        onClick={() => point && onCellClick?.(point)}
                        disabled={!hasValue && !onCellClick}
                        className={cn(
                          "relative transition-all duration-150",
                          "focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-1",
                          onCellClick && hasValue && "cursor-pointer hover:scale-[1.02] hover:shadow-md"
                        )}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          backgroundColor: color,
                          color: getTextColor(color),
                        }}
                        aria-label={`${xLabel}, ${yLabel}: ${valueFormatter(value)}`}
                      >
                        {showValues && hasValue && (
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium">
                            {valueFormatter(value)}
                          </span>
                        )}
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-600">
          <span>{legendLabels[0]}</span>
          <div className="flex h-4 w-32" role="img" aria-label={`Color scale from ${legendLabels[0]} to ${legendLabels[1]}`}>
            {colors.map((c, i) => (
              <div
                key={i}
                className="flex-1"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <span>{legendLabels[1]}</span>
          {showValues && (
            <span className="ml-4 text-slate-500">
              Min: {valueFormatter(finalMin)} · Max: {valueFormatter(finalMax)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Attendance Heatmap - chuyên dụng cho chấm công */
export interface AttendanceHeatmapProps {
  /** Dữ liệu: { date: 'YYYY-MM-DD', employee: 'code', status: 'present'|'late'|'absent'|'early'|'ot', value: 1 } */
  data: Array<{
    date: string;
    employee: string;
    status: "present" | "late" | "absent" | "early" | "ot";
    value: number;
  }>;
  /** Danh sách ngày */
  dates: string[];
  /** Danh sách nhân viên */
  employees: string[];
  /** Cell size */
  cellSize?: number;
  /** Click handler */
  onCellClick?: (date: string, employee: string, status: string) => void;
  /** Class thêm */
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  present: "var(--success)",
  late: "var(--warning)",
  early: "var(--info)",
  absent: "var(--danger)",
  ot: "var(--info)",
};

const STATUS_LABELS: Record<string, string> = {
  present: "Đúng giờ",
  late: "Đi trễ",
  early: "Về sớm",
  absent: "Vắng",
  ot: "Tăng ca",
};

export function AttendanceHeatmap({
  data,
  dates,
  employees,
  cellSize = 24,
  onCellClick,
  className,
}: AttendanceHeatmapProps) {
  const heatmapData: HeatmapDataPoint[] = data.map((d) => ({
    x: d.date,
    y: d.employee,
    value: d.value,
    label: STATUS_LABELS[d.status],
    meta: { status: d.status },
  }));

  return (
    <Heatmap
      data={heatmapData}
      xLabels={dates}
      yLabels={employees}
      cellSize={cellSize}
      gap={1}
      colors={Object.values(STATUS_COLORS)}
      colorMode="categorical"
      showValues={false}
      renderTooltip={(point) => (
        <div>
          <div className="font-medium">{point.x} / {point.y}</div>
          <div className="text-sm text-slate-600">Trạng thái: {point.label}</div>
        </div>
      )}
      onCellClick={(point) => point.meta?.status && onCellClick?.(point.x, point.y, point.meta.status as string)}
      showLegend={false}
      className={className}
    />
  );
}

/** Calendar Heatmap - GitHub style contribution calendar */
export interface CalendarHeatmapProps {
  /** Dữ liệu: { date: 'YYYY-MM-DD', value: number } */
  data: Array<{ date: string; value: number; label?: string }>;
  /** Năm hiển thị */
  year?: number;
  /** Màu gradient */
  colors?: string[];
  /** Cell size */
  cellSize?: number;
  /** Gap */
  gap?: number;
  /** Tooltip */
  renderTooltip?: (date: string, value: number) => ReactNode;
  /** Click */
  onCellClick?: (date: string, value: number) => void;
  /** Class */
  className?: string;
}

export function CalendarHeatmap({
  data,
  year = new Date().getFullYear(),
  colors = [
    "#ebedf0", // level 0
    "#9be9a8", // level 1
    "#40c463", // level 2
    "#30a14e", // level 3
    "#216e39", // level 4
  ],
  cellSize = 12,
  gap = 2,
  renderTooltip,
  onCellClick,
  className,
}: CalendarHeatmapProps) {
  const dataMap = new Map(data.map((d) => [d.date, d]));
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  // Tính toán weeks
  const firstDayOfYear = startDate.getDay(); // 0 = Sunday
  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const weeks = Math.ceil((firstDayOfYear + totalDays) / 7);

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  function getColor(value: number): string {
    if (value === 0) return colors[0];
    const index = Math.min(Math.ceil((value / maxValue) * (colors.length - 1)), colors.length - 1);
    return colors[index];
  }

  const monthNames = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-4", className)}>
      <div className="flex gap-[2px]">
        {/* Weekday labels */}
        <div className="flex flex-col gap-[2px] pr-2">
          {["", "T2", "", "T4", "", "T6", ""].map((day, i) => (
            <div
              key={i}
              className="text-right text-[10px] text-slate-400 select-none"
              style={{ height: cellSize, lineHeight: `${cellSize}px` }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="flex gap-[2px]">
          {Array.from({ length: weeks }).map((_, weekIndex) => {
            const weekStart = new Date(startDate);
            weekStart.setDate(startDate.getDate() - firstDayOfYear + weekIndex * 7);

            return (
              <div key={weekIndex} className="flex flex-col gap-[2px]">
                {Array.from({ length: 7 }).map((_, dayIndex) => {
                  const date = new Date(weekStart);
                  date.setDate(weekStart.getDate() + dayIndex);
                  const dateKey = date.toISOString().split("T")[0];
                  const isCurrentYear = date.getFullYear() === year;
                  const point = dataMap.get(dateKey);
                  const value = point?.value ?? 0;
                  const color = isCurrentYear ? getColor(value) : "#f6f7f9";

                  return (
                    <Tooltip
                      key={dateKey}
                      label={
                        renderTooltip
                          ? renderTooltip(dateKey, value)
                          : (
                              <div>
                                <div className="font-medium">{date.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" })}</div>
                                <div className="text-sm text-slate-600">Giá trị: {value}</div>
                              </div>
                            )
                      }
                    >
                      <button
                        type="button"
                        onClick={() => isCurrentYear && onCellClick?.(dateKey, value)}
                        disabled={!isCurrentYear}
                        className={cn(
                          "relative transition-all duration-150 rounded",
                          "focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-1",
                          isCurrentYear && onCellClick && "cursor-pointer hover:scale-110 hover:shadow-sm"
                        )}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          backgroundColor: color,
                        }}
                        aria-label={`${date.toLocaleDateString("vi-VN")}: ${value}`}
                      />
                    </Tooltip>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Month labels */}
      <div className="mt-3 flex gap-[2px] pl-2">
        {monthNames.map((month, monthIndex) => {
          const firstDayOfMonth = new Date(year, monthIndex, 1);
          const weekOfMonth = Math.floor((firstDayOfMonth.getDay() - firstDayOfYear + 7 * (firstDayOfMonth.getDate() - 1) + 7) / 7);
          const offsetWeeks = weekOfMonth;
          return (
            <div
              key={month}
              className="text-[10px] text-slate-400"
              style={{
                marginLeft: offsetWeeks * (cellSize + gap),
                width: cellSize * 4,
              }}
            >
              {month}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <span>Ít</span>
        <div className="flex h-3 w-24">
          {colors.map((c, i) => (
            <div key={i} className="flex-1" style={{ backgroundColor: c }} />
          ))}
        </div>
        <span>Nhiều</span>
        <span className="ml-4">Max: {maxValue}</span>
      </div>
    </div>
  );
}