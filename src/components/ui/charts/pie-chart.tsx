"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  SectorProps,
} from "recharts";

export interface PieChartData {
  name: string;
  value: number;
  color?: string;
  [key: string]: unknown;
}

export interface PieChartProps {
  /** Dữ liệu cho biểu đồ */
  data: PieChartData[];
  /** Key cho tên */
  nameKey?: string;
  /** Key cho giá trị */
  valueKey?: string;
  /** Chiều cao */
  height?: number;
  /** Chiều rộng */
  width?: number;
  /** Bán kính trong (donut chart) */
  innerRadius?: number;
  /** Bán kính ngoài */
  outerRadius?: number | string;
  /** Màu mặc định */
  colors?: string[];
  /** Hiển thị legend */
  showLegend?: boolean;
  /** Vị trí legend */
  legendPosition?: "top" | "right" | "bottom" | "left";
  /** Hiển thị tooltip */
  showTooltip?: boolean;
  /** Tooltip formatter */
  tooltipFormatter?: (value: number, name: string) => [ReactNode, string];
  /** Hiển thị label trên slice */
  showLabels?: boolean;
  /** Label formatter */
  labelFormatter?: (value: number, name: string, percent: number) => ReactNode;
  /** Label line */
  labelLine?: boolean;
  /** Padding giữa các slice */
  paddingAngle?: number;
  /** Gốc bắt đầu (độ) */
  startAngle?: number;
  /** Góc kết thúc (độ) */
  endAngle?: number;
  /** Animation */
  animationDuration?: number;
  /** Class thêm */
  className?: string;
  /** Tổng giá trị (dùng cho hiển thị ở trung tâm donut) */
  total?: number;
  /** Render nội dung trung tâm donut */
  renderCenter?: (total: number, data: PieChartData[]) => ReactNode;
  /** Click vào slice */
  onSliceClick?: (data: PieChartData, index: number) => void;
}

/** Pie/Donut Chart component wrapper cho Recharts */
export function PieChart({
  data,
  nameKey = "name",
  valueKey = "value",
  height = 300,
  width,
  innerRadius = 60,
  outerRadius = "80%",
  colors = [
    "var(--brand)",
    "var(--success)",
    "var(--warning)",
    "var(--danger)",
    "var(--info)",
    "var(--teal-accent)",
    "#8b5cf6",
    "#ec4899",
    "#f97316",
    "#14b8a6",
  ],
  showLegend = true,
  legendPosition = "right",
  showTooltip = true,
  tooltipFormatter,
  showLabels = true,
  labelFormatter,
  labelLine = true,
  paddingAngle = 2,
  startAngle = 0,
  endAngle = 360,
  animationDuration = 500,
  className,
  total,
  renderCenter,
  onSliceClick,
}: PieChartProps) {
  const computedTotal = total ?? data.reduce((sum, d) => sum + (d[valueKey] as number), 0);

  const hasData = data.length > 0 && computedTotal > 0;

  if (!hasData) {
    return (
      <div className={cn("rounded-xl border border-slate-200 bg-white p-8", className)}>
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <svg className="text-slate-300" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 4" />
          </svg>
          <p>Không có dữ liệu để hiển thị</p>
        </div>
      </div>
    );
  }

  const CustomTooltip = showTooltip
    ? ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string; payload: PieChartData }> }) => {
        if (!active || !payload || !payload[0]) return null;
        const { value, name, color, payload: rawPayload } = payload[0];
        const percent = ((value / computedTotal) * 100).toFixed(1);
        return (
          <div
            style={{
              backgroundColor: "white",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              padding: "8px 12px",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
              <span className="font-medium text-slate-900">{name}</span>
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {tooltipFormatter
                ? tooltipFormatter(value, name)[0]
                : `${value.toLocaleString("vi-VN")} (${percent}%)`}
            </div>
          </div>
        );
      }
    : null;

  const CustomLabel = showLabels
    ? ({ percent, value, name, cx, cy }: SectorProps & { percent: number; value: number; name: string }) => {
        if (percent < 0.05) return null; // Không hiển thị label nếu quá nhỏ (<5%)
        const label = labelFormatter
          ? labelFormatter(value, name, percent)
          : `${name}: ${(percent * 100).toFixed(1)}%`;
        return (
          <text
            x={cx}
            y={cy}
            fill="white"
            fontSize={11}
            fontWeight={600}
            textAnchor="middle"
            dominantBaseline="middle"
            filter="drop-shadow(0 1px 1px rgba(0,0,0,0.3))"
          >
            {label}
          </text>
        );
      }
    : null;

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-4", className)}>
      <ResponsiveContainer width={width ?? "100%"} height={height}>
        <RechartsPieChart>
          <Pie
            data={data}
            nameKey={nameKey}
            dataKey={valueKey}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={paddingAngle}
            startAngle={startAngle}
            endAngle={endAngle}
            label={CustomLabel}
            labelLine={labelLine}
            onClick={onSliceClick
              ? (slice: SectorProps & { payload: PieChartData }, index: number) => onSliceClick(slice.payload, index)
              : undefined}
          >
            {data.map((entry, index) => (
              <Cell
                key={`${nameKey}-${index}`}
                fill={entry.color ?? colors[index % colors.length]}
              />
            ))}
          </Pie>
          {showTooltip && <Tooltip content={CustomTooltip} />}
          {showLegend && (
            <Legend
              layout={legendPosition === "left" || legendPosition === "right" ? "vertical" : "horizontal"}
              align={legendPosition === "left" ? "left" : legendPosition === "right" ? "right" : "center"}
              verticalAlign="middle"
              iconType="circle"
              wrapperStyle={{
                paddingTop: 20,
                maxHeight: 300,
                overflowY: "auto",
              }}
            />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>

      {/* Center content for donut chart */}
      {innerRadius > 0 && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            transform: "translate(-50%, -50%)",
            left: "50%",
            top: "50%",
          }}
        >
          {renderCenter
            ? renderCenter(computedTotal, data)
            : (
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-900 tnum">{computedTotal.toLocaleString("vi-VN")}</p>
                  <p className="text-xs text-slate-500">Tổng</p>
                </div>
              )}
        </div>
      )}
    </div>
  );
}

/** Simple Pie Chart - version đơn giản không cần Recharts (cho KPI nhỏ) */
export interface SimplePieChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  size?: number;
  innerRadius?: number;
  className?: string;
  showLegend?: boolean;
  total?: number;
}

export function SimplePieChart({
  data,
  size = 120,
  innerRadius = 40,
  className,
  showLegend = true,
  total,
}: SimplePieChartProps) {
  const computedTotal = total ?? data.reduce((sum, d) => sum + d.value, 0);

  if (computedTotal === 0) {
    return (
      <div className={cn("flex items-center justify-center", className)} style={{ width: size, height: size }}>
        <div className="text-center text-slate-400">
          <p className="text-xs">Không có dữ liệu</p>
        </div>
      </div>
    );
  }

  const segments = data.map((d) => ({
    ...d,
    percent: d.value / computedTotal,
    color: d.color ?? "var(--brand)",
  }));

  let cumulativePercent = 0;
  const paths = segments.map((seg) => {
    const startAngle = cumulativePercent * 360;
    const endAngle = (cumulativePercent + seg.percent) * 360;
    cumulativePercent += seg.percent;

    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);

    const outerR = size / 2;
    const innerR = innerRadius;

    const x1 = outerR + outerR * Math.cos(startRad);
    const y1 = outerR + outerR * Math.sin(startRad);
    const x2 = outerR + outerR * Math.cos(endRad);
    const y2 = outerR + outerR * Math.sin(endRad);

    const x3 = outerR + innerR * Math.cos(endRad);
    const y3 = outerR + innerR * Math.sin(endRad);
    const x4 = outerR + innerR * Math.cos(startRad);
    const y4 = outerR + innerR * Math.sin(startRad);

    const largeArcFlag = seg.percent > 0.5 ? 1 : 0;

    return (
      <path
        key={seg.label}
        d={[
          `M ${x1} ${y1}`,
          `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
          `L ${x3} ${y3}`,
          `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
          "Z",
        ].join(" ")}
        fill={seg.color}
      />
    );
  });

  return (
    <div className={cn("relative inline-flex", className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
        {paths}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-lg font-bold text-slate-900 tnum">{computedTotal.toLocaleString("vi-VN")}</p>
          <p className="text-xs text-slate-500">Tổng</p>
        </div>
      </div>
      {showLegend && (
        <div className="ml-4 flex-1 min-w-0">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: d.color ?? colors[i % colors.length] }} />
              <span className="text-slate-700 truncate">{d.label}</span>
              <span className="text-slate-500 tnum">
                {d.value.toLocaleString("vi-VN")} ({(d.value / computedTotal * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Progress Donut - donut chart dạng progress */
export interface ProgressDonutProps {
  /** Phần trăm (0-100) */
  percent: number;
  /** Kích thước */
  size?: number;
  /** Độ dày vòng tròn */
  strokeWidth?: number;
  /** Màu progress */
  color?: string;
  /** Màu background */
  bgColor?: string;
  /** Hiển thị label giữa */
  label?: ReactNode;
  /** Class thêm */
  className?: string;
}

export function ProgressDonut({
  percent = 0,
  size = 80,
  strokeWidth = 6,
  color = "var(--brand)",
  bgColor = "var(--surface-muted)",
  label,
  className,
}: ProgressDonutProps) {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedPercent / 100) * circumference;

  return (
    <div className={cn("relative inline-flex", className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
          style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {label ?? (
          <span className="text-lg font-bold text-slate-900 tnum">{clampedPercent.toFixed(0)}%</span>
        )}
      </div>
    </div>
  );
}