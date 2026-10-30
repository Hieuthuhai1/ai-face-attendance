import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import { CardSkeleton, Skeleton, TableSkeleton } from "./skeleton";

/**
 * Khung quét khuôn mặt — dấu hiệu nhận diện thương hiệu của app chấm công AI.
 * Thuần CSS (không JS) để hiển thị ngay cả trước khi hydrate.
 */
export function FaceScanMark({
  size = 64,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative shrink-0 overflow-hidden rounded-2xl border border-[var(--brand)]/15 bg-white/90 shadow-sm",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span className="absolute left-2 top-2 h-3 w-3 rounded-tl border-l-2 border-t-2 border-[var(--brand)]" />
      <span className="absolute right-2 top-2 h-3 w-3 rounded-tr border-r-2 border-t-2 border-[var(--brand)]" />
      <span className="absolute bottom-2 left-2 h-3 w-3 rounded-bl border-b-2 border-l-2 border-[var(--brand)]" />
      <span className="absolute bottom-2 right-2 h-3 w-3 rounded-br border-b-2 border-r-2 border-[var(--brand)]" />
      <span className="absolute inset-0 flex items-center justify-center text-[var(--brand)]">
        <Icon name="scan-face" size={Math.round(size * 0.42)} />
      </span>
      <span className="scan-line" />
    </div>
  );
}

/**
 * Màn hình chờ toàn trang: dùng cho lần tải đầu tiên / chuyển phiên.
 * Không dùng `fixed` để không che nội dung đã stream xong.
 */
export function AppLoadingScreen({
  message = "Đang kết nối hệ thống chấm công…",
}: {
  message?: string;
}) {
  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center gap-7 overflow-hidden bg-[var(--background)] px-6 py-16 text-center">
      {/* Ánh sáng nền nhẹ, không gây nhiễu nội dung */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgb(29 78 216 / 0.08) 1px, transparent 0)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="absolute left-1/2 top-1/2 h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--brand)]/[0.07] blur-3xl" />
        <div className="absolute left-[64%] top-[36%] h-[240px] w-[240px] rounded-full bg-[var(--teal-accent)]/[0.09] blur-3xl" />
      </div>

      {/* Thương hiệu */}
      <div className="relative flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand)] to-[var(--teal-accent)] text-white shadow-md shadow-[var(--brand)]/20">
          <Icon name="scan-face" size={22} />
        </span>
        <div className="text-left">
          <p className="text-base font-bold tracking-tight text-slate-900">AI Face Attendance</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Face Verification Platform
          </p>
        </div>
      </div>

      {/* Khung quét */}
      <FaceScanMark
        size={104}
        className="float-soft shadow-[0_24px_60px_-30px_rgba(29,78,216,0.65)]"
      />

      {/* Trạng thái */}
      <div className="relative flex flex-col items-center gap-3">
        <p role="status" aria-live="polite" className="text-sm font-medium text-slate-700">
          {message}
        </p>

        <div
          className="h-1 w-48 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-label="Đang tải"
        >
          <div className="loader-bar h-full w-2/5 rounded-full bg-gradient-to-r from-[var(--brand)] via-[var(--brand)] to-[var(--teal-accent)] shadow-[0_0_8px_rgba(29,78,216,0.45)]" />
        </div>

        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="loader-dot h-2 w-2 rounded-full bg-[var(--brand)]" />
          <span
            className="loader-dot h-2 w-2 rounded-full bg-[var(--brand)]"
            style={{ animationDelay: "160ms" }}
          />
          <span
            className="loader-dot h-2 w-2 rounded-full bg-[var(--brand)]"
            style={{ animationDelay: "320ms" }}
          />
        </div>
      </div>

      <p className="relative flex items-center gap-1.5 text-xs text-slate-400">
        <Icon name="shield" size={13} />
        Dữ liệu khuôn mặt được bảo vệ và không lưu ảnh thô
      </p>
    </div>
  );
}

/** Loader gọn cho Suspense fallback trong trang. */
export function ScanLoader({
  message = "Đang tải dữ liệu…",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center justify-center gap-3 py-10", className)}
    >
      <FaceScanMark size={56} />
      <p className="text-sm text-slate-600">{message}</p>
    </div>
  );
}

/**
 * Skeleton cho route chuyển trang trong khu vực đã đăng nhập:
 * giữ đúng cấu trúc header + thẻ + bảng để hạn chế layout shift.
 */
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="flex items-start gap-3">
        <Skeleton className="h-11 w-11 rounded-xl" label="" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-52" label="Đang tải tiêu đề trang" />
          <Skeleton className="mt-2 h-3 w-80 max-w-full" label="" />
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <Skeleton className="h-4 w-40" label="Đang tải nội dung" />
        <div className="mt-4">
          <TableSkeleton rows={5} cols={4} />
        </div>
      </div>
    </div>
  );
}
