"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Dot,
  Area,
} from "recharts";

export interface LineChartData {
  name: string;
  [key: string]: string | number | null;
}

export interface LineChartSeries {
  dataKey: string;
  name: string;
  color?: string;
  strokeWidth?: number;
  dot?: boolean;
  type?: "line" | "area" | "step" | "smooth";
  dashArray?: string;
  yAxisId?: string;
}

export interface LineChartProps {
  /** Dữ liệu cho biểu đồ */
  data: LineChartData[];
  /** Các series cần vẽ */
  series: LineChartSeries[];
  /** Key của trục X (thường là 'name' hoặc 'date') */
  xKey: string;
  /** Chiều cao */
  height?: number;
  /** Chiều rộng */
  width?: number;
  /** Màu mặc định */
  colors?: string[];
  /** Hiển thị legend */
  showLegend?: boolean;
  /** Hiển thị tooltip */
  showTooltip?: boolean;
  /** Hiển thị grid */
  showGrid?: boolean;
  /** Tooltip formatter */
  tooltipFormatter?: (value: number | null, name: string) => [ReactNode, string];
  /** Label trục Y */
  yAxisLabel?: string;
  /** Label trục X */
  xAxisLabel?: string;
  /** Kết nối các điểm null */
  connectNulls?: boolean;
  /** Domain Y axis */
  yDomainMin?: number;
  yDomainMax?: number | "auto";
  /** Animation duration */
  animationDuration?: number;
  /** Class thêm */
  className?: string;
  /** Reference line (đường tham chiếu) */
  referenceLines?: Array<{ y: number; label: string; color?: string; strokeDasharray?: string }>;
  /** Reference area (vùng tham chiếu) */
  referenceAreas?: Array<{ y1: number; y2: number; color?: string; opacity?: number }>;
  /** Hiển thị dot trên đường line */
  showDots?: boolean;
  /** Radius của dot */
  dotRadius?: number;
  /** Active dot (hover) */
  activeDotRadius?: number;
  /** Tooltip content custom */
  tooltipContent?: ReactNode;
}

const DEFAULT_COLORS = [
  "var(--brand)",
  "var(--success)",
  "var(--warning)",
  "var(--danger)",
  "var(--info)",
  "var(--teal-accent)",
];

/** Line Chart component wrapper cho Recharts */
export function LineChart({
  data,
  series,
  xKey,
  height = 300,
  width,
  colors = DEFAULT_COLORS,
  showLegend = true,
  showTooltip = true,
  showGrid = true,
  tooltipFormatter,
  yAxisLabel,
  xAxisLabel,
  connectNulls = true,
  yDomainMin,
  yDomainMax = "auto",
  animationDuration = 500,
  className,
  referenceLines = [],
  referenceAreas = [],
  showDots = true,
  dotRadius = 4,
  activeDotRadius = 6,
  tooltipContent,
}: LineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={cn("rounded-xl border border-slate-200 bg-white p-8", className)}>
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <svg className="text-slate-300" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3v18h18" />
            <path d="M7 16l4-4 4 4 6-6" />
          </svg>
          <p>Không có dữ liệu để hiển thị</p>
        </div>
      </div>
    );
  }

  const hasYAxisLabel = yAxisLabel || yAxisLabel === "";
  const hasXAxisLabel = xAxisLabel || xAxisLabel === "";

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-4", className)}>
      <ResponsiveContainer width={width ?? "100%"} height={height}>
        <RechartsLineChart
          data={data}
          margin={{ top: 10, right: showLegend ? 30 : 10, left: hasYAxisLabel ? 60 : 50, bottom: hasXAxisLabel ? 50 : 30 }}
        >
          {referenceAreas.map((area, i) => (
            <Area
              key={`ref-area-${i}`}
              type="area"
              yAxisId={area.yAxisId ?? "left"}
              points={[
                { x: 0, y: area.y1 },
                { x: 0, y: area.y2 },
                { x: 1, y: area.y2 },
                { x: 1, y: area.y1 },
              ]}
              fill={area.color ?? "var(--brand-soft)"}
              fillOpacity={area.opacity ?? 0.3}
              stroke="none"
            />
          ))}

          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          )}

          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fontSize: 12, fill: "var(--text-2)" }}
            interval="preserveStartEnd"
            scale="point"
          >
            {hasXAxisLabel && (
              <XAxis.Label value={xAxisLabel} position="insideBottom" offset={30} fill="var(--text-2)" fontSize={12} />
            )}
          </XAxis>

          <YAxis
            yAxisId="left"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "var(--text-2)" }}
            domain={[yDomainMin ?? (referenceAreas.length > 0 ? "auto" : 0), yDomainMax]}
            minTickGap={30}
          >
            {hasYAxisLabel && (
              <YAxis.Label value={yAxisLabel} angle={-90} position="insideLeft" offset={-40} fill="var(--text-2)" fontSize={12} />
            )}
          </YAxis>

          {referenceLines.map((line, i) => (
            <Line
              key={`ref-line-${i}`}
              type="line"
              yAxisId="left"
              points={[
                { x: 0, y: line.y },
                { x: 1, y: line.y },
              ]}
              stroke={line.color ?? "var(--danger)"}
              strokeDasharray={line.strokeDasharray ?? "5 5"}
              strokeWidth={1}
            />
          ))}

          {showTooltip && (
            <Tooltip
              content={tooltipContent ?? undefined}
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
              formatter={tooltipFormatter}
              labelStyle={{ color: "var(--text-1)", fontWeight: 500 }}
            />
          )}

          {showLegend && <Legend wrapperStyle={{ paddingTop: 20 }} />}

          {series.map((s, index) => {
            const color = s.color ?? colors[index % colors.length];
            const isArea = s.type === "area";

            return isArea ? (
              <Area
                key={s.dataKey}
                dataKey={s.dataKey}
                name={s.name}
                type={s.type === "smooth" ? "monotone" : s.type === "step" ? "step" : "monotone"}
                stroke={color}
                strokeWidth={s.strokeWidth ?? 2}
                fill={color}
                fillOpacity={0.15}
                connectNulls={connectNulls}
                dot={showDots && s.dot !== false ? { r: dotRadius, strokeWidth: 2, stroke: color } : false}
                activeDot={{ r: activeDotRadius, strokeWidth: 2, stroke: color }}
                yAxisId={s.yAxisId ?? "left"}
              />
            ) : (
              <Line
                key={s.dataKey}
                dataKey={s.dataKey}
                name={s.name}
                type={s.type === "smooth" ? "monotone" : s.type === "step" ? "step" : "linear"}
                stroke={color}
                strokeWidth={s.strokeWidth ?? 2}
                strokeDasharray={s.dashArray}
                connectNulls={connectNulls}
                dot={showDots && s.dot !== false ? { r: dotRadius, strokeWidth: 2, stroke: color } : false}
                activeDot={{ r: activeDotRadius, strokeWidth: 2, stroke: color }}
                yAxisId={s.yAxisId ?? "left"}
              />
            );
          })}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Simple Line Chart - version đơn giản */
export interface SimpleLineChartProps {
  data: Array<{ x: string | number; y: number }>;
  height?: number;
  className?: string;
  color?: string;
  showArea?: boolean;
  showDots?: boolean;
  referenceLine?: { y: number; label: string };
}

export function SimpleLineChart({
  data,
  height = 200,
  className,
  color = "var(--brand)",
  showArea = false,
  showDots = true,
  referenceLine,
}: SimpleLineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={cn("rounded-xl border border-slate-200 bg-white p-8", className)}>
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <p>Không có dữ liệu</p>
        </div>
      </div>
    );
  }

  const points = data.map((d, i) => ({
    x: i * (100 / Math.max(1, data.length - 1)),
    y: 100 - (d.y / Math.max(...data.map((d) => d.y), 1)) * 100,
  }));

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaPath =
    showArea &&
    [
      `M ${points[0].x} 100`,
      path,
      `L ${points[points.length - 1].x} 100`,
      "Z",
    ].join(" ");

  const maxY = Math.max(...data.map((d) => d.y), 1);
  const minY = Math.min(...data.map((d) => d.y), 0);
  const refY = referenceLine ? 100 - (referenceLine.y / maxY) * 100 : null;

  return (
    <div className={cn("relative", className)} style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full" role="img" aria-label="Biểu đồ đường">
        {areaPath && (
          <path
            d={areaPath}
            fill={color}
            fillOpacity="0.1"
            stroke="none"
          />
        )}
        {refY !== null && refY >= 0 && refY <= 100 && (
          <line
            x1="0"
            y1={refY}
            x2="100"
            y2={refY}
            stroke="var(--danger)"
            strokeWidth="0.5"
            strokeDasharray="3 3"
          />
        )}
        <path
          d={path}
          stroke={color}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {showDots &&
          points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={3}
              fill={color}
              stroke="white"
              strokeWidth="2"
            />
          ))}
      </svg>
      {referenceLine && (
        <div className="absolute right-2 top-2 text-xs text-red-600 flex items-center gap-1">
          <span className="w-4 h-0.5 bg-red-500" />
          {referenceLine.label}: {referenceLine.y.toLocaleString("vi-VN")}
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-slate-400">
        <span>{data[0]?.x}</span>
        <span>{data[data.length - 1]?.x}</span>
      </div>
    </div>
  );
}

/** Multi-line chart for comparison */
export function MultiLineChart({
  data,
  series,
  xKey,
  height = 300,
  className,
}: Omit<LineChartProps, "colors">) {
  return <LineChart data={data} series={series} xKey={xKey} height={height} className={className} />;
}