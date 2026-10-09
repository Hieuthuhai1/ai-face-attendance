"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { analyzeQuality, type QualityReport } from "@/lib/face/quality";

export type CameraState =
  | "idle"
  | "requesting"
  | "ready"
  | "denied"
  | "unavailable"
  | "error";

const CAPTURE_WIDTH = 480;

/** Camera preview + chụp 1 frame, kiểm tra sáng/mờ/size trước khi gửi. */
export function CameraCapture({
  onCapture,
  disabled,
}: {
  onCapture: (frameDataUrl: string, quality: QualityReport) => void;
  disabled?: boolean;
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 } },
        audio: false,
      });
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
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
        <video
          ref={videoRef}
          playsInline
          muted
          aria-label="Xem trước camera đăng ký khuôn mặt"
          className="aspect-[4/3] w-full object-cover"
        />
      </div>

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
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          ✕ Camera bị từ chối. Hãy cấp quyền camera trong trình duyệt rồi tải lại trang,
          hoặc dùng phương thức chấm công thay thế (liên hệ HR).
        </div>
      ) : null}

      {state === "unavailable" ? (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ○ Thiết bị không có camera hoặc trình duyệt không hỗ trợ. Dùng phương thức thay thế.
        </div>
      ) : null}

      {state === "error" ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm text-red-600">✕ Không mở được camera.</p>
          <Button variant="secondary" size="sm" onClick={start}>Thử lại</Button>
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
