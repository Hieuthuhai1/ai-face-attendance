"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { getFaceProvider } from "@/server/face";
import { PROVIDER_TIMEOUT_MS, withProviderTimeout } from "@/server/face/service";
import { checkRateLimit, VERIFY_LIMIT } from "@/server/rate-limit";
import { REVIEW_BAND_LOW, VERIFY_THRESHOLD } from "@/config/app";
import { idempotencyKeySchema } from "@/lib/validation";
import { logger } from "@/server/logger";
import type { FaceFixture } from "@/server/face/types";
import { decideVerification, resolveShiftFor, wallDateString } from "@/server/attendance/decision";
import { minutesEarlyLeave, minutesLate, wallMinutes } from "@/lib/attendance/rules";

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
    }
  | { ok: false; code: string; message: string };

type Db = Awaited<ReturnType<typeof createClient>>;
const FIXTURES: FaceFixture[] = ["good", "blurry", "no-match", "liveness-fail"];

async function myContext(supabase: Db, userId: string) {
  const { data: employee } = await supabase
    .from("employees")
    .select("id, organization_id, employee_code, employment_status")
    .eq("profile_id", userId)
    .single();
  if (!employee || (employee as { employment_status: string }).employment_status !== "active") {
    return null;
  }
  const emp = employee as { id: string; organization_id: string; employee_code: string };
  const { data: org } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", emp.organization_id)
    .single();
  const tz = ((org as { timezone?: string } | null)?.timezone) ?? "Asia/Ho_Chi_Minh";
  const { data: enrollment } = await supabase
    .from("face_enrollments")
    .select("provider_subject_id")
    .eq("employee_id", emp.id)
    .eq("status", "active")
    .limit(1)
    .single();
  return { emp, tz, subjectId: (enrollment as { provider_subject_id: string } | null)?.provider_subject_id ?? null };
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
  const { data: events } = await supabase
    .from("attendance_events")
    .select("event_type, status, occurred_at")
    .eq("employee_id", ctx.emp.id)
    .gte("occurred_at", `${resolved?.work_date ?? todayStr}T00:00:00`)
    .order("occurred_at", { ascending: false })
    .limit(10);
  const evs = (events ?? []) as Array<{ event_type: string; status: string; occurred_at: string }>;
  const lastSuccess = evs.find((e) => e.status === "success");
  const openCheckIn = lastSuccess?.event_type === "check_in";
  const resolvedMeta = resolved
    ? (list.find((l) => l.id === resolved.assignment_id)?.meta as { name: string } | undefined)
    : undefined;
  return {
    eligible: true as const,
    hasEnrollment: ctx.subjectId !== null,
    shift: resolved
      ? {
          name: resolvedMeta?.name ?? "",
          start_time: resolved.shift.start_time,
          end_time: resolved.shift.end_time,
          overnight: resolved.shift.overnight,
        }
      : null,
    lastEvent: evs[0] ?? null,
    canCheckIn: resolved !== null && !openCheckIn,
    canCheckOut: openCheckIn,
    todayCount: evs.length,
  };
}

export async function verifyCheck(input: {
  direction: "check_in" | "check_out";
  frameDataUrl: string;
  fixture?: FaceFixture;
  idempotencyKey: string;
}): Promise<CheckResult> {
  const { userId } = await requireUser();
  if (!idempotencyKeySchema.safeParse(input.idempotencyKey).success) {
    return { ok: false, code: "INVALID_KEY", message: "Idempotency key không hợp lệ." };
  }
  const supabase = await createClient();
  const ctx = await myContext(supabase, userId);
  if (!ctx) return { ok: false, code: "NOT_ELIGIBLE", message: "Tài khoản chưa phải nhân viên đang làm việc." };
  if (!ctx.subjectId) {
    return { ok: false, code: "NO_ENROLLMENT", message: "Chưa có mẫu khuôn mặt active. Hãy đăng ký và chờ HR duyệt." };
  }

  const rl = checkRateLimit(`verify:${userId}`, VERIFY_LIMIT.max, VERIFY_LIMIT.windowMs);
  if (!rl.allowed) return { ok: false, code: "RATE_LIMITED", message: "Bạn thao tác quá nhanh, nghỉ ít phút rồi thử lại." };

  if (!/^data:image\/(jpeg|png);base64,/.test(input.frameDataUrl) || input.frameDataUrl.length > 700_000) {
    return { ok: false, code: "INVALID_IMAGE", message: "Ảnh không hợp lệ." };
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
    return { ok: false, code: "NO_SHIFT", message: "Hôm nay bạn không có ca làm. Liên hệ HR nếu cần bổ sung." };
  }
  const meta = list.find((l) => l.id === resolved.assignment_id)?.meta as {
    grace_in_min: number; grace_out_min: number; rounding_min: number;
  };

  if (input.direction === "check_out") {
    const status = await getTodayStatus();
    if (!status.eligible || !status.canCheckOut) {
      return { ok: false, code: "OUT_WITHOUT_IN", message: "Chưa có check-in hợp lệ hôm nay. Nếu quên, hãy gửi yêu cầu chỉnh công." };
    }
  } else {
    const status = await getTodayStatus();
    if (status.eligible && !status.canCheckIn && status.lastEvent?.event_type === "check_in") {
      return { ok: false, code: "ALREADY_CHECKED_IN", message: "Bạn đã check-in. Hãy check-out khi ra về." };
    }
  }

  const provider = getFaceProvider();
  const fixture: FaceFixture = provider.isDemo && input.fixture && FIXTURES.includes(input.fixture) ? input.fixture : "good";

  let liveness: string;
  let confidence = 0;
  let ref: string | null = null;
  try {
    const liv = await withProviderTimeout(provider.checkLiveness({ image: fixture }), PROVIDER_TIMEOUT_MS);
    liveness = liv.status;
    if (liveness === "pass" || liveness === "unknown") {
      const v = await withProviderTimeout(
        provider.verify1to1({ providerSubjectId: ctx.subjectId, image: fixture }),
        PROVIDER_TIMEOUT_MS,
      );
      confidence = v.confidence;
      ref = v.providerReference;
      if (v.liveness === "fail") liveness = "fail";
    }
  } catch {
    return { ok: false, code: "PROVIDER_UNAVAILABLE", message: "Dịch vụ nhận diện bận. Giữ nguyên trang và bấm Thử lại (không tạo trùng), hoặc dùng phương thức thay thế." };
  }

  const decision = decideVerification({
    liveness: liveness as "pass" | "fail" | "unknown",
    confidence,
    threshold: VERIFY_THRESHOLD,
    reviewBandLow: REVIEW_BAND_LOW,
  });

  const failedEvent = async (reason: string) => {
    await recordViaRpc(supabase, {
      employee_id: ctx.emp.id, assignment_id: resolved.assignment_id, event_type: input.direction,
      status: "failed", method: "face", verification_ref: ref, liveness, confidence,
      idempotency_key: input.idempotencyKey, note: reason,
      work_date: resolved.work_date, shift_id: resolved.shift_id, late_min: 0, early_leave_min: 0,
    });
  };

  if (decision.outcome === "failed") {
    await failedEvent(decision.reason);
    revalidatePath("/check-in");
    if (decision.reason === "LIVENESS_FAILED") {
      return { ok: false, code: "LIVENESS_FAILED", message: "Không xác định được người thật. Thử lại đủ sáng/nhìn thẳng, hoặc dùng phương thức thay thế." };
    }
    return { ok: false, code: "NO_MATCH", message: "Khuôn mặt không khớp mẫu đã đăng ký. Thử lại hoặc dùng phương thức thay thế." };
  }

  const eventStatus = decision.outcome === "success" ? "success" : "pending_review";
  const late = input.direction === "check_in"
    ? minutesLate(now, resolved.shift.start_time, meta.grace_in_min, meta.rounding_min, ctx.tz)
    : 0;
  const early = input.direction === "check_out"
    ? minutesEarlyLeave(now, resolved.shift.end_time, meta.grace_out_min, meta.rounding_min, ctx.tz)
    : 0;
  const note = provider.isDemo ? "[DEMO] mock verification — không phải chấm công production" : null;

  const { data, error } = await recordViaRpc(supabase, {
    employee_id: ctx.emp.id, assignment_id: resolved.assignment_id, event_type: input.direction,
    status: eventStatus, method: "face", verification_ref: ref, liveness, confidence,
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
        };
      }
    }
    logger.warn("verifyCheck record failed", { code: error.code });
    return { ok: false, code: "RECORD_FAILED", message: "Không ghi được chấm công, vui lòng thử lại." };
  }
  revalidatePath("/check-in");
  if (eventStatus === "pending_review") {
    return {
      ok: true, direction: input.direction, occurred_at: (data as { occurred_at: string }).occurred_at,
      status: "pending_review", late_min: late, early_leave_min: early,
      message: "Độ khớp thấp — đã ghi nhận và chuyển HR rà soát (không coi là gian lận).",
    };
  }
  return {
    ok: true, direction: input.direction, occurred_at: (data as { occurred_at: string }).occurred_at,
    status: "success", late_min: late, early_leave_min: early,
    message: input.direction === "check_in"
      ? (late > 0 ? `Check-in thành công (trễ ${late}′).` : "Check-in thành công, đúng giờ.")
      : (early > 0 ? `Check-out thành công (về sớm ${early}′).` : "Check-out thành công."),
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
    return { ok: false, code: "INVALID_KEY", message: "Idempotency key không hợp lệ." };
  }
  if (!input.reason.trim()) {
    return { ok: false, code: "REASON_REQUIRED", message: "Vui lòng nhập lý do dùng phương thức thay thế." };
  }
  const supabase = await createClient();
  const ctx = await myContext(supabase, userId);
  if (!ctx) return { ok: false, code: "NOT_ELIGIBLE", message: "Tài khoản chưa phải nhân viên đang làm việc." };

  const rl = checkRateLimit(`verify:${userId}`, VERIFY_LIMIT.max, VERIFY_LIMIT.windowMs);
  if (!rl.allowed) return { ok: false, code: "RATE_LIMITED", message: "Bạn thao tác quá nhanh." };

  const now = new Date();
  const { data: assignments } = await supabase
    .from("shift_assignments")
    .select("id, shift_id, effective_from, effective_to, work_shifts!inner(start_time, end_time, overnight)")
    .eq("employee_id", ctx.emp.id);
  const list = ((assignments ?? []) as unknown as Array<Record<string, unknown>>).map((a) => {
    const s = a.work_shifts as { start_time: string; end_time: string; overnight: boolean };
    return {
      id: a.id as string, shift_id: a.shift_id as string,
      effective_from: a.effective_from as string, effective_to: (a.effective_to as string) ?? null,
      shift: { start_time: (s.start_time as string).slice(0, 5), end_time: (s.end_time as string).slice(0, 5), overnight: s.overnight as boolean },
    };
  });
  const resolved = resolveShiftFor(now, wallMinutes(now, ctx.tz), list, ctx.tz);
  if (!resolved) return { ok: false, code: "NO_SHIFT", message: "Hôm nay bạn không có ca làm." };

  const { data, error } = await recordViaRpc(supabase, {
    employee_id: ctx.emp.id, assignment_id: resolved.assignment_id, event_type: input.direction,
    status: "fallback", method: "pin_fallback", verification_ref: null, liveness: null, confidence: null,
    idempotency_key: input.idempotencyKey, note: input.reason.trim().slice(0, 500),
    work_date: resolved.work_date, shift_id: resolved.shift_id, late_min: 0, early_leave_min: 0,
  });
  if (error?.code === "23505") {
    return { ok: false, code: "DUPLICATE", message: "Yêu cầu đã được ghi nhận trước đó." };
  }
  if (error || !data) {
    logger.warn("fallbackCheck record failed", { code: error?.code });
    return { ok: false, code: "RECORD_FAILED", message: "Không ghi được, vui lòng thử lại." };
  }
  revalidatePath("/check-in");
  return {
    ok: true, direction: input.direction, occurred_at: (data as { occurred_at: string }).occurred_at,
    status: "fallback", late_min: 0, early_leave_min: 0,
    message: "Đã ghi nhận phương thức thay thế, chờ HR xác nhận.",
  };
}
