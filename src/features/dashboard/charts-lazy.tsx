"use client";

/**
 * Biểu đồ dashboard nạp lười: recharts (~400KB) chỉ được tải khi trình duyệt
 * thật sự vẽ biểu đồ, không nằm trong bundle JS mà MỌI route phải tải.
 * Trước đây chunk recharts tải ngay khi vào bất kỳ trang nào (qua prefetch
 * dashboard) nên trang nào cũng nặng thêm ~400KB.
 */

import dynamic from "next/dynamic";

function ChartFallback({ height }: { height: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] text-sm text-[var(--text-3)]"
      style={{ height }}
    >
      Đang tải biểu đồ…
    </div>
  );
}

export const DailyAttendanceChart = dynamic(
  () => import("./charts").then((mod) => mod.DailyAttendanceChart),
  { ssr: false, loading: () => <ChartFallback height={286} /> },
);

export const LateAbsentChart = dynamic(
  () => import("./charts").then((mod) => mod.LateAbsentChart),
  { ssr: false, loading: () => <ChartFallback height={250} /> },
);

export const BucketChart = dynamic(
  () => import("./charts").then((mod) => mod.BucketChart),
  { ssr: false, loading: () => <ChartFallback height={250} /> },
);

export const HourTrendChart = dynamic(
  () => import("./charts").then((mod) => mod.HourTrendChart),
  { ssr: false, loading: () => <ChartFallback height={240} /> },
);

export const ShiftDistributionPie = dynamic(
  () => import("./charts").then((mod) => mod.ShiftDistributionPie),
  { ssr: false, loading: () => <ChartFallback height={210} /> },
);

export const DepartmentAttendanceChart = dynamic(
  () => import("./charts").then((mod) => mod.DepartmentAttendanceChart),
  { ssr: false, loading: () => <ChartFallback height={300} /> },
);

export const OnTimeDonut = dynamic(
  () => import("./charts").then((mod) => mod.OnTimeDonut),
  { ssr: false, loading: () => <ChartFallback height={230} /> },
);
