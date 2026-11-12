"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

interface Props {
  date: string;
  month: string;
  employeeId: string;
  departmentId: string;
  status: string;
  employees: Array<{ id: string; employee_code: string; display_name: string }>;
  departments: Array<{ id: string; name: string }>;
}

const CONTROL_CLASS =
  "h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-3 text-sm text-[var(--text-1)] shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--border-strong)] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]";

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function SelectControl({
  id,
  value,
  onChange,
  children,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(CONTROL_CLASS, "appearance-none pr-9")}
      >
        {children}
      </select>
      <Icon
        name="chevron-down"
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"
      />
    </div>
  );
}

/** Bộ lọc bảng chấm công: ngày và tháng loại trừ nhau để server không nhận cả hai. */
export function AttendanceFilters({
  date: initialDate,
  month: initialMonth,
  employeeId: initialEmployeeId,
  departmentId: initialDepartmentId,
  status: initialStatus,
  employees,
  departments,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(initialDate);
  const [month, setMonth] = useState(initialMonth);
  const [employeeId, setEmployeeId] = useState(initialEmployeeId);
  const [departmentId, setDepartmentId] = useState(initialDepartmentId);
  const [status, setStatus] = useState(initialStatus);

  const hasFilters = Boolean(date || month || employeeId || departmentId || status);

  function apply(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    else if (month) params.set("month", month);
    if (employeeId) params.set("employee_id", employeeId);
    if (departmentId) params.set("department_id", departmentId);
    if (status) params.set("status", status);
    params.set("page", "1");
    startTransition(() => router.push(`?${params.toString()}`));
  }

  function reset() {
    setDate("");
    setMonth("");
    setEmployeeId("");
    setDepartmentId("");
    setStatus("");
    startTransition(() => router.push("?page=1"));
  }

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={apply} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[15px] font-bold tracking-[-0.015em] text-[var(--navy-900)]">
              Bộ lọc chấm công
            </p>
            <p className="mt-0.5 text-[13px] text-[var(--text-2)]">
              Chọn ngày hoặc tháng (ngày được ưu tiên), kết hợp nhân viên, phòng ban và trạng thái.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" loading={isPending}>
              <Icon name="filter" size={15} /> Lọc
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={reset}
              disabled={isPending || !hasFilters}
            >
              <Icon name="refresh" size={15} /> Đặt lại
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field id="attendance-date" label="Ngày">
            <input
              id="attendance-date"
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                if (event.target.value) setMonth("");
              }}
              className={CONTROL_CLASS}
            />
          </Field>

          <Field id="attendance-month" label="Tháng">
            <input
              id="attendance-month"
              type="month"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                if (event.target.value) setDate("");
              }}
              className={CONTROL_CLASS}
            />
          </Field>

          <Field id="attendance-employee" label="Nhân viên">
            <SelectControl id="attendance-employee" value={employeeId} onChange={setEmployeeId}>
              <option value="">Tất cả nhân viên</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employee_code} — {employee.display_name}
                </option>
              ))}
            </SelectControl>
          </Field>

          <Field id="attendance-department" label="Phòng ban">
            <SelectControl id="attendance-department" value={departmentId} onChange={setDepartmentId}>
              <option value="">Tất cả phòng ban</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </SelectControl>
          </Field>

          <Field id="attendance-status" label="Trạng thái">
            <SelectControl id="attendance-status" value={status} onChange={setStatus}>
              <option value="">Tất cả trạng thái</option>
              <option value="present">Đúng giờ</option>
              <option value="late">Đi muộn</option>
              <option value="early_leave">Về sớm</option>
              <option value="absent">Vắng mặt</option>
              <option value="incomplete">Chưa hoàn tất</option>
            </SelectControl>
          </Field>
        </div>
      </form>
    </Card>
  );
}
