"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { verifyCheck, fallbackCheck, type CheckResult, type AttendanceError, getTodayStatus } from "@/features/attendance/actions";
import { APP_TZ } from "@/config/app";
import type { FaceFixture } from "@/server/face/types";
import { FaceScanFrame } from "@/components/ui/face-scan-frame";
import { CameraStatusPanel } from "@/components/ui/camera-status-panel";
import { DetailedProgressIndicator } from "@/components/face-attendance/CameraProgressIndicator";
import { AttendanceReceipt } from "@/components/face-attendance/AttendanceReceipt";
import { PrivacyNotice } from "@/components/face-attendance/PrivacyNotice";
import { FaceDetectionProvider, useFaceDetection } from "@/components/face-attendance/FaceDetectionProvider";

export interface FaceVerificationRedesignedProps {
  direction: "check_in" | "check_out";
  shift?: { name: string; start_time: string; end_time: string; overnight: boolean } | null;
  providerDemo?: boolean;
  showDevControls?: boolean;
  status: Awaited<ReturnType<typeof getTodayStatus>>;
  onComplete?: () => void;
}

type UiState =
  | { kind: "idle" }
  | { kind: "verifying"; step: "detecting" | "liveness" | "matching" | "saving" }
  | { kind: "result"; res: Extract<CheckResult, { ok: true }> }
  | { kind: "failed"; error: AttendanceError };

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

/** Component camera nội bộ: bọc FaceDetectionProvider, cung cấp face detection realtime
 * và render video + FaceScanFrame overlay. Gọi onCapture khi người dùng bấm nút chụp.
 */
interface FaceScanCameraProps {
  onCapture: (frameDataUrl: string) => void;
  disabled?: boolean;
  captureLabel?: string;
  cameraState?: "idle" | "requesting" | "ready" | "capturing" | "denied" | "unavailable" | "error";
  onCameraStateChange?: (state: "idle" | "requesting" | "ready" | "capturing" | "denied" | "unavailable" | "error") => void;
  onFaceStateChange?: (state: string | undefined, guidance: string[]) => void;
}

export function FaceScanCamera({
  onCapture,
  disabled = false,
  captureLabel = "Chụp ảnh",
  cameraState = "idle",
  onCameraStateChange,
  onFaceStateChange,
}: FaceScanCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreamStarted, setIsStreamStarted] = useState(false);
  const { result, isLoading, error: detectionError, startDetection, stopDetection } = useFaceDetection();

  const faceDetected = result.detected;

  const deriveFaceState = (): { state: string | undefined; guidance: string[] } => {
    if (!faceDetected) return { state: "not-detected", guidance: ["Đưa khuôn mặt vào khung"] };
    const g: string[] = [];
    if (!result.aligned) g.push("Giữ đầu thẳng, không nghiêng");
    if (!result.centered) g.push("Đưa mặt vào giữa khung");
    if (result.size === "small") g.push("Gần camera hơn một chút");
    if (result.size === "large") g.push("Xa camera ra một chút");
    if (result.brightness === "dark") g.push("Thêm sáng");
    if (result.brightness === "bright") g.push("Giảm sáng");
    if (result.sharpness === "blurry") g.push("Giữ máy ổn định");
    const state = g.length === 0 ? "centered" : "not-centered";
    return { state, guidance: g };
  };

  const { state: faceState, guidance: faceGuidance } = deriveFaceState();

  useEffect(() => {
    if (onFaceStateChange) onFaceStateChange(faceState, faceGuidance);
  }, [faceState, faceGuidance, onFaceStateChange]);

  const startStream = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    setIsStreamStarted(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      try {
        startDetection(video);
      } catch {
        // Face detection lỗi vẫn chụp được
      }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (onCameraStateChange) {
        if (name === "NotAllowedError" || name === "SecurityError") onCameraStateChange("denied");
        else if (name === "NotFoundError" || name === "DevicesNotFoundError") onCameraStateChange("unavailable");
        else onCameraStateChange("error");
      }
    }
  }, [startDetection, onCameraStateChange]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    stopDetection();
    setIsStreamStarted(false);
    if (onCameraStateChange) onCameraStateChange("idle");
  }, [stopDetection, onCameraStateChange]);

  useEffect(() => {
    if (cameraState === "idle" && isStreamStarted) {
      stopStream();
    } else if (cameraState === "requesting" && !isStreamStarted) {
      startStream();
    }
  }, [cameraState, isStreamStarted, startStream, stopStream]);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand)] text-white mb-2">
          <Icon name="camera" size={24} />
        </div>
        <p className="text-sm text-slate-500">Đang tải mô hình nhận diện…</p>
      </div>
    );
  }

  if (detectionError && !isStreamStarted) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
        <p>{detectionError}</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-lg max-w-md w-full">
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted
        className="aspect-[4/3] w-full object-cover"
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <FaceScanFrame
          size={300}
          detected={faceDetected}
          aligned={!faceGuidance.some((g) => g.includes("thẳng") || g.includes("Căn chỉnh"))}
          centered={!faceGuidance.some((g) => g.includes("giữa") || g.includes("Vị trí"))}
        />
      </div>

      {!isStreamStarted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
          <Button
            onClick={() => {
              if (onCameraStateChange) onCameraStateChange("requesting");
            }}
            variant="primary"
            size="lg"
            disabled={disabled}
          >
            <Icon name="camera" size={20} /> Bật camera
          </Button>
        </div>
      )}

      {isStreamStarted && !disabled && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col gap-2 w-full max-w-xs">
          <Button
            onClick={startCapture}
            variant="primary"
            size="lg"
            className="w-full"
          >
            <Icon name="camera" size={18} /> {captureLabel}
          </Button>
          <Button
            onClick={() => {
              stopStream();
              if (onCameraStateChange) onCameraStateChange("idle");
            }}
            variant="ghost"
            size="sm"
            className="w-full"
          >
            Tắt camera
          </Button>
        </div>
      )}

      {isStreamStarted && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-1 text-xs font-medium text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          Đang chụp…
        </div>
      )}
    </div>
  );
}

export function FaceVerificationRedesigned(props: FaceVerificationRedesignedProps) {
  const router = useRouter();
  const { direction, shift, providerDemo = false, showDevControls = false, status, onComplete } = props;

  const [fixture, setFixture] = useState<FaceFixture>("good");
  const keyRef = useRef("");
  const [ui, setUi] = useState<UiState>({ kind: "idle" });
  const [showFallback, setShowFallback] = useState(false);
  const [reason, setReason] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [cameraState, setCameraState] = useState<"idle" | "requesting" | "ready" | "capturing" | "denied" | "unavailable" | "error">("idle");
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
    setUi({ kind: "verifying", step: "saving" });
    const res = await fallbackCheck({ direction, reason, idempotencyKey: ensureKey() });
    if (!res.ok) {
      setUi({ kind: "failed", error: res.error });
      return;
    }
    setUi({ kind: "result", res });
    setShowFallback(false);
    router.refresh();
  }

  const step = ui.kind === "idle" ? 0 : ui.kind === "verifying" ? 1 : 2;
  const failed = ui.kind === "failed" ? (FAILED_META[ui.error.code] ?? { title: `Lỗi (${ui.error.code})`, hint: ui.error.message }) : null;

  const isCheckIn = direction === "check_in";
  const actionLabel = isCheckIn ? "Chấm công vào" : "Chấm công ra";
  const canProceed = status.eligible && (isCheckIn ? status.canCheckIn : status.canCheckOut);

  if (!status.eligible) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardTitle>Không đủ điều kiện</CardTitle>
        <CardDescription>Tài khoản chưa đủ điều kiện chấm công. Liên hệ HR.</CardDescription>
      </Card>
    );
  }

  if (!status.hasEnrollment) {
    const waiting = status.enrollmentState === "pending" || status.enrollmentState === "needs_review";
    const rejected = status.enrollmentState === "rejected" || status.enrollmentState === "failed";
    return (
      <Card className="max-w-lg mx-auto">
        <CardTitle>{waiting ? "Đăng ký khuôn mặt đang chờ duyệt" : rejected ? "Đăng ký khuôn mặt chưa hoàn tất" : "Chưa có mẫu khuôn mặt"}</CardTitle>
        <CardDescription>
          {waiting ? "HR cần duyệt đăng ký trước khi bạn chấm công bằng khuôn mặt." : rejected ? "Đăng ký trước đó chưa thành công." : "Bạn chưa đăng ký khuôn mặt."}
        </CardDescription>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="secondary" size="sm" onClick={() => router.push("/enrollment")}>
            {waiting ? "Xem trạng thái đăng ký" : "Đăng ký khuôn mặt"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowFallback(true)}>
            Dùng phương thức thay thế
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl border border-[var(--brand)]/20 bg-[var(--brand-soft)]">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand)] text-white">
            <Icon name="camera" size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Xác minh khuôn mặt</h1>
            <p className="text-sm text-slate-500 tabular-nums">{timeLabel} · Giờ Việt Nam</p>
          </div>
        </div>
        <div className="hidden sm:block px-3 py-1 text-xs font-medium bg-white rounded-full text-slate-600 border border-slate-200">
          {dateLabel}
        </div>
      </div>

      <ol aria-label="Tiến trình xác minh" className="flex items-center gap-1 text-xs">
        {["1. Chuẩn bị", "2. Quét & xác minh", "3. Kết quả"].map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={label} className="flex flex-1 items-center gap-1" aria-current={current ? "step" : undefined}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-semibold ${done ? "bg-[var(--success-bg)] text-[var(--success)]" : current ? "bg-[var(--brand)] text-white" : "bg-slate-100 text-slate-400"}`}>
                {done ? <Icon name="check" size={14} /> : i + 1}
              </span>
              <span className={current ? "font-medium text-slate-800" : "text-slate-500"}>{label}</span>
              {i < 2 ? <span aria-hidden="true" className="mx-1 h-px flex-1 bg-slate-200" /> : null}
            </li>
          );
        })}
      </ol>

      <Card>
        <CardTitle>{shift ? `Ca: ${shift.name} (${shift.start_time}–${shift.end_time}${shift.overnight ? ", qua đêm" : ""})` : "Hôm nay không có ca làm"}</CardTitle>
        <CardDescription>Xác minh khuôn mặt để {actionLabel.toLowerCase()} ca làm việc.</CardDescription>
      </Card>

      {ui.kind === "result" ? (
        <AttendanceReceipt
          employeeName="Nhân viên"
          employeeCode="NV001"
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
        <Card className="max-w-lg mx-auto border-[var(--danger)]">
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--danger-bg)] text-[var(--danger)]">
              <Icon name="x" size={36} />
            </div>
            <p role="alert" className="text-lg font-semibold">{failed.title}</p>
            <p className="text-sm text-slate-600">{failed.hint}</p>
            <p className="text-xs text-slate-400">Mã lỗi: {ui.error.code}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {failed.category === "retryable" && (
              <>
                <Button size="sm" variant="secondary" onClick={retry}>Thử lại (cùng mã)</Button>
                <Button size="sm" variant="secondary" onClick={newCapture}>Chụp lại (mã mới)</Button>
              </>
            )}
            {failed.showFallback && (
              <Button size="sm" variant="ghost" onClick={() => { newAttempt(); setShowFallback(true); }}>
                Dùng phương thức thay thế
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card className="flex-1 min-h-[560px]">
          <CardTitle>Xác minh khuôn mặt — {isCheckIn ? "vào" : "ra"}</CardTitle>
          <CardDescription>
            Đưa khuôn mặt vào giữa khung, nhìn thẳng camera, giữ yên và đảm bảo đủ sáng.
          </CardDescription>

          <PrivacyNotice variant="banner" onAccept={() => setPrivacyAccepted(true)} onDecline={() => setPrivacyAccepted(false)} />

          <div className="mt-3">
            <CameraStatusPanel
              cameraState={cameraState}
              aiState={providerDemo ? "ready" : "ready"}
              faceState={faceState}
              guidance={guidance}
            />
          </div>

          <div className="mt-4 flex flex-col items-center gap-4">
            <FaceScanCamera
              onCapture={onCapture}
              disabled={cameraState === "capturing"}
              captureLabel={actionLabel}
              cameraState={cameraState}
              onCameraStateChange={setCameraState}
              onFaceStateChange={(state, guidanceList) => {
                setFaceState(state);
                setGuidance(guidanceList);
              }}
            />
          </div>

          {providerDemo && showDevControls && (
            <div className="mt-3 flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-500">Kịch bản mock</label>
              <select value={fixture} onChange={(e) => setFixture(e.target.value as FaceFixture)} className="h-10 rounded-lg border border-slate-300 px-3 text-sm w-full sm:w-auto">
                <option value="good">good — pass (confidence cao)</option>
                <option value="blurry">blurry — confidence thấp → HR rà soát</option>
                <option value="liveness-fail">liveness-fail — thất bại</option>
                <option value="no-match">no-match — không khớp</option>
              </select>
            </div>
          )}

          <div className="mt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowFallback((v) => !v)}>
              Không dùng được camera? Phương thức thay thế
            </Button>
          </div>

          {ui.kind === "verifying" && (
            <div className="mt-4">
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
          )}
        </Card>
      )}

      {showFallback && ui.kind !== "result" && (
        <Card className="max-w-lg mx-auto">
          <CardTitle>Phương thức thay thế</CardTitle>
          <CardDescription>Ghi nhận kèm lý do, chờ HR xác nhận.</CardDescription>
          <form onSubmit={onFallbackHandler} className="mt-2 flex flex-col gap-2">
            <label className="text-sm font-medium">Lý do <span className="text-red-500">*</span></label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              className="h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="VD: camera hỏng, mất mạng, nhận diện lỗi liên tục…"
            />
            <div className="flex justify-end">
              <Button type="submit" loading={ui.kind === "verifying"} disabled={!reason.trim()}>
                Gửi ghi nhận thay thế
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
