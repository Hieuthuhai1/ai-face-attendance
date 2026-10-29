"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { getFaceProvider } from "@/server/face";
import { PROVIDER_TIMEOUT_MS, withProviderTimeout } from "@/server/face/service";
import { checkRateLimit, ENROLL_SUBMIT_LIMIT, resetRateLimits } from "@/server/rate-limit";
import { logger } from "@/server/logger";
import type { FaceFixture, FaceImageInput } from "@/server/face/types";
import { CONSENT_VERSION } from "@/features/face-enrollment/consent";

/** Trạng thái enrollment mà UI cần biết. */
export type EnrollmentStatus =
  | "pending"
  | "active"
  | "rejected"
  | "revoked"
  | "failed"
  | "needs_review";

export type MyEnrollment =
  | { state: "none" }
  | {
      state: EnrollmentStatus;
      quality: number | null;
      consent_version: string | null;
      /** Lý do thất bại/từ chối (nếu có) — hiển thị cho nhân viên. */
      reason: string | null;
      submitted_at: string | null;
    };

export type EnrollmentResult =
  | { ok: true; status?: "pending" | "active"; message?: string }
  | { ok: false; code: string; message: string };

const MAX_FRAME_CHARS = 700_000; // ~500KB ảnh
const VALID_STATUSES: EnrollmentStatus[] = [
  "pending",
  "active",
  "rejected",
  "revoked",
  "failed",
  "needs_review",
];

type Db = Awaited<ReturnType<typeof createClient>>;

async function audit(
  supabase: Db,
  orgId: string,
  action: string,
  resourceId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("audit_logs").insert({
    organization_id: orgId,
    actor_id: user?.id ?? null,
    action,
    resource_type: "face_enrollment",
    resource_id: resourceId,
    metadata,
  });
  if (error) logger.warn("audit insert failed", { action, code: error.code });
}

interface EmployeeRow {
  id: string;
  organization_id: string;
  employee_code: string;
  employment_status: string;
}

/** Hồ sơ nhân viên của caller (kể cả đã nghỉ — để hiển thị trạng thái). */
async function myEmployee(supabase: Db, userId: string): Promise<EmployeeRow | null> {
  const { data } = await supabase
    .from("employees")
    .select("id, organization_id, employee_code, employment_status")
    .eq("profile_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as EmployeeRow | null) ?? null;
}

/** Nhân viên đang làm việc; tự tạo hồ sơ cho tài khoản OAuth mới. */
async function myActiveEmployee(supabase: Db, userId: string): Promise<EmployeeRow | null> {
  const employee = await myEmployee(supabase, userId);
  if (employee && employee.employment_status === "active") return employee;

  const { error: rpcError } = await supabase.rpc("ensure_self_employee");
  if (rpcError) {
    logger.warn("ensure_self_employee failed", { code: rpcError.code });
    return null;
  }
  const created = await myEmployee(supabase, userId);
  return created && created.employment_status === "active" ? created : null;
}

/** Trạng thái enrollment của chính employee (tối thiểu, không trả subject/template). */
export async function getMyEnrollment(): Promise<MyEnrollment> {
  const { userId } = await requireUser();
  const supabase = await createClient();
  const employee = await myEmployee(supabase, userId);
  if (!employee) return { state: "none" };

  const { data } = await supabase
    .from("face_enrollments")
    .select("status, quality, consent_version, failed_reason, created_at")
    .eq("employee_id", employee.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { state: "none" };
  const status = data.status as string;
  if (!VALID_STATUSES.includes(status as EnrollmentStatus)) return { state: "none" };

  return {
    state: status as EnrollmentStatus,
    quality: (data.quality as number) ?? null,
    consent_version: (data.consent_version as string) ?? null,
    reason: (data.failed_reason as string) ?? null,
    submitted_at: (data.created_at as string) ?? null,
  };
}

/** HR xem trạng thái enrollment của một nhân viên trong scope. */
export async function getEmployeeEnrollment(employeeId: string): Promise<MyEnrollment> {
  const { profile } = await requireRole(["hr_admin", "system_admin"]);
  const supabase = await createClient();

  const { data: employee } = await supabase
    .from("employees")
    .select("id, organization_id")
    .eq("id", employeeId)
    .maybeSingle();
  const emp = employee as { id: string; organization_id: string } | null;
  if (!emp) return { state: "none" };
  if (profile.role === "hr_admin" && emp.organization_id !== profile.organization_id) {
    return { state: "none" };
  }

  const { data } = await supabase
    .from("face_enrollments")
    .select("status, quality, consent_version, failed_reason, created_at")
    .eq("employee_id", emp.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { state: "none" };
  const status = data.status as string;
  if (!VALID_STATUSES.includes(status as EnrollmentStatus)) return { state: "none" };

  return {
    state: status as EnrollmentStatus,
    quality: (data.quality as number) ?? null,
    consent_version: (data.consent_version as string) ?? null,
    reason: (data.failed_reason as string) ?? null,
    submitted_at: (data.created_at as string) ?? null,
  };
}

/** Chuyển frameDataUrl (base64) thành FaceImageInput cho provider. */function frameToImageInput(frameDataUrl: string, fixture?: FaceFixture): FaceImageInput {
  // Mock provider đọc fixture từ chuỗi; provider thật chỉ nhận đúng data URL.
  const data = fixture ? `${frameDataUrl}:${fixture}` : frameDataUrl;
  return { data, mimeType: "image/jpeg" };
}

/** Map provider result code sang enrollment error code. */
function mapEnrollCode(code: string): { code: string; message: string } {
  switch (code) {
    case "poor_image_quality":
      return { code: "QUALITY_RETRY", message: "Ảnh chưa đạt chất lượng. Hãy chụp lại ở nơi đủ sáng, nhìn thẳng camera." };
    case "liveness_failed":
      return { code: "LIVENESS_FAILED", message: "Không xác định được người thật. Hãy thử lại với đủ sáng, nhìn thẳng (không dùng ảnh/màn hình)." };
    case "provider_unavailable":
      return { code: "PROVIDER_UNAVAILABLE", message: "Dịch vụ nhận diện đang bận. Vui lòng thử lại sau ít phút." };
    case "timeout":
      return { code: "PROVIDER_UNAVAILABLE", message: "Dịch vụ nhận diện phản hồi quá lâu. Vui lòng thử lại." };
    case "not_configured":
      return { code: "PROVIDER_NOT_CONFIGURED", message: "Hệ thống nhận diện khuôn mặt chưa được cấu hình. Liên hệ quản trị viên." };
    case "unauthorized":
      return { code: "PROVIDER_UNAUTHORIZED", message: "Dịch vụ nhận diện từ chối thông tin đăng nhập. Liên hệ quản trị viên." };
    case "rate_limited":
      return { code: "RATE_LIMITED", message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút." };
    default:
      return { code: "SUBMIT_FAILED", message: "Không hoàn tất được đăng ký. Vui lòng thử lại." };
  }
}

/** Đọc kết quả RPC dạng bảng (PostgREST trả mảng). */
function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T) ?? null;
  if (data && typeof data === "object") return data as T;
  return null;
}

export async function submitEnrollment(input: {
  frameDataUrl: string;
  consentAccepted: boolean;
  consentVersion: string;
  /** HR đăng ký hộ nhân viên (bỏ trống = tự đăng ký). */
  employeeId?: string;
  /** DEMO local/test: chọn kịch bản mock. Production bỏ qua (dùng ảnh thật). */
  fixture?: FaceFixture;
}): Promise<EnrollmentResult> {
  const { userId, profile } = await requireUser();
  const supabase = await createClient();

  let employee: EmployeeRow | null;
  if (input.employeeId) {
    if (profile.role !== "hr_admin" && profile.role !== "system_admin") {
      return { ok: false, code: "FORBIDDEN", message: "Bạn không có quyền đăng ký khuôn mặt cho nhân viên khác." };
    }
    const { data } = await supabase
      .from("employees")
      .select("id, organization_id, employee_code, employment_status")
      .eq("id", input.employeeId)
      .maybeSingle();
    employee = (data as EmployeeRow | null) ?? null;
    if (!employee || employee.employment_status !== "active") {
      return { ok: false, code: "NOT_ELIGIBLE", message: "Nhân viên không tồn tại hoặc đã ngừng làm việc." };
    }
    if (profile.role === "hr_admin" && employee.organization_id !== profile.organization_id) {
      return { ok: false, code: "FORBIDDEN", message: "Bạn chỉ đăng ký được cho nhân viên trong tổ chức của mình." };
    }
  } else {
    employee = await myActiveEmployee(supabase, userId);
  }

  if (!employee) {
    return { ok: false, code: "NOT_ELIGIBLE", message: "Tài khoản chưa phải nhân viên đang làm việc. Liên hệ HR." };
  }

  const rl = checkRateLimit(`enroll:${userId}:${employee.id}`, ENROLL_SUBMIT_LIMIT.max, ENROLL_SUBMIT_LIMIT.windowMs);
  if (!rl.allowed) {
    return { ok: false, code: "RATE_LIMITED", message: "Bạn gửi quá nhiều lần, vui lòng thử lại sau ít phút." };
  }

  if (!input.consentAccepted || input.consentVersion !== CONSENT_VERSION) {
    return { ok: false, code: "CONSENT_REQUIRED", message: "Bạn cần đọc và đồng ý thông báo xử lý dữ liệu (bản v1)." };
  }

  if (!/^data:image\/(jpeg|png);base64,/.test(input.frameDataUrl) || input.frameDataUrl.length > MAX_FRAME_CHARS) {
    return { ok: false, code: "INVALID_IMAGE", message: "Ảnh không đúng định dạng hoặc quá lớn. Vui lòng chụp lại." };
  }

  const { data: existing } = await supabase
    .from("face_enrollments")
    .select("id")
    .eq("employee_id", employee.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (existing) {
    return { ok: false, code: "ALREADY_ACTIVE", message: "Bạn đã có khuôn mặt đang hoạt động. Hãy thu hồi trước khi đăng ký lại." };
  }

  let provider;
  try {
    provider = getFaceProvider();
  } catch (err) {
    logger.warn("getFaceProvider failed on submitEnrollment", {
      code: err instanceof Error && "code" in err ? String((err as { code: unknown }).code) : "unknown",
    });
    return { ok: false, ...mapEnrollCode("not_configured") };
  }

  const imageInput = frameToImageInput(input.frameDataUrl, provider.isDemo ? input.fixture : undefined);

  // 1) Liveness (bước riêng, chạy trước enroll)
  let livenessResult;
  try {
    livenessResult = await withProviderTimeout(provider.checkLiveness({ image: imageInput }), PROVIDER_TIMEOUT_MS);
  } catch {
    return { ok: false, ...mapEnrollCode("timeout") };
  }
  if (!livenessResult.ok) return { ok: false, ...mapEnrollCode(livenessResult.code) };
  if (livenessResult.data?.status === "fail") {
    return { ok: false, code: "LIVENESS_FAILED", message: "Không xác định được người thật. Hãy thử lại với đủ sáng, nhìn thẳng camera." };
  }
  if (livenessResult.data?.status === "unknown") {
    return { ok: false, code: "QUALITY_RETRY", message: "Ảnh chưa đủ rõ để xác minh. Hãy chụp lại gần hơn, đủ sáng." };
  }

  // 2) Enroll ở provider
  let enrollResult;
  try {
    enrollResult = await withProviderTimeout(
      provider.enrollFace({ employeeId: employee.id, images: [imageInput, imageInput] }),
      PROVIDER_TIMEOUT_MS,
    );
  } catch {
    return { ok: false, ...mapEnrollCode("timeout") };
  }
  if (!enrollResult.ok) return { ok: false, ...mapEnrollCode(enrollResult.code) };

  const subjectId = enrollResult.data!.providerSubjectId;
  const quality = enrollResult.data!.quality;

  // 3) Ghi DB qua RPC SECURITY DEFINER (RLS face_insert chỉ cho 'pending').
  const { data, error } = input.employeeId
    ? await supabase.rpc("hr_submit_face_enrollment", {
        p_employee_id: employee.id,
        p_provider: provider.name,
        p_provider_subject_id: subjectId,
        p_quality: quality,
        p_consent_version: CONSENT_VERSION,
      })
    : await supabase.rpc("submit_my_face_enrollment", {
        p_provider: provider.name,
        p_provider_subject_id: subjectId,
        p_quality: quality,
        p_consent_version: CONSENT_VERSION,
      });

  if (error) {
    // Dọn mẫu vừa tạo ở provider để không bị "mồ côi".
    try {
      await provider.removeEnrollment(subjectId);
    } catch {
      logger.warn("removeEnrollment cleanup failed", {});
    }
    logger.warn("submitEnrollment rpc failed", { code: error.code, message: error.message });
    if (error.code === "PGRST202" || error.code === "42883") {
      return {
        ok: false,
        code: "MIGRATION_REQUIRED",
        message: "Hệ thống chưa được cập nhật cơ sở dữ liệu cho đăng ký khuôn mặt. Liên hệ quản trị viên.",
      };
    }
    if (error.message?.includes("ALREADY_ACTIVE")) {
      return { ok: false, code: "ALREADY_ACTIVE", message: "Bạn đã có khuôn mặt đang hoạt động. Hãy thu hồi trước khi đăng ký lại." };
    }
    if (error.message?.includes("NOT_ELIGIBLE")) {
      return { ok: false, code: "NOT_ELIGIBLE", message: "Tài khoản chưa phải nhân viên đang làm việc. Liên hệ HR." };
    }
    return { ok: false, code: "SUBMIT_FAILED", message: "Không lưu được đăng ký, vui lòng thử lại." };
  }

  const row = firstRow<{ enrollment_id: string; enrollment_status: string }>(data);
  if (!row) {
    try {
      await provider.removeEnrollment(subjectId);
    } catch {
      logger.warn("removeEnrollment cleanup failed", {});
    }
    return { ok: false, code: "SUBMIT_FAILED", message: "Không lưu được đăng ký, vui lòng thử lại." };
  }

  const status = row.enrollment_status === "active" ? "active" : "pending";
  revalidatePath("/enrollment");
  revalidatePath("/admin/enrollments");
  revalidatePath("/check-in");
  return { ok: true, status };
}

export async function approveEnrollment(id: string): Promise<EnrollmentResult> {
  await requireRole(["hr_admin", "system_admin"]);
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("face_enrollments")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, code: "NOT_FOUND", message: "Đăng ký không tồn tại." };
  if ((row as { status: string }).status === "active") {
    return { ok: false, code: "ALREADY_ACTIVE", message: "Đăng ký đã được kích hoạt." };
  }

  const { error } = await supabase.rpc("hr_approve_enrollment", { p_enrollment_id: id, p_quality: null });
  if (error) {
    logger.warn("approveEnrollment failed", { code: error.code, message: error.message });
    if (error.code === "42501") {
      return { ok: false, code: "FORBIDDEN", message: "Bạn không có quyền duyệt đăng ký này." };
    }
    return { ok: false, code: "APPROVE_FAILED", message: "Không duyệt được, vui lòng thử lại." };
  }
  revalidatePath("/admin/enrollments");
  revalidatePath("/enrollment");
  revalidatePath("/check-in");
  return { ok: true, status: "active" };
}

export async function rejectEnrollment(id: string, reason: string): Promise<EnrollmentResult> {
  await requireRole(["hr_admin", "system_admin"]);
  if (!reason.trim()) return { ok: false, code: "REASON_REQUIRED", message: "Vui lòng nhập lý do từ chối." };
  const supabase = await createClient();

  const { error } = await supabase.rpc("hr_reject_enrollment", {
    p_enrollment_id: id,
    p_reason: reason.trim().slice(0, 500),
  });
  if (error) {
    logger.warn("rejectEnrollment failed", { code: error.code, message: error.message });
    if (error.code === "42501") {
      return { ok: false, code: "FORBIDDEN", message: "Bạn không có quyền từ chối đăng ký này." };
    }
    return { ok: false, code: "REJECT_FAILED", message: "Không từ chối được, vui lòng thử lại." };
  }
  revalidatePath("/admin/enrollments");
  revalidatePath("/enrollment");
  return { ok: true, message: "Đã từ chối đăng ký." };
}

/** Employee thu hồi của mình, HR thu hồi bất kỳ (kèm xóa mẫu ở provider). */
export async function revokeEnrollment(id: string): Promise<EnrollmentResult> {
  const { userId, profile } = await requireUser();
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("face_enrollments")
    .select("id, employee_id, provider_subject_id, organization_id, status, employees!inner(profile_id)")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, code: "NOT_FOUND", message: "Đăng ký không tồn tại." };
  const r = row as unknown as {
    employee_id: string;
    provider_subject_id: string | null;
    organization_id: string;
    status: string;
    employees: { profile_id: string } | Array<{ profile_id: string }>;
  };
  if (r.status === "revoked") {
    return { ok: false, code: "ALREADY_REVOKED", message: "Đăng ký đã được thu hồi trước đó." };
  }
  const owner = Array.isArray(r.employees) ? r.employees[0] : r.employees;
  const isOwner = owner?.profile_id === userId;
  const isHr = profile.role === "hr_admin" || profile.role === "system_admin";
  if (!isOwner && !isHr) {
    return { ok: false, code: "FORBIDDEN", message: "Bạn không có quyền thu hồi đăng ký này." };
  }

  try {
    if (r.provider_subject_id) {
      await withProviderTimeout(getFaceProvider().removeEnrollment(r.provider_subject_id), PROVIDER_TIMEOUT_MS);
    }
  } catch {
    // Không chặn thu hồi nếu provider lỗi — DB vẫn phải ghi nhận rút đồng ý.
    logger.warn("removeEnrollment failed on revoke", {});
  }

  const { error } = await supabase
    .from("face_enrollments")
    .update({ status: "revoked", disabled_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    logger.warn("revokeEnrollment update failed", { code: error.code });
    return { ok: false, code: "REVOKE_FAILED", message: "Không thu hồi được, vui lòng thử lại." };
  }
  await audit(supabase, r.organization_id, "enrollment.revoked", id, { by: isHr && !isOwner ? "hr" : "owner" });
  revalidatePath("/enrollment");
  revalidatePath("/admin/enrollments");
  revalidatePath("/check-in");
  return { ok: true, message: "Đã thu hồi mẫu khuôn mặt." };
}

/** Thu hồi enrollment mới nhất của chính caller (không cần biết id ở client). */
export async function revokeMyEnrollment(): Promise<EnrollmentResult> {
  const { userId } = await requireUser();
  const supabase = await createClient();
  const employee = await myEmployee(supabase, userId);
  if (!employee) return { ok: false, code: "NOT_ELIGIBLE", message: "Không tìm thấy hồ sơ nhân viên." };
  const { data } = await supabase
    .from("face_enrollments")
    .select("id")
    .eq("employee_id", employee.id)
    .in("status", ["pending", "active", "needs_review"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { ok: false, code: "NOT_FOUND", message: "Không có đăng ký nào để thu hồi." };
  return revokeEnrollment((data as { id: string }).id);
}

/** HR thu hồi enrollment mới nhất của một nhân viên (theo employeeId). */
export async function revokeEmployeeEnrollment(employeeId: string): Promise<EnrollmentResult> {
  const { profile } = await requireRole(["hr_admin", "system_admin"]);
  const supabase = await createClient();

  const { data: employee } = await supabase
    .from("employees")
    .select("id, organization_id")
    .eq("id", employeeId)
    .maybeSingle();
  const emp = employee as { id: string; organization_id: string } | null;
  if (!emp) return { ok: false, code: "NOT_FOUND", message: "Không tìm thấy nhân viên." };
  if (profile.role === "hr_admin" && emp.organization_id !== profile.organization_id) {
    return { ok: false, code: "FORBIDDEN", message: "Bạn chỉ thu hồi được cho nhân viên trong tổ chức của mình." };
  }

  const { data } = await supabase
    .from("face_enrollments")
    .select("id")
    .eq("employee_id", emp.id)
    .in("status", ["pending", "active", "needs_review"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) {
    return { ok: false, code: "NOT_FOUND", message: "Nhân viên không có đăng ký nào đang hoạt động." };
  }
  return revokeEnrollment((data as { id: string }).id);
}

export async function resetEnrollmentRateLimit(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  resetRateLimits();
}
