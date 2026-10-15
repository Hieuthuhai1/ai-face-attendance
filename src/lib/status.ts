/** UI status metadata: mọi trạng thái có label text (icon do StatusIndicator quyết định). */
export type UiStatus =
  | "idle"
  | "loading"
  | "success"
  | "error"
  | "pending"
  | "approved"
  | "rejected"
  | "ontime"
  | "late"
  | "early_leave"
  | "absent"
  | "incomplete"
  | "needs_review";

export const UI_STATUS: Record<UiStatus, { label: string }> = {
  idle: { label: "Chưa thực hiện" },
  loading: { label: "Đang xử lý…" },
  success: { label: "Thành công" },
  error: { label: "Lỗi" },
  pending: { label: "Chờ duyệt" },
  approved: { label: "Đã duyệt" },
  rejected: { label: "Từ chối" },
  ontime: { label: "Đúng giờ" },
  late: { label: "Đi trễ" },
  early_leave: { label: "Về sớm" },
  absent: { label: "Vắng" },
  incomplete: { label: "Thiếu dữ liệu" },
  needs_review: { label: "Cần rà soát" },
};
