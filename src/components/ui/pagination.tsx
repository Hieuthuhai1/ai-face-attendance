import { Icon } from "./icon";

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
  page: number;
  totalPages: number;
  total: number;
  hrefFor: (page: number) => string;
  label?: string;
}

/** Phân trang link-based (server-component friendly, không JS). */
export function Pagination({ page, totalPages, total, hrefFor, label = "bản ghi" }: PaginationProps) {
  if (totalPages <= 1) {
    return <p className="text-sm text-slate-500">Tổng {total} {label}</p>;
  }
  const btn =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm focus-visible:outline-2";
  return (
    <nav aria-label="Phân trang" className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-slate-500">
        Tổng {total} {label} · trang {page}/{totalPages}
      </p>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <a href={hrefFor(page - 1)} aria-label="Trang trước" className={`${btn} border-slate-300 bg-white`}>
            <Icon name="chevron-left" />
          </a>
        ) : null}
        {pageItems(page, totalPages).map((item, i) =>
          item === "…" ? (
            <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <a
              key={item}
              href={hrefFor(item)}
              aria-label={`Trang ${item}`}
              aria-current={item === page ? "page" : undefined}
              className={`${btn} ${item === page ? "border-[var(--brand)] bg-[var(--brand-soft)] font-semibold" : "border-slate-300 bg-white"}`}
            >
              {item}
            </a>
          ),
        )}
        {page < totalPages ? (
          <a href={hrefFor(page + 1)} aria-label="Trang sau" className={`${btn} border-slate-300 bg-white`}>
            <Icon name="chevron-right" />
          </a>
        ) : null}
      </div>
    </nav>
  );
}
