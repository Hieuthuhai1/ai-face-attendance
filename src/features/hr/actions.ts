"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/server/logger";
import {
  assignmentFormSchema,
  employeeFormSchema,
  shiftFormSchema,
  type AssignmentForm,
  type EmployeeForm,
  type ShiftForm,
} from "@/features/hr/validation";

export type ActionResult = { ok: true } | { ok: false; message: string };

const HR = ["hr_admin", "system_admin"] as const;

/** Map lỗi Postgres → thông báo tiếng Việt, không lộ chi tiết nội bộ. */
function mapDbError(code: string | undefined, fallback: string): string {
  switch (code) {
    case "23505":
      return "Mã đã tồn tại trong tổ chức, vui lòng chọn mã khác.";
    case "23P01":
      return "Phân ca bị trùng thời gian với phân ca hiện có của nhân viên.";
    case "23503":
      return "Dữ liệu liên quan không tồn tại hoặc đã bị xóa.";
    case "23514":
      return "Dữ liệu không hợp lệ, vui lòng kiểm tra lại.";
    case "42501":
      return "Bạn không có quyền thực hiện thao tác này.";
    default:
      return fallback;
  }
}

/** Xác minh các id tham chiếu thuộc đúng org của caller (chống id lạ từ client). */
async function assertSameOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  checks: Array<{ table: string; id: string | null; orgColumn?: string }>,
): Promise<string | null> {
  for (const c of checks) {
    if (!c.id) continue;
    const { data, error } = await supabase
      .from(c.table)
      .select(`id, ${c.orgColumn ?? "organization_id"}`)
      .eq("id", c.id)
      .single();
    if (error || !data || (data as unknown as { organization_id: string } | null)?.organization_id !== orgId) {
      return `Dữ liệu tham chiếu không hợp lệ (${c.table}).`;
    }
  }
  return null;
}

// ============================ employees ============================

export async function createEmployee(
  profileId: string,
  input: EmployeeForm,
): Promise<ActionResult> {
  const { profile } = await requireRole([...HR]);
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, message: "Tài khoản chưa thuộc tổ chức nào." };
  const parsed = employeeFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const supabase = await createClient();
  const invalid = await assertSameOrg(supabase, orgId, [
    { table: "profiles", id: profileId, orgColumn: "organization_id" },
    { table: "departments", id: parsed.data.department_id },
    { table: "employees", id: parsed.data.manager_id },
  ]);
  if (invalid) return { ok: false, message: invalid };

  const { error } = await supabase.from("employees").insert({
    organization_id: orgId,
    profile_id: profileId,
    employee_code: parsed.data.employee_code,
    department_id: parsed.data.department_id,
    manager_id: parsed.data.manager_id,
    title: parsed.data.title,
    employment_status: parsed.data.employment_status,
  });
  if (error) {
    logger.warn("createEmployee failed", { code: error.code });
    return { ok: false, message: mapDbError(error.code, "Không tạo được nhân viên.") };
  }
  await supabase.from("profiles").update({ display_name: parsed.data.display_name }).eq("id", profileId);
  revalidatePath("/admin/employees");
  return { ok: true };
}

export async function updateEmployee(id: string, input: EmployeeForm): Promise<ActionResult> {
  const { profile } = await requireRole([...HR]);
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, message: "Tài khoản chưa thuộc tổ chức nào." };
  const parsed = employeeFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const supabase = await createClient();
  const invalid = await assertSameOrg(supabase, orgId, [
    { table: "departments", id: parsed.data.department_id },
    { table: "employees", id: parsed.data.manager_id },
  ]);
  if (invalid) return { ok: false, message: invalid };

  const { data: row, error } = await supabase
    .from("employees")
    .update({
      employee_code: parsed.data.employee_code,
      department_id: parsed.data.department_id,
      manager_id: parsed.data.manager_id,
      title: parsed.data.title,
      employment_status: parsed.data.employment_status,
    })
    .eq("id", id)
    .select("id, profile_id")
    .single();
  if (error || !row) {
    logger.warn("updateEmployee failed", { code: error?.code });
    return { ok: false, message: mapDbError(error?.code, "Không cập nhật được nhân viên.") };
  }
  if (row.profile_id) {
    await supabase.from("profiles").update({ display_name: parsed.data.display_name }).eq("id", row.profile_id);
  }
  revalidatePath("/admin/employees");
  return { ok: true };
}

/** Vô hiệu hóa thay vì xóa cứng — giữ lịch sử chấm công. */
export async function deactivateEmployee(id: string): Promise<ActionResult> {
  const session = await requireRole([...HR]);
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("employees")
    .select("id, profile_id")
    .eq("id", id)
    .single();
  if (!row) return { ok: false, message: "Nhân viên không tồn tại." };
  if (row.profile_id === session.userId) {
    return { ok: false, message: "Không thể vô hiệu hóa chính tài khoản của bạn." };
  }

  const { error } = await supabase
    .from("employees")
    .update({ employment_status: "terminated", terminated_at: new Date().toISOString().slice(0, 10) })
    .eq("id", id);
  if (error) {
    logger.warn("deactivateEmployee failed", { code: error.code });
    return { ok: false, message: mapDbError(error.code, "Không vô hiệu hóa được.") };
  }
  if (row.profile_id) {
    await supabase.from("profiles").update({ is_active: false }).eq("id", row.profile_id);
  }
  revalidatePath("/admin/employees");
  return { ok: true };
}

// ============================ shifts ============================

export async function createShift(input: ShiftForm): Promise<ActionResult> {
  const { profile } = await requireRole([...HR]);
  if (!profile.organization_id) return { ok: false, message: "Tài khoản chưa thuộc tổ chức nào." };
  const parsed = shiftFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const supabase = await createClient();
  const { error } = await supabase.from("work_shifts").insert({
    organization_id: profile.organization_id,
    ...parsed.data,
  });
  if (error) {
    logger.warn("createShift failed", { code: error.code });
    return { ok: false, message: mapDbError(error.code, "Không tạo được ca làm.") };
  }
  revalidatePath("/admin/shifts");
  return { ok: true };
}

export async function updateShift(id: string, input: ShiftForm): Promise<ActionResult> {
  const { profile } = await requireRole([...HR]);
  if (!profile.organization_id) return { ok: false, message: "Tài khoản chưa thuộc tổ chức nào." };
  const parsed = shiftFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("work_shifts")
    .update({ ...parsed.data })
    .eq("id", id)
    .eq("organization_id", profile.organization_id);
  if (error) {
    logger.warn("updateShift failed", { code: error.code });
    return { ok: false, message: mapDbError(error.code, "Không cập nhật được ca làm.") };
  }
  revalidatePath("/admin/shifts");
  return { ok: true };
}

export async function createAssignment(input: AssignmentForm): Promise<ActionResult> {
  const { profile } = await requireRole([...HR]);
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, message: "Tài khoản chưa thuộc tổ chức nào." };
  const parsed = assignmentFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const supabase = await createClient();
  const invalid = await assertSameOrg(supabase, orgId, [
    { table: "employees", id: parsed.data.employee_id },
    { table: "work_shifts", id: parsed.data.shift_id },
  ]);
  if (invalid) return { ok: false, message: invalid };

  const { error } = await supabase.from("shift_assignments").insert({
    organization_id: orgId,
    ...parsed.data,
  });
  if (error) {
    logger.warn("createAssignment failed", { code: error.code });
    return { ok: false, message: mapDbError(error.code, "Không phân ca được.") };
  }
  revalidatePath("/admin/shifts");
  return { ok: true };
}

export async function deleteAssignment(id: string): Promise<ActionResult> {
  const { profile } = await requireRole([...HR]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("shift_assignments")
    .delete()
    .eq("id", id)
    .eq("organization_id", profile.organization_id ?? "");
  if (error) {
    logger.warn("deleteAssignment failed", { code: error.code });
    return { ok: false, message: mapDbError(error.code, "Không xóa phân ca được.") };
  }
  revalidatePath("/admin/shifts");
  return { ok: true };
}
