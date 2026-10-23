"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as faceapi from "@vladmandic/face-api";

export interface FaceDetectionResult {
  detected: boolean;
  faceCount: number;
  aligned: boolean;
  centered: boolean;
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDetecting = useRef(false);

  async function loadModels() {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
      setIsLoading(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Không tải được mô hình: ${msg}`);
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadModels();
  }, []);

  async function detectFaces(video: HTMLVideoElement) {
    if (!video || video.readyState !== 4 || isDetecting.current) return;
    isDetecting.current = true;

    try {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 }))
        .withFaceLandmarks(true)
        .withFaceExpressions();

      if (detection) {
        const { detection: det, landmarks, expressions: faceExpressions } = detection;
        const box = det.box;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        // Check face size relative to video
        const faceArea = box.width * box.height;
        const videoArea = videoWidth * videoHeight;
        const sizeRatio = faceArea / videoArea;

        let size: "small" | "ok" | "large" = "ok";
        if (sizeRatio < 0.08) size = "small";
        else if (sizeRatio > 0.6) size = "large";

        // Check centering
        const faceCenterX = box.x + box.width / 2;
        const faceCenterY = box.y + box.height / 2;
        const videoCenterX = videoWidth / 2;
        const videoCenterY = videoHeight / 2;
        const offsetX = Math.abs(faceCenterX - videoCenterX) / (videoWidth / 2);
        const offsetY = Math.abs(faceCenterY - videoCenterY) / (videoHeight / 2);
        const centered = offsetX < 0.35 && offsetY < 0.35;

        // Estimate brightness from face region (simplified)
        let brightness: "dark" | "ok" | "bright" = "ok";
        // We'll use a canvas to sample brightness
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext("2d");
          if (ctx) {
            canvasRef.current.width = videoWidth;
            canvasRef.current.height = videoHeight;
            ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
            const imageData = ctx.getImageData(box.x, box.y, box.width, box.height);
            let sum = 0;
            for (let i = 0; i < imageData.data.length; i += 4) {
              sum += (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
            }
            const avgBrightness = sum / (imageData.data.length / 4);
            if (avgBrightness < 40) brightness = "dark";
            else if (avgBrightness > 220) brightness = "bright";
          }

        // Sharpness from landmarks (eye openness, etc.)
        let sharpness: "blurry" | "ok" | "sharp" = "ok";
        if (faceExpressions) {
          const eyeOpenness = (faceExpressions.neutral || 0) + (faceExpressions.happy || 0);
          if (eyeOpenness < 0.2) sharpness = "blurry";
          else if (eyeOpenness > 0.6) sharpness = "sharp";
        }

        // Check alignment (face rotation)
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        const eyeAngle = Math.atan2(rightEye[0].y - leftEye[0].y, rightEye[0].x - leftEye[0].x);
        const aligned = Math.abs(eyeAngle) < 0.5; // ~28 degrees

        setResult({
          detected: true,
          faceCount: 1,
          aligned,
          centered,
          size,
          brightness,
          sharpness,
          landmarks,
          box,
        });
      }
    } else {
        // No face detected
        setResult({
          detected: false,
          faceCount: 0,
          aligned: false,
          centered: false,
          size: "ok",
          brightness: "ok",
          sharpness: "ok",
          landmarks: null,
          box: null,
        });
      }
    } catch (err) {
      console.error("Face detection error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      // Nếu là lỗi WebGL/context lost, set error để UI hiển thị
      if (msg.includes("WebGL") || msg.includes("context") || msg.includes("canvas") || msg.includes("texture")) {
        setError(`Lỗi WebGL: ${msg}. Thử tải lại trang hoặc dùng nút "Chụp ngay".`);
      }
      setResult(DEFAULT_RESULT);
    } finally {
      isDetecting.current = false;
    }
  }

  function startDetection(video: HTMLVideoElement) {
    videoRef.current = video;
    // Create hidden canvas for brightness analysis
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
      canvasRef.current.style.display = "none";
      document.body.appendChild(canvasRef.current);
    }

    if (detectionInterval.current) {
      clearInterval(detectionInterval.current);
    }
    // Detect at ~10fps
    detectionInterval.current = setInterval(() => {
      detectFaces(video);
    }, 100);

    // Initial detection
    detectFaces(video);
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