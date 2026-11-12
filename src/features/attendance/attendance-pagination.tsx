"use client";

import { useRouter } from "next/navigation";
import { Pagination, type PaginationProps } from "@/components/ui/pagination";

/** Pagination cho Server Component: giữ nguyên bộ lọc hiện tại trên URL. */
export function AttendancePagination({
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
