import { z } from "zod";

/** Conventions: mọi input ở biên (form + API) đều validate qua zod tại đây. */

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Vui lòng nhập email").email("Email chưa đúng định dạng"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

export const employeeCodeSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập mã nhân viên")
  .max(32, "Mã nhân viên tối đa 32 ký tự")
  .regex(/^[A-Za-z0-9-_]+$/, "Mã nhân viên chỉ gồm chữ, số, - và _");

export const idempotencyKeySchema = z
  .string()
  .regex(/^evt_[0-9a-f-]{36}$/, "Idempotency key chưa đúng định dạng");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type LoginInput = z.infer<typeof loginSchema>;
