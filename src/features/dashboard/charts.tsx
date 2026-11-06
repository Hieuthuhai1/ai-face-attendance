"use client";

/**
 * Biểu đồ dashboard: các formatter/tooltip được khai báo trong client component
 * vì Server Component không được truyền function qua ranh giới client.
 * Dữ liệu truyền vào chỉ là object/array serializable.
 */

import { LineChart, type LineChartData } from "@/components/ui/charts/line-chart";
import { BarChart, type BarChartData } from "@/components/ui/charts/bar-chart";
import { PieChart, type PieChartData } from "@/components/ui/charts/pie-chart";

export interface DayChartPoint extends BarChartData {
  name: string;
  checked_in: number;
  assigned: number;
  late: number;
  absent: number;
}

export interface BucketChartPoint extends BarChartData {
  name: string;
  checked_in: number;
  absent: number;
}

export interface HourChartPoint extends LineChartData {
  name: string;
  check_ins: number;
  check_outs: number;
}

export interface ShiftChartPoint extends PieChartData {
  name: string;
  value: number;
  color?: string;
}

export interface DepartmentChartPoint extends BarChartData {
  name: string;
  present: number;
  late: number;
  early_leave: number;
  absent: number;
}

export interface DonutSlice extends PieChartData {
  name: string;
  value: number;
  color: string;
}

const countLabel = (value: number | null, unit: string): string =>
  `${Number(value ?? 0).toLocaleString("vi-VN")} ${unit}`;

export function DailyAttendanceChart({
  data,
  tickInterval,
  showDots,
}: {
  data: DayChartPoint[];
  tickInterval?: number;
  showDots: boolean;
}) {
  return (
    <LineChart
      data={data}
      xKey="name"
      height={286}
      showDots={showDots}
      dotRadius={3}
      xTickInterval={tickInterval}
      series={[
        { dataKey: "checked_in", name: "Đã chấm công", color: "var(--brand)", type: "area" },
        {
          dataKey: "assigned",
          name: "Có ca",
          color: "var(--teal-accent)",
          dashArray: "5 4",
          dot: false,
          strokeWidth: 2,
        },
      ]}
      tooltipFormatter={(value, name) => [countLabel(value, "nhân viên"), name]}
    />
  );
}

export function LateAbsentChart({
  data,
  tickInterval,
}: {
  data: DayChartPoint[];
  tickInterval?: number;
}) {
  return (
    <BarChart
      data={data}
      xKey="name"
      height={250}
      showLegend={false}
      xTickInterval={tickInterval}
      series={[
        { dataKey: "late", name: "Đi muộn", color: "var(--warning)" },
        { dataKey: "absent", name: "Vắng mặt", color: "var(--danger)" },
      ]}
      tooltipFormatter={(value, name) => [countLabel(value, "nhân viên"), name]}
    />
  );
}

export function BucketChart({ data }: { data: BucketChartPoint[] }) {
  return (
    <BarChart
      data={data}
      xKey="name"
      height={250}
      series={[
        { dataKey: "checked_in", name: "Đã chấm công", color: "var(--brand)" },
        { dataKey: "absent", name: "Vắng mặt", color: "var(--danger)" },
      ]}
      tooltipFormatter={(value, name) => [countLabel(value, "ngày công"), name]}
    />
  );
}

export function HourTrendChart({ data }: { data: HourChartPoint[] }) {
  return (
    <LineChart
      data={data}
      xKey="name"
      height={240}
      showDots={false}
      xTickInterval={2}
      series={[
        { dataKey: "check_ins", name: "Check-in", color: "var(--brand)", type: "area" },
        { dataKey: "check_outs", name: "Check-out", color: "var(--info)" },
      ]}
      tooltipFormatter={(value, name) => [countLabel(value, "lượt"), name]}
    />
  );
}

export function ShiftDistributionPie({ data }: { data: ShiftChartPoint[] }) {
  return (
    <PieChart
      data={data}
      height={210}
      innerRadius={52}
      outerRadius="78%"
      showLegend={false}
      showLabels={false}
      labelLine={false}
      renderCenter={(total) => (
        <div className="text-center">
          <p className="tnum text-[22px] font-bold leading-none text-[var(--navy-800)]">
            {total.toLocaleString("vi-VN")}
          </p>
          <p className="mt-1 text-[11px] font-medium text-[var(--text-2)]">nhân viên</p>
        </div>
      )}
      tooltipFormatter={(value, name) => [countLabel(value, "nhân viên"), name]}
    />
  );
}

export function DepartmentAttendanceChart({ data }: { data: DepartmentChartPoint[] }) {
  return (
    <BarChart
      data={data}
      xKey="name"
      height={300}
      stacked
      series={[
        { dataKey: "present", name: "Đúng giờ", color: "var(--success)" },
        { dataKey: "late", name: "Đi muộn", color: "var(--warning)" },
        { dataKey: "early_leave", name: "Về sớm", color: "var(--info)" },
        { dataKey: "absent", name: "Vắng mặt", color: "var(--danger)" },
      ]}
      tooltipFormatter={(value, name) => [countLabel(value, "nhân viên"), name]}
    />
  );
}

export function OnTimeDonut({ data, rate }: { data: DonutSlice[]; rate: number | null }) {
  return (
    <PieChart
      data={data}
      height={230}
      innerRadius={62}
      outerRadius="78%"
      showLegend={false}
      showLabels={false}
      labelLine={false}
      paddingAngle={2}
      renderCenter={() => (
        <div className="text-center">
          <p className="tnum text-[26px] font-bold leading-none text-[var(--navy-800)]">
            {rate === null ? "—" : `${rate}%`}
          </p>
          <p className="mt-1 text-[11px] font-medium text-[var(--text-2)]">đúng giờ</p>
        </div>
      )}
    />
  );
}
