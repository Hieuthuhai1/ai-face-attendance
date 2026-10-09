import { UI_STATUS, type UiStatus } from "@/lib/status";
import { Badge } from "./badge";

const TONE_BY_STATUS: Record<UiStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  idle: "neutral",
  loading: "info",
  success: "success",
  error: "danger",
  pending: "warning",
  approved: "success",
  rejected: "danger",
  ontime: "success",
  late: "warning",
  early_leave: "warning",
  absent: "danger",
  incomplete: "warning",
  needs_review: "warning",
};

/** Luôn render icon + chữ, không chỉ dùng màu. */
export function StatusIndicator({ status }: { status: UiStatus }) {
  const meta = UI_STATUS[status];
  return (
    <Badge tone={TONE_BY_STATUS[status]}>
      <span aria-hidden="true" className="mr-1">
        {meta.icon}
      </span>
      {meta.label}
    </Badge>
  );
}
