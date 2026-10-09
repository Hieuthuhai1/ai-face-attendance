"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/server/logger";
import {
  adjustmentFormSchema,
  leaveFormSchema,
  reviewSchema,
  type AdjustmentForm,
  type LeaveForm,
  type ReviewInput,
} from "@/features/workflow/validation";

export type WorkflowResult = { ok: true } | { ok: false; code: string; message: string };
type Db = Awaited<ReturnType<typeof createClient>>;
const REVIEW = ["manager", "hr_admin", "system_admin"] as const;

async function myEmployeeId(supabase: Db, userId: string): Promise<string | null> {
  const { data } = await supabase.from("employees").select("id").eq("profile_id", userId).single();
  return ((data as { id: string } | null)?.id) ?? null;
}

function mapRpcError(code: string | undefined, message: string | undefined): { code: string; message: string } {
  if (message === "ALREADY_DECIDED") return { code: "ALREADY_DECIDED", message: "Yêu cầu đã được xử lý trước đó." };
  if (message === "NOT_FOUND") return { code: "NOT_FOUND", message: "Yêu cầu không tồn tại." };
  if (code === "42501" || message === "FORBIDDEN_REVIEWER") {
    return { code: "FORBIDDEN", message: "Bạn không có quyền duyệt yêu cầu này." };
  }
  return { code: code ?? "REVIEW_FAILED", message: "Không xử lý được, vui lòng thử lại." };
}

// ============================ adjustments ============================

export async function createAdjustment(input: AdjustmentForm): Promise<WorkflowResult> {
  const { userId } = await requireUser();
  const parsed = adjustmentFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const supabase = await createClient();
  const empId = await myEmployeeId(supabase, userId);
  if (!empId) return { ok: false, code: "NOT_ELIGIBLE", message: "Không tìm thấy hồ sơ nhân viên." };

  // event (nếu có) phải thuộc chính employee — chống sửa dữ liệu người khác.
  if (parsed.data.event_id) {
    const { data: ev } = await supabase
      .from("attendance_events")
      .select("id, employee_id")
      .eq("id", parsed.data.event_id)
      .single();
    if (!ev || (ev as { employee_id: string }).employee_id !== empId) {
      return { ok: false, code: "FORBIDDEN", message: "Bản ghi chấm công không thuộc về bạn." };
    }
  }

  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
  const orgId = (profile as { organization_id: string } | null)?.organization_id;
  if (!orgId) return { ok: false, code: "NO_ORG", message: "Tài khoản chưa thuộc tổ chức." };

  // Chống request trùng: cùng employee + ngày + trạng thái pending đã tồn tại.
  const { data: dup } = await supabase
    .from("attendance_adjustment_requests")
    .select("id")
    .eq("employee_id", empId)
    .eq("work_date", parsed.data.work_date)
    .eq("status", "pending")
    .limit(1);
  if ((dup as Array<unknown> | null)?.length) {
    return { ok: false, code: "DUPLICATE", message: "Đã có yêu cầu đang chờ cho ngày này." };
  }

  const { error } = await supabase.from("attendance_adjustment_requests").insert({
    organization_id: orgId,
    employee_id: empId,
    event_id: parsed.data.event_id,
    work_date: parsed.data.work_date,
    requested_in: parsed.data.requested_in ? new Date(parsed.data.requested_in).toISOString() : null,
    requested_out: parsed.data.requested_out ? new Date(parsed.data.requested_out).toISOString() : null,
    reason: parsed.data.reason,
    status: "pending",
  });
  if (error) {
    logger.warn("createAdjustment failed", { code: error.code });
    return { ok: false, code: "SUBMIT_FAILED", message: "Không gửi được yêu cầu." };
  }
  revalidatePath("/adjustments");
  return { ok: true };
}

/** Duyệt qua RPC: idempotent, phân quyền trong DB, áp correction + audit cùng transaction. */
export async function reviewAdjustment(id: string, input: ReviewInput): Promise<WorkflowResult> {
  await requireRole([...REVIEW]);
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_adjustment_request", {
    p_request_id: id,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note || null,
  });
  if (error) {
    const e = error as { code?: string; message?: string };
    const mapped = mapRpcError(e.code, e.message);
    if (mapped.code !== "ALREADY_DECIDED") logger.warn("reviewAdjustment failed", { code: e.code });
    return { ok: false, ...mapped };
  }
  revalidatePath("/adjustments");
  revalidatePath("/reports");
  return { ok: true };
}

// ============================ leave ============================

export async function createLeave(input: LeaveForm): Promise<WorkflowResult> {
  const { userId } = await requireUser();
  const parsed = leaveFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const supabase = await createClient();
  const empId = await myEmployeeId(supabase, userId);
  if (!empId) return { ok: false, code: "NOT_ELIGIBLE", message: "Không tìm thấy hồ sơ nhân viên." };
  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
  const orgId = (profile as { organization_id: string } | null)?.organization_id;
  if (!orgId) return { ok: false, code: "NO_ORG", message: "Tài khoản chưa thuộc tổ chức." };

  const { error } = await supabase.from("leave_requests").insert({
    organization_id: orgId,
    employee_id: empId,
    leave_type: parsed.data.leave_type,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    reason: parsed.data.reason,
    status: "pending",
  });
  if (error) {
    logger.warn("createLeave failed", { code: error.code });
    return { ok: false, code: "SUBMIT_FAILED", message: "Không gửi được đơn nghỉ." };
  }
  revalidatePath("/leave");
  return { ok: true };
}

export async function reviewLeave(id: string, input: ReviewInput): Promise<WorkflowResult> {
  const { userId, profile } = await requireRole([...REVIEW]);
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const supabase = await createClient();
  // Chỉ duyệt pending (idempotent ở tầng app; RLS giới hạn phạm vi team/org).
  const { data: row } = await supabase
    .from("leave_requests")
    .select("id, status, organization_id, employee_id")
    .eq("id", id)
    .single();
  const req = row as { status: string; organization_id: string; employee_id: string } | null;
  if (!req) return { ok: false, code: "NOT_FOUND", message: "Đơn không tồn tại." };
  if (req.status !== "pending") return { ok: false, code: "ALREADY_DECIDED", message: "Đơn đã được xử lý trước đó." };
  if (profile.role === "manager") {
    const { data: team } = await supabase
      .from("employees")
      .select("id")
      .eq("id", req.employee_id)
      .eq("manager_id", await myEmployeeId(supabase, userId));
    if (!(team as Array<unknown> | null)?.length) {
      return { ok: false, code: "FORBIDDEN", message: "Đơn ngoài phạm vi quản lý của bạn." };
    }
  }
  const { data: updated, error } = await supabase
    .from("leave_requests")
    .update({ status: parsed.data.decision, reviewer_id: userId, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending") // optimistic concurrency: chỉ đổi khi còn pending
    .select("id");
  if (error) {
    logger.warn("reviewLeave failed", { code: error.code });
    return { ok: false, code: "REVIEW_FAILED", message: "Không xử lý được." };
  }
  if (!(updated as Array<unknown> | null)?.length) {
    return { ok: false, code: "ALREADY_DECIDED", message: "Đơn đã được xử lý hoặc ngoài phạm vi của bạn." };
  }
  await supabase.from("audit_logs").insert({
    organization_id: req.organization_id,
    actor_id: userId,
    action: `leave.${parsed.data.decision}`,
    resource_type: "leave_request",
    resource_id: id,
    metadata: { note: parsed.data.note || null },
  });
  revalidatePath("/leave");
  return { ok: true };
}
