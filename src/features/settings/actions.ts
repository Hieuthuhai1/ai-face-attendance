"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/server/logger";
import { z } from "zod";
import { validateRange } from "@/lib/reports/csv";
import type { Role } from "@/types/db";

const HR = ["hr_admin", "system_admin"] as const satisfies Role[];

export type SettingsResult =
  | { ok: true; data?: unknown }
  | { ok: false; code: string; message: string };

// ============================ Validation Schemas ============================

const attendancePoliciesSchema = z.object({
  grace_in_min: z.number().int().min(0).max(120).default(5),
  grace_out_min: z.number().int().min(0).max(120).default(5),
  rounding_min: z.number().int().min(1).max(60).default(1),
  late_threshold_min: z.number().int().min(0).max(480).default(0),
  early_leave_threshold_min: z.number().int().min(0).max(480).default(0),
  overtime_requires_approval: z.boolean().default(true),
  max_overtime_hours_per_month: z.number().int().min(0).max(200).default(50),
  check_in_methods: z.array(z.enum(["face", "pin_fallback", "manual"])).default(["face", "pin_fallback"]),
});

const faceVerificationSchema = z.object({
  threshold: z.number().min(0).max(1).default(0.7),
  review_band_low: z.number().min(0).max(1).default(0.5),
  provider_timeout_ms: z.number().int().min(1000).max(30000).default(8000),
});

const holidaySchema = z.object({
  name: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải dạng YYYY-MM-DD"),
  is_recurring: z.boolean().default(false),
});

const organizationSchema = z.object({
  name: z.string().min(1).max(100),
  timezone: z.string().min(1).max(50).default("Asia/Ho_Chi_Minh"),
});

const roleUpdateSchema = z.object({
  role: z.enum(["employee", "manager", "hr_admin", "system_admin"]),
});

const profileUpdateSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

// ============================ Helpers ============================

async function audit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("audit_logs").insert({
    organization_id: orgId,
    actor_id: user?.id ?? null,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata,
  });
  if (error) logger.warn("audit insert failed", { action, code: error.code });
}

function mapDbError(code: string | undefined, fallback: string): string {
  switch (code) {
    case "23505":
      return "Dữ liệu đã tồn tại.";
    case "23514":
      return "Dữ liệu không hợp lệ (vi phạm ràng buộc).";
    case "23503":
      return "Dữ liệu tham chiếu không tồn tại.";
    case "42501":
      return "Không có quyền thực hiện.";
    default:
      return fallback;
  }
}

// ============================ Attendance Policies ============================

export async function getAttendancePolicies(): Promise<SettingsResult> {
  const { profile } = await requireRole(HR as Role[]);
  const supabase = await createClient();
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, code: "NO_ORG", message: "Chưa thuộc tổ chức nào." };

  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("organization_id", orgId)
    .eq("key", "attendance_policies")
    .single();

  if (error && error.code !== "PGRST116") {
    logger.warn("getAttendancePolicies failed", { code: error.code });
    return { ok: false, code: "FETCH_FAILED", message: "Không tải được chính sách." };
  }

  const parsed = attendancePoliciesSchema.safeParse(data?.value ?? {});
  return { ok: true, data: parsed.success ? parsed.data : attendancePoliciesSchema.parse({}) };
}

export async function updateAttendancePolicies(input: unknown): Promise<SettingsResult> {
  const { profile } = await requireRole(HR as Role[]);
  const supabase = await createClient();
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, code: "NO_ORG", message: "Chưa thuộc tổ chức nào." };

  const parsed = attendancePoliciesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const { error } = await supabase
    .from("app_settings")
    .upsert({
      organization_id: orgId,
      key: "attendance_policies",
      value: parsed.data,
    }, { onConflict: "organization_id,key" });

  if (error) {
    logger.warn("updateAttendancePolicies failed", { code: error.code });
    return { ok: false, code: "UPDATE_FAILED", message: mapDbError(error.code, "Không cập nhật được chính sách.") };
  }

  await audit(supabase, orgId, "settings.updated", "attendance_policies", "attendance_policies", {
    changes: parsed.data,
    updated_by: profile.role,
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function getFaceVerificationConfig(): Promise<SettingsResult> {
  const { profile } = await requireRole(HR as Role[]);
  const supabase = await createClient();
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, code: "NO_ORG", message: "Chưa thuộc tổ chức nào." };

  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("organization_id", orgId)
    .eq("key", "face_verification")
    .single();

  if (error && error.code !== "PGRST116") {
    logger.warn("getFaceVerificationConfig failed", { code: error.code });
    return { ok: false, code: "FETCH_FAILED", message: "Không tải được cấu hình." };
  }

  const parsed = faceVerificationSchema.safeParse(data?.value ?? {});
  return { ok: true, data: parsed.success ? parsed.data : faceVerificationSchema.parse({}) };
}

export async function updateFaceVerificationConfig(input: unknown): Promise<SettingsResult> {
  const { profile } = await requireRole(HR as Role[]);
  const supabase = await createClient();
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, code: "NO_ORG", message: "Chưa thuộc tổ chức nào." };

  const parsed = faceVerificationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const { error } = await supabase
    .from("app_settings")
    .upsert({
      organization_id: orgId,
      key: "face_verification",
      value: parsed.data,
    }, { onConflict: "organization_id,key" });

  if (error) {
    logger.warn("updateFaceVerificationConfig failed", { code: error.code });
    return { ok: false, code: "UPDATE_FAILED", message: mapDbError(error.code, "Không cập nhật được cấu hình.") };
  }

  await audit(supabase, orgId, "settings.updated", "face_verification", "face_verification", {
    changes: parsed.data,
    updated_by: profile.role,
  });
  revalidatePath("/settings");
  return { ok: true };
}

// ============================ Organization Profile ============================

export async function getOrganizationProfile(): Promise<SettingsResult> {
  const { profile } = await requireRole(HR as Role[]);
  const supabase = await createClient();
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, code: "NO_ORG", message: "Chưa thuộc tổ chức nào." };

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, timezone, is_active")
    .eq("id", orgId)
    .single();

  if (error) {
    logger.warn("getOrganizationProfile failed", { code: error.code });
    return { ok: false, code: "FETCH_FAILED", message: "Không tải được thông tin tổ chức." };
  }

  return { ok: true, data };
}

export async function updateOrganizationProfile(input: unknown): Promise<SettingsResult> {
  const { profile } = await requireRole(HR as Role[]);
  const supabase = await createClient();
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, code: "NO_ORG", message: "Chưa thuộc tổ chức nào." };

  const parsed = organizationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const { error } = await supabase
    .from("organizations")
    .update(parsed.data)
    .eq("id", orgId);

  if (error) {
    logger.warn("updateOrganizationProfile failed", { code: error.code });
    return { ok: false, code: "UPDATE_FAILED", message: mapDbError(error.code, "Không cập nhật được tổ chức.") };
  }

  await audit(supabase, orgId, "settings.updated", "organization", orgId, {
    changes: parsed.data,
    updated_by: profile.role,
  });
  revalidatePath("/settings");
  return { ok: true };
}

// ============================ Holidays ============================

export interface Holiday {
  id: string;
  name: string;
  date: string;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
}

export async function listHolidays(): Promise<SettingsResult> {
  const { profile } = await requireRole(HR as Role[]);
  const supabase = await createClient();
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, code: "NO_ORG", message: "Chưa thuộc tổ chức nào." };

  const { data, error } = await supabase
    .from("holidays")
    .select("id, name, date, is_recurring, created_at, updated_at")
    .eq("organization_id", orgId)
    .order("date", { ascending: true });

  if (error) {
    logger.warn("listHolidays failed", { code: error.code });
    return { ok: false, code: "FETCH_FAILED", message: "Không tải được danh sách ngày lễ." };
  }

  return { ok: true, data: data as Holiday[] };
}

export async function createHoliday(input: unknown): Promise<SettingsResult> {
  const { profile } = await requireRole(HR as Role[]);
  const supabase = await createClient();
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, code: "NO_ORG", message: "Chưa thuộc tổ chức nào." };

  const parsed = holidaySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const { data, error } = await supabase
    .from("holidays")
    .insert({
      organization_id: orgId,
      ...parsed.data,
    })
    .select("id, name, date, is_recurring, created_at, updated_at")
    .single();

  if (error) {
    logger.warn("createHoliday failed", { code: error.code });
    return { ok: false, code: "CREATE_FAILED", message: mapDbError(error.code, "Không tạo được ngày lễ.") };
  }

  await audit(supabase, orgId, "holiday.created", "holiday", (data as Holiday).id, {
    name: (data as Holiday).name,
    date: (data as Holiday).date,
    is_recurring: (data as Holiday).is_recurring,
  });
  revalidatePath("/settings");
  return { ok: true, data };
}

export async function updateHoliday(id: string, input: unknown): Promise<SettingsResult> {
  const { profile } = await requireRole(HR as Role[]);
  const supabase = await createClient();
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, code: "NO_ORG", message: "Chưa thuộc tổ chức nào." };

  const parsed = holidaySchema.partial().safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const { data, error } = await supabase
    .from("holidays")
    .update(parsed.data)
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id, name, date, is_recurring, created_at, updated_at")
    .single();

  if (error) {
    logger.warn("updateHoliday failed", { code: error.code });
    return { ok: false, code: "UPDATE_FAILED", message: mapDbError(error.code, "Không cập nhật được ngày lễ.") };
  }

  await audit(supabase, orgId, "holiday.updated", "holiday", id, {
    changes: parsed.data,
  });
  revalidatePath("/settings");
  return { ok: true, data };
}

export async function deleteHoliday(id: string): Promise<SettingsResult> {
  const { profile } = await requireRole(HR as Role[]);
  const supabase = await createClient();
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, code: "NO_ORG", message: "Chưa thuộc tổ chức nào." };

  const { error } = await supabase
    .from("holidays")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) {
    logger.warn("deleteHoliday failed", { code: error.code });
    return { ok: false, code: "DELETE_FAILED", message: mapDbError(error.code, "Không xóa được ngày lễ.") };
  }

  await audit(supabase, orgId, "holiday.deleted", "holiday", id, {});
  revalidatePath("/settings");
  return { ok: true };
}

// ============================ Roles & Permissions ============================

export interface UserWithRole {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
  employee_code: string | null;
  department: string | null;
  created_at: string;
}

export async function listUsersWithRoles(): Promise<SettingsResult> {
  const { profile } = await requireRole(HR as Role[]);
  const supabase = await createClient();
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, code: "NO_ORG", message: "Chưa thuộc tổ chức nào." };

  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      email,
      display_name,
      role,
      is_active,
      created_at,
      employees!profiles_employees_profile_id_fkey(
        employee_code,
        department_id,
        departments!employees_department_id_fkey(name)
      )
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.warn("listUsersWithRoles failed", { code: error.code });
    return { ok: false, code: "FETCH_FAILED", message: "Không tải được danh sách người dùng." };
  }

  const users = (data ?? []).map((p) => {
    const emp = p.employees as { employee_code: string | null; department_id: string | null; departments: { name: string } | null } | null;
    return {
      id: p.id,
      email: p.email,
      display_name: p.display_name,
      role: p.role,
      is_active: p.is_active,
      employee_code: emp?.employee_code ?? null,
      department: emp?.departments?.name ?? null,
      created_at: p.created_at,
    } as UserWithRole;
  });

  return { ok: true, data: users };
}

export async function updateUserRole(userId: string, input: unknown): Promise<SettingsResult> {
  const { profile } = await requireRole(HR as Role[]);
  const supabase = await createClient();
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, code: "NO_ORG", message: "Chưa thuộc tổ chức nào." };

  const parsed = roleUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  // Kiểm tra user thuộc org này
  const { data: target } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("id", userId)
    .single();

  if (!target || (target as { organization_id: string }).organization_id !== orgId) {
    return { ok: false, code: "NOT_FOUND", message: "Người dùng không tồn tại hoặc không thuộc tổ chức." };
  }

  // Không cho tự hạ quyền mình
  if (target.id === profile.id && parsed.data.role !== profile.role) {
    return { ok: false, code: "FORBIDDEN", message: "Không thể thay đổi quyền của chính mình." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", userId);

  if (error) {
    logger.warn("updateUserRole failed", { code: error.code });
    return { ok: false, code: "UPDATE_FAILED", message: mapDbError(error.code, "Không cập nhật được quyền.") };
  }

  await audit(supabase, orgId, "user.role_updated", "profile", userId, {
    new_role: parsed.data.role,
    updated_by: profile.role,
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateUserProfile(userId: string, input: unknown): Promise<SettingsResult> {
  const { profile } = await requireRole(HR as Role[]);
  const supabase = await createClient();
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, code: "NO_ORG", message: "Chưa thuộc tổ chức nào." };

  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", userId)
    .eq("organization_id", orgId);

  if (error) {
    logger.warn("updateUserProfile failed", { code: error.code });
    return { ok: false, code: "UPDATE_FAILED", message: mapDbError(error.code, "Không cập nhật được hồ sơ.") };
  }

  await audit(supabase, orgId, "user.profile_updated", "profile", userId, {
    changes: parsed.data,
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function toggleUserActive(userId: string): Promise<SettingsResult> {
  const { profile } = await requireRole(HR as Role[]);
  const supabase = await createClient();
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, code: "NO_ORG", message: "Chưa thuộc tổ chức nào." };

  const { data: target } = await supabase
    .from("profiles")
    .select("id, organization_id, is_active")
    .eq("id", userId)
    .single();

  if (!target || (target as { organization_id: string }).organization_id !== orgId) {
    return { ok: false, code: "NOT_FOUND", message: "Người dùng không tồn tại hoặc không thuộc tổ chức." };
  }

  if (target.id === profile.id) {
    return { ok: false, code: "FORBIDDEN", message: "Không thể vô hiệu hóa chính mình." };
  }

  const newActive = !(target as { is_active: boolean }).is_active;
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: newActive })
    .eq("id", userId);

  if (error) {
    logger.warn("toggleUserActive failed", { code: error.code });
    return { ok: false, code: "UPDATE_FAILED", message: mapDbError(error.code, "Không thay đổi được trạng thái.") };
  }

  // Sync employee status
  await supabase
    .from("employees")
    .update({ employment_status: newActive ? "active" : "inactive" })
    .eq("profile_id", userId);

  await audit(supabase, orgId, newActive ? "user.activated" : "user.deactivated", "profile", userId, {});
  revalidatePath("/settings");
  return { ok: true };
}

// ============================ Audit Log Export ============================

export interface AuditLogExportFilters {
  from: string;
  to: string;
  action?: string;
  resource_type?: string;
  actor_id?: string;
}

export async function exportAuditLogs(filters: AuditLogExportFilters): Promise<
  { ok: true; csv: string; filename: string; count: number } | { ok: false; message: string }
> {
  const { userId, profile } = await requireRole(HR as Role[]);
  const supabase = await createClient();
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, message: "Chưa thuộc tổ chức nào." };

  const v = validateRange(filters.from, filters.to);
  if (!v.ok) return { ok: false, message: v.message };

  let q = supabase
    .from("audit_logs")
    .select(
      "id, action, resource_type, resource_id, metadata, created_at, actor:profiles!audit_logs_actor_id_fkey(display_name, email)",
      { count: "exact" }
    )
    .eq("organization_id", orgId)
    .gte("created_at", `${v.from}T00:00:00`)
    .lte("created_at", `${v.to}T23:59:59`);

  if (filters.action) q = q.ilike("action", `%${filters.action}%`);
  if (filters.resource_type) q = q.eq("resource_type", filters.resource_type);
  if (filters.actor_id) q = q.eq("actor_id", filters.actor_id);

  q = q.order("created_at", { ascending: false });
  const { data, count } = await q.limit(5000);

  const rows = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => {
    const actor = r.actor as { display_name?: string; email?: string } | null;
    return [
      (r.id as number).toString(),
      new Date(r.created_at as string).toLocaleString("vi-VN"),
      r.action as string,
      r.resource_type as string,
      (r.resource_id as string) ?? "",
      actor?.display_name ?? actor?.email ?? "hệ thống",
      JSON.stringify(r.metadata ?? {}),
    ];
  });

  const headers = ["ID", "Thời gian", "Hành động", "Loại tài nguyên", "ID tài nguyên", "Người thực hiện", "Metadata"];
  await supabase.from("audit_logs").insert({
    organization_id: orgId,
    actor_id: userId,
    action: "audit.export",
    resource_type: "audit_log",
    resource_id: `${v.from}_${v.to}`,
    metadata: { filters, rows: rows.length, total: count ?? 0 },
  });

  const { toCsv } = await import("@/lib/reports/csv");
  const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  return { ok: true, csv: toCsv(headers, rows), filename: `audit_${v.from}_${v.to}_${stamp}.csv`, count: rows.length };
}