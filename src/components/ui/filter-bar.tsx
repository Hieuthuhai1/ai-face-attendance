"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import { Button } from "./button";
import { Select, SelectOption } from "./select";
import { Input } from "./input";
import { DatePicker } from "./calendar";

export interface FilterField {
  key: string;
  label: string;
  type: "select" | "input" | "date" | "daterange" | "multiselect";
  options?: SelectOption[];
  placeholder?: string;
  defaultValue?: string | string[];
  className?: string;
}

export interface FilterBarProps {
  /** Các trường filter */
  fields: FilterField[];
  /** Giá trị hiện tại */
  values: Record<string, string | string[]>;
  /** Callback khi thay đổi */
  onChange: (values: Record<string, string | string[]>) => void;
  /** Callback khi submit (Enter hoặc click nút lọc) */
  onSubmit?: (values: Record<string, string | string[]>) => void;
  /** Loading state */
  loading?: boolean;
  /** Hiển thị dạng collapsed (mobile) */
  collapsed?: boolean;
  /** Class thêm */
  className?: string;
  /** Label nút lọc */
  submitLabel?: string;
  /** Label nút xóa */
  clearLabel?: string;
  /** Hiển thị số filter đang active */
  showActiveCount?: boolean;
}

/** Filter Bar - thanh bộ lọc linh hoạt cho bảng/báo cáo */
export function FilterBar({
  fields,
  values,
  onChange,
  onSubmit,
  loading = false,
  collapsed = false,
  className,
  submitLabel = "Lọc",
  clearLabel = "Xóa lọc",
  showActiveCount = true,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(!collapsed);
  const activeCount = Object.entries(values).filter(([, v]) => v && (Array.isArray(v) ? v.length > 0 : v !== "")).length;

  const handleChange = (key: string, value: string | string[]) => {
    onChange({ ...values, [key]: value });
  };

  const handleClear = () => {
    const cleared = fields.reduce((acc, f) => ({ ...acc, [f.key]: f.defaultValue ?? "" }), {});
    onChange(cleared);
    onSubmit?.(cleared);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSubmit?.(values);
    }
  };

  if (collapsed) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant={activeCount > 0 ? "primary" : "secondary"}
          onClick={() => setExpanded(true)}
          loading={loading}
          disabled={loading}
        >
          <Icon name="filter" size={18} />
          {submitLabel}
          {showActiveCount && activeCount > 0 && (
            <span className="ml-1.5 h-5 min-w-5 rounded-full bg-white text-[var(--brand)] text-[10px] font-medium flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </Button>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <Icon name="x" size={14} /> {clearLabel}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-end gap-2" onKeyDown={handleKeyDown}>
        {fields.map((field) => (
          <div key={field.key} className={cn("flex-1 min-w-[180px]", field.className)}>
            {field.type === "select" && (
              <Select
                label={field.label}
                value={values[field.key] as string}
                onChange={(v) => handleChange(field.key, v)}
                options={field.options ?? []}
                placeholder={field.placeholder}
                disabled={loading}
              />
            )}
            {field.type === "input" && (
              <Input
                label={field.label}
                value={values[field.key] as string}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                disabled={loading}
              />
            )}
            {field.type === "date" && (
              <DatePicker
                label={field.label}
                value={values[field.key] ? new Date(values[field.key] as string) : null}
                onChange={(d) => handleChange(field.key, d?.toISOString().split("T")[0] ?? "")}
                placeholder={field.placeholder}
                disabled={loading}
              />
            )}
            {field.type === "daterange" && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">{field.label}</label>
                <div className="flex gap-2">
                  <DatePicker
                    label="Từ ngày"
                    value={Array.isArray(values[field.key]) ? (values[field.key] as string[])[0] ? new Date((values[field.key] as string[])[0]) : null : null}
                    onChange={(d) => {
                      const current = (values[field.key] as string[]) ?? ["", ""];
                      handleChange(field.key, [d?.toISOString().split("T")[0] ?? "", current[1]]);
                    }}
                    placeholder="Từ ngày"
                    disabled={loading}
                  />
                  <DatePicker
                    label="Đến ngày"
                    value={Array.isArray(values[field.key]) ? (values[field.key] as string[])[1] ? new Date((values[field.key] as string[])[1]) : null : null}
                    onChange={(d) => {
                      const current = (values[field.key] as string[]) ?? ["", ""];
                      handleChange(field.key, [current[0], d?.toISOString().split("T")[0] ?? ""]);
                    }}
                    placeholder="Đến ngày"
                    disabled={loading}
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="flex items-end gap-2">
          <Button onClick={() => onSubmit?.(values)} loading={loading} disabled={loading}>
            <Icon name="filter" size={16} /> {submitLabel}
          </Button>
          {activeCount > 0 && (
            <Button variant="secondary" onClick={handleClear} disabled={loading}>
              <Icon name="x" size={14} /> {clearLabel}
            </Button>
          )}
        </div>
      </div>

      {activeCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Icon name="filter" size={14} className="text-[var(--brand)]" />
          <span>Đang lọc: <span className="font-medium">{activeCount}</span> tiêu chí</span>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            Xóa tất cả
          </Button>
        </div>
      )}
    </div>
  );
}

/** Filter Panel - panel filter dạng sidebar/drawer */
export interface FilterPanelProps {
  fields: FilterField[];
  values: Record<string, string | string[]>;
  onChange: (values: Record<string, string | string[]>) => void;
  onSubmit?: (values: Record<string, string | string[]>) => void;
  onClose: () => void;
  title?: string;
  className?: string;
}

export function FilterPanel({
  fields,
  values,
  onChange,
  onSubmit,
  onClose,
  title = "Bộ lọc",
  className,
}: FilterPanelProps) {
  const activeCount = Object.entries(values).filter(([, v]) => v && (Array.isArray(v) ? v.length > 0 : v !== "")).length;

  const handleChange = (key: string, value: string | string[]) => {
    onChange({ ...values, [key]: value });
  };

  const handleClear = () => {
    const cleared = fields.reduce((acc, f) => ({ ...acc, [f.key]: f.defaultValue ?? "" }), {});
    onChange(cleared);
  };

  return (
    <div className={cn("flex flex-col h-full", className)} role="dialog" aria-label={title}>
      <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white z-10">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Đóng">
          <Icon name="x" size={20} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="text-sm font-medium text-slate-700 mb-1 block">{field.label}</label>
            {field.type === "select" && (
              <Select
                value={values[field.key] as string}
                onChange={(v) => handleChange(field.key, v)}
                options={field.options ?? []}
                placeholder={field.placeholder}
              />
            )}
            {field.type === "input" && (
              <Input
                value={values[field.key] as string}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder}
              />
            )}
            {field.type === "date" && (
              <DatePicker
                label=""
                value={values[field.key] ? new Date(values[field.key] as string) : null}
                onChange={(d) => handleChange(field.key, d?.toISOString().split("T")[0] ?? "")}
                placeholder={field.placeholder}
              />
            )}
          </div>
        ))}

        {activeCount > 0 && (
          <div className="pt-4 border-t border-slate-200">
            <Button variant="secondary" className="w-full" onClick={() => {
              const cleared = fields.reduce((acc, f) => ({ ...acc, [f.key]: f.defaultValue ?? "" }), {});
              onChange(cleared);
            }}>
              <Icon name="x" size={14} /> Xóa tất cả bộ lọc
            </Button>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200 bg-[var(--surface-muted)] sticky bottom-0">
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Đóng
          </Button>
          <Button onClick={() => onSubmit?.(values)} disabled={loading} className="flex-1">
            <Icon name="filter" size={16} /> Áp dụng
          </Button>
        </div>
      </div>
    </div>
  );
}