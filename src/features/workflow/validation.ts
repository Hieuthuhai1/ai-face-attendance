import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải dạng YYYY-MM-DD");
const datetimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Giờ phải dạng YYYY-MM-DDTHH:MM");

export const adjustmentFormSchema = z
  .object({
    work_date: dateSchema,
    event_id: z.string().trim().min(1).nullable().default(null),
    requested_in: datetimeSchema.nullable().default(null),
    requested_out: datetimeSchema.nullable().default(null),
    reason: z.string().trim().min(5, "Lý do tối thiểu 5 ký tự").max(1000),
  })
  .refine((v) => v.requested_in !== null || v.requested_out !== null, {
    message: "Cần đề xuất ít nhất giờ vào hoặc giờ ra.",
  })
  .refine(
    (v) => !v.requested_in || !v.requested_out || v.requested_out >= v.requested_in,
    { message: "Giờ ra đề xuất phải sau giờ vào.", path: ["requested_out"] },
  );

export const leaveFormSchema = z
  .object({
    leave_type: z.string().trim().min(1, "Vui lòng chọn loại nghỉ").max(32),
    start_date: dateSchema,
    end_date: dateSchema,
    reason: z.string().trim().min(5, "Lý do tối thiểu 5 ký tự").max(1000),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: "Ngày kết thúc phải sau ngày bắt đầu.",
    path: ["end_date"],
  });

export const reviewSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    note: z.string().trim().max(1000).default(""),
  })
  .refine((v) => v.decision === "approved" || v.note.length >= 5, {
    message: "Từ chối cần lý do tối thiểu 5 ký tự.",
    path: ["note"],
  });

export type AdjustmentForm = z.infer<typeof adjustmentFormSchema>;
export type LeaveForm = z.infer<typeof leaveFormSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
