import { Suspense } from "react";
import { requireRole } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/app-shell";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { LoadingState } from "@/components/ui/states";
import { formatDateTimeInZone } from "@/lib/datetime";
import { AuditPagination } from "./pagination-client";

const PAGE_SIZE = 30;

const CONTROL_CLASS =
  "h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-3 text-sm text-[var(--text-1)] shadow-[var(--shadow-xs)] transition-colors placeholder:text-[var(--text-3)] hover:border-[var(--border-strong)] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]";

function parseMeta(raw: string): Array<[string, string]> {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(obj)
      .slice(0, 4)
      .map(([k, v]) => {
        const value =
          v && typeof v === "object" ? JSON.stringify(v) : String(v ?? "—");
        return [k, value];
      });
  } catch {
    return [["raw", raw]];
  }
}

export default function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; from?: string; to?: string; page?: string }>;
}) {
  return (
    <main className="page-shell flex flex-col gap-6">
      <PageHeader
        eyebrow="Quản trị hệ thống"
        icon="shield"
        title="Nhật ký audit"
        description="Chỉ đọc, append-only. Metadata đã tối thiểu hóa — không chứa ảnh, template hay secret."
      />
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
    at: formatDateTimeInZone(r.created_at as string),
  }));

  const hasFilters = Boolean(params.action || params.from || params.to);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-icon)] bg-[var(--brand-soft)] text-[var(--brand)] ring-1 ring-inset ring-blue-100">
              <Icon name="filter" size={17} />
            </span>
            <div>
              <CardTitle>Bộ lọc</CardTitle>
              <p className="mt-0.5 text-[13px] text-[var(--text-2)]">
                Lọc theo loại hành động và khoảng ngày ghi nhận.
              </p>
            </div>
          </div>
          {hasFilters ? (
            <a
              href="/audit"
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border)] bg-white px-3 text-[13px] font-medium text-[var(--text-2)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--navy-800)]"
            >
              <Icon name="refresh" size={14} /> Xóa bộ lọc
            </a>
          ) : null}
        </div>

        <form method="get" className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
          <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-medium text-[var(--text-2)]">
            Hành động
            <input
              name="action"
              defaultValue={params.action ?? ""}
              placeholder="vd: enrollment, adjustment"
              className={CONTROL_CLASS}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-medium text-[var(--text-2)]">
            Từ ngày
            <input type="date" name="from" defaultValue={params.from ?? ""} className={CONTROL_CLASS} />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-medium text-[var(--text-2)]">
            Đến ngày
            <input type="date" name="to" defaultValue={params.to ?? ""} className={CONTROL_CLASS} />
          </label>
          <div className="flex items-end">
            <Button type="submit" size="md" className="h-10">
              <Icon name="search" size={15} /> Lọc
            </Button>
          </div>
        </form>
      </Card>

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
            { key: "resource", header: "Đối tượng", render: (r) => <span className="max-w-56 break-all text-xs text-[var(--text-2)]">{r.resource}</span> },
            { key: "actor", header: "Người thực hiện", render: (r) => <span className="whitespace-nowrap">{r.actor}</span> },
            {
              key: "meta",
              header: "Metadata",
              render: (r) => (
                <dl className="grid w-full max-w-80 grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-xs">
                  {parseMeta(r.metadata).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="truncate text-[var(--text-3)]" title={k}>{k}</dt>
                      <dd className="break-words text-[var(--text-2)]" title={v}>{v}</dd>
                    </div>
                  ))}
                </dl>
              ),
            },
          ]}
          cardTitle={(r) => r.action}
          cardMeta={(r) => (
            <span className="flex flex-col gap-1 text-xs">
              <span className="tnum">{r.at} · {r.actor}</span>
              <span className="break-all text-[var(--text-3)]">{r.resource}</span>
              <span className="break-words text-[var(--text-2)]">
                {parseMeta(r.metadata).map(([k, v]) => `${k}: ${v}`).join(" · ")}
              </span>
            </span>
          )}
        />
        <div className="mt-3">
          <AuditPagination
            page={page}
            totalPages={Math.max(1, Math.ceil((count ?? 0) / 30))}
            total={count ?? 0}
            label="bản ghi"
            baseParams={{
              ...(params.action ? { action: params.action } : {}),
              ...(params.from ? { from: params.from } : {}),
              ...(params.to ? { to: params.to } : {}),
            }}
          />
        </div>
      </Card>
    </div>
  );
}
