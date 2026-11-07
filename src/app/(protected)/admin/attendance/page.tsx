import { Suspense } from "react";
import { requireRole } from "@/server/auth";
import { getAttendanceRecords, type AttendanceRecord } from "@/features/attendance/actions";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { formatTimeInZone } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<string, string> = {
  success: "Thành công",
  pending_review: "Chờ xét duyệt",
  failed: "Thất bại",
  fallback: "Phương thức thay thế",
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  success: "success",
  pending_review: "warning",
  failed: "danger",
  fallback: "neutral",
};

const METHOD_LABELS: Record<string, string> = {
  face: "Khuôn mặt",
  pin_fallback: "PIN thay thế",
  manual: "Nhập thủ công",
};

export default function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    month?: string;
    employee_id?: string;
    department_id?: string;
    status?: string;
    page?: string;
  }>;
}) {
  return (
    <main className="page-shell flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Quản lý chấm công</h1>
      <Suspense fallback={<LoadingState message="Đang tải bảng chấm công…" />}>
        <AttendanceData searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AttendanceData({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    month?: string;
    employee_id?: string;
    department_id?: string;
    status?: string;
    page?: string;
  }>;
}) {
  await requireRole(["manager", "hr_admin", "system_admin"]);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const filters = {
    date: params.date ?? undefined,
    month: params.month ?? undefined,
    employee_id: params.employee_id ?? undefined,
    department_id: params.department_id ?? undefined,
    status: params.status ?? undefined,
  };

  const { ok, records, total } = await getAttendanceRecords(filters, page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil((total ?? 0) / PAGE_SIZE));

  if (!ok) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorState title="Không tải được dữ liệu" description="Lỗi khi tải bảng chấm công." />
      </div>
    );
  }

  const rows: AttendanceRecord[] = (records ?? []).map((r) => r);

  return (
    <div className="flex flex-col gap-4">
      {/* Bộ lọc */}
      <Card>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Ngày
              <input
                type="date"
                name="date"
                defaultValue={filters.date ?? ""}
                className="h-10 rounded-lg border border-slate-300 px-3"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Tháng
              <input
                type="month"
                name="month"
                defaultValue={filters.month ?? ""}
                className="h-10 rounded-lg border border-slate-300 px-3"
              />
            </label>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Trạng thái
              <select
                name="status"
                defaultValue={filters.status ?? ""}
                className="h-10 rounded-lg border border-slate-300 px-3 font-normal"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="success">Thành công</option>
                <option value="pending_review">Chờ xét duyệt</option>
                <option value="failed">Thất bại</option>
                <option value="fallback">Phương thức thay thế</option>
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white"
            >
              Lọc
            </button>
            <a
              href="?page=1"
              className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700"
            >
              Đặt lại
            </a>
          </div>
        </form>
      </Card>

      {/* Bảng dữ liệu */}
      <Card>
        <DataTable
          ariaLabel="Bảng chấm công"
          rows={rows}
          keyOf={(r) => r.id}
          emptyTitle="Chưa có bản ghi chấm công"
          emptyDescription="Thử đổi bộ lọc hoặc thêm dữ liệu chấm công."
          columns={[
            {
              key: "employee",
              header: "Nhân viên",
              render: (r) => (
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{r.display_name}</p>
                  <p className="tnum text-[11px] text-slate-500 truncate">{r.employee_code}</p>
                </div>
              ),
            },
            {
              key: "department",
              header: "Phòng ban",
              render: (r) => <span>{r.department_name}</span>,
            },
            {
              key: "title",
              header: "Chức vụ",
              render: (r) => <span className="text-slate-600">{r.title || "—"}</span>,
            },
            {
              key: "date",
              header: "Ngày",
              render: (r) => <span className="tnum">{r.occurred_at.slice(0, 10)}</span>,
            },
            {
              key: "time",
              header: "Vào – Ra",
              render: (r) => {
                const isIn = r.event_type === "check_in";
                const label = isIn ? "Vào" : "Ra";
                return (
                  <span className="tnum text-sm font-medium text-slate-700">
                    {label}
                    {" "}
                    {formatTimeInZone(r.occurred_at)}
                  </span>
                );
              },
            },
            {
              key: "method",
              header: "Phương thức",
              render: (r) => (
                <span className="text-slate-600 text-sm">{METHOD_LABELS[r.method] || r.method}</span>
              ),
            },
            {
              key: "late",
              header: "Trễ / Sớm",
              render: (r) => {
                if (r.late_min > 0) return <span className="tnum text-[var(--warning)]">Trễ {r.late_min}′</span>;
                if (r.early_leave_min > 0)
                  return <span className="tnum text-[var(--info)]">Sớm {r.early_leave_min}′</span>;
                return <span className="tnum text-slate-400">—</span>;
              },
            },
            {
              key: "status",
              header: "Trạng thái",
              render: (r) => (
                <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>
                  <Icon name={r.status === "success" ? "check" : "alert"} size={12} />
                  {STATUS_LABELS[r.status]}
                </Badge>
              ),
            },
          ]}
          cardTitle={(r) => `${r.display_name} · ${r.employee_code}`}
          cardStatus={(r) => (
            <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{STATUS_LABELS[r.status]}</Badge>
          )}
          cardMeta={(r) => (
            <span className="tnum text-sm">
              {r.department_name} · {r.occurred_at.slice(0, 10)} · {formatTimeInZone(r.occurred_at)}
              {r.late_min > 0 ? ` · Trễ ${r.late_min}′` : r.early_leave_min > 0 ? ` · Sớm ${r.early_leave_min}′` : ""}
            </span>
          )}
        />
        {((total ?? 0) > 0) && (
          <div className="mt-3 flex justify-between items-center">
            <span className="text-sm text-slate-500">
              {rows.length} / {(total ?? 0)} bản ghi
            </span>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <a
                  href={`?${new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page: String(page - 1) }).toString()}`}
                  className="text-sm text-[var(--brand)] hover:underline"
                >
                  Trang trước
                </a>
              )}
              <span className="text-sm text-slate-500">Trang {page} / {totalPages}</span>
              {page < totalPages && (
                <a
                  href={`?${new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page: String(page + 1) }).toString()}`}
                  className="text-sm text-[var(--brand)] hover:underline"
                >
                  Trang sau
                </a>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
