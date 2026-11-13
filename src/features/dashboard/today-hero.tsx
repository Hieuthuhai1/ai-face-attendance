import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { BadgeTone, TodayShift } from "./today-summary";

export interface TodayHeroProps {
  employeeName: string;
  employeeCode?: string | null;
  department?: string | null;
  shift: TodayShift | null;
  statusLabel: string;
  statusTone: BadgeTone;
  hasEnrollment: boolean;
  enrollmentState: string;
  canCheckIn: boolean;
  canCheckOut: boolean;
  firstInLabel: string;
  lastOutLabel: string;
  workedLabel: string;
  lastEventAt?: string | null;
  todayCount: number;
}

function ShiftTimeChip({ label, time }: { label: string; time: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[13px] font-semibold text-white ring-1 ring-inset ring-white/10">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/70">
        {label}
      </span>
      <span className="tnum">{time}</span>
    </span>
  );
}

function EnrollmentBadge({
  hasEnrollment,
  enrollmentState,
}: {
  hasEnrollment: boolean;
  enrollmentState: string;
}) {
  if (hasEnrollment) {
    return (
      <Badge tone="success">
        <Icon name="check" size={12} /> Khuôn mặt sẵn sàng
      </Badge>
    );
  }
  if (enrollmentState === "pending") {
    return <Badge tone="warning">Khuôn mặt chờ duyệt</Badge>;
  }
  return <Badge tone="warning">Chưa đăng ký khuôn mặt</Badge>;
}

/** Hero card "Ca làm hôm nay" — thành phần nổi bật nhất của dashboard nhân viên. */
export function TodayHero({
  employeeName,
  employeeCode,
  department,
  shift,
  statusLabel,
  statusTone,
  hasEnrollment,
  enrollmentState,
  canCheckIn,
  canCheckOut,
  firstInLabel,
  lastOutLabel,
  workedLabel,
  lastEventAt,
  todayCount,
}: TodayHeroProps) {
  const identity = [employeeCode, department].filter(Boolean).join(" · ");

  const primaryAction = canCheckOut ? (
    <Link href="/check-in" className={buttonClassName({ variant: "inverse", size: "lg", className: "h-12 w-full text-[15px]" })}>
      <Icon name="logout" size={19} /> Chấm công ra
    </Link>
  ) : canCheckIn ? (
    <Link href="/check-in" className={buttonClassName({ variant: "inverse", size: "lg", className: "h-12 w-full text-[15px]" })}>
      <Icon name="camera" size={19} /> Chấm công vào
    </Link>
  ) : !hasEnrollment ? (
    <Link href="/enrollment" className={buttonClassName({ variant: "glass", size: "lg", className: "h-12 w-full text-[15px]" })}>
      <Icon name="scan-face" size={19} /> Đăng ký khuôn mặt
    </Link>
  ) : (
    <Link href="/history" className={buttonClassName({ variant: "glass", size: "lg", className: "h-12 w-full text-[15px]" })}>
      <Icon name="clock" size={19} /> Xem lịch sử
    </Link>
  );

  return (
    <section
      aria-labelledby="today-shift-heading"
      className="relative overflow-hidden rounded-[var(--radius-card)] text-white shadow-[0_28px_64px_-34px_rgba(10,18,41,0.8)] ring-1 ring-white/10 [background-image:var(--hero-gradient)]"
    >
      {/* Điểm nhấn ánh sáng + lưới mờ tạo chiều sâu, không ảnh hưởng nội dung */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[var(--brand)]/35 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-[var(--accent)]/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:linear-gradient(to_right,rgba(255,255,255,0.28)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.28)_1px,transparent_1px)] [background-size:36px_36px]"
      />

      <div className="relative grid gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] xl:items-stretch xl:gap-8 xl:p-8">
        <div className="flex min-w-0 flex-col">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
            <Icon name="clock" size={14} className="text-[var(--accent)]" /> Ca làm hôm nay
          </p>

          <h2
            id="today-shift-heading"
            className="mt-2 text-[26px] font-bold leading-tight tracking-[-0.02em] sm:text-[32px]"
          >
            {shift ? shift.name : "Chưa có ca làm"}
          </h2>

          {shift ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ShiftTimeChip label="Vào" time={shift.start_time} />
              <Icon name="arrow-right" size={14} className="text-white/55" />
              <ShiftTimeChip label="Ra" time={shift.end_time} />
              {shift.overnight ? (
                <span className="text-[12px] font-medium text-white/70">· qua đêm</span>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-white/75">
              Liên hệ quản lý nếu bạn cần được phân ca hôm nay.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone={statusTone}>{statusLabel}</Badge>
            <EnrollmentBadge hasEnrollment={hasEnrollment} enrollmentState={enrollmentState} />
            {lastEventAt ? (
              <span className="text-[12px] text-white/70">Cập nhật {lastEventAt}</span>
            ) : null}
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-3 pt-7">
            <Avatar name={employeeName} size="lg" className="ring-2 ring-white/25" />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-white">{employeeName}</p>
              <p className="truncate text-[12px] text-white/70">{identity || "Nhân viên"}</p>
            </div>
            <span className="ml-auto hidden items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1 text-[12px] font-medium text-white/75 ring-1 ring-inset ring-white/10 sm:inline-flex">
              <Icon name="activity" size={13} />
              {todayCount} lượt hôm nay
            </span>
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur-sm sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
            Hành động chính
          </p>

          <div className="mt-3 flex flex-col gap-2">
            {primaryAction}
            {canCheckOut || canCheckIn || !hasEnrollment ? (
              <Link href="/history" className={buttonClassName({ variant: "glass", size: "md", className: "w-full" })}>
                <Icon name="clock" size={16} /> Xem lịch sử hôm nay
              </Link>
            ) : null}
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3.5">
            <div className="min-w-0">
              <dt className="text-[11px] font-medium text-white/70">Giờ vào</dt>
              <dd className="tnum mt-1 text-[15px] font-semibold leading-none text-white">
                {firstInLabel}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-medium text-white/70">Giờ ra</dt>
              <dd className="tnum mt-1 text-[15px] font-semibold leading-none text-white">
                {lastOutLabel}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-medium text-white/70">Đã làm</dt>
              <dd className="tnum mt-1 text-[15px] font-semibold leading-none text-white">
                {workedLabel}
              </dd>
            </div>
          </dl>

          <p className="mt-auto flex items-center gap-1.5 pt-3.5 text-[11px] text-white/70">
            <Icon name="shield" size={12} /> Xác minh 1:1 · Không lưu ảnh thô
          </p>
        </div>
      </div>
    </section>
  );
}
