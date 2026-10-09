/** App-wide config: public values + ngưỡng verify (số, không phải secret). */

export const APP_TZ = process.env.NEXT_PUBLIC_APP_TZ ?? "Asia/Ho_Chi_Minh";

/** Hiển thị banner DEMO khi dùng mock provider ở client. */
export const SHOW_FACE_DEMO_BANNER =
  process.env.NEXT_PUBLIC_FACE_DEMO_BANNER !== "false";

/** Ngưỡng verify khuôn mặt — cấu hình được, không hardcode ở call-site. */
export const VERIFY_THRESHOLD = Number(process.env.VERIFY_THRESHOLD ?? 0.72);
export const REVIEW_BAND_LOW = Number(process.env.REVIEW_BAND_LOW ?? 0.6);

/** Vai trò hệ thống (đồng bộ với đặc tả §3; RLS chi tiết ở Phase 2). */
export const ROLES = ["employee", "manager", "hr_admin", "system_admin"] as const;
export type Role = (typeof ROLES)[number];
export const DEFAULT_ROLE: Role = "employee";
