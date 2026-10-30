import type { ReactNode } from "react";
import { Button } from "./button";
import { Icon } from "./icon";
import { ScanLoader } from "./loading-screen";

export function LoadingState({ message = "Đang tải dữ liệu…" }: { message?: string }) {
  return <ScanLoader message={message} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="text-slate-300">
        <Icon name="inbox" size={32} />
      </span>
      <p className="font-medium text-slate-800">{title}</p>
      {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      {action}
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
    <div role="alert" className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="text-[var(--danger)]">
        <Icon name="x" size={28} />
      </span>
      <p className="font-medium text-slate-800">{title}</p>
      {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Thử lại
        </Button>
      ) : null}
    </div>
  );
}
