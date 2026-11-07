import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type CardVariant = "default" | "flat" | "interactive";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const VARIANTS: Record<CardVariant, string> = {
  default:
    "border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]",
  flat: "border border-[var(--border)] bg-[var(--surface)]",
  interactive:
    "border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-1 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-card-hover)]",
};

export function Card({ className, variant = "default", ...rest }: CardProps) {
  return (
    <div
      className={cn("rounded-[var(--radius-card)] p-5", VARIANTS[variant], className)}
      {...rest}
    />
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn("text-[15px] font-bold tracking-[-0.015em] text-[var(--navy-900)]", className)}>
      {children}
    </h2>
  );
}

export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mt-1 text-[13px] leading-relaxed text-[var(--text-2)]", className)}>{children}</p>;
}

/** Header thẻ: tiêu đề + mô tả + action bên phải. */
export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
