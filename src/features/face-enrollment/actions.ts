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

export type EnrollmentResult = { ok: true } | { ok: false; code: string; message: string };

const MAX_FRAME_CHARS = 700_000; // ~500KB ảnh

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

async function myActiveEmployee(supabase: Db, userId: string) {
  const { data: employee } = await supabase
    .from("employees")
    .select("id, organization_id, employee_code, employment_status")
    .eq("profile_id", userId)
    .single();
  if (!employee || employee.employment_status !== "active") return null;
  return employee as { id: string; organization_id: string; employee_code: string; employment_status: string };
}

/** Trạng thái enrollment của chính employee (tối thiểu, không trả subject/template). */
export async function getMyEnrollment(): Promise<
  | { state: "none" }
  | { state: "pending" | "active" | "rejected" | "revoked"; quality: number | null; consent_version: string | null }
> {
  const { userId } = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("face_enrollments")
    .select("status, quality, consent_version, created_at")
    .eq("employee_id", (await myActiveEmployee(supabase, userId))?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (!data) return { state: "none" };
  const status = data.status as string;
  if (status !== "pending" && status !== "active" && status !== "rejected" && status !== "revoked") {
    return { state: "none" };
  }
  return { state: status, quality: (data.quality as number) ?? null, consent_version: (data.consent_version as string) ?? null };
}

/** Chuyển frameDataUrl (base64) thành FaceImageInput cho provider. */
function frameToImageInput(frameDataUrl: string, fixture?: FaceFixture): FaceImageInput {
  // Nếu là mock với fixture, nhúng fixture vào data để mock provider đọc
  const data = fixture ? `${frameDataUrl}:${fixture}` : frameDataUrl;
  return { data, mimeType: "image/jpeg" };
}

/** Map provider result code sang enrollment error code. */
function mapEnrollCode(code: string): string {
  switch (code) {
    case "success": return "SUBMIT_FAILED"; // không xảy ra ở đây
    case "poor_image_quality": return "QUALITY_RETRY";
    case "liveness_failed": return "LIVENESS_FAILED";
    case "provider_unavailable": return "PROVIDER_UNAVAILABLE";
    case "timeout": return "PROVIDER_UNAVAILABLE";
    default: return "SUBMIT_FAILED";
  }
}

export async function submitEnrollment(input: {
  frameDataUrl: string;
  consentAccepted: boolean;
  consentVersion: string;
  /** DEMO local/test: chọn kịch bản mock. Production bỏ qua (dùng ảnh thật). */
  fixture?: FaceFixture;
}): Promise<EnrollmentResult> {
  const { userId } = await requireUser();
  const supabase = await createClient();
  let employee = await myActiveEmployee(supabase, userId);
  if (!employee) {
    // Tự đăng ký: user chưa có hồ sơ (vd: login Google lần đầu) được tự tạo
    // employee + gán org mặc định; enrollment vẫn pending chờ HR duyệt.
    const { error: rpcError } = await supabase.rpc("ensure_self_employee");
    if (rpcError) {
      logger.warn("ensure_self_employee failed", { code: rpcError.code });
      return { ok: false, code: "NOT_ELIGIBLE", message: "Chưa tạo được hồ sơ nhân viên, liên hệ HR." };
    }
    employee = await myActiveEmployee(supabase, userId);
  }
  if (!employee) {
    return { ok: false, code: "NOT_ELIGIBLE", message: "Tài khoản chưa phải nhân viên đang làm việc." };
  }

  const rl = checkRateLimit(`enroll:${userId}`, ENROLL_SUBMIT_LIMIT.max, ENROLL_SUBMIT_LIMIT.windowMs);
  if (!rl.allowed) {
    return { ok: false, code: "RATE_LIMITED", message: "Bạn gửi quá nhiều lần, vui lòng thử lại sau ít phút." };
  }

  if (!input.consentAccepted || input.consentVersion !== CONSENT_VERSION) {
    return { ok: false, code: "CONSENT_REQUIRED", message: "Bạn cần đọc và đồng ý thông báo xử lý dữ liệu (bản v1)." };
  }

  if (!/^data:image\/(jpeg|png);base64,/.test(input.frameDataUrl) || input.frameDataUrl.length > MAX_FRAME_CHARS) {
    return { ok: false, code: "INVALID_IMAGE", message: "Ảnh không đúng định dạng hoặc quá lớn." };
  }

  const { data: existing } = await supabase
    .from("face_enrollments")
    .select("id")
    .eq("employee_id", employee.id)
    .eq("status", "active")
    .limit(1)
    .single();
  if (existing) {
    return { ok: false, code: "ALREADY_ACTIVE", message: "Bạn đã có enrollment đang hoạt động. Hãy thu hồi trước khi đăng ký lại." };
  }

  const provider = getFaceProvider();
  const imageInput = frameToImageInput(input.frameDataUrl, provider.isDemo ? input.fixture : undefined);

  // Liveness check (bước riêng, chạy trước enroll)
  let livenessResult;
  try {
    livenessResult = await withProviderTimeout(provider.checkLiveness({ image: imageInput }), PROVIDER_TIMEOUT_MS);
  } catch {
    return { ok: false, code: "PROVIDER_UNAVAILABLE", message: "Dịch vụ nhận diện bận, vui lòng thử lại hoặc dùng phương thức thay thế." };
  }
  if (!livenessResult.ok) {
    return { ok: false, code: mapEnrollCode(livenessResult.code), message: livenessResult.message };
  }
  if (livenessResult.data?.status === "fail") {
    return { ok: false, code: "LIVENESS_FAILED", message: "Không xác định được người thật, vui lòng thử lại với đủ sáng, nhìn thẳng." };
  }
  if (livenessResult.data?.status === "unknown") {
    return { ok: false, code: "QUALITY_RETRY", message: "Ảnh chưa đạt chất lượng, vui lòng chụp lại rõ hơn." };
  }

  // Enroll: dùng 2 ảnh (có thể là cùng ảnh lặp lại cho mock; production nên có nhiều ảnh khác nhau)
  let enrollResult;
  try {
    enrollResult = await withProviderTimeout(
      provider.enrollFace({ employeeId: employee.id, images: [imageInput, imageInput] }),
      PROVIDER_TIMEOUT_MS,
    );
  } catch {
    return { ok: false, code: "PROVIDER_UNAVAILABLE", message: "Dịch vụ nhận diện bận, vui lòng thử lại sau." };
  }
  if (!enrollResult.ok) {
    return { ok: false, code: mapEnrollCode(enrollResult.code), message: enrollResult.message };
  }

  const subjectId = enrollResult.data!.providerSubjectId;
  const quality = enrollResult.data!.quality;

  const { data: row, error } = await supabase
    .from("face_enrollments")
    .insert({
      organization_id: employee.organization_id,
      employee_id: employee.id,
      provider: provider.name,
      provider_subject_id: subjectId,
      quality,
      status: "active",
      consent_version: CONSENT_VERSION,
      consent_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !row) {
    logger.warn("submitEnrollment insert failed", { code: error?.code });
    return { ok: false, code: "SUBMIT_FAILED", message: "Không gửi được đăng ký, vui lòng thử lại." };
  }
  await audit(supabase, employee.organization_id, "enrollment.submitted", (row as { id: string }).id, {
    employee_code: employee.employee_code,
    quality,
    auto_approved: true,
  });
  revalidatePath("/enrollment");
  return { ok: true };
}

export async function approveEnrollment(id: string): Promise<EnrollmentResult> {
  const { profile } = await requireRole(["hr_admin", "system_admin"]);
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("face_enrollments")
    .select("id, status, organization_id, employees!inner(employee_code)")
    .eq("id", id)
    .single();
  if (!row) return { ok: false, code: "NOT_FOUND", message: "Đăng ký không tồn tại." };
  if ((row as { status: string }).status === "active") {
    return { ok: false, code: "ALREADY_ACTIVE", message: "Đăng ký đã active." };
  }
  const { error } = await supabase
    .from("face_enrollments")
    .update({ status: "active" })
    .eq("id", id);
  if (error) {
    logger.warn("approveEnrollment failed", { code: error.code });
    return { ok: false, code: "APPROVE_FAILED", message: "Không duyệt được, vui lòng thử lại." };
  }
  const r = row as unknown as { organization_id: string; employees: { employee_code: string } | Array<{ employee_code: string }> };
  const emp = Array.isArray(r.employees) ? r.employees[0] : r.employees;
  await audit(supabase, r.organization_id, "enrollment.approved", id, {
    employee_code: emp?.employee_code ?? "?",
    approved_by_role: profile.role,
  });
  revalidatePath("/admin/enrollments");
  return { ok: true };
}

export async function rejectEnrollment(id: string, reason: string): Promise<EnrollmentResult> {
  await requireRole(["hr_admin", "system_admin"]);
  if (!reason.trim()) return { ok: false, code: "REASON_REQUIRED", message: "Vui lòng nhập lý do từ chối." };
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("face_enrollments")
    .select("id, status, organization_id")
    .eq("id", id)
    .single();
  if (!row) return { ok: false, code: "NOT_FOUND", message: "Đăng ký không tồn tại." };
  const { error } = await supabase.from("face_enrollments").update({ status: "rejected" }).eq("id", id);
  if (error) return { ok: false, code: "REJECT_FAILED", message: "Không từ chối được." };
  const r = row as { organization_id: string };
  await audit(supabase, r.organization_id, "enrollment.rejected", id, { reason: reason.trim() });
  revalidatePath("/admin/enrollments");
  return { ok: true };
}

/** Employee thu hồi của mình, HR thu hồi bất kỳ (kèm deleteSubject ở provider). */
export async function revokeEnrollment(id: string): Promise<EnrollmentResult> {
  const { userId, profile } = await requireUser();
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("face_enrollments")
    .select("id, employee_id, provider_subject_id, organization_id, employees!inner(profile_id)")
    .eq("id", id)
    .single();
  if (!row) return { ok: false, code: "NOT_FOUND", message: "Đăng ký không tồn tại." };
  const r = row as unknown as {
    employee_id: string;
    provider_subject_id: string | null;
    organization_id: string;
    employees: { profile_id: string } | Array<{ profile_id: string }>;
  };
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
    logger.warn("removeEnrollment failed on revoke", {});
  }
  const { error } = await supabase.from("face_enrollments").update({ status: "revoked" }).eq("id", id);
  if (error) return { ok: false, code: "REVOKE_FAILED", message: "Không thu hồi được." };
  await audit(supabase, r.organization_id, "enrollment.revoked", id, { by: isHr && !isOwner ? "hr" : "owner" });
  revalidatePath("/enrollment");
  revalidatePath("/admin/enrollments");
  return { ok: true };
}

/** Thu hồi enrollment mới nhất của chính caller (không cần biết id ở client). */
export async function revokeMyEnrollment(): Promise<EnrollmentResult> {
  const { userId } = await requireUser();
  const supabase = await createClient();
  const employee = await myActiveEmployee(supabase, userId);
  if (!employee) return { ok: false, code: "NOT_ELIGIBLE", message: "Không tìm thấy hồ sơ nhân viên." };
  const { data } = await supabase
    .from("face_enrollments")
    .select("id")
    .eq("employee_id", employee.id)
    .in("status", ["pending", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (!data) return { ok: false, code: "NOT_FOUND", message: "Không có đăng ký nào để thu hồi." };
  return revokeEnrollment((data as { id: string }).id);
}

export async function resetEnrollmentRateLimit(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  resetRateLimits();
}