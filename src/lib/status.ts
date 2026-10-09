/** UI status metadata: every state has text + icon, never color alone. */
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

export const UI_STATUS: Record<UiStatus, { label: string; icon: string }> = {
  idle: { label: "Chưa thực hiện", icon: "○" },
  loading: { label: "Đang xử lý…", icon: "◌" },
  success: { label: "Thành công", icon: "✓" },
  error: { label: "Lỗi", icon: "✕" },
  pending: { label: "Chờ duyệt", icon: "⏳" },
  approved: { label: "Đã duyệt", icon: "✓" },
  rejected: { label: "Từ chối", icon: "✕" },
  ontime: { label: "Đúng giờ", icon: "✓" },
  late: { label: "Đi trễ", icon: "!" },
  early_leave: { label: "Về sớm", icon: "!" },
  absent: { label: "Vắng", icon: "—" },
  incomplete: { label: "Thiếu dữ liệu", icon: "?" },
  needs_review: { label: "Cần rà soát", icon: "⚑" },
};
