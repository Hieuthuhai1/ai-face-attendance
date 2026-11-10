"use client";

import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/** Khung quét khuôn mặt có hiệu ứng đường quét chạy lên xuống.
 * Được đặt đè lên video camera. Không chặn tương tác video.
 *
 * Hiệu ứng quét chạy hoàn toàn bằng CSS (`.scan-line`) để không tạo thêm
 * vòng lặp `requestAnimationFrame` cập nhật React state khi camera đang chạy.
 */
interface FaceScanFrameProps {
  /** Kích thước tối đa (px), khung vẫn co giãn theo container. */
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
  /** Nội dung render bên trong khung (tùy chọn) */
  children?: ReactNode;
}

export function FaceScanFrame({
  size = 320,
  okColor = "var(--success)",
  warnColor = "#fbbf24",
  aligned = false,
  centered = false,
  detected = false,
  className,
  children,
}: FaceScanFrameProps) {
  const ready = detected && aligned && centered;
  const strokeColor = ready ? okColor : warnColor;

  return (
    <div
      className={cn("relative aspect-square w-full", className)}
      style={{ maxWidth: size }}
    >
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full overflow-visible"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
      >
        <defs>
          <filter id="scan-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="scan-vignette" cx="50%" cy="45%" r="62%">
            <stop offset="55%" stopColor="black" stopOpacity="0" />
            <stop offset="100%" stopColor="black" stopOpacity="0.5" />
          </radialGradient>
        </defs>

        {/* Vùng tối xung quanh khung */}
        <rect x="0" y="0" width="200" height="200" fill="url(#scan-vignette)" />

        {/* Khung oval khuôn mặt */}
        <ellipse
          cx="100"
          cy="100"
          rx="62"
          ry="78"
          stroke={strokeColor}
          strokeDasharray={ready ? "0" : "10 7"}
          filter={ready ? "url(#scan-glow)" : "none"}
          strokeWidth={ready ? 3 : 2.5}
          className="transition-[stroke] duration-300"
        />

        {/* Góc khung */}
        <g strokeWidth={3.5} strokeLinecap="round" stroke={strokeColor} className="transition-[stroke] duration-300">
          {/* Top-left */}
          <path d="M58 100 L58 120 Q58 132 70 132 L92 132" fill="none" />
          <path d="M100 58 L122 58 Q134 58 134 70 L134 92" fill="none" />
          {/* Top-right */}
          <path d="M142 100 L142 120 Q142 132 130 132 L108 132" fill="none" />
          <path d="M100 58 L78 58 Q66 58 66 70 L66 92" fill="none" />
          {/* Bottom-left */}
          <path d="M58 100 L58 80 Q58 68 70 68 L92 68" fill="none" />
          <path d="M100 170 L122 170 Q134 170 134 158 L134 136" fill="none" />
          {/* Bottom-right */}
          <path d="M142 100 L142 80 Q142 68 130 68 L108 68" fill="none" />
          <path d="M100 170 L78 170 Q66 170 66 158 L66 136" fill="none" />
        </g>

        {/* Trung tâm crosshair (hiện khi chưa căn giữa) */}
        {!centered ? (
          <g strokeWidth={1.5} stroke="#e2e8f0" strokeDasharray="4 5" opacity={0.5}>
            <line x1="100" y1="10" x2="100" y2="24" />
            <line x1="100" y1="176" x2="100" y2="190" />
            <line x1="10" y1="100" x2="24" y2="100" />
            <line x1="176" y1="100" x2="190" y2="100" />
          </g>
        ) : null}

        {/* Chấm tròn khi khuôn mặt đã phát hiện và căn chỉnh */}
        {ready ? (
          <g>
            <circle cx="100" cy="100" r="10" fill={strokeColor} opacity={0.18} />
            <circle cx="100" cy="100" r="4.5" fill={strokeColor} />
          </g>
        ) : null}

        {children}
      </svg>

      {/* Vùng quét chạy bằng CSS, giới hạn trong oval để nhẹ và tinh tế */}
      {!ready ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[16%] overflow-hidden [border-radius:50%]"
        >
          <span className="scan-line" style={{ left: "6%", right: "6%" }} />
        </div>
      ) : null}

      {/* Viền mờ tạo chiều sâu, không thay đổi layout */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full transition-opacity duration-300",
          ready ? "opacity-0" : "opacity-100",
        )}
        style={{ boxShadow: `inset 0 0 42px -18px ${strokeColor}` }}
      />
    </div>
  );
}
