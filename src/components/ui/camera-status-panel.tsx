"use client";

import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";

interface CameraStatusPanelProps {
  /** Trạng thái camera: idle|requesting|ready|detecting|quality_check|capturing|denied|unavailable|error */
  cameraState?: string;
  /** Trạng thái AI: loading|ready|error|null */
  aiState?: "loading" | "ready" | "error" | null;
  /** Trạng thái khuôn mặt: detected|not-detected|centered|not-centered|blurry|dark|bright|small|large */
  faceState?: string;
  /** Bản hướng dẫn realtime */
  guidance?: string[];
  /** Lớp CSS thêm */
  className?: string;
}

const CAMERA_LABELS: Record<string, { label: string; icon: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  idle: { label: "Chưa bật camera", icon: "camera", tone: "neutral" },
  requesting: { label: "Đang khởi tạo camera…", icon: "clock", tone: "neutral" },
  ready: { label: "Camera đã sẵn sàng", icon: "check", tone: "success" },
  detecting: { label: "Camera đang hoạt động", icon: "camera", tone: "success" },
  quality_check: { label: "Kiểm tra chất lượng ảnh", icon: "shield", tone: "warning" },
  capturing: { label: "Đang chụp ảnh…", icon: "clock", tone: "warning" },
  denied: { label: "Quyền camera bị từ chối", icon: "x", tone: "danger" },
  unavailable: { label: "Không tìm thấy camera", icon: "x", tone: "danger" },
  error: { label: "Không mở được camera", icon: "x", tone: "danger" },
};

const AI_LABELS: Record<string, { label: string; icon: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  loading: { label: "Đang tải mô hình AI…", icon: "clock", tone: "neutral" },
  ready: { label: "Dịch vụ AI sẵn sàng", icon: "check", tone: "success" },
  error: { label: "Lỗi kết nối AI", icon: "x", tone: "danger" },
};

const FACE_LABELS: Record<string, { label: string; icon: string; tone: "success" | "warning" | "neutral" }> = {
  detected: { label: "Đã phát hiện khuôn mặt", icon: "user-check", tone: "success" },
  "not-detected": { label: "Chưa phát hiện khuôn mặt", icon: "camera", tone: "neutral" },
  centered: { label: "Vị trí giữa khung", icon: "check", tone: "success" },
  "not-centered": { label: "Đưa mặt vào giữa", icon: "alert", tone: "warning" },
  blurry: { label: "Ảnh bị mờ", icon: "alert", tone: "warning" },
  dark: { label: "Thiếu sáng", icon: "alert", tone: "warning" },
  bright: { label: "Quá sáng", icon: "alert", tone: "warning" },
  small: { label: "Gần camera hơn", icon: "alert", tone: "warning" },
  large: { label: "Xa camera hơn", icon: "alert", tone: "warning" },
};

export function CameraStatusPanel({
  cameraState = "idle",
  aiState = null,
  faceState,
  guidance,
  className,
}: CameraStatusPanelProps) {
  const camera = CAMERA_LABELS[cameraState] ?? CAMERA_LABELS.idle;
  const ai = aiState ? (AI_LABELS[aiState] ?? AI_LABELS.ready) : null;
  const face = faceState ? (FACE_LABELS[faceState] ?? FACE_LABELS["not-detected"]) : null;

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {/* Camera status */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white/90 shadow-sm">
        <span className={cn("flex-shrink-0 h-2 w-2 rounded-full", camera.tone === "success" ? "bg-[var(--success)]" : camera.tone === "warning" ? "bg-[var(--warning)]" : camera.tone === "danger" ? "bg-[var(--danger)]" : "bg-slate-400")} />
        <span className="text-xs font-medium text-slate-700">{camera.label}</span>
      </div>

      {/* AI status */}
      {ai && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white/90 shadow-sm">
          <span className={cn("flex-shrink-0 h-2 w-2 rounded-full", ai.tone === "success" ? "bg-[var(--success)]" : ai.tone === "warning" ? "bg-[var(--warning)]" : ai.tone === "danger" ? "bg-[var(--danger)]" : "bg-slate-400")} />
          <span className="text-xs font-medium text-slate-700">{ai.label}</span>
        </div>
      )}

      {/* Face status */}
      {face && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white/90 shadow-sm">
          <span className={cn("flex-shrink-0 h-2 w-2 rounded-full", face.tone === "success" ? "bg-[var(--success)]" : face.tone === "warning" ? "bg-[var(--warning)]" : "bg-slate-400")} />
          <span className="text-xs font-medium text-slate-700">{face.label}</span>
        </div>
      )}
      
      {/* Realtime guidance */}
      {guidance && guidance.length > 0 && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--brand)]/20 bg-[var(--brand)]/5 px-3 py-2 text-sm">
          <Icon name="alert" size={12} className="text-[var(--brand)] shrink-0" />
          <span className="text-[var(--brand-strong)] font-medium">
            {guidance.join(" • ")}
          </span>
        </div>
      )}
    </div>
  );
}
