import { UI_STATUS, type UiStatus } from "@/lib/status";
import { Badge } from "./badge";
import { Icon, type IconName } from "./icon";

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

const ICON_BY_STATUS: Record<UiStatus, IconName> = {
  idle: "info",
  loading: "refresh",
  success: "check",
  error: "x",
  pending: "clock",
  approved: "check",
  rejected: "x",
  ontime: "check",
  late: "clock",
  early_leave: "clock",
  absent: "x",
  incomplete: "alert",
  needs_review: "flag",
};

/** Luôn render icon + chữ, không chỉ dùng màu. */
export function StatusIndicator({ status }: { status: UiStatus }) {
  const meta = UI_STATUS[status];
  return (
    <Badge tone={TONE_BY_STATUS[status]}>
      <Icon name={ICON_BY_STATUS[status]} size={14} />
      {meta.label}
    </Badge>
  );
}
