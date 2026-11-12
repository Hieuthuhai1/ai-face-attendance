import { Suspense } from "react";
import { PageHeader } from "@/components/app/app-shell";
import { requireRole } from "@/server/auth";
import {
  getAttendanceDailyRecords,
  type AttendanceDailyRecord,
  type AttendanceDailyStatus,
} from "@/features/attendance/actions";
import { AttendanceFilters } from "@/features/attendance/attendance-filters";
import { AttendancePagination } from "@/features/attendance/attendance-pagination";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Icon, type IconName } from "@/components/ui/icon";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { formatDateOnly, formatDurationMinutes, formatTimeInZone } from "@/lib/datetime";

const PAGE_SIZE = 20;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_LABELS: Record<AttendanceDailyStatus, string> = {
  present: "Đúng giờ",
  late: "Đi muộn",
  early_leave: "Về sớm",
  absent: "Vắng mặt",
  incomplete: "Chưa hoàn tất",
};

const STATUS_TONE: Record<
  AttendanceDailyStatus,
  "success" | "warning" | "info" | "danger" | "neutral"
> = {
  present: "success",
  late: "warning",
  early_leave: "info",
  absent: "danger",
  incomplete: "neutral",
};

const STATUS_ICON: Record<AttendanceDailyStatus, IconName> = {
  present: "check",
  late: "alert",
  early_leave: "clock",
  absent: "x",
  incomplete: "clock",
};

type MethodKey = NonNullable<AttendanceDailyRecord["method"]>;

const METHOD_LABELS: Record<MethodKey, string> = {
  face: "Khuôn mặt",
  pin_fallback: "PIN thay thế",
  manual: "Nhập thủ công",
  mixed: "Kết hợp",
};

const METHOD_ICONS: Record<MethodKey, IconName> = {
  face: "scan-face",
  pin_fallback: "key",
  manual: "file-text",
  mixed: "sparkles",
};

interface AttendanceSearchParams {
  date?: string;
  month?: string;
  employee_id?: string;
  department_id?: string;
  status?: string;
  page?: string;
}

export default function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<AttendanceSearchParams>;
}) {
  return (
    <main className="page-shell flex flex-col gap-6">
      <PageHeader
        title="Quản lý chấm công"
        description="Theo dõi giờ vào/ra, tổng thời gian làm việc và trạng thái chấm công theo từng nhân viên, từng ngày."
      />
      <Suspense fallback={<LoadingState message="Đang tải bảng chấm công…" />}>
        <AttendanceData searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AttendanceData({
  searchParams,
}: {
  searchParams: Promise<AttendanceSearchParams>;
}) {
  await requireRole(["manager", "hr_admin", "system_admin"]);

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const date = DATE_RE.test(params.date ?? "") ? (params.date as string) : "";
  const month = !date && MONTH_RE.test(params.month ?? "") ? (params.month as string) : "";
  const employeeId = UUID_RE.test(params.employee_id ?? "") ? (params.employee_id as string) : "";
  const departmentId = UUID_RE.test(params.department_id ?? "")
    ? (params.department_id as string)
    : "";
  const status =
    params.status && Object.prototype.hasOwnProperty.call(STATUS_LABELS, params.status)
      ? (params.status as AttendanceDailyStatus)
      : "";

  const hasFilters = Boolean(date || month || employeeId || departmentId || status);

  const { ok, records, total, message, employees, departments } = await getAttendanceDailyRecords(
    {
      date: date || undefined,
      month: month || undefined,
      employee_id: employeeId || undefined,
      department_id: departmentId || undefined,
      status: status || undefined,
    },
    page,
    PAGE_SIZE,
  );

  if (!ok) {
    return (
      <ErrorState
        title="Không tải được bảng chấm công"
        description={message ?? "Vui lòng thử lại sau."}
      />
    );
  }

  const rows = records ?? [];
  const totalCount = total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const baseParams: Record<string, string> = {};
  if (date) baseParams.date = date;
  if (month) baseParams.month = month;
  if (employeeId) baseParams.employee_id = employeeId;
  if (departmentId) baseParams.department_id = departmentId;
  if (status) baseParams.status = status;

  return (
    <div className="flex flex-col gap-4">
      <AttendanceFilters
        key={[date, month, employeeId, departmentId, status].join("|")}
        date={date}
        month={month}
        employeeId={employeeId}
        departmentId={departmentId}
        status={status}
        employees={employees ?? []}
        departments={departments ?? []}
      />

      {hasFilters ? (
        <p className="text-[13px] text-[var(--text-2)]">
          Đang hiển thị <span className="font-semibold text-[var(--text-1)]">{totalCount}</span> bản
          ghi phù hợp bộ lọc.
        </p>
      ) : null}

      <DataTable
        ariaLabel="Bảng chấm công theo ngày"
        rows={rows}
        keyOf={(row) => row.id}
        emptyTitle={hasFilters ? "Không có bản ghi phù hợp" : "Chưa có dữ liệu chấm công"}
        emptyDescription={
          hasFilters
            ? "Thử đổi ngày/tháng, nhân viên, phòng ban hoặc trạng thái."
            : "Dữ liệu sẽ xuất hiện sau khi nhân viên chấm công."
        }
        columns={[
          {
            key: "employee",
            header: "Nhân viên",
            render: (row) => (
              <div className="min-w-0">
                <p className="truncate font-semibold text-[var(--navy-900)]">{row.display_name}</p>
                <p className="tnum mt-0.5 truncate text-[12px] text-[var(--text-3)]">
                  {row.employee_code} · {row.department_name}
                </p>
              </div>
            ),
          },
          {
            key: "date",
            header: "Ngày chấm công",
            render: (row) => (
              <div className="min-w-0">
                <p className="tnum whitespace-nowrap font-medium text-[var(--text-1)]">
                  {formatDateOnly(row.work_date)}
                </p>
                <p className="truncate text-[12px] text-[var(--text-3)]">Ca: {row.shift_name}</p>
              </div>
            ),
          },
          {
            key: "check_in",
            header: "Giờ vào",
            render: (row) => (
              <span className="tnum whitespace-nowrap text-[13px] font-medium">
                {row.first_in ? formatTimeInZone(row.first_in) : "—"}
              </span>
            ),
          },
          {
            key: "check_out",
            header: "Giờ ra",
            render: (row) => (
              <span className="tnum whitespace-nowrap text-[13px] font-medium">
                {row.last_out ? formatTimeInZone(row.last_out) : "—"}
              </span>
            ),
          },
          {
            key: "total",
            header: "Tổng thời gian",
            render: (row) => (
              <span className="tnum whitespace-nowrap text-[13px] font-semibold text-[var(--navy-900)]">
                {formatDurationMinutes(row.total_work_min)}
              </span>
            ),
          },
          {
            key: "method",
            header: "Phương thức",
            render: (row) =>
              row.method ? (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-[var(--text-1)]">
                  <Icon name={METHOD_ICONS[row.method]} size={14} className="text-[var(--text-3)]" />
                  {METHOD_LABELS[row.method]}
                </span>
              ) : (
                <span className="whitespace-nowrap text-[12px] text-[var(--text-3)]">Chưa có dữ liệu</span>
              ),
          },
          {
            key: "status",
            header: "Trạng thái",
            render: (row) => (
              <div className="flex flex-col items-start gap-0.5">
                <Badge tone={STATUS_TONE[row.status]}>
                  <Icon name={STATUS_ICON[row.status]} size={12} />
                  {STATUS_LABELS[row.status]}
                </Badge>
                {row.late_min > 0 ? (
                  <span className="tnum text-[11px] font-medium text-[var(--warning-strong)]">
                    Trễ {row.late_min}′
                  </span>
                ) : null}
                {row.early_leave_min > 0 ? (
                  <span className="tnum text-[11px] font-medium text-[var(--info-strong)]">
                    Sớm {row.early_leave_min}′
                  </span>
                ) : null}
              </div>
            ),
          },
        ]}
        cardTitle={(row) => (
          <div className="min-w-0">
            <p className="truncate">{row.display_name}</p>
            <p className="tnum mt-0.5 text-[11px] font-medium text-[var(--text-3)]">
              {row.employee_code}
            </p>
          </div>
        )}
        cardStatus={(row) => (
          <Badge tone={STATUS_TONE[row.status]}>
            <Icon name={STATUS_ICON[row.status]} size={12} />
            {STATUS_LABELS[row.status]}
          </Badge>
        )}
        cardMeta={(row) => (
          <div className="grid gap-1 text-[13px]">
            <span className="flex items-center gap-1.5">
              <Icon name="calendar" size={13} className="text-[var(--text-3)]" />
              {formatDateOnly(row.work_date)} · Ca {row.shift_name}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="clock" size={13} className="text-[var(--text-3)]" />
              Vào {row.first_in ? formatTimeInZone(row.first_in) : "—"} · Ra{" "}
              {row.last_out ? formatTimeInZone(row.last_out) : "—"}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="activity" size={13} className="text-[var(--text-3)]" />
              Tổng {formatDurationMinutes(row.total_work_min)}
              {row.late_min > 0 ? ` · Trễ ${row.late_min}′` : ""}
              {row.early_leave_min > 0 ? ` · Sớm ${row.early_leave_min}′` : ""}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon
                name={row.method ? METHOD_ICONS[row.method] : "scan-face"}
                size={13}
                className="text-[var(--text-3)]"
              />
              {row.method ? METHOD_LABELS[row.method] : "Chưa có phương thức"}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="building" size={13} className="text-[var(--text-3)]" />
              {row.department_name}
            </span>
          </div>
        )}
      />

      <div className="flex justify-end">
        <AttendancePagination
          page={page}
          totalPages={totalPages}
          total={totalCount}
          label="bản ghi"
          showPageSize={false}
          baseParams={baseParams}
        />
      </div>
    </div>
  );
}
