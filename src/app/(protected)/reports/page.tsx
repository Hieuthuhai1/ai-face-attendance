import { Suspense } from "react";
import { requireRole } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { getDashboard, getReport, type ReportFilters } from "@/features/reports/actions";
import { ExportButton } from "@/features/reports/export-button";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { Pagination } from "@/components/ui/pagination";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { LoadingState } from "@/components/ui/states";

const STATUS_MAP: Record<string, "ontime" | "late" | "early_leave" | "absent" | "needs_review" | "idle"> = {
  present: "ontime",
  late: "late",
  early_leave: "early_leave",
  absent: "absent",
  incomplete: "needs_review",
};

export default function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">Báo cáo chấm công</h1>
      <Suspense fallback={<LoadingState message="Đang tải báo cáo…" />}>
        <ReportsData searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ReportsData({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { profile } = await requireRole(["manager", "hr_admin", "system_admin"]);
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const filters: ReportFilters = {
    from: params.from ?? today.slice(0, 7) + "-01",
    to: params.to ?? today,
    departmentId: params.departmentId || undefined,
    employeeId: params.employeeId || undefined,
    shiftId: params.shiftId || undefined,
    status: params.status || undefined,
    page: Number(params.page ?? "1"),
  };
  const supabase = await createClient();
  const orgId = profile.organization_id ?? "";
  const [{ rows, total, page, message }, stats, { data: departments }, { data: shifts }] = await Promise.all([
    getReport(filters),
    getDashboard(params.date ?? today),
    supabase.from("departments").select("id, name").eq("organization_id", orgId).order("name"),
    supabase.from("work_shifts").select("id, name").eq("organization_id", orgId).order("name"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Nhân sự", value: stats.totalActive },
          { label: "Đã chấm công", value: stats.checkedIn },
          { label: "Đi trễ", value: stats.late },
          { label: "Về sớm", value: stats.earlyLeave },
          { label: "Vắng (có ca)", value: stats.absent },
          { label: "Chờ rà soát", value: stats.pendingReview },
        ].map((c) => (
          <Card key={c.label}>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-sm text-slate-500">{c.label} · {stats.date}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardTitle>Bộ lọc</CardTitle>
        <form method="get" className="mt-2 grid gap-2 sm:grid-cols-6">
          <label className="flex flex-col gap-1 text-sm">Từ ngày<input type="date" name="from" defaultValue={filters.from} className="h-10 rounded-lg border px-2" /></label>
          <label className="flex flex-col gap-1 text-sm">Đến ngày<input type="date" name="to" defaultValue={filters.to} className="h-10 rounded-lg border px-2" /></label>
          <label className="flex flex-col gap-1 text-sm">Phòng ban
            <select name="departmentId" defaultValue={filters.departmentId ?? ""} className="h-10 rounded-lg border px-2">
              <option value="">Tất cả</option>
              {(departments ?? []).map((d) => <option key={d.id as string} value={d.id as string}>{d.name as string}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">Ca
            <select name="shiftId" defaultValue={filters.shiftId ?? ""} className="h-10 rounded-lg border px-2">
              <option value="">Tất cả</option>
              {(shifts ?? []).map((s) => <option key={s.id as string} value={s.id as string}>{s.name as string}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">Trạng thái
            <select name="status" defaultValue={filters.status ?? ""} className="h-10 rounded-lg border px-2">
              <option value="">Tất cả</option>
              {["present", "late", "early_leave", "absent", "incomplete"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" size="sm">Lọc</Button>
            <ExportButton filters={filters} />
          </div>
        </form>
        <p className="mt-2 text-xs text-slate-500">Vắng chỉ kết luận khi nhân viên có phân ca phủ ngày xem. Xuất CSV ghi audit.</p>
      </Card>

      <Card>
        {!rows ? (
          <p role="alert" className="flex items-center gap-1 text-sm text-red-600"><Icon name="x" size={14} /> {message}</p>
        ) : (
          <>
            <DataTable
              ariaLabel="Báo cáo chấm công"
              rows={rows}
              keyOf={(r) => `${r.work_date}-${r.employee_code}`}
              emptyTitle="Không có dữ liệu"
              emptyDescription="Đổi khoảng ngày hoặc bộ lọc."
              columns={[
                { key: "date", header: "Ngày", render: (r) => <span className="tnum">{r.work_date}</span> },
                { key: "emp", header: "Nhân viên", render: (r) => `${r.employee_code} — ${r.display_name}` },
                { key: "dept", header: "Phòng/Ca", render: (r) => `${r.department} / ${r.shift}` },
                {
                  key: "inout",
                  header: "Vào–Ra",
                  render: (r) => (
                    <span className="tnum">
                      {r.first_in ? new Date(r.first_in).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      {" – "}
                      {r.last_out ? new Date(r.last_out).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </span>
                  ),
                },
                {
                  key: "late",
                  header: "Trễ/Sớm",
                  render: (r) => (r.late_min > 0 ? `Trễ ${r.late_min}′` : r.early_leave_min > 0 ? `Sớm ${r.early_leave_min}′` : "—"),
                },
                { key: "status", header: "Trạng thái", render: (r) => <StatusIndicator status={STATUS_MAP[r.status] ?? "idle"} /> },
              ]}
              cardTitle={(r) => `${r.employee_code} — ${r.display_name}`}
              cardStatus={(r) => <StatusIndicator status={STATUS_MAP[r.status] ?? "idle"} />}
              cardMeta={(r) => (
                <span className="tnum">
                  {r.work_date} · {r.department} / {r.shift} · Vào{" "}
                  {r.first_in ? new Date(r.first_in).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                  {" – Ra "}
                  {r.last_out ? new Date(r.last_out).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                </span>
              )}
            />
            <div className="mt-3">
              <Pagination
                page={page ?? 1}
                totalPages={Math.max(1, Math.ceil((total ?? 0) / 20))}
                total={total ?? 0}
                label="dòng"
                hrefFor={(p) =>
                  `?from=${filters.from}&to=${filters.to}` +
                  (filters.departmentId ? `&departmentId=${filters.departmentId}` : "") +
                  (filters.shiftId ? `&shiftId=${filters.shiftId}` : "") +
                  (filters.status ? `&status=${filters.status}` : "") +
                  `&page=${p}`
                }
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
