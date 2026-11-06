"use client";

import { cn } from "@/lib/cn";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

/** Khung quét khuôn mặt có hiệu ứng đường quét chạy lên xuống.
 * Được đặt đè lên video camera. Không chặn tương tác video.
 */
interface FaceScanFrameProps {
  /** Kích thước khung (px) */
  size?: number;
  /** Màu sắc khi khuôn mặt đang căn chỉnh tốt */
  okColor?: string;
  /** Màu sắc khi chưa căn chỉnh */
  warnColor?: string;
  /** Trạng thái căn chỉnh (để đổi màu khung) */
  aligned?: boolean;
  centered?: boolean;
  detected?: boolean;
  /** Lớp CSS thêm */
  className?: string;
  /** Nội dungrender bên trong khung (tùy chọn) */
  children?: ReactNode;
}

export function FaceScanFrame({
  size = 320,
  okColor = "var(--success)",
  warnColor = "var(--warning)",
  aligned = false,
  centered = false,
  detected = false,
  className,
  children,
}: FaceScanFrameProps) {
  const [scanY, setScanY] = useState(0);

  useEffect(() => {
    // Hiệu ứng quét chạy từ trên xuống dưới và ngược lại, lặp lại liên tục.
    // Thời gian ~2 giây một chu kỳ, nhẹ không gây lag camera.
    let dir = 1;
    const raf = () => {
      setScanY((y) => {
        const next = y + dir * 2;
        if (next >= size) {
          dir = -1;
          return size;
        }
        if (next <= 0) {
          dir = 1;
          return 0;
        }
        return next;
      });
      requestAnimationFrame(raf);
    };
    const id = requestAnimationFrame(raf);
    return () => cancelAnimationFrame(id);
  }, [size]);

  const strokeColor = detected && aligned && centered ? okColor : warnColor;

  return (
    <div
      className={cn(
        "relative inline-block",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
      >
        <defs>
          <filter id="scan-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Vùng tối xung quanh khung */}
        <rect x="0" y="0" width="200" height="200" fill="black" fillOpacity={0.35} />

        {/* Đường quét chạy dọc */}
        <line
          x1={70}
          x2={130}
          y1={scanY / size * 200}
          y2={scanY / size * 200}
          stroke={strokeColor}
          strokeWidth={3}
          className="animate-pulse"
          filter="url(#scan-glow)"
        />

        {/* Khung oval khuôn mặt */}
        <ellipse
          cx="100"
          cy="100"
          rx="62"
          ry="78"
          stroke={strokeColor}
          strokeDasharray={aligned && centered ? "0" : "12 6"}
          filter={aligned && centered ? "url(#scan-glow)" : "none"}
          strokeWidth={aligned && centered ? 3 : 2.5}
        />

        {/* Góc khung */}
        <g strokeWidth={3.5}>
          {/* Top-left */}
          <path d="M58 100 L58 120 Q58 132 70 132 L92 132" fill="none" stroke={strokeColor} />
          <path d="M100 58 L122 58 Q134 58 134 70 L134 92" fill="none" stroke={strokeColor} />
          {/* Top-right */}
          <path d="M142 100 L142 120 Q142 132 130 132 L108 132" fill="none" stroke={strokeColor} />
          <path d="M100 58 L78 58 Q66 58 66 70 L66 92" fill="none" stroke={strokeColor} />
          {/* Bottom-left */}
          <path d="M58 100 L58 80 Q58 68 70 68 L92 68" fill="none" stroke={strokeColor} />
          <path d="M100 170 L122 170 Q134 170 134 158 L134 136" fill="none" stroke={strokeColor} />
          {/* Bottom-right */}
          <path d="M142 100 L142 80 Q142 68 130 68 L108 68" fill="none" stroke={strokeColor} />
          <path d="M100 170 L78 170 Q66 170 66 158 L66 136" fill="none" stroke={strokeColor} />
        </g>

        {/* Trung tâm crosshair (hiện khi chưa căn giữa) */}
        {!centered && (
          <g strokeWidth={1.5} stroke="currentColor" strokeDasharray="4 4" opacity={0.6}>
            <line x1="100" y1="8" x2="100" y2={90 - 78} />
            <line x1="100" y1={110 + 78} x2="100" y2="192" />
            <line x1="8" y1="100" x2={90 - 62} y2="100" />
            <line x1={110 + 62} y1="100" x2="192" y2="100" />
          </g>
        )}

        {/* Chỉ thị điều hướng khi khuôn mặt chưa căn giữa */}
        {detected && !centered && (
          <g className={warnColor} animate-bounce>
            {aligned === false && (
              <>
                <path d="M40 100 L56 100 M52 94 L56 100 L52 106" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M160 100 L144 100 M148 94 L144 100 L148 106" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </>
            )}
            {centered === false && (
              <>
                <path d="M100 40 L100 56 M94 52 L100 56 L106 52" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M100 160 L100 144 M94 148 L100 144 L106 148" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </>
            )}
          </g>
        )}

        {/* Chấm tròn khi khuôn mặt đã phát hiện và căn chỉnh */}
        {detected && aligned && centered && (
          <circle cx="100" cy="100" r={7} fill={strokeColor} className="animate-pulse" />
        )}

        {children}
      </svg>

      {/* Nhãn trạng thái dưới khung */}
      <div className="mt-3 flex items-center justify-center gap-2 text-xs">
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full",
            detected && aligned && centered
              ? "bg-[var(--success-bg)] text-[var(--success)]"
              : detected
                ? "bg-[var(--warning-bg)] text-[var(--warning)]"
                : "bg-slate-100 text-slate-400",
          )}
        >
          <Icon name={detected ? (aligned && centered ? "check" : "camera") : "camera"} size={10} />
        </span>
        <span className={detected && aligned && centered ? "text-[var(--success)] font-medium" : "text-slate-500"}>
          {detected && aligned && centered
            ? "Khuôn mặt đã căn chỉnh"
            : detected
              ? "Điều chỉnh khuôn mặt"
              : "Đưa khuôn mặt vào khung"}
        </span>
      </div>
    </div>
  );
}
