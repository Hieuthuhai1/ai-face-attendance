"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

export interface BarChartData {
  name: string;
  [key: string]: string | number;
}

export interface BarChartSeries {
  dataKey: string;
  name: string;
  color?: string;
}

export interface BarChartProps {
  /** Dữ liệu cho biểu đồ */
  data: BarChartData[];
  /** Các series cần vẽ */
  series: BarChartSeries[];
  /** Key của trục X (thường là 'name' hoặc 'date') */
  xKey: string;
  /** Chiều cao */
  height?: number;
  /** Chiều rộng */
  width?: number;
  /** Màu mặc định cho các bar */
  colors?: string[];
  /** Hiển thị legend */
  showLegend?: boolean;
  /** Hiển thị tooltip */
  showTooltip?: boolean;
  /** Hiển thị grid */
  showGrid?: boolean;
  /** Tooltip formatter cho value */
  tooltipFormatter?: (value: number, name: string) => [ReactNode, string];
  /** Label cho trục Y */
  yAxisLabel?: string;
  /** Label cho trục X */
  xAxisLabel?: string;
  /** Stack bars */
  stacked?: boolean;
  /** Layout */
  layout?: "vertical" | "horizontal";
  /** Class thêm */
  className?: string;
  /** Render custom cho bar */
  renderBar?: (props: { value: number; name: string; index: number }) => ReactNode;
  /** Tùy chỉnh tooltip */
  tooltipContent?: ReactNode;
  /** Domain tối thiểu cho Y axis */
  yDomainMin?: number;
  /** Domain tối đa cho Y axis */
  yDomainMax?: number | "auto";
  /** Animation */
  animationDuration?: number;
  /** Bọc khung card (mặc định false khi đặt trong Card). */
  frame?: boolean;
  /** Giãn nhãn trục X: số nhãn bỏ qua giữa hai lần hiển thị. */
  xTickInterval?: number;
}

/** Bar Chart component wrapper cho Recharts */
export function BarChart({
  data,
  series,
  xKey,
  height = 300,
  width,
  colors = [
    "var(--brand)",
    "var(--success)",
    "var(--warning)",
    "var(--danger)",
    "var(--info)",
    "var(--teal-accent)",
  ],
  showLegend = true,
  showTooltip = true,
  showGrid = true,
  tooltipFormatter,
  yAxisLabel,
  xAxisLabel,
  stacked = false,
  layout = "horizontal",
  className,
  renderBar,
  yDomainMin = 0,
  yDomainMax = "auto",
  animationDuration = 300,
  frame = false,
  xTickInterval,
}: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center gap-2 text-center",
          frame && "rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-8 shadow-[var(--shadow-card)]",
          className,
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--text-3)]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3v18h18" />
            <path d="M7 16l4-4 4 4 6-6" />
          </svg>
        </span>
        <p className="text-sm font-medium text-[var(--navy-800)]">Chưa có dữ liệu</p>
        <p className="text-xs text-[var(--text-2)]">Số liệu sẽ hiển thị khi có nhân viên chấm công.</p>
      </div>
    );
  }

  const tooltipStyle = {
    backgroundColor: "white",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    boxShadow: "var(--shadow-popover)",
    padding: "10px 12px",
    fontSize: 12,
  };

  const tooltipContent = tooltipFormatter ? (
    <Tooltip
      contentStyle={tooltipStyle}
      itemStyle={{ color: "var(--navy-800)", fontSize: 12 }}
      labelStyle={{ color: "var(--text-2)", fontWeight: 600, fontSize: 12 }}
      formatter={(value: number, name: string) => tooltipFormatter(value, name)}
    />
  ) : showTooltip ? (
    <Tooltip
      contentStyle={tooltipStyle}
      itemStyle={{ color: "var(--navy-800)", fontSize: 12 }}
      labelStyle={{ color: "var(--text-2)", fontWeight: 600, fontSize: 12 }}
    />
  ) : null;

  return (
    <div
      className={cn(
        frame && "rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <ResponsiveContainer width={width ?? "100%"} height={height}>
        <RechartsBarChart
          layout={layout}
          data={data}
          margin={{ top: 10, right: showLegend ? 20 : 10, left: 50, bottom: xAxisLabel ? 50 : 30 }}
          stackedOffset={stacked ? "expand" : undefined}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />}
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fontSize: 12, fill: "var(--text-2)" }}
            interval={xTickInterval ?? "preserveStartEnd"}
            scale="band"
            padding={{ inner: 0.2, outer: 0.1 }}
          >
            {xAxisLabel && <XAxis.Label value={xAxisLabel} position="insideBottom" offset={30} fill="var(--text-2)" fontSize={12} />}
          </XAxis>
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "var(--text-2)" }}
            domain={[yDomainMin, yDomainMax]}
            minTickGap={30}
            allowDecimals={false}
          >
            {yAxisLabel && <YAxis.Label value={yAxisLabel} angle={-90} position="insideLeft" offset={-35} fill="var(--text-2)" fontSize={12} />}
          </YAxis>
          {showTooltip && tooltipContent}
          {showLegend && <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12 }} />}
          {series.map((s, index) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.name}
              fill={s.color ?? colors[index % colors.length]}
              radius={[6, 6, 0, 0]}
              maxBarSize={44}
              stackId={stacked ? "a" : undefined}
            >
              {renderBar && data.map((entry, i) => (
                <Cell key={`${s.dataKey}-${i}`}>
                  {renderBar({ value: entry[s.dataKey] as number, name: s.name, index: i })}
                </Cell>
              ))}
            </Bar>
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Simple Bar Chart - version đơn giản cho KPI */
export interface SimpleBarChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
  className?: string;
  showValue?: boolean;
  maxValue?: number;
}

export function SimpleBarChart({
  data,
  height = 200,
  className,
  showValue = true,
  maxValue,
}: SimpleBarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn("space-y-3", className)}>
      {data.map((item, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="w-24 text-sm text-slate-600 truncate">{item.label}</div>
          <div className="flex-1 h-8 relative">
            <div
              className="absolute inset-0 rounded bg-slate-100 overflow-hidden"
              role="img"
              aria-label={`${item.label}: ${item.value}`}
            >
              <div
                className="h-full rounded transition-all duration-500 ease-out"
                style={{
                  width: `${Math.min((item.value / max) * 100, 100)}%`,
                  backgroundColor: item.color ?? "var(--brand)",
                }}
              />
            </div>
            {showValue && (
              <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-600 whitespace-nowrap">
                {item.value.toLocaleString("vi-VN")}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Grouped Bar Chart - so sánh nhiều series */
export interface GroupedBarChartProps extends Omit<BarChartProps, "series"> {
  series: Array<BarChartSeries & { color?: string }>;
}

export function GroupedBarChart(props: GroupedBarChartProps) {
  return <BarChart {...props} stacked={false} />;
}

/** Stacked Bar Chart - tích lũy */
export interface StackedBarChartProps extends Omit<BarChartProps, "series"> {
  series: Array<BarChartSeries & { color?: string }>;
}

export function StackedBarChart(props: StackedBarChartProps) {
  return <BarChart {...props} stacked={true} yDomainMax="auto" />;
}