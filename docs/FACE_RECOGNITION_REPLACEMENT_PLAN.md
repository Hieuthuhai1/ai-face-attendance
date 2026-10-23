# Face Recognition Replacement Plan

> **Mục tiêu:** Thay thế `MockFaceRecognitionProvider` bằng provider production ổn định, phù hợp ứng dụng chấm công nhân viên. Không xây dựng model AI mới. Ưu tiên tích hợp API/model đã có sẵn.

---

## 1. Root Causes Đã Xác Minh

| Vấn đề | Bằng chứng | Mức độ |
|--------|------------|--------|
| **Chưa có provider production** | `getFaceProvider()` throw `PROVIDER_NOT_CONFIGURED` khi `NODE_ENV=production` (fail-closed by design) | **Critical** |
| **Mock chỉ dùng cho dev/test** | `MockFaceRecognitionProvider.isDemo = true`, UI gắn nhãn "DEMO – không dùng chấm công thật" | **By design** |
| **Frontend face-api.js CHỈ làm detection/quality** | `@vladmandic/face-api` dùng `tinyFaceDetector`, `faceLandmark68Net`, `faceExpressionNet` — **KHÔNG** có face recognition/embedding/matching | **Confirmed** |
| **Enrollment/verify flow hoạt động nhưng trả kết quả giả** | Server actions gọi mock với fixture (`good`/`blurry`/`no-match`/`liveness-fail`) | **Confirmed** |
| **Không có credentials/liveness thật** | `.env.example` chỉ có placeholder; `FACE_PROVIDER_API_KEY` chưa cấu hình | **Confirmed** |

**Kết luận:** Không phải "lỗi" model hiện tại — hệ thống **chưa được tích hợp provider thật**. Cần implement adapter cho provider production.

---

## 2. Đánh Giá Các Phương Án

### A. Giữ nguyên Mock (Trạng thái hiện tại)
| Tiêu chí | Đánh giá |
|----------|----------|
| Enrollment | Chỉ mô phỏng, không tạo template thật |
| Nhận diện lại | Deterministic theo fixture |
| Liveness | Không có (chỉ mock status) |
| Camera | Chỉ client-side detection |
| Vercel | OK (không cần infra) |
| Chi phí | $0 |
| License | N/A |
| Triển khai | Đã xong |
| Bảo vệ dữ liệu | Không có dữ liệu thật |

**Verdict:** Chỉ dùng dev/test. **Không thể dùng production.**

---

### B. AWS Rekognition (Đề xuất chính)

| Capability | Hỗ trợ |
|------------|--------|
| `detectFace()` | `DetectFaces` API |
| `assessImageQuality()` | `DetectFaces` trả quality (brightness, sharpness, pose, eyes open) |
| `startLivenessCheck()` | **Face Liveness** — `CreateFaceLivenessSession` + `GetFaceLivenessSessionResults` (passive + active challenge) |
| `enrollFace()` | `IndexFaces` vào Collection (mỗi employee = 1 face ID) |
| `verifyFace()` | `SearchFacesByImage` (1:N trong collection) HOẶC `CompareFaces` (1:1) |
| `removeEnrollment()` | `DeleteFaces` |
| `getProviderStatus()` | Health check qua `ListCollections` |

| Tiêu chí | Đánh giá |
|----------|----------|
| Phù hợp enrollment | ✅ `IndexFaces` + quality filter |
| Nhận diện lại nhân viên | ✅ `CompareFaces` (1:1) hoặc `SearchFacesByImage` (1:N) |
| Liveness/anti-spoof | ✅ **Face Liveness** có certification (iBeta Level 1/2), passive + active |
| Yêu cầu camera | Web camera chuẩn, HTTPS, hỗ trợ mobile Safari/Chrome |
| Vercel | ✅ Server-side SDK (`@aws-sdk/client-rekognition`), không secret ở client |
| Chi phí | ~$1/1000 compare, ~$0.10/1000 liveness check, collection storage miễn phí <1M faces |
| Tài khoản cần | AWS account, IAM user với `rekognition:*` permissions |
| License | AWS Customer Agreement — cho phép commercial use |
| Độ phức tạp | **Thấp** — managed API, SDK sẵn có, docs rõ ràng |
| Bảo vệ dữ liệu sinh trắc | ✅ Data residency chọn region (ap-southeast-1 Singapore), encryption at rest, `DeleteFaces` cho GDPR, DPA available |

**Verdict:** **Phù hợp nhất** cho project hiện tại.

---

### C. Self-hosted Model (InsightFace / ArcFace / FaceNet)

| Tiêu chí | Đánh giá |
|----------|----------|
| Enrollment | Cần inference server tự build |
| Nhận diện | Embedding + cosine similarity |
| Liveness | Cần model riêng (SilentFaceAntiSpoofing, MiniFASNet) — **không tích hợp sẵn** |
| Camera | Cần WebGL/WebAssembly hoặc server-side inference |
| Vercel | ❌ **Không phù hợp** — model nặng (>100MB), cần GPU, Vercel Edge Functions limit 50MB, timeout 30s |
| Chi phí | Infrastructure (GPU instance, scaling, monitoring) |
| License | **InsightFace: non-commercial only** (MSRA license). ArcFace: research only. Cần license thương mại riêng. |
| Độ phức tạp | **Rất cao** — deploy inference service, model versioning, A/B testing, monitoring |
| Bảo vệ dữ liệu | Tự quản lý toàn bộ (encryption, retention, deletion) |

**Verdict:** **Không khuyến nghị** cho Vercel deployment. Chỉ phù hợp nếu có infra riêng (K8s + GPU) và legal review license.

---

### D. Managed APIs Khác

| Provider | Trạng thái | Lý do loại |
|----------|------------|------------|
| Azure Face API | ❌ **Deprecated** cho khách mới (chỉ existing customers) | Microsoft ngừng cung cấp face recognition từ 2023 |
| Google Cloud Vision | ❌ Không có face recognition/verification | Chỉ detection, landmarks, emotions |
| Face++ (Megvii) | ⚠️ Chinese provider | Data residency VN không đảm bảo, GDPR phức tạp |
| Kairos | ❌ Legacy, ít cập nhật | Hết hạn hỗ trợ |
| Trueface | ❌ Được acquire bởi Pangiam | Không còn bán riêng |
| Paravision | ⚠️ Enterprise only | Cần contract lớn, không self-serve |

**Verdict:** Không có managed API nào khác phù hợp cho self-serve, Vercel-compatible, có liveness certified.

---

## 3. Kiến Trúc Tích Hợp — Face Recognition Provider Abstraction

### 3.1 Interface Mở Rộng (`src/server/face/types.ts`)

```typescript
export interface FaceRecognitionProvider {
  readonly name: string;
  readonly isDemo: boolean;

  // Capability detection
  readonly capabilities: {
    enroll: boolean;
    verify1to1: boolean;
    verify1toN: boolean;
    liveness: boolean;
    qualityAssessment: boolean;
    deleteSubject: boolean;
  };

  // Core operations
  enroll(input: { employeeId: string; images: Blob[] }): Promise<EnrollResult>;
  checkLiveness(input: { image: Blob; sessionId?: string }): Promise<LivenessResult>;
  verify1to1(input: { providerSubjectId: string; image: Blob }): Promise<VerifyResult>;
  verify1toN?(input: { image: Blob; maxResults?: number; threshold?: number }): Promise<VerifyResult[]>; // Optional
  deleteSubject(providerSubjectId: string): Promise<void>;

  // Health & config
  getHealth(): Promise<ProviderHealth>;
  getConfig(): ProviderConfig;
}
```

### 3.2 Factory Pattern (`src/server/face/index.ts`)

```typescript
export function getFaceProvider(env = process.env): FaceRecognitionProvider {
  const providerName = (env.FACE_PROVIDER ?? "mock").toLowerCase();
  const nodeEnv = env.NODE_ENV ?? "development";

  switch (providerName) {
    case "mock":
      if (nodeEnv === "production" && env.ALLOW_MOCK_IN_PRODUCTION !== "true") {
        throw new ProviderNotConfiguredError();
      }
      return new MockFaceRecognitionProvider();

    case "aws-rekognition":
      return new AwsRekognitionProvider({
        region: env.FACE_PROVIDER_REGION ?? "ap-southeast-1",
        apiKey: env.FACE_PROVIDER_API_KEY, // hoặc dùng AWS SDK default credential chain
        collectionId: env.FACE_COLLECTION_ID ?? "attendance-faces",
        verifyThreshold: Number(env.VERIFY_THRESHOLD ?? 0.72),
        reviewBandLow: Number(env.REVIEW_BAND_LOW ?? 0.60),
      });

    default:
      throw new ProviderNotConfiguredError(`Unknown provider: ${providerName}`);
  }
}
```

### 3.3 Provider Adapter Implementation (`src/server/face/aws-rekognition.ts`)

**Chỉ implement capability được hỗ trợ thực tế:**

| Method | AWS API | Note |
|--------|---------|------|
| `enroll` | `IndexFaces` | Tạo face record trong collection, trả `FaceId` + quality |
| `checkLiveness` | `CreateFaceLivenessSession` + `GetFaceLivenessSessionResults` | Passive liveness; active challenge nếu cần |
| `verify1to1` | `CompareFaces` | So sánh 1:1 với `FaceId` đã enroll |
| `deleteSubject` | `DeleteFaces` | Xóa face khỏi collection |
| `getHealth` | `ListCollections` | Kiểm tra collection tồn tại |

---

## 4. Quy Trình Enrollment Mới

```
HR chọn nhân viên
    ↓
Xác nhận đúng danh tính (so sánh thông tin hồ sơ)
    ↓
Hiển thị Privacy Notice (mục đích, provider, retention, quyền rút consent, fallback)
    ↓
Nhân viên tick consent checkbox (bắt buộc, versioned)
    ↓
Kiểm tra camera (permission, hardware, HTTPS)
    ↓
Chất lượng ảnh real-time (face-api.js client: centered, aligned, size, brightness, sharpness)
    ↓
Chụp ≥2 ảnh đạt quality gate
    ↓
Gửi server action `submitEnrollment` (base64 JPEG ≤500KB)
    ↓
Server: rate limit check → liveness check (provider) → enroll (provider) → lưu `provider_subject_id` + quality + consent_at
    ↓
Trạng thái `pending` → HR duyệt → `active` (stamp `verified_by`)
    ↓
Thông báo thành công / thất bại với hướng dẫn cụ thể
```

**Quan trọng:**
- Không coi "camera chụp được ảnh" là thành công
- Phải pass **liveness check** provider trước khi enroll
- HR **bắt buộc duyệt** (verify identity) mới chuyển `active`
- Audit log đầy đủ: `enrollment.submitted`, `enrollment.approved`, `enrollment.rejected`

---

## 5. Quy Trình Chấm Công Mới

```
Nhân viên đã xác thực (login)
    ↓
Mở `/check-in` → chọn ca (hoặc auto-resolve theo giờ)
    ↓
Kiểm tra eligibility: active enrollment, ca hợp lệ, rate limit
    ↓
Mở camera → real-time face detection + quality feedback (face-api.js)
    ↓
Chụp ảnh → client quality gate → gửi server action `verifyCheck`
    ↓
Server: liveness check (provider) → verify 1:1 (CompareFaces với provider_subject_id)
    ↓
Quyết định: success / pending_review (band thấp) / failed
    ↓
Ghi `attendance_events` (server timestamp, idempotency key, confidence, liveness, verification_ref)
    ↓
Recompute `attendance_days` (late/early/overtime)
    ↓
Trả kết quả UI: receipt chi tiết (giờ, ca, trạng thái, confidence, liveness, method)
```

**1:1 Verification Logic:**
- User đã login → biết `employee_id` → lookup `provider_subject_id` từ enrollment active
- Gọi `CompareFaces(SourceImage=live, TargetImage=enrolled_face_id)`
- **Không dùng 1:N search** trừ khi business yêu cầu (security risk: false accept cao hơn)

**Fallback PIN:** Chỉ khi provider unavailable / liveness fail / low confidence → ghi `method=pin_fallback`, `status=fallback`, yêu cầu HR xác nhận.

---

## 6. Security & Privacy

| Yêu cầu | Triển khai |
|---------|------------|
| API key không ở frontend | `FACE_PROVIDER_API_KEY` chỉ server-side (Vercel env), `getFaceProvider()` chạy server-only |
| Không expose embeddings/templates | Provider trả `FaceId`/`providerSubjectId` — opaque reference. Không bao giờ trả vector. |
| Không log raw face images/biometric | `logger.ts` tự redact `image`, `frame`, `template`, `embedding`, `apiKey` |
| Client không tự xác nhận chấm công | Server set `occurred_at=now()`, verify RBAC, idempotency key |
| Authorization backend | `requireUser()`, `requireRole()`, RLS policies |
| RLS face_enrollments | Manager chỉ đọc metadata team, **không** đọc `provider_subject_id` |
| Không auto-kết luận vắng/vi phạm chỉ do AI lỗi | `pending_review` band, fallback PIN, manual adjustment flow |
| Retry + xác minh thủ công | Idempotency key chống duplicate, fallback form, adjustment request |
| Chính sách lưu giữ/xóa | `face_enrollments` TTL theo consent, `deleteSubject` gọi provider API khi revoke |

---

## 7. Kế Hoạch Thực Hiện (Phases)

### Phase A: Audit & Root Cause (✅ Hoàn thành — plan này)

| Task | Files | Acceptance |
|------|-------|------------|
| Đọc docs, code, migrations, tests | — | Hiểu rõ architecture, gaps |
| Xác minh model hiện tại | `src/server/face/*.ts`, `src/components/face-attendance/` | Mock only, face-api.js = detection only |
| Kiểm tra env, Vercel, Supabase | `.env.example`, `vercel.json`, migrations | Fail-closed confirmed |

**Commit:** `docs: add face recognition replacement plan`

---

### Phase B: Provider Adapter & Configuration

| Task | Files | Acceptance |
|------|-------|------------|
| Tạo `AwsRekognitionProvider` implement `FaceRecognitionProvider` | `src/server/face/aws-rekognition.ts` (new) | Unit tests pass với mock AWS SDK |
| Cập nhật factory `getFaceProvider()` | `src/server/face/index.ts` | Switch qua `FACE_PROVIDER=aws-rekognition` |
| Thêm env vars vào `.env.example` | `.env.example` | `FACE_PROVIDER`, `FACE_PROVIDER_API_KEY`, `FACE_PROVIDER_REGION`, `FACE_COLLECTION_ID` |
| Config thresholds từ env | `src/config/app.ts` | `VERIFY_THRESHOLD`, `REVIEW_BAND_LOW` đọc từ env |
| Health check endpoint | `src/app/api/health/face/route.ts` (new) | GET trả `{ configured, provider, demo, message }` |

**DB Changes:** Không (chỉ dùng cột `provider_subject_id` hiện có)

**Test Cases:**
- Mock provider vẫn hoạt động dev/test
- Adapter throw `PROVIDER_NOT_CONFIGURED` khi thiếu credentials
- Health check trả đúng status

**Commit:** `feat(face): add aws-rekognition provider adapter`

---

### Phase C: Face Enrollment Mới

| Task | Files | Acceptance |
|------|-------|------------|
| Cập nhật `submitEnrollment` dùng provider thật | `src/features/face-enrollment/actions.ts` | Enroll gọi `provider.enroll(images: Blob[])` |
| Liveness check bắt buộc trước enroll | `actions.ts` | Fail enrollment nếu liveness != pass |
| Client: quality gate real-time (face-api.js) | `src/features/face-enrollment/camera-capture.tsx` | Chỉ cho chụp khi quality OK |
| Consent flow versioned | `src/features/face-enrollment/consent.ts` | Consent v1 bắt buộc, lưu `consent_at` |
| HR approve queue UI | `src/app/(protected)/admin/enrollments/page.tsx` | Xem metadata, approve/reject với reason |
| Revoke enrollment → deleteSubject | `actions.ts:revokeEnrollment` | Gọi `provider.deleteSubject()` + update DB |

**DB Changes:** Không (schema hiện tại đủ)

**Test Cases:**
- Enroll success → `provider_subject_id` lưu DB, status `pending`
- Low quality → reject với message cụ thể
- Liveness fail → reject
- Duplicate active enrollment → blocked
- Revoke → xóa provider subject + DB status `revoked`

**Commit:** `feat(face): production enrollment with liveness`

---

### Phase D: Face Verification Mới

| Task | Files | Acceptance |
|------|-------|------------|
| Cập nhật `verifyCheck` dùng provider thật | `src/features/attendance/actions.ts` | verify 1:1 với `CompareFaces` |
| Liveness check tích hợp | `actions.ts` | Passive liveness trước verify |
| Decision logic: threshold + review band | `src/server/attendance/decision.ts` | Configurable, unit tested |
| Confidence + liveness lưu event | `actions.ts` | `verification_ref`, `confidence`, `liveness` columns |
| UI receipt hiển thị chi tiết | `src/components/face-attendance/AttendanceReceipt.tsx` | Confidence %, liveness status, method |
| Error states cụ thể | `src/features/attendance/checkin-flow.tsx` | Low confidence, liveness fail, no match, provider down |

**DB Changes:** Không (columns `confidence`, `liveness`, `verification_ref` đã có trong migration `132000`)

**Test Cases:**
- Good face → success, confidence > threshold
- Blurry → pending_review (band)
- No match → failed event
- Liveness fail → failed event + fallback prompt
- Provider timeout → retry 1 lần → fallback PIN
- Idempotency key → duplicate request trả bản ghi cũ

**Commit:** `feat(attendance): production face verification 1:1`

---

### Phase E: Attendance Integration

| Task | Files | Acceptance |
|------|-------|------------|
| Shift resolveovernight correct | `src/server/attendance/decision.ts` | Integration tests pass |
| Late/early/overtime calculation | `src/lib/attendance/rules.ts` | Unit tests 100% |
| Fallback PIN flow | `src/features/attendance/actions.ts:fallbackCheck` | Ghi `method=pin_fallback`, `status=fallback` |
| Reports/dashboard dùng dữ liệu thật | `src/features/reports/actions.ts` | KPIs, charts, export CSV đúng scope RBAC |

**Test Cases:**
- Check-in → check-out full cycle
- Overnight shift work_date correct
- Grace period + rounding
- Fallback PIN → HR approve adjustment

**Commit:** `feat(attendance): full integration with production provider`

---

### Phase F: Security & Regression Tests

| Task | Files | Acceptance |
|------|-------|------------|
| Secret scan pre-commit | `.github/workflows/ci.yml` | No secrets in diff |
| RLS test matrix full | `supabase/tests/test_rls.sql` | 11/11 sections pass |
| Integration test attendance API | `tests/integration/attendance-api.test.ts` | All paths: success, review, failed, fallback |
| Contract test provider adapter | `tests/face-provider-contract.test.ts` (new) | Mock AWS SDK, verify calls |
| Load test verify endpoint | `tests/load/verify.test.ts` (new) | p95 < 2s, rate limit works |
| Audit log verification | `tests/integration/audit-api.test.ts` | Enrollment/verify/export all logged |

**Commit:** `test(security): regression suite for face provider`

---

### Phase G: Vercel Deployment & Live Verification

| Task | Owner | Acceptance |
|------|-------|------------|
| Tạo AWS account, IAM user, Rekognition collection | User (bạn) | Credentials ready |
| Cấu hình Vercel env vars (production) | User | `FACE_PROVIDER=aws-rekognition`, keys set |
| Deploy staging → smoke test | Auto (Vercel Preview) | `/check-in` flow end-to-end pass |
| Privacy review sign-off | HR/Legal | Consent flow, retention, DPA reviewed |
| Production deploy từ tag | Auto | `main` tag → Vercel production |
| Rollback drill | Team | `FACE_PROVIDER=mock` revert < 5 min |

**Env Vars Production (Vercel Dashboard):**
```bash
FACE_PROVIDER=aws-rekognition
FACE_PROVIDER_API_KEY=<aws-secret-access-key>
FACE_PROVIDER_REGION=ap-southeast-1
FACE_COLLECTION_ID=attendance-faces-prod
VERIFY_THRESHOLD=0.72
REVIEW_BAND_LOW=0.60
```

**Commit:** `chore(deploy): production face provider configuration`

---

## 8. Migration Strategy

| Bước | Mô tả | Rollback |
|------|-------|----------|
| 1. Dev: implement adapter, test local với AWS credentials dev | `FACE_PROVIDER=aws-rekognition` local `.env.local` | `FACE_PROVIDER=mock` |
| 2. Staging: deploy preview, test E2E với AWS staging collection | Vercel Preview env | Revert env var |
| 3. Data migration: enrollments mock → production | Script migrate `provider_subject_id` (nếu cần) | Không xóa mock data cho đến khi verify |
| 4. Parallel run: cả mock + production song song (feature flag) | `NEXT_PUBLIC_FACE_DEMO_BANNER` control UI | Tắt flag |
| 5. Cutover: switch production env, disable mock | `FACE_PROVIDER=aws-rekognition` prod | Revert env var ngay |

**Lưu ý:** Collection AWS Rekognition là isolated per environment (dev/staging/prod). Không share face IDs.

---

## 9. Test Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | Vitest | `decision.ts`, `rules.ts`, `quality.ts`, rate limit, validation |
| Provider Contract | Vitest + Mock AWS SDK | `AwsRekognitionProvider` methods, error mapping |
| Integration | Vitest + Supabase local | Server actions: enroll, verify, fallback, RPC |
| RLS | pgTAP / SQL script | 11 sections matrix (employee/manager/HR/admin) |
| E2E | Playwright | Full flows: login→enroll→approve→check-in→report→adjustment |
| Load | k6 / Playwright | Verify endpoint p95, rate limit, concurrent users |

**Fixtures:** `tests/fixtures.ts` — chỉ dữ liệu giả, **không** dữ liệu sinh trắc thật.

---

## 10. Thông Tin Còn Thiếu (Cần Bạn Cung Cấp)

| Thông tin | Cần cho Phase | Trạng thái |
|-----------|---------------|------------|
| AWS Account ID / Access Key / Secret Key | Phase B, G | ❌ Chưa có |
| Region ưu tiên (Singapore `ap-southeast-1` recommended) | Phase B | ⚠️ Chưa xác nhận |
| Collection name convention | Phase B | ⚠️ Default: `attendance-faces-{env}` |
| Verification threshold business decision | Phase C | ⚠️ Default 0.72, review band 0.60 |
| Privacy/DPA review sign-off | Phase G | ❌ Cần HR/Legal |
| Liveness mode: passive only / passive+active | Phase C | ⚠️ Default passive, active khi low confidence |

---

## 11. Prompt Build Tiếp Theo

> **Build Task — Phase B: Provider Adapter & Configuration**
>
> Tạo file `src/server/face/aws-rekognition.ts` implement `FaceRecognitionProvider` dùng `@aws-sdk/client-rekognition`. Cập nhật `getFaceProvider()` trong `index.ts` để support `FACE_PROVIDER=aws-rekognition`. Thêm env vars vào `.env.example`. Viết unit tests cho adapter (mock AWS SDK). Chỉ implement capabilities: `enroll`, `checkLiveness`, `verify1to1`, `deleteSubject`, `getHealth`. Không implement `verify1toN` trừ khi business yêu cầu.
>
> **Files to create/modify:**
> - `src/server/face/aws-rekognition.ts` (new)
> - `src/server/face/index.ts` (update factory)
> - `.env.example` (add AWS vars)
> - `src/config/app.ts` (read thresholds from env)
> - `tests/face-provider-contract.test.ts` (new)
>
> **Acceptance:** `npm test` pass, `npm run typecheck` pass, `npm run build` pass, mock provider vẫn works khi `FACE_PROVIDER=mock`.

---

## 12. Appendix: Current Code References

| Component | Path | Note |
|-----------|------|------|
| Provider Interface | `src/server/face/types.ts` | `FaceRecognitionProvider`, `EnrollResult`, `VerifyResult` |
| Mock Provider | `src/server/face/mock.ts` | Dev/test only |
| Factory | `src/server/face/index.ts` | Fail-closed production |
| Enrollment Actions | `src/features/face-enrollment/actions.ts` | `submitEnrollment`, `approveEnrollment`, `revokeEnrollment` |
| Verification Actions | `src/features/attendance/actions.ts` | `verifyCheck`, `fallbackCheck`, `getTodayStatus` |
| Decision Logic | `src/server/attendance/decision.ts` | `decideVerification` |
| Camera/Quality UI | `src/features/face-enrollment/camera-capture.tsx` | face-api.js detection |
| Face Detection Provider | `src/components/face-attendance/FaceDetectionProvider.tsx` | Real-time feedback |
| Quality Analysis | `src/lib/face/quality.ts` | Client-side brightness/blur/size |
| Database Schema | `supabase/migrations/20261009122000_face.sql` | `face_enrollments` table |
| Attendance Events | `supabase/migrations/20261009132000_record_event_rpc.sql` | RPC `record_attendance_event` |

---

**Document Version:** 1.0  
**Created:** 2026-10-23  
**Status:** PLAN MODE — Ready for Build Phase B