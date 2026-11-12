import type { ReactNode } from "react";
import { EmptyState } from "./states";

export interface DataColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Array<DataColumn<T>>;
  rows: T[];
  keyOf: (row: T, index: number) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Card mobile: tiêu đề + trạng thái + meta + actions. */
  cardTitle: (row: T) => ReactNode;
  cardStatus?: (row: T) => ReactNode;
  cardMeta?: (row: T) => ReactNode;
  cardActions?: (row: T) => ReactNode;
  ariaLabel?: string;
}

/**
 * Bảng desktop + danh sách card mobile (dưới `md`), cùng một nguồn rows.
 * Không sort phía client — thứ tự do server quyết (giữ nguyên nghiệp vụ).
 */
export function DataTable<T>(props: DataTableProps<T>) {
  const {
    columns,
    rows,
    keyOf,
    emptyTitle = "Chưa có dữ liệu",
    emptyDescription,
    cardTitle,
    cardStatus,
    cardMeta,
    cardActions,
    ariaLabel = "Bảng dữ liệu",
  } = props;

  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <>
      {/* Desktop — chỉ hiển thị khi đủ chỗ (≥1280px) để bảng không bị cắt cột;
          dưới ngưỡng này dùng danh sách card dễ đọc hơn. */}
      <div className="relative hidden overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] xl:block">
        <table aria-label={ariaLabel} className="w-full text-left text-sm">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={`border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)] ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={keyOf(row, i)} className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--brand-soft)]/40">
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3.5 align-middle text-[var(--text-1)] ${c.className ?? ""}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: mỗi dòng thành 1 card */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:hidden">
        {rows.map((row, i) => (
          <article
            key={keyOf(row, i)}
            aria-label={typeof cardTitle(row) === "string" ? (cardTitle(row) as string) : undefined}
            className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 font-semibold text-[var(--navy-900)]">{cardTitle(row)}</div>
              {cardStatus ? <div className="shrink-0">{cardStatus(row)}</div> : null}
            </div>
            {cardMeta ? <div className="mt-1.5 text-sm text-[var(--text-2)]">{cardMeta(row)}</div> : null}
            {cardActions ? <div className="mt-3 flex flex-wrap gap-1.5">{cardActions(row)}</div> : null}
          </article>
        ))}
      </div>
    </>
  );
}
