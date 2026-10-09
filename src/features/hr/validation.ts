import { z } from "zod";
import { employeeCodeSchema } from "@/lib/validation";

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Giờ phải dạng HH:MM (00:00–23:59)");

/** ID tham chiếu: chỉ yêu cầu non-empty. Tính hợp lệ + đúng org được server
 *  verify trực tiếp với DB (assertSameOrg + RLS), vì seed/test IDs không phải RFC UUID. */
const refId = (label: string) => z.string().trim().min(1, `${label} chưa hợp lệ`);

export const employeeFormSchema = z.object({
  employee_code: employeeCodeSchema,
  display_name: z.string().trim().min(1, "Vui lòng nhập họ tên").max(128),
  department_id: z.string().trim().min(1).nullable(),
  manager_id: z.string().trim().min(1).nullable(),
  title: z.string().trim().max(128).default(""),
  employment_status: z.enum(["active", "inactive", "terminated"]).default("active"),
});

export const shiftFormSchema = z
  .object({
    name: z.string().trim().min(1, "Vui lòng nhập tên ca").max(64),
    start_time: timeSchema,
    end_time: timeSchema,
    overnight: z.boolean().default(false),
    grace_in_min: z.coerce.number().int().min(0).max(120).default(5),
    grace_out_min: z.coerce.number().int().min(0).max(120).default(5),
    rounding_min: z.coerce.number().int().min(1).max(60).default(1),
  })
  .refine((v) => v.start_time !== v.end_time, {
    message: "Giờ bắt đầu phải khác giờ kết thúc",
    path: ["end_time"],
  });

export const assignmentFormSchema = z
  .object({
    employee_id: refId("Nhân viên"),
    shift_id: refId("Ca làm"),
    effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải dạng YYYY-MM-DD"),
    effective_to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải dạng YYYY-MM-DD")
      .nullable()
      .default(null),
  })
  .refine((v) => !v.effective_to || v.effective_to >= v.effective_from, {
    message: "Ngày kết thúc phải sau ngày bắt đầu",
    path: ["effective_to"],
  });

export type EmployeeForm = z.infer<typeof employeeFormSchema>;
export type ShiftForm = z.infer<typeof shiftFormSchema>;
export type AssignmentForm = z.infer<typeof assignmentFormSchema>;
