"use client";

import { useState, useRef, useEffect, useMemo, type ReactNode, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import { Button } from "./button";

export interface Column<T> {
  key: string;
  header: ReactNode;
  accessor?: keyof T | ((row: T) => ReactNode);
  render?: (row: T, index: number) => ReactNode;
  width?: string | number;
  minWidth?: string | number;
  maxWidth?: string | number;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  resizable?: boolean;
  frozen?: boolean;
  sticky?: boolean;
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
}

export interface TableProps<T> {
  /** Dữ liệu */
  data: T[];
  /** Các cột */
  columns: Column<T>[];
  /** Key duy nhất cho mỗi row */
  rowKey: keyof T | ((row: T) => string);
  /** Loading state */
  loading?: boolean;
  /** Empty state */
  emptyTitle?: string;
  emptyDescription?: string;
  /** Row selection */
  selectedRows?: Set<string>;
  onRowSelect?: (keys: Set<string>) => void;
  onRowClick?: (row: T, index: number) => void;
  /** Hover highlight */
  hoverable?: boolean;
  /** Striped rows */
  striped?: boolean;
  /** Bordered */
  bordered?: boolean;
  /** Size */
  size?: "sm" | "md" | "lg";
  /** Class thêm */
  className?: string;
  /** Footer */
  footer?: ReactNode;
  /** Row className function */
  rowClassName?: (row: T, index: number) => string;
  /** Expandable rows */
  expandedRows?: Set<string>;
  onRowExpand?: (keys: Set<string>) => void;
  renderExpanded?: (row: T) => ReactNode;
  /** Virtual scrolling (cho dữ liệu lớn) */
  virtualized?: boolean;
  itemHeight?: number;
}

const SIZE_CLASSES = {
  sm: { cell: "px-2 py-1.5 text-xs", header: "px-2 py-1.5 text-xs" },
  md: { cell: "px-3 py-2 text-sm", header: "px-3 py-2 text-sm" },
  lg: { cell: "px-4 py-3 text-base", header: "px-4 py-3 text-base" },
};

/** Table component nâng cao - hỗ trợ sort, resize, frozen columns, expandable rows */
export function Table<T extends Record<string, unknown>>({
  data,
  columns,
  rowKey,
  loading = false,
  emptyTitle = "Không có dữ liệu",
  emptyDescription,
  selectedRows,
  onRowSelect,
  onRowClick,
  hoverable = true,
  striped = false,
  bordered = true,
  size = "md",
  className,
  footer,
  rowClassName,
  expandedRows,
  onRowExpand,
  renderExpanded,
  virtualized = false,
  itemHeight = 50,
}: TableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);

  const sizeClasses = SIZE_CLASSES[size];
  const getRowKey = typeof rowKey === "function" ? rowKey : (row: T) => String(row[rowKey]);

  // Handle column resize
  const handleResizeStart = (e: React.MouseEvent, column: Column<T>) => {
    if (!column.resizable) return;
    e.preventDefault();
    e.stopPropagation();
    const th = e.currentTarget.closest("th");
    if (!th) return;
    setResizingColumn(column.key);
    resizeStartRef.current = { x: e.clientX, width: th.offsetWidth };
  };

  useEffect(() => {
    if (!resizingColumn || !resizeStartRef.current) return;

    const handleMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartRef.current!.x;
      const newWidth = Math.max(resizeStartRef.current!.width + delta, 60);
      setColumnWidths((prev) => ({ ...prev, [resizingColumn]: newWidth }));
    };

    const handleUp = () => {
      setResizingColumn(null);
      resizeStartRef.current = null;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizingColumn]);

  // Handle sort
  const handleSort = (key: string) => {
    const column = columns.find((c) => c.key === key);
    if (!column?.sortable) return;

    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  // Sorted data
  const sortedData = useMemo(() => {
    if (!sortConfig) return data;
    const { key, direction } = sortConfig;
    const column = columns.find((c) => c.key === key);
    if (!column) return data;

    return [...data].sort((a, b) => {
      const accessor = column.accessor;
      let valueA: unknown;
      let valueB: unknown;

      if (typeof accessor === "function") {
        valueA = accessor(a);
        valueB = accessor(b);
      } else if (accessor) {
        valueA = a[accessor];
        valueB = b[accessor];
      } else {
        return 0;
      }

      if (valueA === valueB) return 0;
      if (valueA === null || valueA === undefined) return 1;
      if (valueB === null || valueB === undefined) return -1;

      const comparison = String(valueA).localeCompare(String(valueB), "vi", { numeric: true });
      return direction === "asc" ? comparison : -comparison;
    });
  }, [data, sortConfig, columns]);

  // Handle row selection
  const handleRowSelect = (key: string, e: React.MouseEvent) => {
    if (e.shiftKey && selectedRows && selectedRows.size > 0) {
      // Range selection
      const keys = Array.from(selectedRows);
      const currentIndex = data.findIndex((row) => getRowKey(row) === key);
      const lastIndex = data.findIndex((row) => getRowKey(row) === keys[keys.length - 1]);
      const start = Math.min(currentIndex, lastIndex);
      const end = Math.max(currentIndex, lastIndex);
      const newSelection = new Set(data.slice(start, end + 1).map(getRowKey));
      onRowSelect?.(newSelection);
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle single
      const newSelection = new Set(selectedRows ?? []);
      if (newSelection.has(key)) {
        newSelection.delete(key);
      } else {
        newSelection.add(key);
      }
      onRowSelect?.(newSelection);
    } else {
      // Single select
      onRowSelect?.(new Set(selectedRows?.has(key) ? [] : [key]));
    }
  };

  const handleSelectAll = () => {
    if (selectedRows && selectedRows.size === data.length) {
      onRowSelect?.(new Set());
    } else {
      onRowSelect?.(new Set(data.map(getRowKey)));
    }
  };

  if (loading) {
    return (
      <div className={cn("rounded-xl border border-slate-200", className)}>
        <div className="p-8" role="status" aria-label="Đang tải bảng dữ liệu">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin text-[var(--info)]">
              <Icon name="refresh" size={32} />
            </div>
            <p className="text-sm text-slate-600">Đang tải dữ liệu...</p>
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={cn("rounded-xl border border-slate-200", className)}>
        <div className="p-8 text-center" role="status" aria-label={emptyTitle}>
          <Icon name="inbox" size={32} className="text-slate-300 mx-auto" />
          <p className="mt-2 font-medium text-slate-800">{emptyTitle}</p>
          {emptyDescription && <p className="mt-1 text-sm text-slate-500">{emptyDescription}</p>}
        </div>
      </div>
    );
  }

  // Separate frozen and normal columns
  const frozenColumns = columns.filter((c) => c.frozen);
  const normalColumns = columns.filter((c) => !c.frozen);

  const renderCell = (row: T, index: number, column: Column<T>) => {
    const content = column.render
      ? column.render(row, index)
      : column.accessor
      ? typeof column.accessor === "function"
        ? column.accessor(row)
        : row[column.accessor]
      : null;

    return (
      <td
        className={cn(
          sizeClasses.cell,
          "border-t border-slate-100",
          column.align === "center" && "text-center",
          column.align === "right" && "text-right",
          column.className
        )}
        style={{
          width: columnWidths[column.key],
          minWidth: column.minWidth,
          maxWidth: column.maxWidth,
        } as CSSProperties}
      >
        {content}
      </td>
    );
  };

  const renderHeaderCell = (column: Column<T>) => {
    const isSorted = sortConfig?.key === column.key;
    const width = columnWidths[column.key] ?? column.width;

    return (
      <th
        scope="col"
        className={cn(
          sizeClasses.header,
          "font-medium text-slate-600",
          "bg-[var(--surface-muted)]",
          "border-b border-slate-200",
          "whitespace-nowrap",
          "relative",
          column.sortable && "cursor-pointer select-none hover:bg-slate-100",
          column.resizable && "pr-8",
          column.align === "center" && "text-center",
          column.align === "right" && "text-right",
          column.headerClassName
        )}
        style={{ width, minWidth: column.minWidth, maxWidth: column.maxWidth } as CSSProperties}
        onClick={() => column.sortable && handleSort(column.key)}
      >
        <div className="flex items-center gap-1">
          {column.header}
          {column.sortable && (
            <Icon
              name={isSorted ? (sortConfig.direction === "asc" ? "chevron-up" : "chevron-down") : "chevron-up"}
              size={12}
              className={cn("text-slate-400", isSorted && "text-[var(--brand)]")}
            />
          )}
        </div>
        {column.resizable && (
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-[var(--brand)] opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleResizeStart(e, column)}
          />
        )}
      </th>
    );
  };

  return (
    <div className={cn("rounded-xl border border-slate-200 overflow-hidden", className)}>
      {frozenColumns.length > 0 && (
        <div className="absolute left-0 top-0 bottom-0 z-10 bg-white border-r border-slate-200 shadow-md" style={{ width: frozenColumns.reduce((sum, c) => sum + (columnWidths[c.key] ?? c.width ?? 120), 0) }}>
          <table className="w-full" role="grid">
            <thead>
              <tr>
                {selectedRows !== undefined && (
                  <th
                    scope="col"
                    className={cn(sizeClasses.header, "bg-[var(--surface-muted)]", "border-b border-slate-200", "w-10", "text-center")}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRows.size === data.length && data.length > 0}
                      onChange={handleSelectAll}
                      aria-label="Chọn tất cả"
                      className="h-4 w-4 rounded border-slate-300 text-[var(--brand)] focus:ring-[var(--brand)]"
                    />
                  </th>
                )}
                {frozenColumns.map(renderHeaderCell)}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, index) => {
                const key = getRowKey(row);
                const isSelected = selectedRows?.has(key);
                const isExpanded = expandedRows?.has(key);

                return (
                  <>
                    <tr
                      className={cn(
                        "transition-colors",
                        isSelected && "bg-[var(--brand-soft)]",
                        hoverable && !isSelected && "hover:bg-slate-50",
                        striped && index % 2 === 1 && "bg-slate-50/50",
                        rowClassName?.(row, index)
                      )}
                      onClick={() => onRowClick?.(row, index)}
                      style={{ cursor: onRowClick ? "pointer" : "default" }}
                    >
                      {selectedRows !== undefined && (
                        <td className={cn(sizeClasses.cell, "border-t border-slate-100", "w-10", "text-center")}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleRowSelect(key, { shiftKey: false, ctrlKey: false, metaKey: false } as React.MouseEvent)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Chọn dòng ${index + 1}`}
                            className="h-4 w-4 rounded border-slate-300 text-[var(--brand)] focus:ring-[var(--brand)]"
                          />
                        </td>
                      )}
                      {frozenColumns.map((col) => renderCell(row, index, col))}
                    </tr>
                    {isExpanded && renderExpanded && (
                      <tr className="bg-white">
                        <td colSpan={frozenColumns.length + (selectedRows !== undefined ? 1 : 0)} className="border-t border-slate-200 p-0" />
                        <td colSpan={normalColumns.length} className="border-t border-slate-200 p-4">
                          {renderExpanded(row)}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={cn("overflow-auto", frozenColumns.length > 0 && "ml-[calc(var(--frozen-width))]")}>
        <table className="w-full min-w-max" role="grid">
          <thead>
            <tr>
              {normalColumns.map(renderHeaderCell)}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, index) => {
              const key = getRowKey(row);
              const isSelected = selectedRows?.has(key);
              const isExpanded = expandedRows?.has(key);

              return (
                <>
                  <tr
                    className={cn(
                      "transition-colors",
                      isSelected && "bg-[var(--brand-soft)]",
                      hoverable && !isSelected && "hover:bg-slate-50",
                      striped && index % 2 === 1 && "bg-slate-50/50",
                      rowClassName?.(row, index)
                    )}
                    onClick={() => onRowClick?.(row, index)}
                    style={{ cursor: onRowClick ? "pointer" : "default" }}
                  >
                    {normalColumns.map((col) => renderCell(row, index, col))}
                  </tr>
                  {isExpanded && renderExpanded && (
                    <tr className="bg-white">
                      <td colSpan={normalColumns.length} className="border-t border-slate-200 p-4">
                        {renderExpanded(row)}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {footer && (
        <div className="border-t border-slate-200 bg-[var(--surface-muted)] px-4 py-3">
          {footer}
        </div>
      )}
    </div>
  );
}