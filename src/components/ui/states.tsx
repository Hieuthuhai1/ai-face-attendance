import type { ReactNode } from "react";
import { Button } from "./button";
import { Icon, type IconName } from "./icon";
import { ScanLoader } from "./loading-screen";

export function LoadingState({ message = "Đang tải dữ liệu…" }: { message?: string }) {
  return <ScanLoader message={message} />;
}

export function EmptyState({
  title,
  description,
  action,
  icon = "inbox",
  compact = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: IconName;
  /** Bản gọn cho empty state nằm trong card nhỏ (không tạo khoảng trống lớn). */
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "flex flex-col items-center gap-1.5 px-4 py-8 text-center"
          : "flex flex-col items-center gap-2 px-6 py-14 text-center"
      }
    >
      <span
        className={
          compact
            ? "flex h-11 w-11 items-center justify-center rounded-[var(--radius-icon)] bg-[var(--brand-soft)] text-[var(--brand)] ring-1 ring-blue-100"
            : "flex h-14 w-14 items-center justify-center rounded-[var(--radius-icon)] bg-[var(--brand-soft)] text-[var(--brand)] ring-1 ring-blue-100"
        }
      >
        <Icon name={icon} size={compact ? 20 : 26} />
      </span>
      <p className={compact ? "mt-1 text-[14px] font-semibold text-[var(--navy-900)]" : "mt-2 text-[15px] font-semibold text-[var(--navy-900)]"}>
        {title}
      </p>
      {description ? (
        <p className="max-w-sm text-[13px] leading-relaxed text-[var(--text-2)]">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Đã xảy ra lỗi",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-icon)] bg-[var(--danger-bg)] text-[var(--danger)] ring-1 ring-[var(--danger-border)]">
        <Icon name="alert" size={24} />
      </span>
      <p className="mt-2 text-[15px] font-semibold text-[var(--navy-900)]">{title}</p>
      {description ? <p className="max-w-sm text-[13px] leading-relaxed text-[var(--text-2)]">{description}</p> : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
          <Icon name="refresh" size={14} /> Thử lại
        </Button>
      ) : null}
    </div>
  );
}
