/** App-wide config: public values + ngưỡng verify (số, không phải secret). */

export const APP_TZ = process.env.NEXT_PUBLIC_APP_TZ ?? "Asia/Ho_Chi_Minh";

/** Ngưỡng verify khuôn mặt - cấu hình được, không hardcode ở call-site.
 *  Chính sách production: độ khớp >= 75% mới chấm công thành công; dưới 75% là
 *  failed (ghi event failed, người dùng phải chấm lại). Vì vậy review band cũng
 *  đặt bằng ngưỡng để không còn nhánh pending_review do confidence thấp. */
export const VERIFY_THRESHOLD = Number(process.env.VERIFY_THRESHOLD ?? 0.75);
export const REVIEW_BAND_LOW = Number(process.env.REVIEW_BAND_LOW ?? 0.75);

/** Vai trò hệ thống (đồng bộ với đặc tả §3; RLS chi tiết ở Phase 2). */
export const ROLES = ["employee", "manager", "hr_admin", "system_admin"] as const;
export type Role = (typeof ROLES)[number];
export const DEFAULT_ROLE: Role = "employee";
