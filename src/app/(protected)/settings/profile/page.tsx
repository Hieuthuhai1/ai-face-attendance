import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";
import { LoadingState } from "@/components/ui/states";
import { ProfileClient, type ProfilePageData } from "@/features/profile/profile-client";

export default function ProfilePage() {
  return (
    <Suspense fallback={<LoadingState message="Đang tải hồ sơ…" />}>
      <ProfileContent />
    </Suspense>
  );
}

async function ProfileContent() {
  const { userId, profile } = await requireUser();
  const supabase = await createClient();

  const { data: employeeRow } = await supabase
    .from("employees")
    .select("employee_code, title, department_id, employment_status, hired_at")
    .eq("profile_id", userId)
    .maybeSingle();

  let departmentName: string | null = null;
  if (employeeRow?.department_id) {
    const { data: department } = await supabase
      .from("departments")
      .select("name")
      .eq("id", employeeRow.department_id)
      .maybeSingle();
    departmentName = department?.name ?? null;
  }

  let organizationName: string | null = null;
  if (profile.organization_id) {
    const { data: organization } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .maybeSingle();
    organizationName = organization?.name ?? null;
  }

  const data: ProfilePageData = {
    profile: {
      displayName: profile.display_name,
      email: profile.email,
      role: profile.role,
      locale: profile.locale,
    },
    employee: employeeRow
      ? {
          employeeCode: employeeRow.employee_code,
          title: employeeRow.title,
          department: departmentName,
          employmentStatus: employeeRow.employment_status,
          hiredAt: employeeRow.hired_at,
        }
      : null,
    organizationName,
  };

  return <ProfileClient {...data} />;
}
