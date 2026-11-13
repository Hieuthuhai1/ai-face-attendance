/**
 * Danh mục loại nghỉ dùng chung cho form tạo đơn, bảng lịch sử và trung tâm duyệt.
 * Trước đây mỗi file khai báo một map riêng nên nhãn dễ lệch nhau.
 */
export const LEAVE_TYPES = [
  { value: "annual", label: "Phép năm", icon: "calendar" },
  { value: "sick", label: "Ốm đau", icon: "alert" },
  { value: "unpaid", label: "Nghỉ không lương", icon: "calendar" },
  { value: "maternity", label: "Thai sản", icon: "calendar" },
  { value: "other", label: "Khác", icon: "file-text" },
] as const;

export type LeaveTypeValue = (typeof LEAVE_TYPES)[number]["value"];

export function leaveTypeLabel(value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  return LEAVE_TYPES.find((type) => type.value === value)?.label ?? value;
}
