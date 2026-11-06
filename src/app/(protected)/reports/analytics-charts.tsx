"use client";

import dynamic from "next/dynamic";

const ReportsTimeTrendChart = dynamic(() => import("@/components/ui/charts/reports-charts").then((mod) => mod.ReportsTimeTrendChart), {
  ssr: false,
  loading: () => <div className="h-72 flex items-center justify-center text-slate-500">Đang tải biểu đồ…</div>,
});

const ReportsShiftDistributionChart = dynamic(() => import("@/components/ui/charts/reports-charts").then((mod) => mod.ReportsShiftDistributionChart), {
  ssr: false,
  loading: () => <div className="h-72 flex items-center justify-center text-slate-500">Đang tải biểu đồ…</div>,
});

const ReportsDepartmentAttendanceChart = dynamic(() => import("@/components/ui/charts/reports-charts").then((mod) => mod.ReportsDepartmentAttendanceChart), {
  ssr: false,
  loading: () => <div className="h-72 flex items-center justify-center text-slate-500">Đang tải biểu đồ…</div>,
});

export { ReportsTimeTrendChart, ReportsShiftDistributionChart, ReportsDepartmentAttendanceChart };
