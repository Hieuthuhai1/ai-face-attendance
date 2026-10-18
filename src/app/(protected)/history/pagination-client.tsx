"use client";

import { Pagination, type PaginationProps } from "@/components/ui/pagination";
import { useRouter } from "next/navigation";

export function HistoryPagination(props: Omit<PaginationProps, "onPageChange" | "hrefFor"> & {
  baseParams: Record<string, string>;
}) {
  const router = useRouter();

  const onPageChange = (page: number) => {
    const params = new URLSearchParams(props.baseParams);
    params.set("page", String(page));
    router.push(`?${params.toString()}`);
  };

  return <Pagination {...props} onPageChange={onPageChange} />;
}