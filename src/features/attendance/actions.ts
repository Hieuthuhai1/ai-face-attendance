"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { getFaceProvider } from "@/server/face";
import { PROVIDER_TIMEOUT_MS, withProviderTimeout } from "@/server/face/service";
import { checkRateLimit, VERIFY_LIMIT } from "@/server/rate-limit";
import { APP_TZ, REVIEW_BAND_LOW, VERIFY_THRESHOLD } from "@/config/app";
import { idempotencyKeySchema } from "@/lib/validation";
import { logger } from "@/server/logger";
import type { FaceFixture, FaceImageInput } from "@/server/face/types";
import { decideVerification, resolveShiftFor, wallDateString } from "@/server/attendance/decision";
import { minutesEarlyLeave, minutesLate, wallMinutes, zonedStartOfDayIso } from "@/lib/attendance/rules";
import { monthRange } from "@/lib/reports/csv";

/** Error classification for UI handling */
export type ErrorCategory = "retryable" | "permanent" | "configuration" | "requires_fallback";

/** Enhanced error code with category and action */
export interface AttendanceError {
  code: string;
  message: string;
  category: ErrorCategory;
  hint: string;
  showFallback: boolean;
}

export type CheckResult =
  | {
      ok: true;
      direction: "check_in" | "check_out";
      occurred_at: string;
      status: "success" | "pending_review" | "fallback";
      late_min: number;
      early_leave_min: number;
      duplicate?: boolean;
      message: string;
      verification_ref: string | null;
      confidence: number | null;
      liveness: string | null;
    }
  | { ok: false; error: AttendanceError };

type Db = Awaited<ReturnType<typeof createClient>>;
const FIXTURES: FaceFixture[] = ["good", "blurry", "no-match", "liveness-fail"];

async function myContext(supabase: Db, userId: string) {
  const { data: employee } = await supabase
    .from("employees")
    .select("id, organization_id, employee_code, employment_status")
    .eq("profile_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!employee || (employee as { employment_status: string }).employment_status !== "active") {
    // Tự động tạo employee nếu chưa có (idempotent)
    const { data: newEmpId, error: rpcError } = await supabase.rpc("ensure_self_employee");
    if (rpcError || !newEmpId) {
      return null;
    }
    const { data: newEmployee } = await supabase
      .from("employees")
      .select("id, organization_id, employee_code, employment_status")
      .eq("id", newEmpId)
      .maybeSingle();
    if (!newEmployee) return null;
    const empNew = newEmployee as { id: string; organization_id: string; employee_code: string };
    const { data: orgNew } = await supabase
      .from("organizations")
      .select("timezone")
      .eq("id", empNew.organization_id)
      .maybeSingle();
    const tzNew = ((orgNew as { timezone?: string } | null)?.timezone) ?? "Asia/Ho_Chi_Minh";
    return { emp: empNew, tz: tzNew, subjectId: null, enrollmentState: "none" };
  }
  const emp = employee as { id: string; organization_id: string; employee_code: string };
  const { data: org } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", emp.organization_id)
    .maybeSingle();
  const tz = ((org as { timezone?: string } | null)?.timezone) ?? "Asia/Ho_Chi_Minh";
  const { data: enrollment } = await supabase
    .from("face_enrollments")
    .select("status, provider_subject_id")
    .eq("employee_id", emp.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = enrollment as { status: string; provider_subject_id: string | null } | null;
  const enrollmentState = row?.status ?? "none";
  const subjectId = enrollmentState === "active" ? (row?.provider_subject_id ?? null) : null;
  return { emp, tz, subjectId, enrollmentState };
}

async function recordViaRpc(
  supabase: Db,
  args: {
    employee_id: string;
    assignment_id: string;
    event_type: string;
    status: string;
    method: string;
    verification_ref: string | null;
    liveness: string | null;
    confidence: number | null;
    idempotency_key: string;
    note: string | null;
    work_date: string;
    shift_id: string;
    late_min: number;
    early_leave_min: number;
  },
) {
  // Gọi bằng user-JWT client: function DEFINER tự check ownership qua auth.uid().
  const { data, error } = await supabase.rpc("record_attendance_event", {
    p_employee_id: args.employee_id,
    p_shift_assignment_id: args.assignment_id,
    p_event_type: args.event_type,
    p_status: args.status,
    p_method: args.method,
    p_verification_ref: args.verification_ref,
    p_liveness: args.liveness,
    p_confidence: args.confidence,
    p_idempotency_key: args.idempotency_key,
    p_note: args.note,
    p_work_date: args.work_date,
    p_shift_id: args.shift_id,
    p_late_min: args.late_min,
    p_early_leave_min: args.early_leave_min,
  });
  return { data: data as { occurred_at: string } | null, error: error as { code?: string; message?: string } | null };
}

/** Trạng thái hôm nay: ca, event cuối, cho phép in/out. */
export async function getTodayStatus() {
  const { userId } = await requireUser();
  const supabase = await createClient();
  const ctx = await myContext(supabase, userId);
  if (!ctx) return { eligible: false as const };
  const now = new Date();
  const { data: assignments } = await supabase
    .from("shift_assignments")
    .select("id, shift_id, effective_from, effective_to, work_shifts!inner(start_time, end_time, overnight, grace_in_min, grace_out_min, rounding_min, name)")
    .eq("employee_id", ctx.emp.id);
  const list = ((assignments ?? []) as unknown as Array<Record<string, unknown>>).map((a) => {
    const s = a.work_shifts as { start_time: string; end_time: string; overnight: boolean; grace_in_min: number; grace_out_min: number; rounding_min: number; name: string };
    return {
      id: a.id as string,
      shift_id: a.shift_id as string,
      effective_from: a.effective_from as string,
      effective_to: (a.effective_to as string) ?? null,
      shift: { start_time: (s.start_time as string).slice(0, 5), end_time: (s.end_time as string).slice(0, 5), overnight: s.overnight as boolean },
      meta: s,
    };
  });
  const resolved = resolveShiftFor(now, wallMinutes(now, ctx.tz), list, ctx.tz);
  const todayStr = wallDateString(now, ctx.tz);
  const workDate = resolved?.work_date ?? todayStr;
  const dayStartIso = zonedStartOfDayIso(workDate, ctx.tz);
  let eventQuery = supabase
    .from("attendance_events")
    .select("event_type, status, occurred_at, method, confidence, liveness_status, shift_assignment_id")
    .eq("employee_id", ctx.emp.id)
    .gte("occurred_at", dayStartIso)
    .order("occurred_at", { ascending: false })
    .limit(50);
  if (resolved) eventQuery = eventQuery.eq("shift_assignment_id", resolved.assignment_id);
  const { data: events } = await eventQuery;
  const evs = (events ?? []) as Array<{
    event_type: string;
    status: string;
    occurred_at: string;
    method: string;
    confidence: number | null;
    liveness_status: string | null;
    shift_assignment_id: string | null;
  }>;
  // Chỉ event được tính công mới quyết định trạng thái vào/ra; event failed
  // vẫn hiển thị trong timeline nhưng không làm lệch giờ vào/ra.
  const counted = evs.filter((e) => e.status !== "failed");
  const lastCounted = counted[0] ?? null;
  const openCheckIn = lastCounted?.event_type === "check_in";
  const resolvedMeta = resolved
    ? (list.find((l) => l.id === resolved.assignment_id)?.meta as
        | { name: string; grace_in_min: number; grace_out_min: number; rounding_min: number }
        | undefined)
    : undefined;
  return {
    eligible: true as const,
    hasEnrollment: ctx.subjectId !== null,
    enrollmentState: ctx.enrollmentState,
    shift: resolved
      ? {
          name: resolvedMeta?.name ?? "",
          start_time: resolved.shift.start_time,
          end_time: resolved.shift.end_time,
          overnight: resolved.shift.overnight,
          grace_in_min: resolvedMeta?.grace_in_min ?? 0,
          grace_out_min: resolvedMeta?.grace_out_min ?? 0,
          rounding_min: resolvedMeta?.rounding_min ?? 1,
        }
      : null,
    lastEvent: lastCounted,
    events: evs,
    canCheckIn: resolved !== null && !openCheckIn,
    canCheckOut: openCheckIn,
    todayCount: counted.length,
  };
}

/** Chuyển frameDataUrl (base64) thành FaceImageInput cho provider. */
function frameToImageInput(frameDataUrl: string, fixture?: FaceFixture): FaceImageInput {
  const data = fixture ? `${frameDataUrl}:${fixture}` : frameDataUrl;
  return { data, mimeType: "image/jpeg" };
}

/** Map provider verify code sang attendance error code with category. */
function mapVerifyCode(code: string, livenessStatus?: string): AttendanceError {
  switch (code) {
    case "success":
      return { code: "NO_MATCH", message: "Khuôn mặt không khớp", category: "retryable", hint: "Thử lại hoặc dùng phương thức thay thế.", showFallback: true };
    case "no_match":
      return { code: "NO_MATCH", message: "Khuôn mặt không khớp mẫu đã đăng ký", category: "retryable", hint: "Thử lại đủ sáng, nhìn thẳng camera.", showFallback: true };
    case "low_confidence":
      return { code: "LOW_CONFIDENCE", message: "Độ khớp thấp", category: "retryable", hint: "Thử lại hoặc chuyển HR rà soát.", showFallback: true };
    case "liveness_failed":
      return { code: "LIVENESS_FAILED", message: "Không xác định được người thật", category: "retryable", hint: "Thử lại đủ sáng, nhìn thẳng. Không dùng ảnh/màn hình.", showFallback: true };
    case "poor_image_quality":
      return { code: "POOR_IMAGE_QUALITY", message: "Ảnh không đạt chất lượng", category: "retryable", hint: "Hãy chụp lại rõ hơn, đủ sáng, nhìn thẳng camera.", showFallback: false };
    case "provider_unavailable":
      return { code: "PROVIDER_UNAVAILABLE", message: "Dịch vụ nhận diện bận", category: "retryable", hint: "Giữ nguyên trang, bấm Thử lại (cùng mã, không tạo trùng).", showFallback: true };
    case "timeout":
      return { code: "PROVIDER_TIMEOUT", message: "Dịch vụ nhận diện quá lâu", category: "retryable", hint: "Giữ nguyên trang, bấm Thử lại (cùng mã, không tạo trùng).", showFallback: true };
    case "enrollment_missing":
      return { code: "NO_ENROLLMENT", message: "Chưa có mẫu khuôn mặt active", category: "permanent", hint: "Đăng ký và chờ HR duyệt trước.", showFallback: true };
    case "unauthorized":
      return { code: "UNAUTHORIZED", message: "Provider credentials không hợp lệ", category: "configuration", hint: "Liên hệ quản trị viên cấu hình provider.", showFallback: false };
    case "rate_limited":
      return { code: "RATE_LIMITED", message: "Quá nhiều yêu cầu", category: "retryable", hint: "Nghỉ ít phút rồi thử lại.", showFallback: false };
    case "not_configured":
      return { code: "PROVIDER_NOT_CONFIGURED", message: "Provider chưa được cấu hình", category: "configuration", hint: "Chỉ dùng được DEMO trên development. Production cần cấu hình AWS Rekognition.", showFallback: false };
    default:
      return { code: "NO_MATCH", message: "Khuôn mặt không khớp", category: "retryable", hint: "Thử lại hoặc dùng phương thức thay thế.", showFallback: true };
  }
}

export async function verifyCheck(input: {
  direction: "check_in" | "check_out";
  frameDataUrl: string;
  fixture?: FaceFixture;
  idempotencyKey: string;
}): Promise<CheckResult> {
  const { userId } = await requireUser();
  if (!idempotencyKeySchema.safeParse(input.idempotencyKey).success) {
    return { ok: false, error: { code: "INVALID_KEY", message: "Idempotency key không hợp lệ.", category: "permanent", hint: "Lỗi hệ thống, vui lòng tải lại trang.", showFallback: false } };
  }
  const supabase = await createClient();
  const ctx = await myContext(supabase, userId);
  if (!ctx) return { ok: false, error: { code: "NOT_ELIGIBLE", message: "Tài khoản chưa phải nhân viên đang làm việc.", category: "permanent", hint: "Liên hệ HR.", showFallback: false } };
  if (!ctx.subjectId) {
    const waiting = ctx.enrollmentState === "pending" || ctx.enrollmentState === "needs_review";
    return {
      ok: false,
      error: waiting
        ? {
            code: "NO_ENROLLMENT",
            message: "Đăng ký khuôn mặt đang chờ duyệt. Bạn có thể dùng phương thức thay thế để chấm công.",
            category: "permanent",
            hint: "HR cần duyệt đăng ký trước khi chấm công bằng khuôn mặt.",
            showFallback: true,
          }
        : {
            code: "NO_ENROLLMENT",
            message: "Chưa có mẫu khuôn mặt đang hoạt động. Hãy đăng ký khuôn mặt trước.",
            category: "permanent",
            hint: "Đăng ký khuôn mặt trước khi chấm công.",
            showFallback: true,
          },
    };
  }

  const rl = checkRateLimit(`verify:${userId}`, VERIFY_LIMIT.max, VERIFY_LIMIT.windowMs);
  if (!rl.allowed) return { ok: false, error: { code: "RATE_LIMITED", message: "Bạn thao tác quá nhanh, nghỉ ít phút rồi thử lại.", category: "retryable", hint: "Nghỉ ít phút rồi thử lại.", showFallback: false } };

  if (!/^data:image\/(jpeg|png);base64,/.test(input.frameDataUrl) || input.frameDataUrl.length > 700_000) {
    return { ok: false, error: { code: "INVALID_IMAGE", message: "Ảnh không hợp lệ.", category: "retryable", hint: "Chụp lại ảnh đúng định dạng.", showFallback: false } };
  }

  const now = new Date();
  const { data: assignments } = await supabase
    .from("shift_assignments")
    .select("id, shift_id, effective_from, effective_to, work_shifts!inner(start_time, end_time, overnight, grace_in_min, grace_out_min, rounding_min)")
    .eq("employee_id", ctx.emp.id);
  const list = ((assignments ?? []) as unknown as Array<Record<string, unknown>>).map((a) => {
    const s = a.work_shifts as { start_time: string; end_time: string; overnight: boolean; grace_in_min: number; grace_out_min: number; rounding_min: number };
    return {
      id: a.id as string,
      shift_id: a.shift_id as string,
      effective_from: a.effective_from as string,
      effective_to: (a.effective_to as string) ?? null,
      shift: { start_time: (s.start_time as string).slice(0, 5), end_time: (s.end_time as string).slice(0, 5), overnight: s.overnight as boolean },
      meta: s,
    };
  });
  const resolved = resolveShiftFor(now, wallMinutes(now, ctx.tz), list, ctx.tz);
  if (!resolved) {
    return { ok: false, error: { code: "NO_SHIFT", message: "Hôm nay bạn không có ca làm. Liên hệ HR nếu cần bổ sung.", category: "permanent", hint: "Liên hệ HR để phân ca.", showFallback: false } };
  }
  const meta = list.find((l) => l.id === resolved.assignment_id)?.meta as
    | { grace_in_min: number; grace_out_min: number; rounding_min: number }
    | undefined;

  if (input.direction === "check_out") {
    const status = await getTodayStatus();
    if (!status.eligible || !status.canCheckOut) {
      return { ok: false, error: { code: "OUT_WITHOUT_IN", message: "Chưa có check-in hợp lệ hôm nay. Nếu quên, hãy gửi yêu cầu chỉnh công.", category: "permanent", hint: "Gửi yêu cầu chỉnh công hoặc dùng phương thức thay thế.", showFallback: true } };
    }
  } else {
    const status = await getTodayStatus();
    if (status.eligible && !status.canCheckIn && status.lastEvent?.event_type === "check_in") {
      return { ok: false, error: { code: "ALREADY_CHECKED_IN", message: "Bạn đã check-in. Hãy check-out khi ra về.", category: "permanent", hint: "Bấm check-out khi ra về.", showFallback: false } };
    }
  }

  let provider;
  try {
    provider = getFaceProvider();
  } catch {
    return { ok: false, error: mapVerifyCode("not_configured") };
  }
  const imageInput = frameToImageInput(input.frameDataUrl, provider.isDemo && input.fixture && FIXTURES.includes(input.fixture) ? input.fixture : undefined);

  let livenessStatus: string = "unknown";
  let confidence = 0;
  let ref: string | null = null;

  // Liveness check
  let livenessResult;
  try {
    livenessResult = await withProviderTimeout(provider.checkLiveness({ image: imageInput }), PROVIDER_TIMEOUT_MS);
  } catch {
    return { ok: false, error: { code: "PROVIDER_TIMEOUT", message: "Dịch vụ nhận diện quá lâu. Giữ nguyên trang và bấm Thử lại (không tạo trùng), hoặc dùng phương thức thay thế.", category: "retryable", hint: "Thử lại hoặc dùng phương thức thay thế.", showFallback: true } };
  }
  if (!livenessResult.ok) {
    const err = mapVerifyCode(livenessResult.code);
    return { ok: false, error: { ...err, message: err.message || livenessResult.message } };
  }
  livenessStatus = livenessResult.data?.status ?? "unknown";

  // Verify 1:1 (chỉ chạy nếu liveness pass hoặc unknown)
  let verifyResult;
  if (livenessStatus === "pass" || livenessStatus === "unknown") {
    try {
      verifyResult = await withProviderTimeout(
        provider.verifyFace({ providerSubjectId: ctx.subjectId, image: imageInput }),
        PROVIDER_TIMEOUT_MS,
      );
    } catch {
      return { ok: false, error: { code: "PROVIDER_TIMEOUT", message: "Dịch vụ nhận diện quá lâu. Giữ nguyên trang và bấm Thử lại (không tạo trùng), hoặc dùng phương thức thay thế.", category: "retryable", hint: "Thử lại hoặc dùng phương thức thay thế.", showFallback: true } };
    }
    if (!verifyResult.ok) {
      const err = mapVerifyCode(verifyResult.code, livenessStatus);
      return { ok: false, error: { ...err, message: err.message || verifyResult.message } };
    }
    confidence = verifyResult.data!.confidence;
    ref = verifyResult.data!.providerReference;
    if (verifyResult.data!.liveness === "fail") livenessStatus = "fail";
  }

  const decision = decideVerification({
    liveness: livenessStatus as "pass" | "fail" | "unknown",
    confidence,
    threshold: VERIFY_THRESHOLD,
    reviewBandLow: REVIEW_BAND_LOW,
  });

  const failedEvent = async (reason: string) => {
    await recordViaRpc(supabase, {
      employee_id: ctx.emp.id, assignment_id: resolved.assignment_id, event_type: input.direction,
      status: "failed", method: "face", verification_ref: ref, liveness: livenessStatus, confidence,
      idempotency_key: input.idempotencyKey, note: reason,
      work_date: resolved.work_date, shift_id: resolved.shift_id, late_min: 0, early_leave_min: 0,
    });
  };

  if (decision.outcome === "failed") {
    await failedEvent(decision.reason);
    revalidatePath("/check-in");
    revalidatePath("/dashboard");
    revalidatePath("/history");
    if (decision.reason === "LIVENESS_FAILED") {
      return { ok: false, error: { code: "LIVENESS_FAILED", message: "Không xác định được người thật. Thử lại đủ sáng/nhìn thẳng, hoặc dùng phương thức thay thế.", category: "retryable", hint: "Thử lại đủ sáng, nhìn thẳng. Không dùng ảnh/màn hình.", showFallback: true } };
    }
    return { ok: false, error: { code: "NO_MATCH", message: "Khuôn mặt không khớp mẫu đã đăng ký. Thử lại hoặc dùng phương thức thay thế.", category: "retryable", hint: "Thử lại đủ sáng, nhìn thẳng camera.", showFallback: true } };
  }

  const eventStatus = decision.outcome === "success" ? "success" : "pending_review";
  const late = input.direction === "check_in"
    ? minutesLate(now, resolved.shift.start_time, meta?.grace_in_min ?? 0, meta?.rounding_min ?? 1, ctx.tz, resolved.shift.overnight, resolved.shift.end_time)
    : 0;
  const early = input.direction === "check_out"
    ? minutesEarlyLeave(now, resolved.shift.end_time, meta?.grace_out_min ?? 0, meta?.rounding_min ?? 1, ctx.tz)
    : 0;
  const note = provider.isDemo ? "[DEMO] mock verification — không phải chấm công production" : null;

  const { data, error } = await recordViaRpc(supabase, {
    employee_id: ctx.emp.id, assignment_id: resolved.assignment_id, event_type: input.direction,
    status: eventStatus, method: "face", verification_ref: ref, liveness: livenessStatus, confidence,
    idempotency_key: input.idempotencyKey, note,
    work_date: resolved.work_date, shift_id: resolved.shift_id, late_min: late, early_leave_min: early,
  });
  if (error) {
    if (error.code === "23505") {
      // Retry với cùng key: trả bản ghi đã có, không tạo trùng.
      const { data: existing } = await supabase
        .from("attendance_events")
        .select("event_type, occurred_at, status")
        .eq("idempotency_key", input.idempotencyKey)
        .single();
      const ex = existing as { event_type: string; occurred_at: string; status: string } | null;
      if (ex) {
        return {
          ok: true, direction: ex.event_type as "check_in" | "check_out", occurred_at: ex.occurred_at,
          status: ex.status as "success" | "pending_review" | "fallback",
          late_min: 0, early_leave_min: 0, duplicate: true,
          message: "Yêu cầu đã được ghi nhận trước đó (chống trùng).",
          verification_ref: null,
          confidence: null,
          liveness: null,
        };
      }
    }
    logger.warn("verifyCheck record failed", { code: error.code });
    return { ok: false, error: { code: "RECORD_FAILED", message: "Không ghi được chấm công, vui lòng thử lại.", category: "retryable", hint: "Thử lại, hệ thống sẽ không tạo trùng nhờ idempotency key.", showFallback: true } };
  }
  revalidatePath("/check-in");
  revalidatePath("/dashboard");
  revalidatePath("/history");
  if (eventStatus === "pending_review") {
    return {
      ok: true, direction: input.direction, occurred_at: (data as { occurred_at: string }).occurred_at,
      status: "pending_review", late_min: late, early_leave_min: early,
      message: "Độ khớp thấp — đã ghi nhận và chuyển HR rà soát (không coi là gian lận).",
      verification_ref: ref,
      confidence,
      liveness: livenessStatus,
    };
  }
  return {
    ok: true, direction: input.direction, occurred_at: (data as { occurred_at: string }).occurred_at,
    status: "success", late_min: late, early_leave_min: early,
    message: input.direction === "check_in"
      ? (late > 0 ? `Check-in thành công (trễ ${late}′).` : "Check-in thành công, đúng giờ.")
      : (early > 0 ? `Check-out thành công (về sớm ${early}′).` : "Check-out thành công."),
    verification_ref: ref,
    confidence,
    liveness: livenessStatus,
  };
}

/** Phương án thay thế: ghi nhận + chuyển HR rà soát, kèm lý do bắt buộc. */
export async function fallbackCheck(input: {
  direction: "check_in" | "check_out";
  reason: string;
  idempotencyKey: string;
}): Promise<CheckResult> {
  const { userId } = await requireUser();
  if (!idempotencyKeySchema.safeParse(input.idempotencyKey).success) {
    return { ok: false, error: { code: "INVALID_KEY", message: "Idempotency key không hợp lệ.", category: "permanent", hint: "Lỗi hệ thống, vui lòng tải lại trang.", showFallback: false } };
  }
  if (!input.reason.trim()) {
    return { ok: false, error: { code: "REASON_REQUIRED", message: "Vui lòng nhập lý do dùng phương thức thay thế.", category: "permanent", hint: "Lý do là bắt buộc cho phương thức thay thế.", showFallback: false } };
  }
  const supabase = await createClient();
  const ctx = await myContext(supabase, userId);
  if (!ctx) return { ok: false, error: { code: "NOT_ELIGIBLE", message: "Tài khoản chưa phải nhân viên đang làm việc.", category: "permanent", hint: "Liên hệ HR.", showFallback: false } };

  const rl = checkRateLimit(`verify:${userId}`, VERIFY_LIMIT.max, VERIFY_LIMIT.windowMs);
  if (!rl.allowed) return { ok: false, error: { code: "RATE_LIMITED", message: "Bạn thao tác quá nhanh.", category: "retryable", hint: "Nghỉ ít phút rồi thử lại.", showFallback: false } };

  const now = new Date();
  const { data: assignments } = await supabase
    .from("shift_assignments")
    .select("id, shift_id, effective_from, effective_to, work_shifts!inner(start_time, end_time, overnight, grace_in_min, grace_out_min, rounding_min)")
    .eq("employee_id", ctx.emp.id);
  const list = ((assignments ?? []) as unknown as Array<Record<string, unknown>>).map((a) => {
    const s = a.work_shifts as { start_time: string; end_time: string; overnight: boolean; grace_in_min: number; grace_out_min: number; rounding_min: number };
    return {
      id: a.id as string, shift_id: a.shift_id as string,
      effective_from: a.effective_from as string, effective_to: (a.effective_to as string) ?? null,
      shift: { start_time: (s.start_time as string).slice(0, 5), end_time: (s.end_time as string).slice(0, 5), overnight: s.overnight as boolean },
      meta: s,
    };
  });
  const resolved = resolveShiftFor(now, wallMinutes(now, ctx.tz), list, ctx.tz);
  if (!resolved) return { ok: false, error: { code: "NO_SHIFT", message: "Hôm nay bạn không có ca làm.", category: "permanent", hint: "Liên hệ HR để phân ca.", showFallback: false } };
  const meta = list.find((l) => l.id === resolved.assignment_id)?.meta;
  const late = input.direction === "check_in"
    ? minutesLate(now, resolved.shift.start_time, meta?.grace_in_min ?? 0, meta?.rounding_min ?? 1, ctx.tz, resolved.shift.overnight, resolved.shift.end_time)
    : 0;
  const early = input.direction === "check_out"
    ? minutesEarlyLeave(now, resolved.shift.end_time, meta?.grace_out_min ?? 0, meta?.rounding_min ?? 1, ctx.tz)
    : 0;

  const { data, error } = await recordViaRpc(supabase, {
    employee_id: ctx.emp.id, assignment_id: resolved.assignment_id, event_type: input.direction,
    status: "fallback", method: "pin_fallback", verification_ref: null, liveness: null, confidence: null,
    idempotency_key: input.idempotencyKey, note: input.reason.trim().slice(0, 500),
    work_date: resolved.work_date, shift_id: resolved.shift_id, late_min: late, early_leave_min: early,
  });
  if (error?.code === "23505") {
    return { ok: false, error: { code: "DUPLICATE", message: "Yêu cầu đã được ghi nhận trước đó.", category: "retryable", hint: "Không cần gửi lại.", showFallback: false } };
  }
  if (error || !data) {
    logger.warn("fallbackCheck record failed", { code: error?.code });
    return { ok: false, error: { code: "RECORD_FAILED", message: "Không ghi được, vui lòng thử lại.", category: "retryable", hint: "Thử lại, hệ thống sẽ không tạo trùng nhờ idempotency key.", showFallback: false } };
  }
  revalidatePath("/check-in");
  revalidatePath("/dashboard");
  revalidatePath("/history");
  return {
    ok: true, direction: input.direction, occurred_at: (data as { occurred_at: string }).occurred_at,
    status: "fallback", late_min: late, early_leave_min: early,
    message: late > 0
      ? `Đã ghi nhận phương thức thay thế (trễ ${late}′), chờ HR xác nhận.`
      : early > 0
        ? `Đã ghi nhận phương thức thay thế (về sớm ${early}′), chờ HR xác nhận.`
        : "Đã ghi nhận phương thức thay thế, chờ HR xác nhận.",
    verification_ref: null,
    confidence: null,
    liveness: null,
  };
}

/** ============================ Quản lý chấm công (HR/Manager view) ============================ */

export interface AttendanceRecord {
  id: string;
  event_type: "check_in" | "check_out";
  occurred_at: string;
  status: "success" | "pending_review" | "failed" | "fallback";
  method: "face" | "pin_fallback" | "manual";
  employee_id: string;
  employee_code: string;
  display_name: string;
  email: string;
  department_id: string | null;
  department_name: string;
  title: string;
  late_min: number;
  early_leave_min: number;
}

interface AttendanceFilters {
  date?: string;       // YYYY-MM-DD
  month?: string;      // YYYY-MM
  employee_id?: string;
  department_id?: string;
  status?: string;
}

export async function getAttendanceRecords(
  filters: AttendanceFilters,
  page: number,
  pageSize: number,
): Promise<{
  ok: boolean;
  records?: AttendanceRecord[];
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
}> {
  const { profile } = await requireRole(["manager", "hr_admin", "system_admin"]);
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, message: "Tài khoản chưa thuộc tổ chức nào." };

  const supabase = await createClient();
  const p = Math.max(1, page || 1);
  const ps = Math.max(1, pageSize || 20);

  // Xác định scope nhân viên (manager chỉ thấy team)
  let employeeIds: string[] | null = null;
  if (profile.role === "manager") {
    const me = await supabase
      .from("employees")
      .select("id")
      .eq("profile_id", (await supabase.auth.getUser()).data.user?.id ?? "")
      .single();
    const meId = (me.data as { id: string } | null)?.id;
    if (!meId) return { ok: false, records: [], total: 0, page: p, pageSize: ps };

    const { data: team } = await supabase
      .from("employees")
      .select("id")
      .eq("manager_id", meId);
    const ids = ((team ?? []) as Array<{ id: string }>).map((t) => t.id);
    if (meId) ids.push(meId);
    employeeIds = ids;
  }

  let query = supabase
    .from("attendance_events")
    .select(
      `
      id, event_type, occurred_at, status, method,
      late_min, early_leave_min,
      employee_id,
      employees!inner(
        id, employee_code, department_id, title,
        profiles!inner(display_name, email),
        departments(name)
      )
    `,
      { count: "exact" },
    )
    .eq("employees.organization_id", orgId)
    .order("occurred_at", { ascending: false })
    .range((p - 1) * ps, p * ps - 1);

  // Áp dụng bộ lọc ngày/tháng
  if (filters.date) {
    const dayStart = new Date(`${filters.date}T00:00:00`).toISOString();
    const dayEnd = new Date(`${filters.date}T23:59:59`).toISOString();
    query = query.gte("occurred_at", dayStart).lte("occurred_at", dayEnd);
  } else if (filters.month) {
    const [y, m] = filters.month.split("-").map(Number);
    const from = new Date(y, m - 1, 1).toISOString();
    const to = new Date(y, m, 0, 23, 59, 59).toISOString();
    query = query.gte("occurred_at", from).lte("occurred_at", to);
  }

  if (filters.employee_id) {
    query = query.eq("employee_id", filters.employee_id);
  }
  if (filters.department_id) {
    query = query.eq("employees.department_id", filters.department_id);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  // Manager scope: chỉ team
  if (employeeIds) {
    query = query.in("employee_id", employeeIds);
  }

  const [{ data, count }, { data: depts }] = await Promise.all([
    query,
    supabase.from("departments").select("id, name").eq("organization_id", orgId).order("name"),
  ]);

  const rows = ((data ?? []) as unknown) as Array<{
    id: string;
    event_type: string;
    occurred_at: string;
    status: string;
    method: string;
    late_min: number;
    early_leave_min: number;
    employee_id: string;
    employees: {
      id: string;
      employee_code: string;
      department_id: string | null;
      title: string;
      profiles: { display_name: string; email: string };
      departments: { name: string } | null;
    };
  }>;

  const records: AttendanceRecord[] = ((rows as unknown) as Array<{
    id: string;
    event_type: string;
    occurred_at: string;
    status: string;
    method: string;
    late_min: number;
    early_leave_min: number;
    employee_id: string;
    employees: {
      employee_code: string;
      department_id: string | null;
      title: string;
      profiles: { display_name: string; email: string };
      departments: { name: string } | null;
    };
  }>).map((r) => ({
    id: r.id,
    event_type: r.event_type as "check_in" | "check_out",
    occurred_at: r.occurred_at,
    status: r.status as "success" | "pending_review" | "failed" | "fallback",
    method: r.method as "face" | "pin_fallback" | "manual",
    employee_id: r.employee_id,
    employee_code: r.employees.employee_code,
    display_name: r.employees.profiles.display_name,
    email: r.employees.profiles.email,
    department_id: r.employees.department_id,
    department_name: r.employees.departments?.name || "—",
    title: r.employees.title,
    late_min: r.late_min,
    early_leave_min: r.early_leave_min,
  }));

  return {
    ok: true,
    records,
    total: count ?? 0,
    page: p,
    pageSize: ps,
  };
}

/** ============================ Bảng chấm công theo ngày (HR/Manager) ============================ */

export type AttendanceMethod = "face" | "pin_fallback" | "manual";
export type AttendanceDailyStatus = "present" | "late" | "early_leave" | "absent" | "incomplete";

export interface AttendanceDailyRecord {
  /** Khoá tổng hợp từ employee + work_date + shift (bảng summary không có id riêng). */
  id: string;
  employee_id: string;
  employee_code: string;
  display_name: string;
  email: string;
  department_id: string | null;
  department_name: string;
  title: string;
  work_date: string;
  shift_id: string | null;
  shift_name: string;
  first_in: string | null;
  last_out: string | null;
  late_min: number;
  early_leave_min: number;
  total_work_min: number;
  status: AttendanceDailyStatus;
  /** Suy ra từ attendance_events của đúng nhân viên + ngày; null nếu chưa có event. */
  method: AttendanceMethod | "mixed" | null;
}

export interface AttendanceDailyFilters {
  date?: string; // YYYY-MM-DD
  month?: string; // YYYY-MM
  employee_id?: string;
  department_id?: string;
  status?: string;
}

const SUMMARY_STATUSES = new Set<string>([
  "present",
  "late",
  "early_leave",
  "absent",
  "incomplete",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Bảng chấm công theo nhân viên + ngày (nguồn: attendance_daily_summaries).
 * Phương thức chấm công không nằm trong summary nên được suy ra từ events cùng ngày.
 */
export async function getAttendanceDailyRecords(
  filters: AttendanceDailyFilters,
  page: number,
  pageSize: number,
): Promise<{
  ok: boolean;
  records?: AttendanceDailyRecord[];
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
  employees?: Array<{ id: string; employee_code: string; display_name: string }>;
  departments?: Array<{ id: string; name: string }>;
}> {
  const { profile, userId } = await requireRole(["manager", "hr_admin", "system_admin"]);
  const orgId = profile.organization_id;
  if (!orgId) return { ok: false, message: "Tài khoản chưa thuộc tổ chức nào." };

  const supabase = await createClient();
  const p = Math.max(1, page || 1);
  const ps = Math.min(100, Math.max(1, pageSize || 20));

  // Manager chỉ thấy team của mình + bản thân.
  let employeeIds: string[] | null = null;
  if (profile.role === "manager") {
    const { data: me } = await supabase
      .from("employees")
      .select("id")
      .eq("profile_id", userId)
      .single();
    const meId = (me as { id?: string } | null)?.id;
    if (!meId) {
      return { ok: true, records: [], total: 0, page: p, pageSize: ps, employees: [], departments: [] };
    }
    const { data: team } = await supabase.from("employees").select("id").eq("manager_id", meId);
    const ids = ((team ?? []) as Array<{ id: string }>).map((t) => t.id);
    ids.push(meId);
    employeeIds = ids;
  }

  let query = supabase
    .from("attendance_daily_summaries")
    .select(
      `
      employee_id, work_date, shift_id, first_in, last_out,
      late_min, early_leave_min, total_work_min, status,
      employees!inner(
        id, employee_code, department_id, title,
        profiles(display_name, email),
        departments(name)
      ),
      work_shifts(name)
    `,
      { count: "exact" },
    )
    .eq("organization_id", orgId);

  if (filters.date && DATE_RE.test(filters.date)) {
    query = query.eq("work_date", filters.date);
  } else if (filters.month && MONTH_RE.test(filters.month)) {
    const range = monthRange(filters.month);
    if (range) query = query.gte("work_date", range.from).lte("work_date", range.to);
  }

  if (filters.employee_id && UUID_RE.test(filters.employee_id)) {
    query = query.eq("employee_id", filters.employee_id);
  }
  if (filters.department_id && UUID_RE.test(filters.department_id)) {
    query = query.eq("employees.department_id", filters.department_id);
  }
  if (filters.status && SUMMARY_STATUSES.has(filters.status)) {
    query = query.eq("status", filters.status);
  }
  if (employeeIds) query = query.in("employee_id", employeeIds);

  let employeeQuery = supabase
    .from("employees")
    .select("id, employee_code, profiles(display_name)")
    .eq("organization_id", orgId)
    .order("employee_code");
  if (employeeIds) employeeQuery = employeeQuery.in("id", employeeIds);

  const [{ data, count, error }, { data: departments }, { data: employeeRows }] = await Promise.all([
    query
      .order("work_date", { ascending: false })
      .order("employee_id", { ascending: true })
      .range((p - 1) * ps, p * ps - 1),
    supabase.from("departments").select("id, name").eq("organization_id", orgId).order("name"),
    employeeQuery,
  ]);

  if (error) {
    logger.warn("getAttendanceDailyRecords failed", { code: error.code });
    return { ok: false, message: "Không tải được bảng chấm công." };
  }

  const summaryRows = ((data ?? []) as unknown) as Array<{
    employee_id: string;
    work_date: string;
    shift_id: string | null;
    first_in: string | null;
    last_out: string | null;
    late_min: number;
    early_leave_min: number;
    total_work_min: number;
    status: string;
    employees: {
      id: string;
      employee_code: string;
      department_id: string | null;
      title: string;
      profiles: { display_name: string; email: string } | null;
      departments: { name: string } | null;
    };
    work_shifts: { name: string } | null;
  }>;

  // Suy ra phương thức chấm công từ events của các cặp nhân viên + ngày trên trang.
  const methodsByKey = new Map<string, Set<AttendanceMethod>>();
  if (summaryRows.length > 0) {
    const ids = [...new Set(summaryRows.map((row) => row.employee_id))];
    const dates = [...new Set(summaryRows.map((row) => row.work_date))].sort();
    const from = zonedStartOfDayIso(dates[0], APP_TZ);
    const to = zonedStartOfDayIso(addDays(dates[dates.length - 1], 1), APP_TZ);

    const { data: events } = await supabase
      .from("attendance_events")
      .select("employee_id, occurred_at, method, status")
      .in("employee_id", ids)
      .gte("occurred_at", from)
      .lt("occurred_at", to);

    for (const event of ((events ?? []) as unknown) as Array<{
      employee_id: string;
      occurred_at: string;
      method: string;
      status: string;
    }>) {
      if (event.status === "failed") continue;
      if (event.method !== "face" && event.method !== "pin_fallback" && event.method !== "manual") {
        continue;
      }
      const key = `${event.employee_id}:${wallDateString(new Date(event.occurred_at), APP_TZ)}`;
      const set = methodsByKey.get(key) ?? new Set<AttendanceMethod>();
      set.add(event.method);
      methodsByKey.set(key, set);
    }
  }

  const records: AttendanceDailyRecord[] = summaryRows.map((row) => {
    const methods = methodsByKey.get(`${row.employee_id}:${row.work_date}`);
    let method: AttendanceDailyRecord["method"] = null;
    if (methods && methods.size === 1) {
      method = Array.from(methods)[0] ?? null;
    } else if (methods && methods.size > 1) {
      method = "mixed";
    }

    return {
      id: `${row.employee_id}:${row.work_date}:${row.shift_id ?? "none"}`,
      employee_id: row.employee_id,
      employee_code: row.employees.employee_code,
      display_name: row.employees.profiles?.display_name || row.employees.employee_code,
      email: row.employees.profiles?.email || "",
      department_id: row.employees.department_id,
      department_name: row.employees.departments?.name || "—",
      title: row.employees.title || "",
      work_date: row.work_date,
      shift_id: row.shift_id,
      shift_name: row.work_shifts?.name || "—",
      first_in: row.first_in,
      last_out: row.last_out,
      late_min: row.late_min,
      early_leave_min: row.early_leave_min,
      total_work_min: row.total_work_min,
      status: (SUMMARY_STATUSES.has(row.status) ? row.status : "incomplete") as AttendanceDailyStatus,
      method,
    };
  });

  return {
    ok: true,
    records,
    total: count ?? 0,
    page: p,
    pageSize: ps,
    employees: ((employeeRows ?? []) as unknown as Array<{
      id: string;
      employee_code: string;
      profiles: { display_name: string } | null;
    }>).map((employee) => ({
      id: employee.id,
      employee_code: employee.employee_code,
      display_name: employee.profiles?.display_name || employee.employee_code,
    })),
    departments: (departments ?? []).map((department) => ({
      id: department.id as string,
      name: department.name as string,
    })),
  };
}