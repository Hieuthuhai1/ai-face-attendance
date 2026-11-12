"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icon";
import { verifyCheck, fallbackCheck, type CheckResult, type AttendanceError, getTodayStatus } from "@/features/attendance/actions";
import { APP_TZ } from "@/config/app";
import type { FaceFixture } from "@/server/face/types";
import { FaceScanFrame } from "@/components/ui/face-scan-frame";
import { DetailedProgressIndicator } from "@/components/face-attendance/CameraProgressIndicator";
import { AttendanceReceipt } from "@/components/face-attendance/AttendanceReceipt";
import { PrivacyNotice } from "@/components/face-attendance/PrivacyNotice";
import {
  FaceDetectionProvider,
  useFaceDetection,
} from "@/components/face-attendance/FaceDetectionProvider";

export interface FaceVerificationRedesignedProps {
  direction: "check_in" | "check_out";
  shift?: {
    name: string;
    start_time: string;
    end_time: string;
    overnight: boolean;
    grace_in_min?: number;
    grace_out_min?: number;
  } | null;
  providerDemo?: boolean;
  showDevControls?: boolean;
  status: Awaited<ReturnType<typeof getTodayStatus>>;
  /** Tên hiển thị thật của nhân viên (dùng cho biên nhận chấm công). */
  employeeName?: string;
  /** Mã nhân viên thật. */
  employeeCode?: string;
  /** Phòng ban (nếu có). */
  department?: string | null;
  onComplete?: () => void;
}

type UiState =
  | { kind: "idle" }
  | { kind: "verifying"; step: "detecting" | "liveness" | "matching" | "saving" }
  | { kind: "result"; res: Extract<CheckResult, { ok: true }> }
  | { kind: "failed"; error: AttendanceError };

type CameraState = "idle" | "requesting" | "ready" | "capturing" | "denied" | "unavailable" | "error";

const FAILED_META: Record<string, { title: string; hint: string; category?: "retryable" | "permanent" | "configuration" | "requires_fallback"; showFallback?: boolean }> = {
  LIVENESS_FAILED: { title: "Không xác định được người thật", hint: "Thử lại đủ sáng, nhìn thẳng camera.", showFallback: true },
  NO_MATCH: { title: "Khuôn mặt không khớp", hint: "Thử lại hoặc dùng phương thức thay thế.", showFallback: true },
  LOW_CONFIDENCE: { title: "Độ khớp thấp", hint: "Đã ghi nhận và chuyển HR rà soát.", showFallback: true },
  POOR_IMAGE_QUALITY: { title: "Ảnh không đạt chất lượng", hint: "Hãy chụp lại rõ hơn, đủ sáng, nhìn thẳng camera.", showFallback: false },
  ENROLLMENT_MISSING: { title: "Chưa có mẫu khuôn mặt", hint: "Đăng ký và chờ HR duyệt trước.", showFallback: true },
  PROVIDER_UNAVAILABLE: { title: "Dịch vụ nhận diện bận", hint: "Giữ nguyên trang, bấm Thử lại.", showFallback: true },
  PROVIDER_TIMEOUT: { title: "Dịch vụ nhận diện quá lâu", hint: "Giữ nguyên trang, bấm Thử lại.", showFallback: true },
  NETWORK_ERROR: { title: "Mất kết nối", hint: "Kiểm tra mạng rồi bấm Thử lại.", showFallback: true },
  NO_SHIFT: { title: "Không có ca làm", hint: "Liên hệ HR nếu cần bổ sung phân ca.", showFallback: false },
  NO_ENROLLMENT: { title: "Chưa có mẫu khuôn mặt", hint: "Đăng ký và chờ HR duyệt trước.", showFallback: true },
  OUT_WITHOUT_IN: { title: "Chưa có lượt vào", hint: "Nếu quên check-in, gửi yêu cầu chỉnh công.", showFallback: true },
  ALREADY_CHECKED_IN: { title: "Đã check-in rồi", hint: "Hãy check-out khi ra về.", showFallback: false },
  RATE_LIMITED: { title: "Thao tác quá nhanh", hint: "Nghỉ ít phút rồi thử lại.", showFallback: false },
  INVALID_IMAGE: { title: "Ảnh không hợp lệ", hint: "Ảnh quá lớn hoặc sai định dạng.", showFallback: false },
  NOT_ELIGIBLE: { title: "Không đủ điều kiện", hint: "Tài khoản chưa phải nhân viên đang làm việc.", showFallback: false },
  INVALID_KEY: { title: "Idempotency key không hợp lệ", hint: "Lỗi hệ thống, vui lòng tải lại trang.", showFallback: false },
  RECORD_FAILED: { title: "Không ghi được chấm công", hint: "Thử lại, hệ thống sẽ không tạo trùng.", showFallback: true },
  PROVIDER_NOT_CONFIGURED: { title: "Provider chưa được cấu hình", hint: "Production cần cấu hình AWS Rekognition.", showFallback: false },
  UNAUTHORIZED: { title: "Provider credentials không hợp lệ", hint: "Liên hệ quản trị viên cấu hình provider.", showFallback: false },
  REASON_REQUIRED: { title: "Lý do bắt buộc", hint: "Vui lòng nhập lý do dùng phương thức thay thế.", showFallback: false },
  DUPLICATE: { title: "Đã ghi nhận trước đó", hint: "Không cần gửi lại.", showFallback: false },
};

const CAMERA_META: Record<CameraState, { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  idle: { label: "Camera chưa bật", tone: "neutral" },
  requesting: { label: "Đang khởi tạo camera", tone: "warning" },
  ready: { label: "Camera đang hoạt động", tone: "success" },
  capturing: { label: "Đang xác minh", tone: "warning" },
  denied: { label: "Quyền camera bị từ chối", tone: "danger" },
  unavailable: { label: "Không tìm thấy camera", tone: "danger" },
  error: { label: "Không mở được camera", tone: "danger" },
};

interface FaceScanCameraProps {
  onCapture: (frameDataUrl: string) => void;
  disabled?: boolean;
  captureLabel?: string;
  cameraState?: CameraState;
  onCameraStateChange?: (state: CameraState) => void;
  onFaceStateChange?: (state: string | undefined, guidance: string[]) => void;
}

interface FaceGuidance {
  state: string | undefined;
  guidance: string[];
}

/** Camera + overlay quét khuôn mặt. Bọc provider nhận diện để trạng thái AI
 * và hướng dẫn realtime hoạt động ổn định, không gây re-render mỗi frame. */
export function FaceScanCamera(props: FaceScanCameraProps) {
  return (
    <FaceDetectionProvider>
      <FaceScanCameraInner {...props} />
    </FaceDetectionProvider>
  );
}

function FaceScanCameraInner({
  onCapture,
  disabled = false,
  captureLabel = "Chụp ảnh",
  cameraState,
  onCameraStateChange,
  onFaceStateChange,
}: FaceScanCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [internalCameraState, setInternalCameraState] = useState<CameraState>("idle");
  const [isStreamStarted, setIsStreamStarted] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const { result, isLoading, error: detectionError, startDetection, stopDetection } = useFaceDetection();

  const effectiveState = cameraState ?? internalCameraState;

  const updateCameraState = useCallback(
    (next: CameraState) => {
      setInternalCameraState(next);
      onCameraStateChange?.(next);
    },
    [onCameraStateChange],
  );

  const face = useMemo<FaceGuidance>(() => {
    if (!result.detected) {
      return { state: "not-detected", guidance: ["Đưa khuôn mặt vào giữa khung"] };
    }
    const guidance: string[] = [];
    if (!result.aligned) guidance.push("Giữ đầu thẳng, không nghiêng");
    if (!result.centered) guidance.push("Đưa mặt vào giữa khung");
    if (result.size === "small") guidance.push("Gần camera hơn một chút");
    if (result.size === "large") guidance.push("Xa camera ra một chút");
    if (result.brightness === "dark") guidance.push("Thêm sáng");
    if (result.brightness === "bright") guidance.push("Giảm sáng");
    if (result.sharpness === "blurry") guidance.push("Giữ máy ổn định");
    return { state: guidance.length === 0 ? "centered" : "not-centered", guidance };
  }, [result.detected, result.aligned, result.centered, result.size, result.brightness, result.sharpness]);

  const onFaceStateChangeRef = useRef(onFaceStateChange);
  useEffect(() => {
    onFaceStateChangeRef.current = onFaceStateChange;
  }, [onFaceStateChange]);

  // `face` chỉ đổi identity khi các trường thực sự thay đổi → không tạo vòng lặp render.
  useEffect(() => {
    onFaceStateChangeRef.current?.(face.state, face.guidance);
  }, [face]);

  const startStream = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setIsStreamStarted(false);
      updateCameraState("unavailable");
      return;
    }
    setIsStreamStarted(true);
    setStreamActive(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        setIsStreamStarted(false);
        updateCameraState("error");
        return;
      }
      video.srcObject = stream;
      await video.play();
      setStreamActive(true);
      updateCameraState("ready");
      try {
        startDetection(video);
      } catch {
        // Nhận diện lỗi vẫn chụp được.
      }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStreamActive(false);
      setIsStreamStarted(false);
      if (name === "NotAllowedError" || name === "SecurityError") updateCameraState("denied");
      else if (name === "NotFoundError" || name === "DevicesNotFoundError") updateCameraState("unavailable");
      else updateCameraState("error");
    }
  }, [startDetection, updateCameraState]);

  const stopStream = useCallback((notify = true) => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    stopDetection();
    setStreamActive(false);
    setIsStreamStarted(false);
    if (notify) updateCameraState("idle");
  }, [stopDetection, updateCameraState]);

  useEffect(() => {
    if (effectiveState === "idle" && isStreamStarted) {
      stopStream();
    } else if (effectiveState === "requesting" && !isStreamStarted) {
      void startStream();
    }
  }, [effectiveState, isStreamStarted, startStream, stopStream]);

  // Restart nhận diện sau khi chụp xong (parent đưa camera về ready).
  useEffect(() => {
    if (effectiveState === "ready" && streamActive && videoRef.current) {
      startDetection(videoRef.current);
    }
  }, [effectiveState, streamActive, startDetection]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      stopDetection();
    };
  }, [stopDetection]);

  const startCapture = useCallback(() => {
    if (disabled) return;
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const scale = 480 / video.videoWidth;
    const w = 480;
    const h = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    stopDetection();
    onCapture(canvas.toDataURL("image/jpeg", 0.85));
  }, [disabled, onCapture, stopDetection]);

  const cameraMeta = CAMERA_META[effectiveState];
  const faceReady = face.state === "centered";
  const hasCameraError = effectiveState === "denied" || effectiveState === "unavailable" || effectiveState === "error";

  return (
    <div className="relative w-full overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-[var(--navy-950)] shadow-[0_30px_70px_-40px_rgba(2,6,23,0.85)]">
      <div className="relative aspect-[4/3] w-full sm:aspect-[16/11]">
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          aria-label="Camera xác minh khuôn mặt"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            streamActive ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Lớp phủ tạo chiều sâu cho video */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--navy-950)]/80 via-transparent to-[var(--navy-950)]/40"
        />

        {streamActive ? (
          <>
            <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm ring-1 ring-inset ring-white/15">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                {effectiveState === "capturing" ? "Đang xác minh…" : "Camera trực tiếp"}
              </span>
              <Badge tone={faceReady ? "success" : "warning"} className="bg-white/90 ring-0 backdrop-blur-sm">
                <Icon name={faceReady ? "check" : "scan-face"} size={12} />
                {faceReady ? "Đã căn chỉnh" : "Đang căn chỉnh"}
              </Badge>
            </div>

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <FaceScanFrame
                className="w-[62%] max-w-[290px] -translate-y-1 sm:-translate-y-2"
                size={320}
                detected={result.detected}
                aligned={result.aligned}
                centered={result.centered}
              />
            </div>

            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-3 pt-10 sm:p-4 sm:pt-12">
              {face.guidance.length > 0 && !faceReady ? (
                <p className="flex items-center justify-center gap-1.5 text-center text-[12px] font-medium text-amber-200">
                  <Icon name="alert" size={13} className="shrink-0" />
                  {face.guidance[0]}
                </p>
              ) : (
                <p className="flex items-center justify-center gap-1.5 text-center text-[12px] font-medium text-emerald-200">
                  <Icon name="check" size={13} className="shrink-0" />
                  Khuôn mặt đã sẵn sàng — bấm nút bên dưới
                </p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  onClick={startCapture}
                  variant="inverse"
                  size="lg"
                  className="flex-1"
                  disabled={disabled}
                >
                  <Icon name="scan-face" size={19} /> {captureLabel}
                </Button>
                <button
                  type="button"
                  onClick={() => stopStream()}
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-white/20 bg-white/10 px-3 text-[13px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
                >
                  Tắt camera
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {effectiveState === "requesting" ? (
              <>
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/20">
                  <Icon name="refresh" size={26} className="animate-spin" />
                </span>
                <p className="text-sm font-medium text-white">Đang khởi tạo camera…</p>
                <p className="max-w-xs text-xs text-slate-300">Vui lòng chấp nhận quyền truy cập camera khi trình duyệt hỏi.</p>
              </>
            ) : hasCameraError ? (
              <>
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-400/25">
                  <Icon name="camera" size={26} />
                </span>
                <p className="text-sm font-semibold text-white">{cameraMeta.label}</p>
                <p className="max-w-xs text-xs text-slate-300">
                  {effectiveState === "denied"
                    ? "Bật quyền camera trong cài đặt trình duyệt rồi thử lại. Bạn vẫn có thể dùng phương thức thay thế."
                    : "Kiểm tra camera đang được ứng dụng khác sử dụng, hoặc dùng phương thức thay thế."}
                </p>
                <Button variant="inverse" size="sm" onClick={() => updateCameraState("requesting")}>
                  <Icon name="refresh" size={15} /> Thử lại camera
                </Button>
              </>
            ) : (
              <>
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/20">
                  <Icon name="scan-face" size={30} />
                </span>
                <p className="text-sm font-semibold text-white">Bật camera để xác minh khuôn mặt</p>
                <p className="max-w-xs text-xs leading-relaxed text-slate-300">
                  Hệ thống chỉ dùng camera để xác minh 1:1, không lưu ảnh thô.
                </p>
                <Button variant="inverse" size="lg" onClick={() => updateCameraState("requesting")} disabled={disabled}>
                  <Icon name="camera" size={18} /> Bật camera
                </Button>
              </>
            )}
          </div>
        )}

        {streamActive && disabled ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--navy-950)]/35 backdrop-blur-[1px]">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-[var(--navy-900)] shadow-lg">
              <Icon name="refresh" size={16} className="animate-spin" /> Đang xác minh…
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-white/[0.04] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              cameraMeta.tone === "success"
                ? "bg-emerald-400"
                : cameraMeta.tone === "warning"
                  ? "bg-amber-400"
                  : cameraMeta.tone === "danger"
                    ? "bg-red-400"
                    : "bg-slate-400"
            }`}
          />
          <span className="text-[12px] font-medium text-slate-200">{cameraMeta.label}</span>
        </div>
        <span className="flex items-center gap-1.5 text-[12px] text-slate-300">
          {isLoading ? (
            <>
              <Icon name="refresh" size={12} className="animate-spin" /> Đang tải AI…
            </>
          ) : detectionError ? (
            <>
              <Icon name="alert" size={12} className="text-amber-300" /> Vẫn có thể chụp thủ công
            </>
          ) : faceReady ? (
            <>
              <Icon name="check" size={12} className="text-emerald-300" /> Khuôn mặt đã căn chỉnh
            </>
          ) : (
            <>
              <Icon name="scan-face" size={12} /> AI đang theo dõi khuôn mặt
            </>
          )}
        </span>
      </div>
    </div>
  );
}

function StepRail({ step }: { step: number }) {
  const steps = ["Chuẩn bị", "Quét & xác minh", "Kết quả"];
  return (
    <ol aria-label="Tiến trình xác minh" className="flex items-center gap-1.5">
      {steps.map((label, index) => {
        const done = index < step;
        const current = index === step;
        return (
          <li key={label} className="flex flex-1 items-center gap-1.5" aria-current={current ? "step" : undefined}>
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                done
                  ? "bg-[var(--success-bg)] text-[var(--success)] ring-1 ring-inset ring-[var(--success-border)]"
                  : current
                    ? "bg-[var(--brand)] text-white shadow-[0_6px_14px_-8px_rgba(37,99,235,0.9)]"
                    : "bg-[var(--surface-muted)] text-[var(--text-3)] ring-1 ring-inset ring-[var(--border)]"
              }`}
            >
              {done ? <Icon name="check" size={13} /> : index + 1}
            </span>
            <span className={`hidden text-[12px] sm:inline ${current ? "font-semibold text-[var(--navy-800)]" : "text-[var(--text-2)]"}`}>
              {label}
            </span>
            {index < steps.length - 1 ? <span aria-hidden="true" className="mx-1 h-px flex-1 bg-[var(--border)]" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function GateCard({
  icon,
  tone = "brand",
  title,
  description,
  children,
}: {
  icon: "camera" | "scan-face" | "clock" | "shield" | "id-card" | "alert";
  tone?: "brand" | "warning" | "danger" | "success";
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "warning"
      ? "bg-[var(--warning-bg)] text-[var(--warning)] ring-[var(--warning-border)]"
      : tone === "danger"
        ? "bg-[var(--danger-bg)] text-[var(--danger)] ring-[var(--danger-border)]"
        : tone === "success"
          ? "bg-[var(--success-bg)] text-[var(--success)] ring-[var(--success-border)]"
          : "bg-[var(--brand-soft)] text-[var(--brand)] ring-blue-100";
  return (
    <Card className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 py-8 text-center">
      <span className={`flex h-16 w-16 items-center justify-center rounded-[var(--radius-icon)] ring-1 ring-inset ${toneClass}`}>
        <Icon name={icon} size={30} />
      </span>
      <div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </div>
      <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div>
    </Card>
  );
}

export function FaceVerificationRedesigned(props: FaceVerificationRedesignedProps) {
  const router = useRouter();
  const {
    direction,
    shift,
    providerDemo = false,
    showDevControls = false,
    status,
    employeeName = "Nhân viên",
    employeeCode = "—",
    department = null,
    onComplete,
  } = props;

  const [fixture, setFixture] = useState<FaceFixture>("good");
  const keyRef = useRef("");
  const [ui, setUi] = useState<UiState>({ kind: "idle" });
  const [showFallback, setShowFallback] = useState(false);
  const [reason, setReason] = useState("");
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [faceState, setFaceState] = useState<string | undefined>(undefined);
  const [guidance, setGuidance] = useState<string[]>([]);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const raf = window.requestAnimationFrame(tick);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(timer);
    };
  }, []);

  const timeLabel = now
    ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: APP_TZ }).format(now)
    : "--:--:--";
  const dateLabel = now
    ? new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: APP_TZ }).format(now)
    : "";

  function newClientKey(): string {
    return `evt_${crypto.randomUUID()}`;
  }

  function ensureKey(): string {
    if (!keyRef.current) keyRef.current = newClientKey();
    return keyRef.current;
  }

  function newAttempt() {
    keyRef.current = "";
  }

  function retry() {
    setUi({ kind: "idle" });
  }

  function newCapture() {
    newAttempt();
    setUi({ kind: "idle" });
  }

  const handleFaceStateChange = useCallback((state: string | undefined, list: string[]) => {
    setFaceState(state);
    setGuidance(list);
  }, []);

  const onCapture = useCallback(
    async (frameDataUrl: string) => {
      setUi({ kind: "verifying", step: "detecting" });
      setCameraState("capturing");
      let res: CheckResult;
      try {
        res = await verifyCheck({
          direction,
          frameDataUrl,
          fixture: providerDemo ? fixture : undefined,
          idempotencyKey: ensureKey(),
        });
      } catch {
        setUi({ kind: "failed", error: { code: "NETWORK_ERROR", message: "Mất mạng khi gửi. Bấm Thử lại (dùng cùng mã, không tạo trùng).", category: "retryable", hint: "Kiểm tra mạng rồi bấm Thử lại (cùng mã).", showFallback: true } });
        setCameraState("ready");
        return;
      }
      setCameraState("ready");
      if (!res.ok) {
        setUi({ kind: "failed", error: res.error });
        return;
      }
      setUi({ kind: "result", res });
      setShowFallback(false);
      router.refresh();
    },
    [direction, providerDemo, fixture, router],
  );

  async function onFallbackHandler(e: React.FormEvent) {
    e.preventDefault();
    setFallbackError(null);
    setShowFallback(false);
    setUi({ kind: "verifying", step: "saving" });
    try {
      const res = await fallbackCheck({ direction, reason, idempotencyKey: ensureKey() });
      if (!res.ok) {
        setUi({ kind: "failed", error: res.error });
        return;
      }
      setUi({ kind: "result", res });
      setReason("");
      router.refresh();
    } catch {
      setUi({
        kind: "failed",
        error: {
          code: "NETWORK_ERROR",
          message: "Mất mạng khi gửi. Bấm Thử lại (dùng cùng mã, không tạo trùng).",
          category: "retryable",
          hint: "Kiểm tra mạng rồi bấm Thử lại (cùng mã).",
          showFallback: true,
        },
      });
    }
  }

  const step = ui.kind === "idle" ? 0 : ui.kind === "verifying" ? 1 : ui.kind === "failed" ? 1 : 2;
  const failed = ui.kind === "failed" ? (FAILED_META[ui.error.code] ?? { title: `Lỗi (${ui.error.code})`, hint: ui.error.message }) : null;

  const isCheckIn = direction === "check_in";
  const actionLabel = isCheckIn ? "Chấm công vào" : "Chấm công ra";

  const fallbackModal = (
    <Modal
      open={showFallback}
      onClose={() => {
        setShowFallback(false);
        setFallbackError(null);
      }}
      title="Phương thức thay thế"
      size="md"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => setShowFallback(false)}
            disabled={ui.kind === "verifying"}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            form="fallback-form"
            loading={ui.kind === "verifying"}
            disabled={!reason.trim()}
          >
            <Icon name="key" size={15} /> Gửi ghi nhận
          </Button>
        </>
      }
    >
      <form id="fallback-form" onSubmit={onFallbackHandler} className="flex flex-col gap-3">
        <div className="flex items-start gap-2 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2.5 text-[13px] text-[var(--warning-strong)]">
          <Icon name="info" size={15} className="mt-0.5 shrink-0" />
          <p>Ghi nhận kèm lý do sẽ được chuyển HR xác nhận. Không thay thế việc xác minh khuôn mặt khi camera hoạt động bình thường.</p>
        </div>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-[var(--text-2)]">
          Lý do <span className="text-[var(--danger)]">*</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            rows={4}
            className="min-h-24 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-3 py-2 text-sm text-[var(--navy-700)] transition-colors focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]"
            placeholder="VD: camera hỏng, mất mạng, nhận diện lỗi liên tục…"
          />
        </label>
        {fallbackError ? (
          <p role="alert" className="flex items-center gap-1 text-sm text-[var(--danger)]">
            <Icon name="x" size={14} /> {fallbackError}
          </p>
        ) : null}
      </form>
    </Modal>
  );

  if (!status.eligible) {
    return (
      <div className="flex flex-col gap-4">
        <GateCard
          icon="id-card"
          tone="warning"
          title="Tài khoản chưa đủ điều kiện chấm công"
          description="Tài khoản của bạn chưa gắn với nhân viên đang làm việc. Liên hệ HR để cập nhật hồ sơ."
        >
          <Button variant="secondary" size="sm" onClick={() => router.push("/requests")}>
            <Icon name="file-text" size={15} /> Gửi yêu cầu
          </Button>
        </GateCard>
        {fallbackModal}
      </div>
    );
  }

  if (!status.hasEnrollment) {
    const waiting = status.enrollmentState === "pending" || status.enrollmentState === "needs_review";
    const rejected = status.enrollmentState === "rejected" || status.enrollmentState === "failed";
    return (
      <div className="flex flex-col gap-4">
        <GateCard
          icon="scan-face"
          tone={waiting ? "warning" : rejected ? "danger" : "brand"}
          title={waiting ? "Đăng ký khuôn mặt đang chờ duyệt" : rejected ? "Đăng ký khuôn mặt chưa hoàn tất" : "Chưa có mẫu khuôn mặt"}
          description={
            waiting
              ? "HR cần duyệt đăng ký trước khi bạn chấm công bằng khuôn mặt. Trong lúc chờ, bạn vẫn có thể dùng phương thức thay thế."
              : rejected
                ? "Đăng ký trước đó chưa thành công. Hãy đăng ký lại để chấm công bằng khuôn mặt."
                : "Bạn chưa đăng ký khuôn mặt. Đăng ký và chờ HR duyệt trước khi chấm công."
          }
        >
          <Button size="sm" onClick={() => router.push("/enrollment")}>
            <Icon name="scan-face" size={15} /> {waiting ? "Xem trạng thái đăng ký" : "Đăng ký khuôn mặt"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowFallback(true)}>
            Dùng phương thức thay thế
          </Button>
        </GateCard>
        {fallbackModal}
      </div>
    );
  }

  const lastEvent = status.lastEvent;
  const lastEventLabel = lastEvent
    ? `${lastEvent.event_type === "check_in" ? "Vào" : "Ra"} lúc ${new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: APP_TZ }).format(new Date(lastEvent.occurred_at))}`
    : "Chưa có lượt chấm công";

  return (
    <div className="flex flex-col gap-5">
      {/* Hero trạng thái trực tiếp */}
      <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-[var(--navy-900)] text-white shadow-[var(--shadow-card)]">
        <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-blue-500/25 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-0 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
              <Icon name="scan-face" size={13} className="text-cyan-300" />
              {isCheckIn ? "Check-in" : "Check-out"} · AI Face 1:1
            </p>
            <h2 className="mt-1.5 text-xl font-bold tracking-[-0.02em] sm:text-2xl">
              Xác minh khuôn mặt để {isCheckIn ? "vào ca" : "ra ca"}
            </h2>
            <p className="mt-1.5 text-[13px] text-slate-300">
              Xin chào <span className="font-semibold text-white">{employeeName}</span>
              {employeeCode !== "—" ? <span className="tnum"> · {employeeCode}</span> : null}
              {department ? <span> · {department}</span> : null}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {shift ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-2.5 py-1 text-[12px] font-medium text-slate-200">
                  <Icon name="clock" size={12} /> {shift.name} · {shift.start_time}–{shift.end_time}
                  {shift.overnight ? " (qua đêm)" : ""}
                </span>
              ) : (
                <Badge tone="warning">Hôm nay không có ca làm</Badge>
              )}
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium ${
                status.canCheckOut
                  ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
                  : "border-sky-300/25 bg-sky-400/10 text-sky-200"
              }`}>
                <Icon name={status.canCheckOut ? "check" : "clock"} size={12} />
                {lastEventLabel}
              </span>
              {providerDemo ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                  DEMO – không dùng chấm công thật
                </span>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-right backdrop-blur-sm lg:min-w-[190px]">
            <p className="tnum text-[30px] font-bold leading-none tracking-[-0.02em] text-white">{timeLabel}</p>
            <p className="mt-1.5 text-[12px] capitalize text-slate-300">{dateLabel}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--text-3)]">Giờ Việt Nam</p>
          </div>
        </div>
      </div>

      <StepRail step={step} />

      {ui.kind === "result" ? (
        <AttendanceReceipt
          employeeName={employeeName}
          employeeCode={employeeCode}
          action={ui.res.direction}
          occurredAt={ui.res.occurred_at}
          shiftName={shift?.name || "Ca làm"}
          shiftTime={`${shift?.start_time || "--:--"}–${shift?.end_time || "--:--"}${shift?.overnight ? " (qua đêm)" : ""}`}
          status={ui.res.status}
          lateMinutes={ui.res.late_min}
          earlyMinutes={ui.res.early_leave_min}
          method={ui.res.status === "fallback" ? "pin_fallback" : "face"}
          confidence={ui.res.confidence}
          livenessStatus={ui.res.liveness}
          verificationRef={ui.res.verification_ref}
          onContinue={() => {
            setUi({ kind: "idle" });
            onComplete?.();
          }}
          onFallback={() => { newAttempt(); setShowFallback(true); }}
        />
      ) : ui.kind === "failed" && failed ? (
        <Card className="mx-auto w-full max-w-xl border-[var(--danger-border)]">
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--danger-bg)] text-[var(--danger)] ring-1 ring-inset ring-[var(--danger-border)]">
              <Icon name="x" size={36} />
            </div>
            <div>
              <p role="alert" className="text-lg font-bold text-[var(--navy-900)]">{failed.title}</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--text-2)]">{failed.hint}</p>
              <p className="mt-1.5 font-mono text-[11px] text-[var(--text-3)]">Mã lỗi: {ui.error.code}</p>
            </div>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              {failed.category === "retryable" ? (
                <>
                  <Button size="sm" variant="secondary" onClick={retry}>
                    <Icon name="refresh" size={15} /> Thử lại (cùng mã)
                  </Button>
                  <Button size="sm" variant="secondary" onClick={newCapture}>
                    <Icon name="camera" size={15} /> Chụp lại (mã mới)
                  </Button>
                </>
              ) : null}
              {failed.showFallback ? (
                <Button size="sm" variant="ghost" onClick={() => { newAttempt(); setShowFallback(true); }}>
                  Dùng phương thức thay thế
                </Button>
              ) : null}
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <Card className="flex flex-col">
            <CardHeader
              title={`Xác minh khuôn mặt — ${isCheckIn ? "vào ca" : "ra ca"}`}
              description="Đưa khuôn mặt vào giữa khung, nhìn thẳng camera, giữ yên và đảm bảo đủ sáng."
              action={
                <Badge tone={faceState === "centered" ? "success" : "brand"}>
                  <Icon name={faceState === "centered" ? "check" : "scan-face"} size={12} />
                  {faceState === "centered" ? "Sẵn sàng" : "AI đang quét"}
                </Badge>
              }
            />

            <div className="mt-4">
              <FaceScanCamera
                onCapture={onCapture}
                disabled={cameraState === "capturing"}
                captureLabel={actionLabel}
                cameraState={cameraState}
                onCameraStateChange={setCameraState}
                onFaceStateChange={handleFaceStateChange}
              />
            </div>

            {ui.kind === "verifying" ? (
              <div className="mt-4 rounded-xl border border-[var(--brand)]/20 bg-[var(--brand-soft)]/50 p-3">
                <DetailedProgressIndicator
                  step={ui.step === "detecting" ? "detecting" : ui.step === "liveness" ? "liveness" : ui.step === "matching" ? "matching" : "saving"}
                  message={
                    ui.step === "detecting" ? "Đang phát hiện khuôn mặt…" :
                    ui.step === "liveness" ? "Đang kiểm tra liveness…" :
                    ui.step === "matching" ? "Đang đối chiếu khuôn mặt…" :
                    "Đang lưu bản ghi…"
                  }
                />
              </div>
            ) : null}

            {providerDemo && showDevControls ? (
              <label className="mt-4 flex flex-col gap-1.5 text-[13px] font-medium text-[var(--text-2)]">
                Kịch bản mock (chỉ môi trường dev)
                <select
                  value={fixture}
                  onChange={(e) => setFixture(e.target.value as FaceFixture)}
                  className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-3 text-sm text-[var(--navy-700)] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)] sm:w-auto"
                >
                  <option value="good">good — pass (confidence cao)</option>
                  <option value="blurry">blurry — confidence thấp → HR rà soát</option>
                  <option value="liveness-fail">liveness-fail — thất bại</option>
                  <option value="no-match">no-match — không khớp</option>
                </select>
              </label>
            ) : null}
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader
                title="Ca làm hôm nay"
                description={shift ? "Thông tin ca đang áp dụng cho lượt chấm công này" : "Chưa có phân ca cho hôm nay"}
                action={<Badge tone={shift ? "info" : "warning"}>{shift ? "Đã phân ca" : "Chưa phân ca"}</Badge>}
              />
              {shift ? (
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]">Tên ca</dt>
                    <dd className="mt-0.5 truncate text-[13px] font-semibold text-[var(--navy-800)]">{shift.name}</dd>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]">Thời gian</dt>
                    <dd className="tnum mt-0.5 text-[13px] font-semibold text-[var(--navy-800)]">
                      {shift.start_time}–{shift.end_time}{shift.overnight ? " · qua đêm" : ""}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]">Lượt gần nhất</dt>
                    <dd className="mt-0.5 truncate text-[13px] font-semibold text-[var(--navy-800)]">{lastEventLabel}</dd>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]">Trạng thái</dt>
                    <dd className="mt-0.5 text-[13px] font-semibold text-[var(--navy-800)]">
                      {status.canCheckOut ? "Đang trong ca" : status.canCheckIn ? "Sẵn sàng vào ca" : "Chờ ca kế tiếp"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-sm text-[var(--text-2)]">
                  Liên hệ HR nếu bạn cần bổ sung phân ca trước khi chấm công.
                </p>
              )}
            </Card>

            <Card>
              <CardHeader title="Trước khi chấm công" description="Vài giây chuẩn bị giúp xác minh nhanh và chính xác hơn" />
              <ul className="mt-3 flex flex-col gap-2 text-[13px] text-[var(--text-2)]">
                {[
                  "Đủ sáng, không ngược sáng",
                  "Nhìn thẳng camera, không nghiêng đầu",
                  "Chỉ một người trong khung hình",
                  "Không đội mũ/khẩu trang che khuôn mặt",
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--success-bg)] text-[var(--success)]">
                      <Icon name="check" size={10} />
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <PrivacyNotice variant="banner" />
              </div>
            </Card>

            <Card>
              <div className="flex items-start gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-icon)] bg-[var(--surface-muted)] text-[var(--text-2)] ring-1 ring-inset ring-[var(--border)]">
                  <Icon name="key" size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[var(--navy-800)]">Không dùng được camera?</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-2)]">
                    Gửi ghi nhận thay thế kèm lý do, HR sẽ xác nhận.
                  </p>
                  <Button variant="ghost" size="sm" className="mt-1.5 px-0" onClick={() => setShowFallback(true)}>
                    Dùng phương thức thay thế <Icon name="arrow-right" size={14} />
                  </Button>
                </div>
              </div>
            </Card>

            {guidance.length > 0 && faceState !== "centered" ? (
              <p className="flex items-start gap-1.5 px-1 text-[12px] text-[var(--text-3)]">
                <Icon name="info" size={13} className="mt-0.5 shrink-0" />
                Gợi ý hiện tại: {guidance.join(" · ")}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {fallbackModal}
    </div>
  );
}
