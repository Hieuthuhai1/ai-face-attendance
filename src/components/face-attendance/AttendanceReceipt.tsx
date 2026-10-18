"use client";

import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AttendanceReceiptProps {
  employeeName: string;
  employeeCode: string;
  action: "check_in" | "check_out";
  occurredAt: string;
  shiftName: string;
  shiftTime: string;
  status: "success" | "pending_review" | "fallback";
  lateMinutes?: number;
  earlyMinutes?: number;
  method: "face" | "pin_fallback" | "manual";
  confidence?: number | null;
  livenessStatus?: string | null;
  verificationRef?: string | null;
  onContinue?: () => void;
  onFallback?: () => void;
  className?: string;
}

const STATUS_CONFIG = {
  success: {
    label: "Thành công",
    icon: "check",
    tone: "success" as const,
    color: "text-[var(--success)]",
    bgColor: "bg-[var(--success-bg)]",
    borderColor: "border-[var(--success)]",
  },
  pending_review: {
    label: "Chờ rà soát",
    icon: "flag",
    tone: "warning" as const,
    color: "text-[var(--warning)]",
    bgColor: "bg-[var(--warning-bg)]",
    borderColor: "border-[var(--warning)]",
  },
  fallback: {
    label: "Phương thức thay thế",
    icon: "clock",
    tone: "info" as const,
    color: "text-[var(--info)]",
    bgColor: "bg-[var(--info-bg)]",
    borderColor: "border-[var(--info)]",
  },
} as const;

const METHOD_LABELS = {
  face: "Nhận diện khuôn mặt",
  pin_fallback: "PIN thay thế",
  manual: "Thủ công",
} as const;

const METHOD_ICONS = {
  face: "camera",
  pin_fallback: "key",
  manual: "edit",
} as const;

export function AttendanceReceipt({
  employeeName,
  employeeCode,
  action,
  occurredAt,
  shiftName,
  shiftTime,
  status,
  lateMinutes,
  earlyMinutes,
  method,
  confidence,
  livenessStatus,
  verificationRef,
  onContinue,
  onFallback,
  className,
}: AttendanceReceiptProps) {
  const config = STATUS_CONFIG[status];
  const date = new Date(occurredAt);
  const timeStr = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = date.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  const actionLabel = action === "check_in" ? "Check-in" : "Check-out";

  return (
    <div className={cn("rounded-2xl border p-6 shadow-sm", config.borderColor, config.bgColor, className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl", config.bgColor, config.color)}>
            <Icon name={config.icon} size={28} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{actionLabel} {config.label}</p>
            <p className="text-sm text-slate-500">
              {dateStr} · {timeStr} · Giờ máy chủ
            </p>
          </div>
        </div>
        <Badge tone={config.tone} className="text-xs">
          <Icon name={config.icon} size={12} /> {config.label}
        </Badge>
      </div>

      {/* Employee & Shift Info */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <div className={cn("rounded-xl p-4", config.bgColor)}>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Nhân viên</p>
          <p className="text-lg font-semibold text-slate-900">{employeeName}</p>
          <p className="text-sm text-slate-500">Mã: {employeeCode}</p>
        </div>
        <div className={cn("rounded-xl p-4", config.bgColor)}>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Ca làm việc</p>
          <p className="text-lg font-semibold text-slate-900">{shiftName}</p>
          <p className="text-sm text-slate-500">{shiftTime}</p>
        </div>
      </div>

      {/* Late/Early indicators */}
      {(lateMinutes && lateMinutes > 0) || (earlyMinutes && earlyMinutes > 0) ? (
        <div className="flex gap-3 mb-6">
          {lateMinutes && lateMinutes > 0 && (
            <div className="flex-1 rounded-xl bg-[var(--warning-bg)] border border-[var(--warning)] p-4">
              <div className="flex items-center gap-2 text-[var(--warning)]">
                <Icon name="clock" size={20} />
                <span className="font-medium">Đi muộn</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-[var(--warning)]">{lateMinutes} phút</p>
            </div>
          )}
          {earlyMinutes && earlyMinutes > 0 && (
            <div className="flex-1 rounded-xl bg-[var(--info-bg)] border border-[var(--info)] p-4">
              <div className="flex items-center gap-2 text-[var(--info)]">
                <Icon name="clock" size={20} />
                <span className="font-medium">Về sớm</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-[var(--info)]">{earlyMinutes} phút</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 mb-6 p-4 rounded-xl bg-[var(--success-bg)] border border-[var(--success)]">
          <Icon name="check" size={20} className="text-[var(--success)]" />
          <span className="font-medium text-[var(--success)]">Đúng giờ - Không muộn, không về sớm</span>
        </div>
      )}

      {/* Method & Verification Details */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Chi tiết xác minh</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">Phương thức</p>
            <p className="flex items-center gap-1 font-medium text-slate-900">
              <Icon name={METHOD_ICONS[method]} size={14} />
              {METHOD_LABELS[method]}
            </p>
          </div>
          {confidence !== null && confidence !== undefined && (
            <div>
              <p className="text-xs text-slate-500">Độ khớp (confidence)</p>
              <p className="font-mono font-semibold text-lg text-slate-900">
                {(confidence * 100).toFixed(1)}%
              </p>
            </div>
          )}
          {livenessStatus && (
            <div>
              <p className="text-xs text-slate-500">Liveness</p>
              <p className={cn("font-medium capitalize", livenessStatus === "pass" ? "text-[var(--success)]" : livenessStatus === "fail" ? "text-[var(--danger)]" : "text-slate-600")}>
                {livenessStatus}
              </p>
            </div>
          )}
          {verificationRef && (
            <div>
              <p className="text-xs text-slate-500">Mã tham chiếu</p>
              <p className="font-mono text-xs text-slate-600 truncate">{verificationRef}</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          onClick={onContinue}
        >
          <Icon name="arrow-right" size={18} /> Tiếp tục
        </Button>
        {status !== "success" && onFallback && (
          <Button variant="secondary" size="lg" className="flex-1" onClick={onFallback}>
            <Icon name="rotate-ccw" size={18} /> Dùng phương thức thay thế
          </Button>
        )}
      </div>

      {/* Timestamp footer */}
      <p className="mt-4 text-center text-xs text-slate-400 font-mono">
        Bản ghi được tạo lúc {new Date(occurredAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · Giờ do máy chủ ghi nhận
      </p>
    </div>
  );
}