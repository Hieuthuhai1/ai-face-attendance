import { Suspense } from "react";
import { requireRole } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { LoadingState } from "@/components/ui/states";

const PAGE_SIZE = 30;

function parseMeta(raw: string): Array<[string, string]> {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(obj)
      .slice(0, 4)
      .map(([k, v]) => [k, String(v ?? "—")]);
  } catch {
    return [["raw", raw.slice(0, 120)]];
  }
}

export default function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; from?: string; to?: string; page?: string }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Nhật ký audit</h1>
      <p className="text-sm text-slate-500">
        Chỉ đọc, append-only. Metadata đã tối thiểu hóa — không chứa ảnh, template hay secret.
      </p>
      <Suspense fallback={<LoadingState message="Đang tải audit…" />}>
        <AuditData searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AuditData({ searchParams }: { searchParams: Promise<{ action?: string; from?: string; to?: string; page?: string }> }) {
  const { profile } = await requireRole(["hr_admin", "system_admin"]);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const supabase = await createClient();

  let q = supabase
    .from("audit_logs")
    .select("id, action, resource_type, resource_id, metadata, created_at, actor:profiles!audit_logs_actor_id_fkey(display_name, email)", { count: "exact" })
    .eq("organization_id", profile.organization_id ?? "")
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (params.action) q = q.ilike("action", `%${params.action.replace(/,/g, " ")}%`);
  if (params.from) q = q.gte("created_at", `${params.from}T00:00:00`);
  if (params.to) q = q.lte("created_at", `${params.to}T23:59:59`);
  const { data, count } = await q;

  const rows = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as number,
    action: r.action as string,
    resource: `${r.resource_type as string}:${(r.resource_id as string) ?? "—"}`,
    actor: ((r.actor as { display_name?: string; email?: string } | null)?.display_name)
      || ((r.actor as { email?: string } | null)?.email) || "hệ thống",
    metadata: JSON.stringify(r.metadata ?? {}),
    at: new Date(r.created_at as string).toLocaleString("vi-VN"),
  }));

  return (
    <div className="flex flex-col gap-4">
      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">Hành động<input name="action" defaultValue={params.action ?? ""} placeholder="vd: enrollment, adjustment" className="h-10 rounded-lg border px-2" /></label>
        <label className="flex flex-col gap-1 text-sm">Từ ngày<input type="date" name="from" defaultValue={params.from ?? ""} className="h-10 rounded-lg border px-2" /></label>
        <label className="flex flex-col gap-1 text-sm">Đến ngày<input type="date" name="to" defaultValue={params.to ?? ""} className="h-10 rounded-lg border px-2" /></label>
        <Button type="submit" size="sm" variant="secondary">Lọc</Button>
      </form>
      <Card>
        <DataTable
          ariaLabel="Nhật ký audit"
          rows={rows}
          keyOf={(r) => String(r.id)}
          emptyTitle="Chưa có bản ghi audit"
          emptyDescription="Đổi bộ lọc hoặc thực hiện thao tác quản trị."
          columns={[
            { key: "at", header: "Thời gian", render: (r) => <span className="tnum whitespace-nowrap text-xs">{r.at}</span> },
            { key: "action", header: "Hành động", render: (r) => <span className="font-medium">{r.action}</span> },
            { key: "resource", header: "Đối tượng", render: (r) => <span className="text-xs">{r.resource}</span> },
            { key: "actor", header: "Người thực hiện", render: (r) => r.actor },
            {
              key: "meta",
              header: "Metadata",
              render: (r) => (
                <dl className="grid max-w-64 grid-cols-[auto_1fr] gap-x-2 text-xs">
                  {parseMeta(r.metadata).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="truncate text-slate-400">{k}</dt>
                      <dd className="truncate text-slate-600" title={v}>{v}</dd>
                    </div>
                  ))}
                </dl>
              ),
            },
          ]}
          cardTitle={(r) => r.action}
          cardMeta={(r) => (
            <span className="text-xs">
              {r.at} · {r.resource} · {r.actor}
            </span>
          )}
        />
        <div className="mt-3">
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil((count ?? 0) / 30))}
            total={count ?? 0}
            label="bản ghi"
            hrefFor={(p) =>
              `?page=${p}` +
              (params.action ? `&action=${encodeURIComponent(params.action)}` : "") +
              (params.from ? `&from=${params.from}` : "") +
              (params.to ? `&to=${params.to}` : "")
            }
          />
        </div>
      </Card>
    </div>
  );
}
