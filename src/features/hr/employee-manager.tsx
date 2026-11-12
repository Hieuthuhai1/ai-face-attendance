"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DropdownItem, DropdownMenu } from "@/components/ui/dropdown-menu";
import { Icon, type IconName } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { Pagination, type PaginationProps } from "@/components/ui/pagination";
import { ErrorState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { createEmployee, deleteEmployee, updateEmployee } from "@/features/hr/actions";
import { employeeFormSchema } from "@/features/hr/validation";
import { cn } from "@/lib/cn";
import { formatDateOnly } from "@/lib/datetime";

export interface EmployeeRow {
  id: string;
  employee_code: string;
  title: string;
  employment_status: "active" | "inactive" | "terminated";
  department_id: string | null;
  department_name: string;
  manager_id: string | null;
  manager_code: string;
  display_name: string;
  email: string;
  profile_active: boolean;
  hired_at: string | null;
  /** Schema hiện tại chưa có cột phone — giữ null để UI hiển thị trung thực. */
  phone: string | null;
}

interface Props {
  rows: EmployeeRow[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  status: string;
  departmentId: string;
  departments: Array<{ id: string; name: string }>;
  managers: Array<{ id: string; employee_code: string }>;
  freeProfiles: Array<{ id: string; email: string; display_name: string }>;
}

const STATUS_LABELS: Record<EmployeeRow["employment_status"], string> = {
  active: "Đang hoạt động",
  inactive: "Tạm nghỉ",
  terminated: "Đã nghỉ việc",
};

const STATUS_TONE: Record<EmployeeRow["employment_status"], "success" | "warning" | "danger"> = {
  active: "success",
  inactive: "warning",
  terminated: "danger",
};

type EmployeeFormValues = {
  employee_code: string;
  display_name: string;
  department_id: string;
  manager_id: string;
  title: string;
  employment_status: "active" | "inactive" | "terminated";
  hired_at: string | null;
};

type FieldErrors = Partial<Record<keyof EmployeeFormValues | "profile_id", string>>;

const emptyForm: EmployeeFormValues = {
  employee_code: "",
  display_name: "",
  department_id: "",
  manager_id: "",
  title: "",
  employment_status: "active",
  hired_at: null,
};

const CONTROL_CLASS =
  "h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-3.5 text-sm text-[var(--text-1)] shadow-[var(--shadow-xs)] transition-colors placeholder:text-[var(--text-3)] hover:border-[var(--border-strong)] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]";

/* -------------------------------------------------------------------------- */
/* Small building blocks                                                       */
/* -------------------------------------------------------------------------- */

function EmployeePagination({
  baseParams,
  ...rest
}: Omit<PaginationProps, "onPageChange"> & { baseParams: Record<string, string> }) {
  const router = useRouter();

  return (
    <Pagination
      {...rest}
      onPageChange={(nextPage) => {
        const params = new URLSearchParams(baseParams);
        params.set("page", String(nextPage));
        router.push(`?${params.toString()}`);
      }}
    />
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]">
        {label}
      </span>
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
    </label>
  );
}

function FormSelect({
  id,
  label,
  value,
  onChange,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-[var(--text-2)]">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            CONTROL_CLASS,
            "appearance-none pr-9",
            error && "border-[var(--danger)] focus-visible:border-[var(--danger)] focus-visible:ring-red-100",
          )}
        >
          {children}
        </select>
        <Icon
          name="chevron-down"
          size={14}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"
        />
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[12px] font-medium text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono,
  muted,
}: {
  icon: IconName;
  label: string;
  value: ReactNode;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)]/60 px-3 py-2.5">
      <span className="mt-0.5 text-[var(--text-3)]" aria-hidden="true">
        <Icon name={icon} size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]">
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 break-words text-sm font-medium",
            muted ? "text-[var(--text-3)]" : "text-[var(--text-1)]",
            mono && "tnum",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main component                                                              */
/* -------------------------------------------------------------------------- */

export function EmployeeManager(props: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(props.q);

  const [form, setForm] = useState<EmployeeFormValues>(emptyForm);
  const [profileId, setProfileId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [viewing, setViewing] = useState<EmployeeRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<EmployeeRow | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totalPages = Math.max(1, Math.ceil(props.total / props.pageSize));
  const hasFilters = Boolean(
    props.q || props.departmentId || (props.status && props.status !== "all"),
  );

  const baseParams: Record<string, string> = {};
  if (props.q) baseParams.q = props.q;
  if (props.departmentId) baseParams.departmentId = props.departmentId;
  if (props.status && props.status !== "all") baseParams.status = props.status;

  function applyFilters(patch: { q?: string; departmentId?: string; status?: string }) {
    const next = {
      q: patch.q !== undefined ? patch.q : props.q,
      departmentId: patch.departmentId !== undefined ? patch.departmentId : props.departmentId,
      status: patch.status !== undefined ? patch.status : props.status,
    };
    const params = new URLSearchParams();
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.departmentId) params.set("departmentId", next.departmentId);
    if (next.status && next.status !== "all") params.set("status", next.status);
    params.set("page", "1");
    startTransition(() => router.push(`?${params.toString()}`));
  }

  function resetFilters() {
    setSearch("");
    startTransition(() => router.push("?page=1"));
  }

  function openCreate() {
    setForm(emptyForm);
    setProfileId("");
    setFieldErrors({});
    setFormError(null);
    setEditing(null);
    setViewing(null);
    setCreating(true);
  }

  function openEdit(row: EmployeeRow) {
    setForm({
      employee_code: row.employee_code,
      display_name: row.display_name,
      department_id: row.department_id ?? "",
      manager_id: row.manager_id ?? "",
      title: row.title,
      employment_status: row.employment_status,
      hired_at: row.hired_at,
    });
    setProfileId("");
    setFieldErrors({});
    setFormError(null);
    setCreating(false);
    setViewing(null);
    setEditing(row);
  }

  function closeForm() {
    if (saving) return;
    setCreating(false);
    setEditing(null);
    setFieldErrors({});
    setFormError(null);
  }

  function openView(row: EmployeeRow) {
    setViewing(row);
    setEditing(null);
    setCreating(false);
  }

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const payload = {
      employee_code: form.employee_code.trim(),
      display_name: form.display_name.trim(),
      department_id: form.department_id || null,
      manager_id: form.manager_id || null,
      title: form.title.trim(),
      employment_status: form.employment_status,
      hired_at: form.hired_at,
    };

    const parsed = employeeFormSchema.safeParse(payload);
    const nextErrors: FieldErrors = {};

    if (!editing && !profileId) {
      nextErrors.profile_id = "Vui lòng chọn tài khoản đăng nhập.";
    }
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !nextErrors[key as keyof FieldErrors]) {
          nextErrors[key as keyof FieldErrors] = issue.message;
        }
      }
    }

    if (Object.keys(nextErrors).length > 0 || !parsed.success) {
      setFieldErrors(nextErrors);
      return;
    }

    setSaving(true);
    const result = editing
      ? await updateEmployee(editing.id, parsed.data)
      : await createEmployee(profileId, parsed.data);
    setSaving(false);

    if (!result.ok) {
      setFormError(result.message);
      return;
    }

    setCreating(false);
    setEditing(null);
    toast.success(editing ? "Đã cập nhật nhân viên." : "Đã tạo nhân viên mới.");
    router.refresh();
  };

  async function confirmDelete() {
    if (!deleting) return;
    setDeletingLoading(true);
    setListError(null);
    const result = await deleteEmployee(deleting.id);
    setDeletingLoading(false);
    setDeleting(null);
    if (!result.ok) {
      setListError(result.message);
      return;
    }
    toast.success(`Đã vô hiệu hóa ${deleting.employee_code}.`);
    router.refresh();
  }

  function statusBadge(row: EmployeeRow) {
    const effectiveActive = row.employment_status === "active" && row.profile_active;
    const label =
      row.employment_status === "active" && !row.profile_active
        ? "Tài khoản bị khóa"
        : STATUS_LABELS[row.employment_status];
    const tone = effectiveActive
      ? "success"
      : row.employment_status === "active"
        ? "warning"
        : STATUS_TONE[row.employment_status];

    return (
      <Badge tone={tone}>
        <Icon name={effectiveActive ? "check" : row.employment_status === "inactive" ? "clock" : "x"} size={12} />
        {label}
      </Badge>
    );
  }

  function rowActions(row: EmployeeRow) {
    return (
      <DropdownMenu
        align="end"
        trigger={({ open, toggle }) => (
          <IconButton
            icon="more-horizontal"
            label={`Thao tác với ${row.display_name || row.employee_code}`}
            size="sm"
            variant="ghost"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={toggle}
          />
        )}
      >
        <DropdownItem onSelect={() => openView(row)}>
          <Icon name="eye" size={15} /> Xem chi tiết
        </DropdownItem>
        <DropdownItem onSelect={() => openEdit(row)}>
          <Icon name="pencil" size={15} /> Chỉnh sửa
        </DropdownItem>
        {row.employment_status !== "terminated" ? (
          <DropdownItem danger onSelect={() => setDeleting(row)}>
            <Icon name="trash" size={15} /> Xóa nhân viên
          </DropdownItem>
        ) : null}
      </DropdownMenu>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar + filters */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-bold tracking-[-0.015em] text-[var(--navy-900)]">
              Danh sách nhân viên
            </p>
            <p className="mt-0.5 text-[13px] text-[var(--text-2)]">
              {props.total > 0
                ? `${props.total} nhân viên${hasFilters ? " phù hợp bộ lọc" : " trong tổ chức"}`
                : "Chưa có nhân viên nào"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button type="button" onClick={openCreate} disabled={props.freeProfiles.length === 0}>
              <Icon name="plus" size={16} /> Thêm nhân viên
            </Button>
            {props.freeProfiles.length === 0 ? (
              <p className="text-[11px] text-[var(--text-3)]">
                Tất cả tài khoản đã được liên kết.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto] md:items-end">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters({ q: search, departmentId: props.departmentId, status: props.status });
            }}
            className="flex min-w-0 flex-col gap-1.5"
          >
            <label
              htmlFor="employee-search"
              className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]"
            >
              Tìm kiếm
            </label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Icon
                  name="search"
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"
                />
                <input
                  id="employee-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Mã, họ tên, email, chức vụ…"
                  className={cn(CONTROL_CLASS, "pl-9")}
                />
              </div>
              <Button type="submit" variant="secondary">
                Tìm
              </Button>
            </div>
          </form>

          <FilterSelect
            id="employee-department-filter"
            label="Phòng ban"
            value={props.departmentId}
            onChange={(value) =>
              applyFilters({ q: search, departmentId: value, status: props.status })
            }
          >
            <option value="">Tất cả phòng ban</option>
            {props.departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            id="employee-status-filter"
            label="Trạng thái"
            value={props.status || "all"}
            onChange={(value) =>
              applyFilters({ q: search, departmentId: props.departmentId, status: value })
            }
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Tạm nghỉ</option>
            <option value="terminated">Đã nghỉ việc</option>
          </FilterSelect>

          <Button type="button" variant="secondary" onClick={resetFilters} disabled={!hasFilters}>
            <Icon name="refresh" size={15} /> Đặt lại
          </Button>
        </div>
      </Card>

      {listError ? (
        <ErrorState title="Không thực hiện được thao tác" description={listError} />
      ) : null}

      {/* Table */}
      <div
        aria-busy={isPending || undefined}
        className={cn("flex flex-col gap-3 transition-opacity", isPending && "opacity-60")}
      >
        <DataTable
          ariaLabel="Danh sách nhân viên"
          rows={props.rows}
          keyOf={(row) => row.id}
          emptyTitle={hasFilters ? "Không tìm thấy nhân viên phù hợp" : "Chưa có nhân viên"}
          emptyDescription={
            hasFilters
              ? "Thử đổi từ khóa, phòng ban hoặc trạng thái."
              : "Thêm nhân viên đầu tiên để bắt đầu quản lý hồ sơ."
          }
          columns={[
            {
              key: "avatar",
              header: <span className="sr-only">Ảnh</span>,
              className: "w-12",
              render: (row) => <Avatar name={row.display_name || row.email} size="sm" />,
            },
            {
              key: "code",
              header: "Mã NV",
              render: (row) => (
                <span className="tnum whitespace-nowrap font-semibold text-[var(--navy-900)]">
                  {row.employee_code}
                </span>
              ),
            },
            {
              key: "employee",
              header: "Họ và tên",
              render: (row) => (
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--navy-900)]">
                    {row.display_name || "Chưa cập nhật tên"}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--text-3)]">
                    {row.email || "Chưa có email"}
                  </p>
                </div>
              ),
            },
            {
              key: "phone",
              header: "Số điện thoại",
              render: (row) =>
                row.phone ? (
                  <span className="tnum whitespace-nowrap">{row.phone}</span>
                ) : (
                  <span className="whitespace-nowrap text-[12px] text-[var(--text-3)]">
                    Chưa cập nhật
                  </span>
                ),
            },
            {
              key: "department",
              header: "Phòng ban / Chức vụ",
              render: (row) => (
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[var(--text-1)]">
                    {row.department_name}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--text-3)]">
                    {row.title || "Chưa có chức vụ"}
                  </p>
                </div>
              ),
            },
            {
              key: "hired_at",
              header: "Ngày vào làm",
              render: (row) => (
                <span className="tnum whitespace-nowrap text-[13px]">{formatDateOnly(row.hired_at)}</span>
              ),
            },
            {
              key: "status",
              header: "Trạng thái",
              render: statusBadge,
            },
            {
              key: "actions",
              header: <span className="sr-only">Thao tác</span>,
              className: "w-12 text-right",
              render: rowActions,
            },
          ]}
          cardTitle={(row) => (
            <div className="flex items-center gap-3">
              <Avatar name={row.display_name || row.email} size="sm" />
              <div className="min-w-0">
                <p className="truncate">{row.display_name || "Chưa cập nhật tên"}</p>
                <p className="tnum mt-0.5 text-[11px] font-medium text-[var(--text-3)]">
                  {row.employee_code}
                </p>
              </div>
            </div>
          )}
          cardStatus={statusBadge}
          cardMeta={(row) => (
            <div className="grid gap-1 text-[13px]">
              <span className="flex items-center gap-1.5">
                <Icon name="mail" size={13} className="text-[var(--text-3)]" />
                {row.email || "Chưa có email"}
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="phone" size={13} className="text-[var(--text-3)]" />
                {row.phone || "Chưa cập nhật số điện thoại"}
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="building" size={13} className="text-[var(--text-3)]" />
                {row.department_name} · {row.title || "Chưa có chức vụ"}
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="calendar" size={13} className="text-[var(--text-3)]" />
                Vào làm {formatDateOnly(row.hired_at)}
              </span>
            </div>
          )}
          cardActions={(row) => (
            <>
              <Button size="sm" variant="secondary" onClick={() => openView(row)}>
                <Icon name="eye" size={14} /> Xem
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
                <Icon name="pencil" size={14} /> Sửa
              </Button>
              {row.employment_status !== "terminated" ? (
                <Button size="sm" variant="ghost" onClick={() => setDeleting(row)}>
                  <Icon name="trash" size={14} /> Xóa
                </Button>
              ) : null}
            </>
          )}
        />

        <div className="flex justify-end">
          <EmployeePagination
            page={props.page}
            totalPages={totalPages}
            total={props.total}
            label="nhân viên"
            showPageSize={false}
            baseParams={baseParams}
          />
        </div>
      </div>

      {/* Detail modal */}
      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title="Chi tiết nhân viên"
        size="lg"
        bodyClassName="max-h-[70vh]"
        footer={
          viewing ? (
            <>
              <Button variant="secondary" onClick={() => setViewing(null)}>
                Đóng
              </Button>
              <Button
                onClick={() => {
                  const row = viewing;
                  setViewing(null);
                  if (row) openEdit(row);
                }}
              >
                <Icon name="pencil" size={15} /> Chỉnh sửa
              </Button>
            </>
          ) : null
        }
      >
        {viewing ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-4">
              <Avatar name={viewing.display_name || viewing.email} size="xl" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-bold tracking-[-0.02em] text-[var(--navy-900)]">
                  {viewing.display_name || "Chưa cập nhật tên"}
                </h2>
                <p className="tnum mt-0.5 text-[13px] font-medium text-[var(--text-2)]">
                  {viewing.employee_code}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {statusBadge(viewing)}
                  <Badge tone={viewing.profile_active ? "info" : "neutral"}>
                    <Icon name={viewing.profile_active ? "key" : "shield"} size={12} />
                    {viewing.profile_active ? "Tài khoản hoạt động" : "Tài khoản bị khóa"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <InfoRow icon="mail" label="Email" value={viewing.email || "Chưa cập nhật"} muted={!viewing.email} />
              <InfoRow
                icon="phone"
                label="Số điện thoại"
                value={viewing.phone || "Chưa cập nhật"}
                muted={!viewing.phone}
              />
              <InfoRow icon="building" label="Phòng ban" value={viewing.department_name} />
              <InfoRow icon="briefcase" label="Chức vụ" value={viewing.title || "Chưa có chức vụ"} muted={!viewing.title} />
              <InfoRow icon="calendar" label="Ngày vào làm" value={formatDateOnly(viewing.hired_at)} mono />
              <InfoRow
                icon="user-check"
                label="Quản lý trực tiếp"
                value={viewing.manager_code || "Chưa gán"}
                mono
                muted={!viewing.manager_code || viewing.manager_code === "—"}
              />
              <InfoRow icon="id-card" label="Trạng thái làm việc" value={STATUS_LABELS[viewing.employment_status]} />
              <InfoRow
                icon="shield"
                label="Tài khoản đăng nhập"
                value={viewing.profile_active ? "Đang kích hoạt" : "Đã vô hiệu hóa"}
              />
            </div>

            <p className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)]/60 px-3 py-2 text-[12px] leading-relaxed text-[var(--text-2)]">
              <Icon name="info" size={13} className="mr-1 inline-block align-[-2px]" />
              Số điện thoại chưa được lưu trong cơ sở dữ liệu hiện tại. Liên hệ bộ phận kỹ thuật nếu cần bổ sung trường này.
            </p>
          </div>
        ) : null}
      </Modal>

      {/* Create / edit modal */}
      <Modal
        open={creating || editing !== null}
        onClose={closeForm}
        title={editing ? "Chỉnh sửa nhân viên" : "Thêm nhân viên"}
        size="lg"
        bodyClassName="max-h-[68vh]"
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={saving}>
              Hủy
            </Button>
            <Button type="submit" form="employee-form" loading={saving}>
              {editing ? "Lưu thay đổi" : "Tạo nhân viên"}
            </Button>
          </>
        }
      >
        <form id="employee-form" onSubmit={onSave} noValidate className="flex flex-col gap-4">
          {!editing ? (
            <FormSelect
              id="employee-profile"
              label="Tài khoản đăng nhập *"
              value={profileId}
              onChange={(value) => {
                setProfileId(value);
                setFieldErrors({});
              }}
              error={fieldErrors.profile_id}
              required
            >
              <option value="">— Chọn tài khoản —</option>
              {props.freeProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.email}
                  {profile.display_name ? ` (${profile.display_name})` : ""}
                </option>
              ))}
            </FormSelect>
          ) : (
            <div className="flex items-center gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)]/60 px-3 py-2.5">
              <Avatar name={editing.display_name || editing.email} size="sm" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]">
                  Tài khoản đăng nhập
                </p>
                <p className="truncate text-sm font-medium text-[var(--text-1)]">{editing.email}</p>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="employee-code"
              label="Mã nhân viên *"
              value={form.employee_code}
              onChange={(event) => {
                setForm({ ...form, employee_code: event.target.value });
                setFieldErrors({});
              }}
              error={fieldErrors.employee_code}
              placeholder="VD: NV001"
              required
            />
            <Input
              id="employee-name"
              label="Họ và tên *"
              value={form.display_name}
              onChange={(event) => {
                setForm({ ...form, display_name: event.target.value });
                setFieldErrors({});
              }}
              error={fieldErrors.display_name}
              placeholder="Nguyễn Văn A"
              required
            />
            <FormSelect
              id="employee-department"
              label="Phòng ban"
              value={form.department_id}
              onChange={(value) => {
                setForm({ ...form, department_id: value });
                setFieldErrors({});
              }}
              error={fieldErrors.department_id}
            >
              <option value="">— Chưa gán phòng ban —</option>
              {props.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </FormSelect>
            <FormSelect
              id="employee-manager"
              label="Quản lý trực tiếp"
              value={form.manager_id}
              onChange={(value) => {
                setForm({ ...form, manager_id: value });
                setFieldErrors({});
              }}
              error={fieldErrors.manager_id}
            >
              <option value="">— Không có —</option>
              {props.managers
                .filter((manager) => manager.id !== editing?.id)
                .map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.employee_code}
                  </option>
                ))}
            </FormSelect>
            <Input
              id="employee-title"
              label="Chức vụ"
              value={form.title}
              onChange={(event) => {
                setForm({ ...form, title: event.target.value });
                setFieldErrors({});
              }}
              error={fieldErrors.title}
              placeholder="VD: Nhân viên kinh doanh"
            />
            <Input
              id="employee-hired-at"
              label="Ngày vào làm"
              type="date"
              value={form.hired_at || ""}
              onChange={(event) => {
                setForm({ ...form, hired_at: event.target.value || null });
                setFieldErrors({});
              }}
              error={fieldErrors.hired_at}
            />
            <FormSelect
              id="employee-employment-status"
              label="Trạng thái làm việc"
              value={form.employment_status}
              onChange={(value) => {
                setForm({
                  ...form,
                  employment_status: value as EmployeeFormValues["employment_status"],
                });
                setFieldErrors({});
              }}
              error={fieldErrors.employment_status}
            >
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Tạm nghỉ</option>
              <option value="terminated">Đã nghỉ việc</option>
            </FormSelect>
          </div>

          {formError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-[12px] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2.5 text-[13px] font-medium text-[var(--danger-strong)]"
            >
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
              <span>{formError}</span>
            </div>
          ) : null}
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmModal
        open={deleting !== null}
        onClose={() => {
          if (!deletingLoading) setDeleting(null);
        }}
        onConfirm={confirmDelete}
        title="Xóa nhân viên"
        message={
          deleting
            ? `Bạn có chắc muốn xóa ${deleting.display_name || deleting.employee_code} (${deleting.employee_code})? Nhân viên sẽ bị vô hiệu hóa và không thể đăng nhập. Lịch sử chấm công vẫn được giữ lại.`
            : ""
        }
        confirmLabel="Xóa nhân viên"
        cancelLabel="Hủy"
        danger
        loading={deletingLoading}
      />
    </div>
  );
}
