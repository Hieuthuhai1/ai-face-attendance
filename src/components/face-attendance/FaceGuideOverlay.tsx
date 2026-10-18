"use client";

import { cn } from "@/lib/cn";
import { useFaceDetection } from "./FaceDetectionProvider";

interface FaceGuideOverlayProps {
  className?: string;
  showInstructions?: boolean;
}

const SIZE_LABELS = {
  small: "Gần hơn",
  ok: "Độ cách phù hợp",
  large: "Xa hơn",
} as const;

const BRIGHTNESS_LABELS = {
  dark: "Thiếu sáng",
  ok: "Ánh sáng tốt",
  bright: "Quá sáng",
} as const;

const SHARPNESS_LABELS = {
  blurry: "Mờ",
  ok: "Nét",
  sharp: "Rất nét",
} as const;

export function FaceGuideOverlay({ className, showInstructions = true }: FaceGuideOverlayProps) {
  const { result } = useFaceDetection();

  const getStatusColor = (status: string | boolean, type: "size" | "brightness" | "sharpness" | "aligned" | "centered") => {
    if (type === "size") {
      switch (status) {
        case "ok": return "text-[var(--success)]";
        case "small": return "text-[var(--warning)]";
        case "large": return "text-[var(--warning)]";
      }
    }
    if (type === "brightness") {
      switch (status) {
        case "ok": return "text-[var(--success)]";
        case "dark": return "text-[var(--warning)]";
        case "bright": return "text-[var(--warning)]";
      }
    }
    if (type === "sharpness") {
      switch (status) {
        case "sharp": return "text-[var(--success)]";
        case "ok": return "text-[var(--info)]";
        case "blurry": return "text-[var(--warning)]";
      }
    }
    if (type === "aligned" || type === "centered") {
      const isTrue = status === true || status === "true";
      return isTrue ? "text-[var(--success)]" : "text-[var(--warning)]";
    }
    return "text-slate-500";
  };

  if (!result.detected) {
    return (
      <div className={cn("flex flex-col items-center gap-3 p-4", className)}>
        <div className="relative" aria-hidden="true">
          <svg viewBox="0 0 200 200" className="w-48 h-48 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <ellipse cx="100" cy="100" rx="70" ry="85" strokeDasharray="8 4" />
            <line x1="100" y1="20" x2="100" y2="40" strokeWidth={2} />
            <line x1="100" y1="160" x2="100" y2="180" strokeWidth={2} />
            <line x1="20" y1="100" x2="40" y2="100" strokeWidth={2} />
            <line x1="160" y1="100" x2="180" y2="100" strokeWidth={2} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-12 h-12 text-slate-400 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        <p className="text-center text-sm text-slate-600 font-medium">Đưa khuôn mặt vào khung</p>
        {showInstructions && (
          <ul className="text-xs text-slate-500 text-center space-y-1 max-w-xs">
            <li>• Đưa mặt vào giữa khung tròn</li>
            <li>• Nhìn thẳng vào camera</li>
            <li>• Đủ sáng, không đèn chiếu thẳng mắt</li>
            <li>• Giữ yên khi chụp</li>
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-3 p-4", className)}>
      {/* Face oval with status indicators */}
      <div className="relative" aria-hidden="true">
        <svg viewBox="0 0 200 200" className="w-48 h-48" fill="none" stroke="currentColor" strokeWidth={2}>
          {/* Face oval */}
          <ellipse
            cx="100"
            cy="100"
            rx="70"
            ry="85"
            className={cn(
              result.aligned ? "text-[var(--success)]" : "text-[var(--warning)]",
              result.centered ? "stroke-[var(--success)]" : "stroke-[var(--warning)]"
            )}
            strokeDasharray={result.aligned ? "0" : "8 4"}
          />
          {/* Center crosshair */}
          <line x1="100" y1="15" x2="100" y2="35" className={result.centered ? "stroke-[var(--success)]" : "stroke-slate-300"} strokeWidth={2} />
          <line x1="100" y1="165" x2="100" y2="185" className={result.centered ? "stroke-[var(--success)]" : "stroke-slate-300"} strokeWidth={2} />
          <line x1="15" y1="100" x2="35" y2="100" className={result.centered ? "stroke-[var(--success)]" : "stroke-slate-300"} strokeWidth={2} />
          <line x1="165" y1="100" x2="185" y2="100" className={result.centered ? "stroke-[var(--success)]" : "stroke-slate-300"} strokeWidth={2} />

          {/* Size indicator rings */}
          {result.size === "small" && (
            <ellipse cx="100" cy="100" rx="40" ry="50" stroke="currentColor" strokeWidth={1} strokeDasharray="4 4" className="text-[var(--warning)]" />
          )}
          {result.size === "large" && (
            <ellipse cx="100" cy="100" rx="90" ry="110" stroke="currentColor" strokeWidth={1} strokeDasharray="4 4" className="text-[var(--warning)]" />
          )}

          {/* Face detected indicator */}
          <circle cx="100" cy="100" r="8" fill="currentColor" className="text-[var(--success)] animate-pulse" />
        </svg>

        {/* Status badges overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-between p-2 pointer-events-none">
          {/* Top: Size */}
          <div className={cn("px-2 py-0.5 rounded text-[10px] font-medium", getStatusColor(result.size, "size"))}>
            {SIZE_LABELS[result.size]}
          </div>

          {/* Bottom: Brightness & Sharpness */}
          <div className="flex gap-1">
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", getStatusColor(result.brightness, "brightness"))}>
              {BRIGHTNESS_LABELS[result.brightness]}
            </span>
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", getStatusColor(result.sharpness, "sharpness"))}>
              {SHARPNESS_LABELS[result.sharpness]}
            </span>
          </div>
        </div>

        {/* Centered indicator */}
        {!result.centered && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--warning)] animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
        )}
      </div>

      {/* Status Summary */}
      <div className="w-full max-w-xs space-y-1">
        <div className="flex items-center justify-center gap-4 text-xs">
          <span className={cn("flex items-center gap-1", getStatusColor(String(result.aligned), "aligned"))}>
            <span className="w-2 h-2 rounded-full bg-current" />
            Căn chỉnh: {result.aligned ? "Đúng" : "Nghiêng"}
          </span>
          <span className={cn("flex items-center gap-1", getStatusColor(String(result.centered), "centered"))}>
            <span className="w-2 h-2 rounded-full bg-current" />
            Vị trí: {result.centered ? "Giữa" : "Lệch"}
          </span>
        </div>

        {showInstructions && (
          <div className="text-xs text-slate-500 space-y-1">
            {!result.aligned && <p>• Giữ đầu thẳng, không nghiêng</p>}
            {!result.centered && <p>• Điều chỉnh để mặt ở giữa khung</p>}
            {result.size === "small" && <p>• Gần camera hơn một chút</p>}
            {result.size === "large" && <p>• Xa camera ra một chút</p>}
            {result.brightness === "dark" && <p>• Thêm sáng: bật đèn hoặc ra chỗ sáng</p>}
            {result.brightness === "bright" && <p>• Giảm sáng: tránh đèn chiếu thẳng</p>}
            {result.sharpness === "blurry" && <p>• Giữ máy ổn định, nhìn thẳng camera</p>}
          </div>
        )}
      </div>
    </div>
  );
}