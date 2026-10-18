import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { EmployeeDetailClient } from "./employee-detail-client";
import { LoadingState } from "@/components/ui/states";

interface EmployeeDetailProps {
  params: Promise<{ id: string }>;
}

export default function EmployeeDetailPage({ params }: EmployeeDetailProps) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6">
      <Suspense fallback={<LoadingState message="Đang tải chi tiết nhân viên…" />}>
        <EmployeeDetailContentServer params={params} />
      </Suspense>
    </main>
  );
}

async function EmployeeDetailContentServer({ params }: EmployeeDetailProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: employee } = await supabase
    .from("employees")
    .select(`
      id,
      employee_code,
      title,
      employment_status,
      department_id,
      manager_id,
      hired_at,
      terminated_at,
      department:departments(name),
      manager:employees!employees_manager_id_fkey(employee_code),
      profile:profiles!employees_profile_id_fkey(display_name, email, is_active, created_at)
    `)
    .eq("id", id)
    .single();

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9V6a2 2 0 00-2-2H8a2 2 0 00-2 2v7m8 0v5m0-8v8m0 0l-4-4m4 4l4-4m0 0H4a2 2 0 01-2-2v-7a2 2 0 012-2h12a2 2 0 012 2v7" />
        </svg>
        <p className="mt-2 text-slate-500">Không tìm thấy nhân viên</p>
      </div>
    );
  }

  const { data: faceEnrollment } = await supabase
    .from("face_enrollments")
    .select("status, quality, consent_version, created_at, provider")
    .eq("employee_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const { data: attendanceEvents } = await supabase
    .from("attendance_events")
    .select("event_type, status, occurred_at, method, confidence, liveness_status")
    .eq("employee_id", id)
    .order("occurred_at", { ascending: false })
    .limit(20);

  const { data: adjustments } = await supabase
    .from("attendance_adjustment_requests")
    .select("work_date, requested_in, requested_out, reason, status, resolution_note, created_at")
    .eq("employee_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: leaves } = await supabase
    .from("leave_requests")
    .select("id, leave_type, start_date, end_date, reason, status, created_at")
    .eq("employee_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: assignments } = await supabase
    .from("shift_assignments")
    .select("effective_from, effective_to, shift:work_shifts(name, start_time, end_time, overnight, color)")
    .eq("employee_id", id)
    .order("effective_from", { ascending: false })
    .limit(10);

  const data = {
    id,
    employee,
    faceEnrollment,
    attendanceEvents: attendanceEvents || [],
    adjustments: adjustments || [],
    leaves: leaves || [],
    assignments: assignments || [],
  };

  return <EmployeeDetailClient data={data} />;
}