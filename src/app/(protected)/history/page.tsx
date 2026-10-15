import { Suspense } from "react";
import { requireUser } from "@/server/auth";
import { getPersonalHistory } from "@/features/reports/actions";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { Td, Th, Table } from "@/components/ui/table";
import { LoadingState } from "@/components/ui/states";

const STATUS_MAP: Record<string, "success" | "error" | "pending" | "approved" | "rejected" | "ontime" | "late" | "early_leave" | "absent" | "incomplete" | "needs_review" | "idle" | "loading"> = {
  present: "ontime",
  late: "late",
  early_leave: "early_leave",
  absent: "absent",
  incomplete: "needs_review",
};

export default function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; page?: string }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Lịch sử chấm công</h1>
      <Suspense fallback={<LoadingState message="Đang tải lịch sử…" />}>
        <HistoryData searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function HistoryData({ searchParams }: { searchParams: Promise<{ month?: string; page?: string }> }) {
  await requireUser();
  const params = await searchParams;
  const month = params.month ?? new Date().toISOString().slice(0, 7);
  const { rows, total, page, pageSize } = await getPersonalHistory(month, Number(params.page ?? "1"));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <form method="get" className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Tháng
          <input type="month" name="month" defaultValue={month} className="h-10 rounded-lg border border-slate-300 px-3" />
        </label>
        <button type="submit" className="inline-flex h-10 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white">
          Xem
        </button>
      </form>
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Chưa có bản ghi" description="Tháng này chưa có dữ liệu chấm công." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Ngày</Th>
                <Th>Ca</Th>
                <Th>Vào</Th>
                <Th>Ra</Th>
                <Th>Trễ/Sớm</Th>
                <Th>Trạng thái</Th>
                <Th>Chỉnh công</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.work_date}`}>
                  <Td>{r.work_date}</Td>
                  <Td>{r.shift_name}</Td>
                  <Td>{r.first_in ? new Date(r.first_in).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}</Td>
                  <Td>{r.last_out ? new Date(r.last_out).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}</Td>
                  <Td>{r.late_min > 0 ? `Trễ ${r.late_min}′` : r.early_leave_min > 0 ? `Sớm ${r.early_leave_min}′` : "—"}</Td>
                  <Td><StatusIndicator status={STATUS_MAP[r.status] ?? "idle"} /></Td>
                  <Td>{r.adjustment_status ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <p className="mt-2 text-sm text-slate-500">Tổng {total} ngày · trang {page}/{totalPages}</p>
      </Card>
    </div>
  );
}
