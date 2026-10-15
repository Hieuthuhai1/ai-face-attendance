import { Suspense } from "react";
import { requireUser } from "@/server/auth";
import { getPersonalHistory } from "@/features/reports/actions";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { StatusIndicator } from "@/components/ui/status-indicator";
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
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6">
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
        <DataTable
          ariaLabel="Lịch sử chấm công"
          rows={rows}
          keyOf={(r) => r.work_date}
          emptyTitle="Chưa có bản ghi"
          emptyDescription="Tháng này chưa có dữ liệu chấm công."
          columns={[
            { key: "date", header: "Ngày", render: (r) => <span className="tnum">{r.work_date}</span> },
            { key: "shift", header: "Ca", render: (r) => r.shift_name },
            {
              key: "inout",
              header: "Vào – Ra",
              render: (r) => (
                <span className="tnum">
                  {r.first_in ? new Date(r.first_in).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                  {" – "}
                  {r.last_out ? new Date(r.last_out).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                </span>
              ),
            },
            {
              key: "late",
              header: "Trễ/Sớm",
              render: (r) => (r.late_min > 0 ? `Trễ ${r.late_min}′` : r.early_leave_min > 0 ? `Sớm ${r.early_leave_min}′` : "—"),
            },
            { key: "status", header: "Trạng thái", render: (r) => <StatusIndicator status={STATUS_MAP[r.status] ?? "idle"} /> },
            { key: "adj", header: "Chỉnh công", render: (r) => r.adjustment_status ?? "—" },
          ]}
          cardTitle={(r) => `${r.work_date} · ${r.shift_name}`}
          cardStatus={(r) => <StatusIndicator status={STATUS_MAP[r.status] ?? "idle"} />}
          cardMeta={(r) => (
            <span className="tnum">
              Vào {r.first_in ? new Date(r.first_in).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
              {" · Ra "}
              {r.last_out ? new Date(r.last_out).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
              {r.late_min > 0 ? ` · Trễ ${r.late_min}′` : r.early_leave_min > 0 ? ` · Sớm ${r.early_leave_min}′` : ""}
              {r.adjustment_status ? ` · Chỉnh công: ${r.adjustment_status}` : ""}
            </span>
          )}
        />
        <div className="mt-3">
          <Pagination page={page} totalPages={totalPages} total={total} label="ngày công" hrefFor={(p) => `?month=${month}&page=${p}`} />
        </div>
      </Card>
    </div>
  );
}
