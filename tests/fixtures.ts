/**
 * Fixtures Phase 1 — KHÔNG chứa dữ liệu sinh trắc thật.
 * Ảnh fixture chỉ là flag do MockFaceRecognitionProvider đọc.
 */
import type { FaceFixture } from "@/server/face/types";

export const demoUsers = {
  employeeA: { id: "user-a", employeeCode: "NV001", departmentId: "dept-x" },
  employeeB: { id: "user-b", employeeCode: "NV002", departmentId: "dept-y" },
};

export const faceFixtures: Record<string, FaceFixture> = {
  good: "good",
  blurry: "blurry",
  noMatch: "no-match",
  livenessFail: "liveness-fail",
};
