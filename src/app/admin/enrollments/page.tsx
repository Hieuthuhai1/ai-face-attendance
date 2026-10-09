import { Suspense } from "react";
import { requireRole } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { getProviderHealth } from "@/server/face/service";
import { EnrollmentQueue, type EnrollmentQueueRow } from "@/features/face-enrollment/enrollment-queue";
import { LoadingState } from "@/components/ui/states";

export default function EnrollmentsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Xác minh đăng ký khuôn mặt</h1>
      <Suspense fallback={<LoadingState message="Đang tải hàng đợi…" />}>
        <QueueData searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function QueueData({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { profile } = await requireRole(["hr_admin", "system_admin"]);
  const params = await searchParams;
  const filter = params.status === "active" || params.status === "all" ? params.status : "pending";
  const supabase = await createClient();
  const health = getProviderHealth();

  let query = supabase
    .from("face_enrollments")
    .select("id, status, quality, consent_version, created_at, employees!inner(employee_code, organization_id, profiles!employees_profile_id_fkey(display_name))")
    .eq("employees.organization_id", profile.organization_id ?? "")
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter !== "all") query = query.eq("status", filter);
  const { data } = await query;

  const rows: EnrollmentQueueRow[] = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => {
    const emp = r.employees as { employee_code: string; profiles: { display_name: string } | null };
    return {
      id: r.id as string,
      employee_code: emp.employee_code,
      display_name: emp.profiles?.display_name ?? "",
      status: r.status as string,
      quality: (r.quality as number) ?? null,
      consent_version: (r.consent_version as string) ?? null,
      created_at: r.created_at as string,
    };
  });

  return (
    <>
      {!health.configured ? (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          ✕ {health.message}
        </p>
      ) : null}
      <EnrollmentQueue rows={rows} filter={filter} />
    </>
  );
}
