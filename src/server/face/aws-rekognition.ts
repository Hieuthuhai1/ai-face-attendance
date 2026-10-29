import "server-only";
import {
  RekognitionClient,
  SearchFacesByImageCommand,
  IndexFacesCommand,
  DeleteFacesCommand,
  DetectFacesCommand,
  CreateFaceLivenessSessionCommand,
  GetFaceLivenessSessionResultsCommand,
  ListCollectionsCommand,
} from "@aws-sdk/client-rekognition";
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
  LivenessStatus,
} from "./types";

/**
 * AwsRekognitionProvider — Production face recognition provider.
 * Yêu cầu: FACE_PROVIDER=aws-rekognition, FACE_PROVIDER_API_KEY, FACE_PROVIDER_SECRET_KEY, FACE_PROVIDER_REGION, FACE_COLLECTION_ID
 * Capabilities: enroll, verify1to1, liveness (passive + active), deleteSubject, qualityAssessment (via DetectFaces)
 * Không hỗ trợ: verify1toN (có thể thêm sau nếu cần)
 */
export class AwsRekognitionProvider implements FaceRecognitionProvider {
  readonly name = "aws-rekognition";
  readonly isDemo = false;
  readonly capabilities: ProviderCapabilities = {
    enroll: true,
    verify1to1: true,
    verify1toN: false,
    liveness: true,
    qualityAssessment: true,
    deleteSubject: true,
  };

  private client: RekognitionClient;
  private collectionId: string;
  private verifyThreshold: number;
  private reviewBandLow: number;

  constructor(config: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    collectionId: string;
    verifyThreshold?: number;
    reviewBandLow?: number;
  }) {
    this.client = new RekognitionClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    this.collectionId = config.collectionId;
    this.verifyThreshold = config.verifyThreshold ?? 0.72;
    this.reviewBandLow = config.reviewBandLow ?? 0.6;
  }

  /** Convert base64/Buffer/Blob to Uint8Array for AWS SDK. */
  private toBytes(input: FaceImageInput): Uint8Array {
    if (typeof input.data === "string") {
      // Base64 string (may include data URL prefix)
      const base64 = input.data.includes(",") ? input.data.split(",")[1] : input.data;
      return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    }
    if (input.data instanceof Buffer) {
      return new Uint8Array(input.data);
    }
    if (input.data instanceof Blob) {
      // In Node.js environment, Blob needs to be converted
      // This is a fallback - in practice, server actions receive base64
      throw new Error("Blob input not supported in Node.js environment; use base64 string");
    }
    throw new Error("Invalid image data format");
  }

  /** Map AWS error codes to standardized FaceResultCode. */
  private mapAwsError(error: unknown, operation: string): FaceOperationResult<never> {
    const msg = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : "UnknownError";

    // Credentials/authorization errors
    if (name === "UnauthorizedException" || name === "AccessDeniedException" || msg.includes("InvalidAccessKeyId") || msg.includes("SignatureDoesNotMatch")) {
      return { ok: false, code: "unauthorized", message: `AWS credentials invalid: ${msg}` };
    }

    // Resource not found
    if (name === "ResourceNotFoundException" || msg.includes("ResourceNotFoundException")) {
      return { ok: false, code: "enrollment_missing", message: `Resource not found: ${msg}` };
    }

    // Invalid parameter / quality issues
    if (name === "InvalidParameterException" || msg.includes("InvalidParameterException")) {
      if (msg.includes("quality") || msg.includes("QualityFilter")) {
        return { ok: false, code: "poor_image_quality", message: `Image quality rejected by provider: ${msg}` };
      }
      if (msg.includes("FaceId") || msg.includes("CollectionId")) {
        return { ok: false, code: "enrollment_missing", message: `Invalid resource reference: ${msg}` };
      }
      return { ok: false, code: "invalid_input", message: `Invalid request parameter: ${msg}` };
    }

    // Throttling / rate limit
    if (name === "ThrottlingException" || name === "ProvisionedThroughputExceededException" || msg.includes("Throttling") || msg.includes("RateExceeded")) {
      return { ok: false, code: "rate_limited", message: `Provider rate limit exceeded: ${msg}` };
    }

    // Service unavailable
    if (name === "ServiceUnavailableException" || name === "InternalServerError" || msg.includes("ServiceUnavailable") || msg.includes("InternalFailure")) {
      return { ok: false, code: "provider_unavailable", message: `Provider temporarily unavailable: ${msg}` };
    }

    // Request timeout
    if (name === "RequestTimeoutException" || msg.includes("RequestTimeout") || msg.includes("timeout")) {
      return { ok: false, code: "timeout", message: `Provider request timeout: ${msg}` };
    }

    // Limit exceeded (collection full, etc.)
    if (name === "LimitExceededException" || msg.includes("LimitExceeded")) {
      return { ok: false, code: "provider_unavailable", message: `Provider limit exceeded: ${msg}` };
    }

    // Generic fallback
    return { ok: false, code: "provider_unavailable", message: `${operation} failed: ${msg}` };
  }

  async checkAvailability(): Promise<FaceOperationResult<{ available: boolean }>> {
    try {
      await this.client.send(new ListCollectionsCommand({ MaxResults: 1 }));
      return { ok: true, code: "success", message: "AWS Rekognition available", data: { available: true } };
    } catch (error) {
      return this.mapAwsError(error, "Health check");
    }
  }

  async assessImageQuality(input: { image: FaceImageInput }): Promise<FaceOperationResult<{ quality: number; issues: string[] }>> {
    try {
      const bytes = this.toBytes(input.image);
      const command = new DetectFacesCommand({
        Image: { Bytes: bytes },
        Attributes: ["ALL"],
      });
      const response = await this.client.send(command);

      if (!response.FaceDetails || response.FaceDetails.length === 0) {
        return { ok: false, code: "poor_image_quality", message: "No face detected in image", data: { quality: 0, issues: ["no_face_detected"] } };
      }

      const face = response.FaceDetails[0];
      const issues: string[] = [];
      let qualityScore = 1.0;

      // Brightness check
      if (face.Quality?.Brightness !== undefined) {
        if (face.Quality.Brightness < 30) {
          issues.push("too_dark");
          qualityScore -= 0.3;
        } else if (face.Quality.Brightness > 90) {
          issues.push("too_bright");
          qualityScore -= 0.2;
        }
      }

      // Sharpness check
      if (face.Quality?.Sharpness !== undefined) {
        if (face.Quality.Sharpness < 50) {
          issues.push("blurry");
          qualityScore -= 0.4;
        }
      }

      // Pose check
      if (face.Pose) {
        if (Math.abs(face.Pose.Yaw ?? 0) > 30 || Math.abs(face.Pose.Pitch ?? 0) > 30) {
          issues.push("poor_pose");
          qualityScore -= 0.2;
        }
      }

      // Eyes open check
      if (face.EyesOpen?.Value === false) {
        issues.push("eyes_closed");
        qualityScore -= 0.2;
      }

      // Confidence check
      if (face.Confidence !== undefined && face.Confidence < 90) {
        issues.push("low_detection_confidence");
        qualityScore -= 0.1;
      }

      qualityScore = Math.max(0, Math.min(1, qualityScore));

      return {
        ok: true,
        code: "success",
        message: "Quality assessed",
        data: { quality: qualityScore, issues },
      };
    } catch (error) {
      return this.mapAwsError(error, "Quality assessment");
    }
  }

  async enrollFace(input: EnrollInput): Promise<FaceOperationResult<EnrollResult>> {
    try {
      if (input.images.length < 2) {
        return { ok: false, code: "poor_image_quality", message: "Enrollment requires at least 2 images" };
      }

      // Quality gate: check first image quality
      const qualityCheck = await this.assessImageQuality({ image: input.images[0] });
      if (!qualityCheck.ok || (qualityCheck.data?.quality ?? 0) < 0.5) {
        return { ok: false, code: "poor_image_quality", message: `Image quality too low: ${qualityCheck.data?.issues.join(", ") ?? "unknown"}` };
      }

      // Use first image for enrollment (AWS IndexFaces adds to collection)
      const bytes = this.toBytes(input.images[0]);
      const command = new IndexFacesCommand({
        CollectionId: this.collectionId,
        Image: { Bytes: bytes },
        ExternalImageId: input.employeeId,
        DetectionAttributes: ["ALL"],
        QualityFilter: "AUTO",
      });

      const response = await this.client.send(command);

      if (!response.FaceRecords || response.FaceRecords.length === 0) {
        return { ok: false, code: "provider_unavailable", message: "Failed to index face" };
      }

      const faceRecord = response.FaceRecords[0];
      // AWS doesn't return quality filter on FaceRecord.Face directly, infer from confidence
      const confidence = faceRecord.Face?.Confidence ?? 0;
      const quality = confidence >= 90 ? 0.9 : confidence >= 70 ? 0.7 : 0.5;

      return {
        ok: true,
        code: "success",
        message: "Face enrolled successfully",
        data: {
          providerSubjectId: faceRecord.Face?.FaceId ?? `aws_${input.employeeId}`,
          quality,
        },
      };
    } catch (error) {
      return this.mapAwsError(error, "Enrollment");
    }
  }

  /** Start active liveness session (for challenge-response flow). */
  async startLivenessSession(): Promise<FaceOperationResult<{ sessionId: string }>> {
    try {
      const command = new CreateFaceLivenessSessionCommand({});
      const response = await this.client.send(command);
      return {
        ok: true,
        code: "success",
        message: "Liveness session created",
        data: { sessionId: response.SessionId ?? "" },
      };
    } catch (error) {
      return this.mapAwsError(error, "Start liveness session");
    }
  }

  async checkLiveness(input: LivenessInput): Promise<FaceOperationResult<LivenessResult>> {
    try {
      if (input.sessionId) {
        // Active liveness: get results for existing session
        const command = new GetFaceLivenessSessionResultsCommand({
          SessionId: input.sessionId,
        });
        const response = await this.client.send(command);

        const statusValue = response.Status as string;
        // LivenessSessionStatus enum: "SUCCESS" | "FAILED" | "CREATED" | "EXPIRED" | "IN_PROGRESS"
        const status: LivenessStatus = (statusValue === "SUCCESS") ? "pass" : (statusValue === "FAILED") ? "fail" : "unknown";
        return {
          ok: true,
          code: status === "pass" ? "success" : status === "fail" ? "liveness_failed" : "manual_review_required",
          message: `Liveness check ${status}`,
          data: { status, providerReference: response.SessionId ?? "unknown" },
        };
      } else {
        // Passive liveness: use DetectFaces for basic checks
        // Full passive liveness requires CreateFaceLivenessSession + GetFaceLivenessSessionResults
        const bytes = this.toBytes(input.image);
        const command = new DetectFacesCommand({
          Image: { Bytes: bytes },
          Attributes: ["ALL"],
        });
        const response = await this.client.send(command);

        if (!response.FaceDetails || response.FaceDetails.length === 0) {
          return { ok: false, code: "poor_image_quality", message: "No face detected for liveness", data: { status: "fail", providerReference: "no_face" } };
        }

        const face = response.FaceDetails[0];
        let status: LivenessStatus = "pass";

        // Basic passive liveness indicators
        if (face.EyesOpen?.Value === false) status = "fail";
        else if (face.Quality?.Sharpness !== undefined && face.Quality.Sharpness < 30) status = "unknown";
        else if (face.Pose && (Math.abs(face.Pose.Yaw ?? 0) > 45 || Math.abs(face.Pose.Pitch ?? 0) > 45)) status = "unknown";

        return {
          ok: true,
          code: status === "pass" ? "success" : status === "fail" ? "liveness_failed" : "manual_review_required",
          message: `Passive liveness: ${status}`,
          data: { status, providerReference: `passive_${Date.now()}` },
        };
      }
    } catch (error) {
      return this.mapAwsError(error, "Liveness check");
    }
  }

  async verifyFace(input: Verify1to1Input): Promise<FaceOperationResult<VerifyResult>> {
    try {
      const bytes = this.toBytes(input.image);
      // SearchFacesByImage searches for faces in a collection that match the input image
      // This is the correct API for 1:1 verification against an enrolled face
      const command = new SearchFacesByImageCommand({
        CollectionId: this.collectionId,
        Image: { Bytes: bytes },
        // Lấy nhiều ứng viên rồi tự chọn đúng FaceId của nhân viên (1:1 thật sự).
        FaceMatchThreshold: this.reviewBandLow * 100, // AWS uses 0-100
        MaxFaces: 10,
        QualityFilter: "AUTO",
      });

      const response = await this.client.send(command);

      if (!response.FaceMatches || response.FaceMatches.length === 0) {
        return {
          ok: true,
          code: "no_match",
          message: "No match found",
          data: { match: false, confidence: 0, liveness: "unknown", providerReference: "search_faces_no_match" },
        };
      }

      // 1:1: chỉ chấp nhận FaceId đã đăng ký cho nhân viên này.
      const match = response.FaceMatches.find(
        (m) => m.Face?.FaceId === input.providerSubjectId,
      );
      if (!match) {
        return {
          ok: true,
          code: "no_match",
          message: "Matched different face",
          data: { match: false, confidence: 0, liveness: "unknown", providerReference: "search_faces_wrong_face" },
        };
      }

      const matchedFaceId = match.Face?.FaceId;
      const similarity = (match.Similarity ?? 0) / 100; // Convert to 0..1
      const confidence = similarity;

      // Determine liveness status (SearchFacesByImage doesn't directly return liveness)
      // We infer from quality/confidence
      let liveness: LivenessStatus = "pass";
      if (confidence < this.reviewBandLow) liveness = "unknown";

      const result: VerifyResult = {
        match: confidence >= this.reviewBandLow,
        confidence,
        liveness,
        providerReference: matchedFaceId ?? "search_faces_match",
      };

      let code: FaceOperationResult<VerifyResult>["code"] = "success";
      if (confidence < this.reviewBandLow) code = "no_match";
      else if (confidence < this.verifyThreshold) code = "low_confidence";

      return { ok: true, code, message: "Verify completed", data: result };
    } catch (error) {
      return this.mapAwsError(error, "Verification");
    }
  }

  async removeEnrollment(providerSubjectId: string): Promise<FaceOperationResult<void>> {
    try {
      const command = new DeleteFacesCommand({
        CollectionId: this.collectionId,
        FaceIds: [providerSubjectId],
      });
      await this.client.send(command);
      return { ok: true, code: "success", message: "Face deleted from collection" };
    } catch (error) {
      const mapped = this.mapAwsError(error, "Delete enrollment");
      // ResourceNotFoundException is idempotent for delete
      if (error instanceof Error && error.name === "ResourceNotFoundException") {
        return { ok: true, code: "success", message: "Face already deleted or not found" };
      }
      return mapped;
    }
  }

  async getHealth(): Promise<ProviderHealth> {
    try {
      await this.client.send(new ListCollectionsCommand({ MaxResults: 1 }));
      return { configured: true, provider: "aws-rekognition", demo: false, message: "AWS Rekognition ready" };
    } catch (error) {
      return { configured: false, provider: "aws-rekognition", demo: false, message: "AWS Rekognition unavailable — check credentials/region" };
    }
  }
}