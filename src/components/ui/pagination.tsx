"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import { Input } from "./input";
import { Select, SelectOption } from "./select";

/** Danh sách số trang rút gọn: 1 … 4 5 6 … 12. Thuần túy, test được. */
export function pageItems(page: number, totalPages: number): Array<number | "…"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const set = new Set<number>([1, 2, page - 1, page, page + 1, totalPages - 1, totalPages]);
  const nums = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  let prev = 0;
  for (const n of nums) {
    if (prev > 0 && n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

export interface PaginationProps {
  /** Trang hiện tại (1-based) */
  page: number;
  /** Tổng số trang */
  totalPages: number;
  /** Tổng số bản ghi */
  total: number;
  /** Callback khi chuyển trang */
  onPageChange: (page: number) => void;
  /** Callback khi thay đổi page size */
  onPageSizeChange?: (size: number) => void;
  /** Các page size có sẵn */
  pageSizes?: number[];
  /** Page size hiện tại */
  pageSize?: number;
  /** Label cho total (vd: "dòng", "nhân viên") */
  label?: string;
  /** Hiển thị page size selector */
  showPageSize?: boolean;
  /** Hiển thị jump to page */
  showJump?: boolean;
  /** Class thêm */
  className?: string;
  /** Disabled */
  disabled?: boolean;
  /** Aria label */
  ariaLabel?: string;
}

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

/** Phân trang nâng cao - có page size selector, jump to page */
export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = DEFAULT_PAGE_SIZES,
  pageSize = 20,
  label = "bản ghi",
  showPageSize = true,
  showJump = true,
  className,
  disabled = false,
  ariaLabel = "Phân trang",
}: PaginationProps) {
  const [jumpPage, setJumpPage] = useState("");

  if (totalPages <= 1) {
    return (
      <nav aria-label={ariaLabel} className={cn("flex flex-wrap items-center justify-between gap-2", className)}>
        <p className="text-sm text-slate-500">Tổng {total} {label}</p>
      </nav>
    );
  }

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPage = parseInt(jumpPage, 10);
    if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
      onPageChange(targetPage);
      setJumpPage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleJump(e as unknown as React.FormEvent);
    }
  };

  const btn = "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm focus-visible:outline-2 transition-colors";

  return (
    <nav aria-label={ariaLabel} className={cn("flex flex-wrap items-center justify-between gap-2", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-500">
          Tổng <span className="font-medium tnum">{total}</span> {label} · Trang{" "}
          <span className="font-medium tnum">{page}</span> /{" "}
          <span className="font-medium tnum">{totalPages}</span>
        </p>

        {showPageSize && onPageSizeChange && (
          <div className="flex items-center gap-1">
            <span className="text-sm text-slate-500">Hiển thị</span>
            <Select
              value={String(pageSize)}
              onChange={(v) => onPageSizeChange?.(parseInt(v, 10))}
              options={pageSizes.map((s) => ({ value: String(s), label: String(s) }))}
              placeholder="Size"
              className="w-auto"
              disabled={disabled}
            />
            <span className="text-sm text-slate-500">/ trang</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {page > 1 ? (
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={disabled}
            aria-label="Trang trước"
            className={cn(btn, "border-slate-300 bg-white disabled:opacity-50 disabled:cursor-not-allowed")}
          >
            <Icon name="chevron-left" />
          </button>
        ) : null}

        {page > 1 ? (
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={disabled}
            aria-label="Trang đầu"
            className={cn(btn, "border-slate-300 bg-white disabled:opacity-50 disabled:cursor-not-allowed")}
          >
            <Icon name="chevron-left" />
            <Icon name="chevron-left" />
          </button>
        ) : null}

        {pageItems(page, totalPages).map((item, i) =>
          item === "…" ? (
            <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-slate-400 flex items-center">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              disabled={disabled}
              aria-label={`Trang ${item}`}
              aria-current={item === page ? "page" : undefined}
              className={cn(
                btn,
                item === page
                  ? "border-[var(--brand)] bg-[var(--brand-soft)] font-semibold text-[var(--brand)]"
                  : "border-slate-300 bg-white"
              )}
            >
              {item}
            </button>
          )
        )}

        {page < totalPages ? (
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={disabled}
            aria-label="Trang cuối"
            className={cn(btn, "border-slate-300 bg-white disabled:opacity-50 disabled:cursor-not-allowed")}
          >
            <Icon name="chevron-right" />
            <Icon name="chevron-right" />
          </button>
        ) : null}

        {page < totalPages ? (
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={disabled}
            aria-label="Trang sau"
            className={cn(btn, "border-slate-300 bg-white disabled:opacity-50 disabled:cursor-not-allowed")}
          >
            <Icon name="chevron-right" />
          </button>
        ) : null}

        {showJump && totalPages > 7 && (
          <form onSubmit={handleJump} className="flex items-center gap-1 ml-2">
            <span className="text-sm text-slate-500">Đến</span>
            <input
              type="text"
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={(e) => handleJump(e as unknown as React.FormEvent)}
              className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-sm text-center focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
              aria-label="Nhập số trang"
              placeholder="..."
              disabled={disabled}
            />
            <span className="text-sm text-slate-500">trang</span>
          </form>
        )}
      </div>
    </nav>
  );
}

/** Pagination compact - cho mobile/table */
export interface CompactPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
  className?: string;
}

export function CompactPagination({
  page,
  totalPages,
  total,
  onPageChange,
  label = "bản ghi",
  className,
}: CompactPaginationProps) {
  if (totalPages <= 1) {
    return <p className={cn("text-sm text-slate-500", className)}>Tổng {total} {label}</p>;
  }

  return (
    <nav aria-label="Phân trang" className={cn("flex items-center justify-between gap-2", className)}>
      <p className="text-sm text-slate-500">
        Tổng <span className="tnum font-medium">{total}</span> {label}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Trang trước"
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <span className="px-3 text-sm font-medium tnum">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Trang sau"
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="chevron-right" size={18} />
        </button>
      </div>
    </nav>
  );
}

/** Infinite Scroll Pagination - load more button */
export interface LoadMoreProps {
  /** Có còn dữ liệu không */
  hasMore: boolean;
  /** Đang tải */
  loading: boolean;
  /** Callback tải thêm */
  onLoadMore: () => void;
  /** Label nút */
  label?: string;
  /** Class thêm */
  className?: string;
}

export function LoadMore({ hasMore, loading, onLoadMore, label = "Tải thêm", className }: LoadMoreProps) {
  if (!hasMore) return null;

  return (
    <div className={cn("text-center py-4", className)}>
      <button
        type="button"
        onClick={onLoadMore}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium",
          "hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[var(--brand)]",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        {loading ? (
          <>
            <span className="animate-spin">
              <Icon name="refresh" size={16} />
            </span>
            Đang tải...
          </>
        ) : (
          label
        )}
      </button>
    </div>
  );
}