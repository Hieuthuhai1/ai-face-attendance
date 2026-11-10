import { Suspense } from "react";
import { PageHeader } from "@/components/app/app-shell";
import { connection } from "next/server";
import { getProviderHealth } from "@/server/face/public";
import { getTodayStatus } from "@/features/attendance/actions";
import { requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { LoadingState } from "@/components/ui/states";
import { CheckInClient } from "./check-in-client";

export default function CheckInPage() {
  return (
    <main className="page-shell flex flex-col gap-6">
      <PageHeader
        eyebrow="Điểm danh AI"
        icon="scan-face"
        title="Chấm công"
        description="Xác minh khuôn mặt 1:1 và ghi nhận thời gian vào/ra ca theo giờ máy chủ."
      />
      <Suspense fallback={<LoadingState message="Đang tải trạng thái chấm công…" />}>
        <CheckInData />
      </Suspense>
    </main>
  );
}

async function CheckInData() {
  await connection();
  const [{ profile }, status, health] = await Promise.all([
    requireUser(),
    getTodayStatus(),
    getProviderHealth(),
  ]);

  // Lấy danh tính nhân viên để in trên biên nhận chấm công (mã NV + phòng ban).
  const supabase = await createClient();
  const { data: employee } = await supabase
    .from("employees")
    .select("employee_code, departments(name)")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const employeeRow = employee as
    | { employee_code?: string; departments?: { name?: string } | null }
    | null;

  return (
    <CheckInClient
      status={status}
      providerDemo={health.demo && health.configured}
      showDevControls={process.env.NODE_ENV !== "production"}
      employeeName={profile.display_name}
      employeeCode={employeeRow?.employee_code ?? "—"}
      department={employeeRow?.departments?.name ?? null}
    />
  );
}
