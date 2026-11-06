"use client";

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts";

const COLOR_PALETTE = ["var(--brand)", "var(--success)", "var(--warning)", "var(--danger)", "var(--info)", "var(--teal-accent)"];

export function ReportsTimeTrendChart({ data }: { data: Array<{ hour: number; checkins: number; checkouts: number }> }) {
  if (data.length === 0) return <div className="h-72 flex items-center justify-center text-slate-500 text-sm">Không có dữ liệu chấm công theo giờ.</div>;

  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "var(--text-2)" }} type="number" domain={[0, 23]} />
          <YAxis tick={{ fontSize: 11, fill: "var(--text-2)" }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="checkins" name="Check-in" stroke="var(--brand)" dot={false} />
          <Line type="monotone" dataKey="checkouts" name="Check-out" stroke="var(--success)" dot={false} />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ReportsShiftDistributionChart({ data }: { data: Array<{ shift: string; count: number }> }) {
  if (data.length === 0) return <div className="h-72 flex items-center justify-center text-slate-500 text-sm">Hôm nay không có nhân viên được phân ca.</div>;

  return (
    <div className="h-full flex flex-col">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="shift"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            fill="#8884d8"
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLOR_PALETTE[index % COLOR_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ReportsDepartmentAttendanceChart({ data }: { data: Array<{ department: string; present: number; late: number; early_leave: number; absent: number; incomplete: number }> }) {
  if (data.length === 0) return <div className="h-72 flex items-center justify-center text-slate-500 text-sm">Hôm nay không có dữ liệu chấm công theo phòng ban.</div>;

  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="department" tick={{ fontSize: 11, fill: "var(--text-2)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--text-2)" }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="present" name="Đúng giờ" fill="var(--success)" />
          <Bar dataKey="late" name="Đi muộn" fill="var(--warning)" />
          <Bar dataKey="early_leave" name="Về sớm" fill="var(--info)" />
          <Bar dataKey="absent" name="Vắng mặt" fill="var(--danger)" />
          <Bar dataKey="incomplete" name="Chưa hoàn tất" fill="var(--text-3)" />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
