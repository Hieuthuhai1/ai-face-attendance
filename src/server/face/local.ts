import "server-only";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-cpu";
import * as faceapi from "@vladmandic/face-api/dist/face-api.esm-nobundle.js";
import { createServiceClient, isServiceClientConfigured } from "@/lib/supabase/service";
import type {
  EnrollInput,
  EnrollResult,
  FaceImageInput,
  FaceOperationResult,
  FaceRecognitionProvider,
  LivenessInput,
  LivenessResult,
  ProviderCapabilities,
  ProviderHealth,
  Verify1to1Input,
  VerifyResult,
} from "./types";

/**
 * LocalFaceRecognitionProvider — đối chiếu khuôn mặt NGAY TRÊN SERVER.
 *
 * - Enrollment: tính descriptor 128 chiều bằng face-api (tiny face detector +
 *   landmark 68 + face recognition), lưu vào public.face_templates qua service role.
 * - Verify: tính descriptor của frame camera rồi so Euclidean distance với mẫu
 *   đã đăng ký. distance <= FACE_MATCH_DISTANCE → khớp.
 * - Không trả descriptor/template/frame về client. Không log dữ liệu sinh trắc.
 *
 * Giới hạn: đây là so khớp khuôn mặt, KHÔNG phải liveness/anti-spoof thật.
 * checkLiveness chỉ xác nhận có đúng 1 khuôn mặt rõ trong khung hình.
 */

const MODEL_VERSION = "face-api-1.7.15/face_recognition_model";
const DEFAULT_MATCH_DISTANCE = 0.45;
const DETECTOR_INPUT_SIZE = 320;
const DETECTOR_SCORE_THRESHOLD = 0.45;

interface FaceSample {
  descriptor: Float32Array;
  score: number;
}

interface LocalProviderOptions {
  matchDistance?: number;
  modelDir?: string;
}

/** Cache model theo process để tránh load lại mỗi request (Vercel warm). */
let modelsPromise: Promise<void> | null = null;

function modelDirectory(configured?: string): string {
  return configured ?? process.env.FACE_LOCAL_MODEL_DIR ?? path.join(process.cwd(), "public", "models");
}

/**
 * face-api's loadFromDisk dùng dynamic require('fs') — Turbopack không hỗ trợ.
 * Tự đọc manifest + shard bằng node:fs rồi nạp weight map.
 */
async function loadNetFromDisk(
  net: { loadFromWeightMap: (weightMap: faceapi.tf.NamedTensorMap) => void },
  dir: string,
  modelName: string,
): Promise<void> {
  const manifestPath = path.join(dir, `${modelName}-weights_manifest.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Parameters<
    ReturnType<typeof faceapi.tf.io.weightsLoaderFactory>
  >[0];

  const loadWeights = faceapi.tf.io.weightsLoaderFactory(async (filePaths: string[]) =>
    filePaths.map((filePath) => {
      const buf = readFileSync(filePath);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    }),
  );

  const base = dir.endsWith("/") || dir.endsWith("\\") ? dir : `${dir}${path.sep}`;
  const weightMap = await loadWeights(manifest, base);
  net.loadFromWeightMap(weightMap);
}

async function ensureModels(dir: string): Promise<void> {
  if (!modelsPromise) {
    modelsPromise = (async () => {
      await tf.setBackend("cpu");
      await tf.ready();
      await Promise.all([
        loadNetFromDisk(faceapi.nets.tinyFaceDetector, dir, "tiny_face_detector_model"),
        loadNetFromDisk(faceapi.nets.faceLandmark68Net, dir, "face_landmark_68_model"),
        loadNetFromDisk(faceapi.nets.faceRecognitionNet, dir, "face_recognition_model"),
      ]);
    })().catch((err: unknown) => {
      // Cho phép thử lại ở request sau thay vì cache lỗi vĩnh viễn.
      modelsPromise = null;
      throw err;
    });
  }
  return modelsPromise;
}

function toBuffer(data: FaceImageInput["data"]): Promise<Buffer> {
  if (typeof data === "string") {
    const match = /^data:[^;]+;base64,(.+)$/.exec(data);
    return Promise.resolve(Buffer.from(match ? match[1] : data, "base64"));
  }
  if (Buffer.isBuffer(data)) return Promise.resolve(data);
  return data.arrayBuffer().then((ab) => Buffer.from(ab));
}

async function extractFaces(image: FaceImageInput, dir: string): Promise<FaceSample[]> {
  await ensureModels(dir);
  const buf = await toBuffer(image.data);

  const { data, info } = await sharp(buf)
    .rotate()
    .toColourspace("srgb")
    .removeAlpha()
    .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 3) {
    throw new Error(`LOCAL_FACE_UNSUPPORTED_CHANNELS:${info.channels}`);
  }

  const tensor = faceapi.tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3]);
  try {
    const results = await faceapi
      .detectAllFaces(
        tensor,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: DETECTOR_INPUT_SIZE,
          scoreThreshold: DETECTOR_SCORE_THRESHOLD,
        }),
      )
      .withFaceLandmarks()
      .withFaceDescriptors();

    return results.map((r) => ({ descriptor: r.descriptor, score: r.detection.score }));
  } finally {
    tensor.dispose();
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export class LocalFaceRecognitionProvider implements FaceRecognitionProvider {
  readonly name = "local";
  readonly isDemo = false;
  readonly capabilities: ProviderCapabilities = {
    enroll: true,
    verify1to1: true,
    verify1toN: false,
    // Không có anti-spoof thật; chỉ kiểm tra hiện diện 1 khuôn mặt.
    liveness: false,
    qualityAssessment: true,
    deleteSubject: true,
  };

  private readonly matchDistance: number;
  private readonly modelDir: string;
  /** Cache trong 1 request: liveness và verify dùng cùng frame. */
  private readonly frameCache = new Map<string, Promise<FaceSample[]>>();

  constructor(options: LocalProviderOptions = {}) {
    this.matchDistance = options.matchDistance ?? DEFAULT_MATCH_DISTANCE;
    this.modelDir = modelDirectory(options.modelDir);
  }

  private faces(image: FaceImageInput): Promise<FaceSample[]> {
    const key = typeof image.data === "string" ? image.data : null;
    if (!key) return extractFaces(image, this.modelDir);

    const cached = this.frameCache.get(key);
    if (cached) return cached;

    const task = extractFaces(image, this.modelDir);
    this.frameCache.set(key, task);
    if (this.frameCache.size > 4) {
      const oldest = this.frameCache.keys().next().value;
      if (oldest !== undefined) this.frameCache.delete(oldest);
    }
    return task;
  }

  async checkAvailability(): Promise<FaceOperationResult<{ available: boolean }>> {
    const modelsPresent = ["tiny_face_detector_model-weights_manifest.json", "face_landmark_68_model-weights_manifest.json", "face_recognition_model-weights_manifest.json"].every(
      (file) => existsSync(path.join(this.modelDir, file)),
    );
    if (!modelsPresent || !isServiceClientConfigured()) {
      return {
        ok: false,
        code: "not_configured",
        message: "Local face matcher thiếu model hoặc SUPABASE_SERVICE_ROLE_KEY.",
        data: { available: false },
      };
    }
    return { ok: true, code: "success", message: "Local face matcher available", data: { available: true } };
  }

  async assessImageQuality(input: { image: FaceImageInput }): Promise<FaceOperationResult<{ quality: number; issues: string[] }>> {
    try {
      const faces = await this.faces(input.image);
      if (faces.length === 0) {
        return { ok: true, code: "success", message: "Quality assessed", data: { quality: 0, issues: ["no_face"] } };
      }
      if (faces.length > 1) {
        return { ok: true, code: "success", message: "Quality assessed", data: { quality: 0, issues: ["multiple_faces"] } };
      }
      return { ok: true, code: "success", message: "Quality assessed", data: { quality: clamp01(faces[0].score), issues: [] } };
    } catch {
      return { ok: false, code: "poor_image_quality", message: "Không đọc được ảnh." };
    }
  }

  async enrollFace(input: EnrollInput): Promise<FaceOperationResult<EnrollResult>> {
    if (!input.organizationId) {
      return { ok: false, code: "invalid_input", message: "Thiếu organizationId khi đăng ký khuôn mặt." };
    }

    let faces: FaceSample[];
    try {
      faces = await this.faces(input.images[0]);
    } catch {
      return { ok: false, code: "poor_image_quality", message: "Không đọc được ảnh. Hãy chụp lại." };
    }

    if (faces.length === 0) {
      return { ok: false, code: "poor_image_quality", message: "Không phát hiện khuôn mặt. Hãy chụp lại đủ sáng, nhìn thẳng camera." };
    }
    if (faces.length > 1) {
      return { ok: false, code: "poor_image_quality", message: "Phát hiện nhiều khuôn mặt. Chỉ chụp một mình bạn." };
    }

    const providerSubjectId = `local_${randomUUID()}`;
    const descriptor = Array.from(faces[0].descriptor);

    try {
      const supabase = createServiceClient();
      const { error } = await supabase.from("face_templates").insert({
        organization_id: input.organizationId,
        employee_id: input.employeeId,
        provider: this.name,
        provider_subject_id: providerSubjectId,
        model_version: MODEL_VERSION,
        descriptor,
      });
      if (error) {
        return { ok: false, code: "provider_unavailable", message: "Không lưu được mẫu khuôn mặt." };
      }
    } catch {
      return { ok: false, code: "not_configured", message: "Local face matcher chưa được cấu hình." };
    }

    return {
      ok: true,
      code: "success",
      message: "Enrolled successfully",
      data: { providerSubjectId, quality: clamp01(faces[0].score) },
    };
  }

  async checkLiveness(input: LivenessInput): Promise<FaceOperationResult<LivenessResult>> {
    let faces: FaceSample[];
    try {
      faces = await this.faces(input.image);
    } catch {
      return { ok: false, code: "poor_image_quality", message: "Không đọc được ảnh." };
    }

    if (faces.length === 0) {
      return { ok: false, code: "poor_image_quality", message: "Không phát hiện khuôn mặt trong khung hình." };
    }
    if (faces.length > 1) {
      return { ok: false, code: "liveness_failed", message: "Phát hiện nhiều khuôn mặt trong khung hình." };
    }

    return {
      ok: true,
      code: "success",
      message: "Single face detected",
      data: { status: "pass", providerReference: "local_presence" },
    };
  }

  async verifyFace(input: Verify1to1Input): Promise<FaceOperationResult<VerifyResult>> {
    let stored: number[] | null = null;
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("face_templates")
        .select("descriptor, model_version")
        .eq("provider_subject_id", input.providerSubjectId)
        .maybeSingle();
      if (error) {
        return { ok: false, code: "provider_unavailable", message: "Không đọc được mẫu khuôn mặt." };
      }
      const row = data as { descriptor: unknown; model_version: string } | null;
      if (!row) {
        return { ok: false, code: "enrollment_missing", message: "Không tìm thấy mẫu khuôn mặt đã đăng ký." };
      }
      if (!Array.isArray(row.descriptor) || row.descriptor.length !== 128) {
        return { ok: false, code: "enrollment_missing", message: "Mẫu khuôn mặt không hợp lệ. Hãy đăng ký lại." };
      }
      stored = row.descriptor.map((n) => Number(n));
    } catch {
      return { ok: false, code: "not_configured", message: "Local face matcher chưa được cấu hình." };
    }

    let faces: FaceSample[];
    try {
      faces = await this.faces(input.image);
    } catch {
      return { ok: false, code: "poor_image_quality", message: "Không đọc được ảnh." };
    }

    if (faces.length === 0) {
      return { ok: false, code: "poor_image_quality", message: "Không phát hiện khuôn mặt. Hãy nhìn thẳng camera." };
    }
    if (faces.length > 1) {
      return { ok: false, code: "liveness_failed", message: "Phát hiện nhiều khuôn mặt trong khung hình." };
    }

    const live = faces[0].descriptor;
    const distance = faceapi.euclideanDistance(stored, live);
    const confidence = clamp01(1 - distance);
    const match = distance <= this.matchDistance;

    return {
      ok: true,
      code: match ? "success" : "no_match",
      message: match ? "Khuôn mặt khớp mẫu đã đăng ký." : "Khuôn mặt không khớp mẫu đã đăng ký.",
      data: {
        match,
        confidence,
        liveness: "pass",
        // Chỉ mã tham chiếu ngắn, không phải descriptor.
        providerReference: `local:${input.providerSubjectId.slice(-12)}`,
      },
    };
  }

  async removeEnrollment(providerSubjectId: string): Promise<FaceOperationResult<void>> {
    try {
      const supabase = createServiceClient();
      const { error } = await supabase
        .from("face_templates")
        .delete()
        .eq("provider_subject_id", providerSubjectId);
      if (error) {
        return { ok: false, code: "provider_unavailable", message: "Không xóa được mẫu khuôn mặt." };
      }
      return { ok: true, code: "success", message: "Subject removed", data: undefined };
    } catch {
      return { ok: false, code: "not_configured", message: "Local face matcher chưa được cấu hình." };
    }
  }

  async getHealth(): Promise<ProviderHealth> {
    const configured = isServiceClientConfigured() && existsSync(path.join(this.modelDir, "face_recognition_model-weights_manifest.json"));
    return {
      configured,
      provider: this.name,
      demo: false,
      message: configured
        ? "Đối chiếu khuôn mặt trên server (face-api). Không có anti-spoof/liveness thật."
        : "NOT CONFIGURED — thiếu SUPABASE_SERVICE_ROLE_KEY hoặc model files.",
    };
  }
}
