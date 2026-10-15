"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { analyzeQuality, type QualityReport } from "@/lib/face/quality";

export type CameraState =
  | "idle"
  | "requesting"
  | "ready"
  | "denied"
  | "unavailable"
  | "error";

const CAPTURE_WIDTH = 480;

/** Mở camera: ưu tiên cam trước, fallback không ràng buộc khi thiết bị lạ/không hỗ trợ.
 *  Mỗi lượt race với timeout — request treo (prompt limbo, thiết bị lỗi) không được kẹt
 *  mãi ở "Đang xử lý…". Stream đến muộn (thua race) bị dừng ngay để không rò camera. */
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

const ATTEMPT_MS = 6000;

async function openCamera(): Promise<MediaStream> {
  try {
    return await openWithTimeout(
      { video: { facingMode: "user", width: { ideal: 1280 } }, audio: false },
      ATTEMPT_MS,
    );
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === "OverconstrainedError" ||
        err.name === "NotFoundError" ||
        err.name === "TimeoutError")
    ) {
      return openWithTimeout({ video: true, audio: false }, ATTEMPT_MS);
    }
    throw err;
  }
}

/** Camera preview + chụp 1 frame, kiểm tra sáng/mờ/size trước khi gửi. */
export function CameraCapture({
  onCapture,
  disabled,
  showGuide,
}: {
  onCapture: (frameDataUrl: string, quality: QualityReport) => void;
  disabled?: boolean;
  /** Khung căn vị trí + tips (hướng dẫn đặt mặt, KHÔNG phải phát hiện/liveness). */
  showGuide?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");
  const [quality, setQuality] = useState<QualityReport | null>(null);

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
    } catch (err) {
      setState(err instanceof DOMException && err.name === "NotAllowedError" ? "denied" : "error");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || state !== "ready") return;
    const scale = CAPTURE_WIDTH / video.videoWidth;
    const w = CAPTURE_WIDTH;
    const h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h).data;
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      gray[i] = Math.round((pixels[i * 4]! + pixels[i * 4 + 1]! + pixels[i * 4 + 2]!) / 3);
    }
    const report = analyzeQuality(gray, w, h);
    setQuality(report);
    if (report.ok) {
      onCapture(canvas.toDataURL("image/jpeg", 0.85), report);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {showGuide ? (
        <ul className="flex flex-col gap-1 text-sm text-slate-600" aria-label="Hướng dẫn trước khi chụp">
          <li>• Đưa khuôn mặt vào giữa khung, nhìn thẳng camera.</li>
          <li>• Đủ sáng, tránh đèn chiếu thẳng sau lưng.</li>
          <li>• Giữ yên máy khi bấm chụp.</li>
        </ul>
      ) : null}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
        <video
          ref={videoRef}
          playsInline
          muted
          aria-label="Xem trước camera đăng ký khuôn mặt"
          className="aspect-[4/3] w-full object-cover"
        />
        {showGuide && state === "ready" ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-3/4 w-1/2 rounded-full border-2 border-dashed border-white/80" />
          </div>
        ) : null}
      </div>

      {showGuide ? (
        <p className="text-xs text-slate-500">
          Khung tròn chỉ giúp căn vị trí — không phải phát hiện khuôn mặt hay chống giả mạo.
        </p>
      ) : null}
      {state === "idle" || state === "requesting" ? (
        <Button onClick={start} loading={state === "requesting"} disabled={disabled}>
          Bật camera
        </Button>
      ) : null}

      {state === "ready" ? (
        <Button onClick={capture} disabled={disabled}>
          Chụp ảnh đăng ký
        </Button>
      ) : null}

      {state === "denied" ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          <Icon name="x" size={16} className="mt-0.5 shrink-0" />
          <span>
            Camera bị từ chối. Hãy cấp quyền camera trong trình duyệt rồi tải lại trang,
            hoặc dùng phương thức chấm công thay thế (liên hệ HR).
          </span>
        </div>
      ) : null}

      {state === "unavailable" ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Icon name="info" size={16} className="mt-0.5 shrink-0" />
          <span>Thiết bị không có camera hoặc trình duyệt không hỗ trợ. Dùng phương thức thay thế.</span>
        </div>
      ) : null}

      {state === "error" ? (
        <div role="alert" className="flex flex-col gap-2">
          <p className="flex items-center gap-1 text-sm text-red-600"><Icon name="x" size={14} /> Không mở được camera.</p>
          <div><Button variant="secondary" size="sm" onClick={start}>Thử lại</Button></div>
        </div>
      ) : null}

      {quality && !quality.ok ? (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="font-medium">Ảnh chưa đạt, hãy chụp lại:</p>
          <ul className="list-disc pl-5">
            {quality.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
