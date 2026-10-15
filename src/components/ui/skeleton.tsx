import { cn } from "@/lib/cn";

/** Khối skeleton hình chữ nhật (tắt shimmer khi reduced-motion). */
export function Skeleton({
  className,
  label = "Đang tải nội dung",
}: {
  className?: string;
  label?: string;
}) {
  return <div role="status" aria-label={label} className={cn("skeleton h-4 w-full", className)} />;
}

/** Skeleton bảng: N dòng đúng số cột, tránh layout shift. */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Đang tải bảng dữ liệu" className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-9" label="" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton thẻ stat/dashboard. */
export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <Skeleton className="h-7 w-16" label="" />
      <Skeleton className="mt-2 h-4 w-24" label="Đang tải thẻ thông tin" />
    </div>
  );
}
