"use client";

import { cn } from "@/lib/cn";
import { useFaceDetection } from "./FaceDetectionProvider";

interface FaceGuideOverlayProps {
  className?: string;
  showInstructions?: boolean;
  /** Chế độ overlay đè lên video (mặc định false = panel riêng) */
  overlay?: boolean;
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

function getStatusColor(status: string | boolean, type: "size" | "brightness" | "sharpness" | "aligned" | "centered") {
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
}

/** SVG Face Guide Overlay - dùng cho overlay mode (đè lên video) */
function FaceGuideSVG({ result, className }: { result: ReturnType<typeof useFaceDetection>["result"]; className?: string }) {
  const ovalRx = 70;
  const ovalRy = 85;
  const centerX = 100;
  const centerY = 100;

  return (
    <svg viewBox="0 0 200 200" className={cn("w-full h-full", className)} fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background dimming */}
      <rect x="0" y="0" width="200" height="200" fill="black" fillOpacity={0.15} />

      {/* Face oval - main guide */}
      <ellipse
        cx={centerX}
        cy={centerY}
        rx={ovalRx}
        ry={ovalRy}
        className={cn(
          result.aligned ? "stroke-[var(--success)]" : "stroke-[var(--warning)]",
          result.centered ? "stroke-[var(--success)]" : "stroke-[var(--warning)]"
        )}
        strokeDasharray={result.aligned && result.centered ? "0" : "12 6"}
        filter={result.aligned && result.centered ? "url(#glow)" : "none"}
        strokeWidth={result.aligned && result.centered ? 3 : 2.5}
      />

      {/* Corner brackets for visual guidance */}
      <g strokeWidth={3} className={result.centered ? "stroke-[var(--success)]" : "stroke-white/60"}>
        {/* Top-left */}
        <path d="M30 100 L30 120 Q30 130 40 130 L60 130" fill="none" />
        <path d="M100 30 L120 30 Q130 30 130 40 L130 60" fill="none" />
        {/* Top-right */}
        <path d="M170 100 L170 120 Q170 130 160 130 L140 130" fill="none" />
        <path d="M100 30 L80 30 Q70 30 70 40 L70 60" fill="none" />
        {/* Bottom-left */}
        <path d="M30 100 L30 80 Q30 70 40 70 L60 70" fill="none" />
        <path d="M100 170 L120 170 Q130 170 130 160 L130 140" fill="none" />
        {/* Bottom-right */}
        <path d="M170 100 L170 80 Q170 70 160 70 L140 70" fill="none" />
        <path d="M100 170 L80 170 Q70 170 70 160 L70 140" fill="none" />
      </g>

      {/* Center crosshair - only show when not centered */}
      {!result.centered && (
        <g strokeWidth={1.5} stroke="currentColor" className="stroke-white/50 stroke-dasharray-4">
          <line x1={centerX} y1="5" x2={centerX} y2={centerY - ovalRy - 10} />
          <line x1={centerX} y1={centerY + ovalRy + 10} x2={centerX} y2="195" />
          <line x1="5" y1={centerY} x2={centerX - ovalRx - 10} y2={centerY} />
          <line x1={centerX + ovalRx + 10} y1={centerY} x2="195" y2={centerY} />
        </g>
      )}

      {/* Size indicator rings */}
      {result.size === "small" && (
        <ellipse cx={centerX} cy={centerY} rx={40} ry={50} stroke="currentColor" strokeWidth={1.5} strokeDasharray="6 4" className="text-[var(--warning)]" />
      )}
      {result.size === "large" && (
        <ellipse cx={centerX} cy={centerY} rx={95} ry={115} stroke="currentColor" strokeWidth={1.5} strokeDasharray="6 4" className="text-[var(--warning)]" />
      )}

      {/* Face detected center dot */}
      {result.detected && (
        <circle cx={centerX} cy={centerY} r={6} fill="currentColor" className="text-[var(--success)] animate-pulse" />
      )}

      {/* Arrow indicators for adjustment */}
      {!result.detected && (
        <g className="text-white/70 animate-pulse">
          <path d="M100 190 L100 175 M95 180 L100 185 L105 180" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {result.detected && !result.centered && (
        <g className="text-[var(--warning)] animate-bounce">
          {result.faceX !== undefined && result.faceX < 0.45 && (
            <path d="M40 100 L55 100 M50 95 L55 100 L50 105" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {result.faceX !== undefined && result.faceX > 0.55 && (
            <path d="M160 100 L145 100 M150 95 L145 100 L150 105" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {result.faceY !== undefined && result.faceY < 0.45 && (
            <path d="M100 40 L100 55 M95 50 L100 55 L105 50" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {result.faceY !== undefined && result.faceY > 0.55 && (
            <path d="M100 160 L100 145 M95 150 L100 145 L105 150" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </g>
      )}
    </svg>
  );
}

export function FaceGuideOverlay({ className, showInstructions = true, overlay = false }: FaceGuideOverlayProps) {
  const { result } = useFaceDetection();

  // Overlay mode: render SVG directly on top of video
  if (overlay) {
    return (
      <div className={cn("absolute inset-0 pointer-events-none flex items-center justify-center", className)}>
        <div className="relative w-full h-full max-w-[400px] aspect-square">
          <FaceGuideSVG result={result} />
        </div>
      </div>
    );
  }

  // Panel mode (original): render below video with instructions
  if (!result.detected) {
    return (
      <div className={cn("flex flex-col items-center gap-3 p-4", className)}>
        <div className="relative w-48 h-48" aria-hidden="true">
          <FaceGuideSVG result={result} />
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
      <div className="relative w-48 h-48" aria-hidden="true">
        <FaceGuideSVG result={result} />
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