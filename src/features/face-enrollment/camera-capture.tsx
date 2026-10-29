"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { analyzeQuality, type QualityReport } from "@/lib/face/quality";
import { FaceDetectionProvider, useFaceDetection } from "@/components/face-attendance";
import { FaceGuideOverlay } from "@/components/face-attendance/FaceGuideOverlay";
import { DetailedProgressIndicator } from "@/components/face-attendance/CameraProgressIndicator";

/** Camera states for enrollment */
export type EnrollmentCameraState =
  | "idle"
  | "requesting"
  | "ready"
  | "detecting"
  | "quality_check"
  | "capturing"
  | "denied"
  | "unavailable"
  | "error";

const CAPTURE_WIDTH = 480;
const ATTEMPT_MS = 10_000;

/** Mở camera với timeout và fallback. */
function openWithTimeout(constraints: MediaStreamConstraints, ms: number): Promise<MediaStream> {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = window.setTimeout(() => {
      if (!done) {
        done = true;
        reject(new DOMException("Camera timeout", "TimeoutError"));
      }
    }, ms);
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(
        (s) => {
          if (done) {
            s.getTracks().forEach((t) => t.stop());
            return;
          }
          done = true;
          window.clearTimeout(timer);
          resolve(s);
        },
        (e: unknown) => {
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          reject(e instanceof Error ? e : new Error("camera failed"));
        },
      )
      .catch(() => {});
  });
}

async function openCamera(): Promise<MediaStream> {
  try {
    return await openWithTimeout(
      { video: { facingMode: "user", width: { ideal: 1280 } }, audio: false },
      ATTEMPT_MS,
    );
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === "OverconstrainedError" || err.name === "NotFoundError" || err.name === "TimeoutError")
    ) {
      return openWithTimeout({ video: true, audio: false }, ATTEMPT_MS);
    }
    throw err;
  }
}

interface CameraCaptureInnerProps {
  onCapture: (frameDataUrl: string, quality: QualityReport) => void;
  disabled?: boolean;
  showGuide?: boolean;
  /** For check-in flow */
  isCheckIn?: boolean;
  /** Action label for buttons */
  captureLabel?: string;
  /** Button variant */
  buttonVariant?: "primary" | "secondary";
  /** Show privacy notice */
  showPrivacyNotice?: boolean;
  /**
   * @deprecated Không còn cần thiết: nút chụp luôn bật khi camera sẵn sàng.
   * Giữ prop để không phá vỡ call site cũ.
   */
  allowManualCapture?: boolean;
}

/** Inner component that uses FaceDetectionProvider context */
function CameraCaptureInner({
  onCapture,
  disabled,
  showGuide = true,
  isCheckIn = false,
  captureLabel = "Chụp ảnh",
  buttonVariant = "primary",
  showPrivacyNotice = false,
}: CameraCaptureInnerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<EnrollmentCameraState>("idle");
  const [quality, setQuality] = useState<{ ok: boolean; issues: string[] } | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const { result, startDetection, stopDetection, isLoading, error: detectionError } = useFaceDetection();

  const faceDetected = result.detected;

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Giữ tham chiếu mới nhất để cleanup không chạy lại mỗi lần provider re-render.
  const stopDetectionRef = useRef(stopDetection);
  useEffect(() => {
    stopDetectionRef.current = stopDetection;
  }, [stopDetection]);

  useEffect(() => {
    return () => {
      stopDetectionRef.current();
      stopStream();
    };
  }, [stopStream]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      return;
    }
    setCaptureError(null);
    setQuality(null);
    setState("requesting");
    try {
      stopStream();
      const stream = await openCamera();
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopStream();
        setState("error");
        return;
      }
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // Autoplay có thể bị chặn — thử lại sau 1 nhịp.
        await new Promise((r) => setTimeout(r, 150));
        await video.play();
      }
      setState("ready");
      try {
        startDetection(video);
      } catch {
        // Không có face detection vẫn chụp được (chất lượng kiểm tra khi chụp).
      }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") setState("denied");
      else if (name === "NotFoundError" || name === "DevicesNotFoundError") setState("unavailable");
      else setState("error");
    }
  }, [startDetection, stopStream]);

  const startCapture = useCallback(() => {
    if (disabled) return;
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCaptureError("Camera chưa sẵn sàng. Đợi một chút rồi thử lại, hoặc bấm “Bật lại camera”.");
      return;
    }

    setCaptureError(null);
    setQuality(null);
    setState("capturing");

    const scale = CAPTURE_WIDTH / video.videoWidth;
    const w = CAPTURE_WIDTH;
    const h = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      setCaptureError("Trình duyệt không xử lý được ảnh. Hãy thử trình duyệt khác.");
      setState("ready");
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);

    // Kiểm tra chất lượng ảnh (sáng/mờ/kích thước) — trung thực, không phải liveness.
    const pixels = ctx.getImageData(0, 0, w, h).data;
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      gray[i] = Math.round((pixels[i * 4]! + pixels[i * 4 + 1]! + pixels[i * 4 + 2]!) / 3);
    }
    const report = analyzeQuality(gray, w, h);
    setQuality({ ok: report.ok, issues: report.issues });

    if (!report.ok) {
      setState("ready");
      return;
    }

    stopDetection();
    onCapture(canvas.toDataURL("image/jpeg", 0.85), report);
  }, [disabled, onCapture, stopDetection]);

  const retry = useCallback(() => {
    setState("idle");
    setCaptureError(null);
    setQuality(null);
  }, []);

  const errorMessages: Partial<Record<EnrollmentCameraState, { title: string; hint: string }>> = {
    denied: {
      title: "Quyền camera bị từ chối",
      hint: "Trình duyệt đang chặn camera. Bấm vào biểu tượng ổ khóa trên thanh địa chỉ → cho phép Camera → tải lại trang.",
    },
    unavailable: {
      title: "Không tìm thấy camera",
      hint: "Thiết bị không có camera hoặc trình duyệt không hỗ trợ. Bạn vẫn có thể chấm công bằng phương thức thay thế.",
    },
    error: {
      title: "Không mở được camera",
      hint: "Camera có thể đang bị ứng dụng khác dùng. Đóng ứng dụng đó, tải lại trang rồi thử lại.",
    },
  };

  const guidance = result.detected
    ? [
        !result.centered && "đưa mặt vào giữa",
        !result.aligned && "giữ đầu thẳng",
        result.size === "small" && "gần camera hơn",
        result.size === "large" && "xa camera hơn",
        result.brightness === "dark" && "thêm ánh sáng",
        result.brightness === "bright" && "giảm ánh sáng",
        result.sharpness === "blurry" && "giữ yên máy",
      ].filter(Boolean)
    : [];

  return (
    <div className="flex flex-col gap-3">
      {showPrivacyNotice ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3" role="note">
          <p className="text-sm font-medium text-amber-800">Quyền riêng tư dữ liệu khuôn mặt</p>
          <p className="mt-1 text-sm text-amber-700">
            Ảnh chỉ dùng để tạo mẫu xác minh chấm công, không lưu ảnh thô và không dùng cho mục đích khác.
          </p>
        </div>
      ) : null}

      <DetailedProgressIndicator
        step={
          state === "idle"
            ? "idle"
            : state === "requesting"
              ? "detecting"
              : state === "ready"
                ? "detecting"
                : state === "capturing"
                  ? "saving"
                  : "idle"
        }
        message={
          state === "requesting"
            ? "Đang bật camera…"
            : state === "ready"
              ? "Camera sẵn sàng — bấm chụp khi khuôn mặt nằm trong khung"
              : state === "capturing"
                ? "Đang xử lý ảnh…"
                : "Bấm “Bật camera” để bắt đầu"
        }
        errorCode={
          state === "error"
            ? "CAMERA_ERROR"
            : state === "denied"
              ? "CAMERA_DENIED"
              : state === "unavailable"
                ? "NO_CAMERA"
                : undefined
        }
      />

      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          aria-label={isCheckIn ? "Xem trước camera chấm công" : "Xem trước camera đăng ký khuôn mặt"}
          className="aspect-[4/3] w-full object-cover"
        />
        {showGuide && state === "ready" ? <FaceGuideOverlay showInstructions={false} overlay /> : null}
        {state === "capturing" ? (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-1 text-xs font-medium text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            Đang chụp…
          </div>
        ) : null}
      </div>

      {quality && !quality.ok ? (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="font-medium">Ảnh chưa đạt, hãy chụp lại:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {quality.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {captureError ? (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {captureError}
        </p>
      ) : null}

      {/* Hướng dẫn căn chỉnh realtime (không chặn chụp) */}
      {state === "ready" ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full",
                faceDetected ? "bg-[var(--success-bg)] text-[var(--success)]" : "bg-slate-100 text-slate-400",
              )}
            >
              <Icon name={faceDetected ? "check" : "camera"} size={14} />
            </span>
            <span className={faceDetected ? "text-[var(--success)]" : "text-slate-500"}>
              {faceDetected ? "Đã phát hiện khuôn mặt" : isLoading ? "Đang tải mô hình nhận diện…" : "Chưa phát hiện khuôn mặt"}
            </span>
            {result.faceCount > 1 ? (
              <span className="ml-auto rounded-full bg-[var(--warning-bg)] px-2 py-0.5 text-xs text-[var(--warning)]">
                {result.faceCount} khuôn mặt
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-xs text-slate-500">
            {detectionError
              ? "Không tải được mô hình nhận diện — bạn vẫn có thể bấm chụp, hệ thống sẽ kiểm tra chất lượng ảnh."
              : faceDetected
                ? guidance.length > 0
                  ? `Gợi ý: ${guidance.join(", ")}.`
                  : "Khuôn mặt đã căn chỉnh tốt — bấm chụp."
                : "Đưa khuôn mặt vào khung rồi bấm chụp. Nút chụp luôn khả dụng."}
          </p>
        </div>
      ) : null}

      {state === "idle" || state === "requesting" ? (
        <Button onClick={start} loading={state === "requesting"} disabled={disabled} className="w-full">
          {state === "requesting" ? "Đang bật camera…" : "Bật camera"}
        </Button>
      ) : null}

      {state === "ready" ? (
        <div className="flex flex-col gap-2">
          <Button
            onClick={startCapture}
            disabled={disabled}
            variant={buttonVariant}
            className="w-full"
            size="lg"
          >
            <Icon name="camera" size={18} /> {captureLabel}
          </Button>
          <Button onClick={start} variant="ghost" size="sm" className="w-full">
            Bật lại camera
          </Button>
        </div>
      ) : null}

      {errorMessages[state] ? (
        <div role="alert" className="flex flex-col gap-2">
          <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            <Icon name="x" size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">{errorMessages[state]!.title}</p>
              <p>{errorMessages[state]!.hint}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={retry} className="w-full">
            Thử lại
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Wrapper that provides FaceDetectionProvider */
export function CameraCapture(props: CameraCaptureInnerProps) {
  return (
    <FaceDetectionProvider>
      <CameraCaptureInner {...props} />
    </FaceDetectionProvider>
  );
}
