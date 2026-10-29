"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as faceapi from "@vladmandic/face-api";

export interface FaceDetectionResult {
  detected: boolean;
  faceCount: number;
  aligned: boolean;
  centered: boolean;
  /** Tâm khuôn mặt theo trục X (0..1) — dùng cho overlay hướng dẫn. */
  faceX?: number;
  /** Tâm khuôn mặt theo trục Y (0..1) — dùng cho overlay hướng dẫn. */
  faceY?: number;
  size: "small" | "ok" | "large";
  brightness: "dark" | "ok" | "bright";
  sharpness: "blurry" | "ok" | "sharp";
  landmarks: faceapi.FaceLandmarks68 | null;
  box: faceapi.Box | null;
}

interface FaceDetectionContextValue {
  result: FaceDetectionResult;
  isLoading: boolean;
  error: string | null;
  startDetection: (video: HTMLVideoElement) => void;
  stopDetection: () => void;
}

const FaceDetectionContext = createContext<FaceDetectionContextValue | null>(null);

const MODEL_URL = "/models";

const DEFAULT_RESULT: FaceDetectionResult = {
  detected: false,
  faceCount: 0,
  aligned: false,
  centered: false,
  size: "ok",
  brightness: "ok",
  sharpness: "ok",
  landmarks: null,
  box: null,
};

export function FaceDetectionProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<FaceDetectionResult>(DEFAULT_RESULT);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const detectionInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDetecting = useRef(false);
  const disposed = useRef(false);

  useEffect(() => {
    disposed.current = false;
    async function loadModels() {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        if (!disposed.current) setIsLoading(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!disposed.current) {
          setError(`Không tải được mô hình: ${msg}`);
          setIsLoading(false);
        }
      }
    }
    loadModels();
    return () => {
      disposed.current = true;
    };
  }, []);

  async function detectFaces(video: HTMLVideoElement) {
    if (!video || video.readyState !== 4 || isDetecting.current || disposed.current) return;
    isDetecting.current = true;

    try {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 }))
        .withFaceLandmarks(true)
        .withFaceExpressions();

      if (!detection || disposed.current) {
        setResult(DEFAULT_RESULT);
        return;
      }

      const { detection: det, landmarks, expressions } = detection;
      const box = det.box;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      // Kích thước khuôn mặt so với khung hình
      const sizeRatio = (box.width * box.height) / (videoWidth * videoHeight);
      const size: "small" | "ok" | "large" =
        sizeRatio < 0.08 ? "small" : sizeRatio > 0.6 ? "large" : "ok";

      // Vị trí tâm khuôn mặt
      const faceX = (box.x + box.width / 2) / videoWidth;
      const faceY = (box.y + box.height / 2) / videoHeight;
      const centered = Math.abs(faceX - 0.5) < 0.18 && Math.abs(faceY - 0.5) < 0.2;

      // Độ sáng vùng mặt
      let brightness: "dark" | "ok" | "bright" = "ok";
      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
        canvasRef.current.style.display = "none";
        document.body.appendChild(canvasRef.current);
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
        const sx = Math.max(0, Math.floor(box.x));
        const sy = Math.max(0, Math.floor(box.y));
        const sw = Math.max(1, Math.min(Math.floor(box.width), videoWidth - sx));
        const sh = Math.max(1, Math.min(Math.floor(box.height), videoHeight - sy));
        try {
          const imageData = ctx.getImageData(sx, sy, sw, sh);
          let sum = 0;
          for (let i = 0; i < imageData.data.length; i += 4) {
            sum += (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
          }
          const avg = sum / (imageData.data.length / 4);
          if (avg < 40) brightness = "dark";
          else if (avg > 220) brightness = "bright";
        } catch {
          // getImageData có thể lỗi nếu canvas bị nhiễu — bỏ qua.
        }
      }

      // Độ nét ước lượng từ biểu cảm (không phải blur thật) — chỉ là gợi ý.
      let sharpness: "blurry" | "ok" | "sharp" = "ok";
      if (expressions) {
        const openness = (expressions.neutral || 0) + (expressions.happy || 0);
        if (openness < 0.2) sharpness = "blurry";
        else if (openness > 0.6) sharpness = "sharp";
      }

      // Góc nghiêng đầu qua đường nối hai mắt
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const eyeAngle = Math.atan2(rightEye[0].y - leftEye[0].y, rightEye[0].x - leftEye[0].x);
      const aligned = Math.abs(eyeAngle) < 0.5; // ~28 độ

      setResult({
        detected: true,
        faceCount: 1,
        aligned,
        centered,
        faceX,
        faceY,
        size,
        brightness,
        sharpness,
        landmarks,
        box,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Lỗi WebGL/context: hiển thị để người dùng biết vẫn chụp tay được.
      if (msg.includes("WebGL") || msg.includes("context") || msg.includes("canvas") || msg.includes("texture")) {
        setError(`Lỗi xử lý ảnh: ${msg}. Bạn vẫn có thể bấm chụp.`);
      }
      setResult(DEFAULT_RESULT);
    } finally {
      isDetecting.current = false;
    }
  }

  function startDetection(video: HTMLVideoElement) {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
      canvasRef.current.style.display = "none";
      document.body.appendChild(canvasRef.current);
    }

    if (detectionInterval.current) clearInterval(detectionInterval.current);
    detectionInterval.current = setInterval(() => {
      void detectFaces(video);
    }, 150);

    void detectFaces(video);
  }

  function stopDetection() {
    if (detectionInterval.current) {
      clearInterval(detectionInterval.current);
      detectionInterval.current = null;
    }
    isDetecting.current = false;
    setResult(DEFAULT_RESULT);
    if (canvasRef.current) {
      canvasRef.current.remove();
      canvasRef.current = null;
    }
  }

  return (
    <FaceDetectionContext.Provider value={{ result, isLoading, error, startDetection, stopDetection }}>
      {children}
    </FaceDetectionContext.Provider>
  );
}

export function useFaceDetection() {
  const context = useContext(FaceDetectionContext);
  if (!context) {
    throw new Error("useFaceDetection must be used within a FaceDetectionProvider");
  }
  return context;
}
