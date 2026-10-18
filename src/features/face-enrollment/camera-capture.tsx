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
const ATTEMPT_MS = 6000;

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
  const { result, startDetection, stopDetection } = useFaceDetection();

  const faceDetected = useCallback(() => result.detected, [result.detected]);
  const faceCentered = useCallback(() => result.centered, [result.centered]);
  const faceAligned = useCallback(() => result.aligned, [result.aligned]);
  const faceSizeOk = useCallback(() => result.size === "ok", [result.size]);
  const brightnessOk = useCallback(() => result.brightness === "ok", [result.brightness]);
  const sharpnessOk = useCallback(() => result.sharpness !== "blurry", [result.sharpness]);

  const canCapture = faceDetected && faceCentered && faceAligned && faceSizeOk && brightnessOk && sharpnessOk;

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      return;
    }
    setState("requesting");
    try {
      const stream = await openCamera();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("ready");
      // Start face detection after camera is ready
      if (videoRef.current) {
        startDetection(videoRef.current);
      }
    } catch (err) {
      setState(err instanceof DOMException && err.name === "NotAllowedError" ? "denied" : "error");
    }
  }

  async function startCapture() {
    if (!canCapture) return;
    setState("capturing");

    const video = videoRef.current;
    if (!video || state !== "ready") {
      setState("ready");
      return;
    }

    // Capture frame
    const scale = CAPTURE_WIDTH / video.videoWidth;
    const w = CAPTURE_WIDTH;
    const h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      setState("ready");
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);

    // Analyze quality
    const pixels = ctx.getImageData(0, 0, w, h).data;
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      gray[i] = Math.round((pixels[i * 4]! + pixels[i * 4 + 1]! + pixels[i * 4 + 2]!) / 3);
    }
    const report = analyzeQuality(gray, w, h);
    setQuality({ ok: report.ok, issues: report.issues });

    if (report.ok) {
      // Stop face detection to save resources
      stopDetection();
      onCapture(canvas.toDataURL("image/jpeg", 0.85), report);
    } else {
      setState("ready");
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Determine current step for progress indicator
  const getProgressStep = () => {
    switch (state) {
      case "idle":
      case "requesting":
        return 0;
      case "ready":
        return 1;
      case "capturing":
        return 2;
      default:
        return 0;
    }
  };

  const progressStep = getProgressStep();

  // Error messages
  const errorMessages: Record<Exclude<EnrollmentCameraState, "idle" | "requesting" | "ready" | "capturing">, { title: string; hint: string }> = {
    denied: {
      title: "Camera bị từ chối",
      hint: "Hãy cấp quyền camera trong trình duyệt rồi tải lại trang, hoặc dùng phương thức thay thế (liên hệ HR).",
    },
    unavailable: {
      title: "Không có camera",
      hint: "Thiết bị không có camera hoặc trình duyệt không hỗ trợ. Dùng phương thức thay thế.",
    },
    error: {
      title: "Lỗi camera",
      hint: "Không mở được camera. Thử lại hoặc dùng phương thức thay thế.",
    },
    detecting: {
      title: "Đang phát hiện khuôn mặt",
      hint: "Vui lòng đưa khuôn mặt vào khung camera.",
    },
    quality_check: {
      title: "Kiểm tra chất lượng ảnh",
      hint: "Đang phân tích chất lượng ảnh...",
    },
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Privacy Notice */}
      {showPrivacyNotice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4" role="note">
          <div className="flex items-start gap-3">
            <svg className="flex-shrink-0 w-5 h-5 mt-0.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h4a1 1 0 001-1v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Quyền riêng tư dữ liệu khuôn mặt</p>
            <p className="mt-1 text-sm text-amber-700">
              Dữ liệu khuôn mặt chỉ dùng để xác minh chấm công. Chỉ lưu mã tham chiếu, không lưu ảnh/template.
              <a href="#" className="underline hover:text-amber-900 ml-1">Xem chi tiết</a>
            </p>
          </div>
        </div>
      )}

      {/* Progress Indicator */}
      <DetailedProgressIndicator
        step={
          state === "idle" ? "idle" :
          state === "requesting" ? "detecting" :
          state === "ready" ? "detecting" :
          state === "capturing" ? "saving" : "idle"
        }
        message={
          state === "requesting" ? "Đang bật camera..." :
          state === "ready" ? "Sẵn sàng chụp" :
          state === "capturing" ? "Đang xử lý ảnh..." :
          state === "idle" ? "Nhấn nút để bật camera" : "Sẵn sàng"
        }
        errorCode={state === "error" ? "CAMERA_ERROR" : state === "denied" ? "CAMERA_DENIED" : state === "unavailable" ? "NO_CAMERA" : undefined}
      />

      {/* Camera Preview */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
        <video
          ref={videoRef}
          playsInline
          muted
          aria-label={isCheckIn ? "Xem trước camera chấm công" : "Xem trước camera đăng ký khuôn mặt"}
          className="aspect-[4/3] w-full object-cover"
        />
        {/* Face Guide Overlay */}
        {showGuide && state === "ready" && (
          <FaceGuideOverlay showInstructions={true} />
        )}
        {/* Recording indicator */}
        {state === "capturing" && (
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/90 text-white text-xs font-medium animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Đang chụp...
          </div>
        )}
      </div>

      {/* Quality Feedback */}
      {quality && !quality.ok && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="font-medium">Ảnh chưa đạt, hãy chụp lại:</p>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            {quality.issues.map((issue) => (
              <li key={issue} className="text-sm">{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Face Detection Feedback */}
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2 text-sm">
          <span className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full",
            result.detected ? "bg-[var(--success-bg)] text-[var(--success)]" : "bg-slate-100 text-slate-400"
          )}>
            {result.detected ? (
              <Icon name="check" size={14} />
            ) : (
              <Icon name="camera" size={14} />
            )}
          </span>
          <span className={result.detected ? "text-[var(--success)]" : "text-slate-500"}>
            {result.detected ? "Đã phát hiện khuôn mặt" : "Chưa phát hiện khuôn mặt"}
          </span>
          {result.faceCount > 1 && (
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[var(--warning-bg)] text-[var(--warning)]">
              {result.faceCount} khuôn mặt
            </span>
          )}
        </div>

        {result.detected && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div className={cn("flex items-center gap-1 p-2 rounded", faceCentered() ? "bg-[var(--success-bg)]" : "bg-[var(--warning-bg)]")}>
              <Icon name={faceCentered() ? "check" : "x"} size={12} className={faceCentered() ? "text-[var(--success)]" : "text-[var(--warning)]"} />
              <span className={faceCentered() ? "text-[var(--success)]" : "text-[var(--warning)]"}>Giữa</span>
            </div>
            <div className={cn("flex items-center gap-1 p-2 rounded", faceAligned() ? "bg-[var(--success-bg)]" : "bg-[var(--warning-bg)]")}>
              <Icon name={faceAligned() ? "check" : "x"} size={12} className={faceAligned() ? "text-[var(--success)]" : "text-[var(--warning)]"} />
              <span className={faceAligned() ? "text-[var(--success)]" : "text-[var(--warning)]"}>Thẳng</span>
            </div>
            <div className={cn("flex items-center gap-1 p-2 rounded", brightnessOk() ? "bg-[var(--success-bg)]" : "bg-[var(--warning-bg)]")}>
              <Icon name={brightnessOk() ? "check" : "x"} size={12} className={brightnessOk() ? "text-[var(--success)]" : "text-[var(--warning)]"} />
              <span className={brightnessOk() ? "text-[var(--success)]" : "text-[var(--warning)]"}>Sáng</span>
            </div>
          </div>
        )}
      </div>

      {/* Camera State UI */}
      {state === "idle" || state === "requesting" ? (
        <Button onClick={start} loading={state === "requesting"} disabled={disabled} className="w-full">
          {state === "requesting" ? "Đang bật camera..." : "Bật camera"}
        </Button>
      ) : null}

      {state === "ready" && (
        <Button
          onClick={startCapture}
          disabled={disabled || !canCapture}
          variant={buttonVariant}
          className="w-full"
        >
          {captureLabel}
          {!canCapture && <span className="ml-2 opacity-50">(Căn chỉnh khuôn mặt)</span>}
        </Button>
      )}

      {!canCapture && state === "ready" && (
        <p className="text-xs text-slate-500 text-center">
          Hãy căn chỉnh khuôn mặt: {[
            !result.detected && "Đưa mặt vào khung",
            result.detected && !result.centered && "Đưa mặt vào giữa",
            result.detected && !result.aligned && "Giữ đầu thẳng",
            result.size !== "ok" && (result.size === "small" ? "Gần hơn" : "Xa ra"),
            !brightnessOk() && (result.brightness === "dark" ? "Thêm sáng" : "Giảm sáng"),
            !sharpnessOk() && "Giữ máy ổn định",
          ].filter(Boolean).join(", ")}
        </p>
      )}

      {errorMessages[state as keyof typeof errorMessages] && (
        <div role="alert" className="flex flex-col gap-2">
          <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            <Icon name="x" size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">{errorMessages[state as keyof typeof errorMessages].title}</p>
              <p className="text-sm">{errorMessages[state as keyof typeof errorMessages].hint}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={start} className="w-full">
            Thử lại
          </Button>
        </div>
      )}
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