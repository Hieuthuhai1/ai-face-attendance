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
      <div className="rounded-xl border border-slate-200">
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
        <table aria-label={ariaLabel} className="w-full text-left text-sm">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={`bg-[var(--surface-muted)] px-3 py-2 font-medium text-slate-600 ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={keyOf(row, i)} className="border-t border-slate-100">
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2 align-top ${c.className ?? ""}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: mỗi dòng thành 1 card */}
      <div className="flex flex-col gap-2 md:hidden">
        {rows.map((row, i) => (
          <article
            key={keyOf(row, i)}
            aria-label={typeof cardTitle(row) === "string" ? (cardTitle(row) as string) : undefined}
            className="rounded-xl border border-slate-200 bg-white p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 flex-1 font-medium text-slate-800">{cardTitle(row)}</p>
              {cardStatus ? <div className="shrink-0">{cardStatus(row)}</div> : null}
            </div>
            {cardMeta ? <div className="mt-1 text-sm text-slate-500">{cardMeta(row)}</div> : null}
            {cardActions ? <div className="mt-2 flex flex-wrap gap-1">{cardActions(row)}</div> : null}
          </article>
        ))}
      </div>
    </>
  );
}
