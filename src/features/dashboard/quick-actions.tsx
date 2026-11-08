import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

export interface QuickActionItem {
  href: string;
  icon: IconName;
  title: string;
  description: string;
}

/** Lối tắt dùng chung cho dashboard nhân viên và quản lý. */
export function QuickActions({
  actions,
  className,
}: {
  actions: QuickActionItem[];
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {actions.map((action) => (
        <Link
          key={`${action.href}-${action.title}`}
          href={action.href}
          className="group relative flex h-full flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-1 hover:border-[var(--brand)]/35 hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-icon)] bg-[var(--brand-soft)] text-[var(--brand)] ring-1 ring-blue-100 transition-colors duration-200 group-hover:[background-image:var(--brand-gradient)] group-hover:text-white group-hover:ring-transparent">
              <Icon name={action.icon} size={20} />
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-3)] transition-all duration-200 group-hover:border-[var(--brand)]/30 group-hover:bg-[var(--brand-soft)] group-hover:text-[var(--brand)]">
              <Icon name="arrow-up-right" size={14} />
            </span>
          </div>
          <p className="mt-4 text-[14.5px] font-semibold tracking-[-0.01em] text-[var(--navy-900)]">
            {action.title}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-2)]">
            {action.description}
          </p>
        </Link>
      ))}
    </div>
  );
}

/** Bộ thao tác nhanh mặc định cho nhân viên. */
export const EMPLOYEE_QUICK_ACTIONS: QuickActionItem[] = [
  { href: "/check-in", icon: "camera", title: "Chấm công", description: "Xác minh khuôn mặt 1:1" },
  { href: "/history", icon: "clock", title: "Lịch sử", description: "Bảng công và lượt chấm" },
  { href: "/requests", icon: "file-text", title: "Yêu cầu", description: "Chỉnh công, nghỉ phép" },
  { href: "/enrollment", icon: "scan-face", title: "Khuôn mặt", description: "Trạng thái đăng ký" },
];
