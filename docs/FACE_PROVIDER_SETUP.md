# Face Provider Setup — AWS Rekognition

> Hướng dẫn cấu hình AWS Rekognition cho production. Chỉ chạy khi đã có AWS account và credentials.

## 1. Yêu Cầu Tiên Quyết

- AWS Account đã bật billing
- IAM User/Programmatic access với quyền `rekognition:*` và `rekognition:ListCollections`
- Region khuyến nghị: `ap-southeast-1` (Singapore) — gần VN, data residency OK
- Collection Rekognition: sẽ tự tạo khi enroll lần đầu (hoặc tạo trước qua CLI)

## 2. Tạo IAM User & Policy

### Option A: Inline Policy (khuyến nghị cho dev/staging)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rekognition:CreateCollection",
        "rekognition:DeleteCollection",
        "rekognition:ListCollections",
        "rekognition:IndexFaces",
        "rekognition:SearchFacesByImage",
        "rekognition:DeleteFaces",
        "rekognition:DetectFaces",
        "rekognition:CreateFaceLivenessSession",
        "rekognition:GetFaceLivenessSessionResults"
      ],
      "Resource": "*"
    }
  ]
}
```

### Option B: Managed Policy (production - hạn chế resource)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rekognition:ListCollections"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "rekognition:IndexFaces",
        "rekognition:SearchFacesByImage",
        "rekognition:DeleteFaces",
        "rekognition:DetectFaces",
        "rekognition:CreateFaceLivenessSession",
        "rekognition:GetFaceLivenessSessionResults"
      ],
      "Resource": "arn:aws:rekognition:ap-southeast-1:<ACCOUNT_ID>:collection/attendance-faces-*"
    }
  ]
}
```

## 3. Cấu Hình Environment Variables

### Local Development (`.env.local`)

```bash
# Face Recognition Provider
FACE_PROVIDER=aws-rekognition
FACE_PROVIDER_API_KEY=<AWS_ACCESS_KEY_ID>
FACE_PROVIDER_SECRET_KEY=<AWS_SECRET_ACCESS_KEY>
FACE_PROVIDER_REGION=ap-southeast-1
FACE_COLLECTION_ID=attendance-faces-dev
VERIFY_THRESHOLD=0.72
REVIEW_BAND_LOW=0.60
```

### Vercel Preview/Production (Dashboard → Settings → Environment Variables)

| Variable | Preview | Production | Mô tả |
|----------|---------|------------|-------|
| `FACE_PROVIDER` | `aws-rekognition` | `aws-rekognition` | Chọn provider |
| `FACE_PROVIDER_API_KEY` | `<dev-access-key>` | `<prod-access-key>` | AWS Access Key ID |
| `FACE_PROVIDER_SECRET_KEY` | `<dev-secret-key>` | `<prod-secret-key>` | AWS Secret Access Key |
| `FACE_PROVIDER_REGION` | `ap-southeast-1` | `ap-southeast-1` | AWS Region |
| `FACE_COLLECTION_ID` | `attendance-faces-staging` | `attendance-faces-prod` | Collection ID riêng per env |
| `VERIFY_THRESHOLD` | `0.72` | `0.72` | Ngưỡng match (0-1) |
| `REVIEW_BAND_LOW` | `0.60` | `0.60` | Ngưỡng review band (0-1) |

**Quan trọng:** Collection ID **phải khác nhau** per environment (dev/staging/prod) để không share face IDs.

## 4. Tạo Collection (Tự động hoặc thủ công)

### Tự động (khuyến nghị)
Collection sẽ được tạo tự động khi enroll lần đầu (IndexFaces tự tạo collection nếu chưa tồn tại).

### Thủ công (CLI)
```bash
aws rekognition create-collection \
  --collection-id attendance-faces-dev \
  --region ap-southeast-1
```

Kiểm tra:
```bash
aws rekognition list-collections --region ap-southeast-1
```

## 5. Kiểm Tra Kết Nối

### Local
```bash
# Khởi động dev server
npm run dev

# Gọi health endpoint
curl http://localhost:3000/api/health/face
```

Kết quả mong đợi:
```json
{
  "configured": true,
  "provider": "aws-rekognition",
  "demo": false,
  "message": "AWS Rekognition ready"
}
```

### Vercel Preview
Sau khi push branch, Vercel auto-deploy. Kiểm tra:
```
https://<preview-url>/api/health/face
```

## 6. Quy Trình Test End-to-End

### 5.1 Enrollment
1. Login với tài khoản employee
2. Vào `/enrollment`
3. Đồng ý consent
4. Chụp ảnh (cần ≥2 ảnh quality pass)
5. Submit → enrollment status `pending`
6. Login HR → `/admin/enrollments` → Approve
7. Enrollment status thành `active`

### 5.2 Verification (Check-in/out)
1. Login employee có enrollment active
2. Vào `/check-in`
3. Chọn ca → chụp ảnh
4. Kết quả: success / pending_review / failed
5. Xem receipt: confidence, liveness, method

### 5.3 Fallback
1. Tắt camera hoặc che khuôn mặt
2. Chọn "Phương thức thay thế" → nhập lý do
3. Status `fallback` → HR duyệt qua `/approval`

## 7. Liveness Mode

### Passive Only (Mặc định)
- Dùng `DetectFaces` Attributes ALL
- Kiểm tra: eyes open, pose, sharpness
- Không cần user interaction

### Passive + Active Challenge (Khi confidence thấp)
1. Server gọi `CreateFaceLivenessSession` → trả `SessionId`
2. Client hiển thị challenge (quay đầu, chớp mắt)
3. Client gửi video frames → server gọi `GetFaceLivenessSessionResults`
4. Kết quả: SUCCESS/FAILED

Để bật active challenge, cần cập nhật `verifyCheck` action để gọi `startLivenessSession` khi confidence < threshold.

## 8. Chi Phí Ước Tính (USD)

| Operation | Chi phí/1000 requests | Ghi chú |
|-----------|----------------------|---------|
| `CompareFaces` / `SearchFacesByImage` | $1.00 | Verify 1:1 |
| `IndexFaces` (enroll) | $1.00 | Chỉ enroll lần đầu |
| `DetectFaces` (quality/liveness) | $1.00 | Mỗi ảnh check |
| `CreateFaceLivenessSession` | $0.10 | Active liveness |
| `GetFaceLivenessSessionResults` | $0.10 | Active liveness |
| Collection storage | Free < 1M faces | |

Ví dụ: 1000 nhân viên, 2 check-in/ngày, 20 ngày/tháng = 40,000 verify/tháng ≈ $40/tháng.

## 9. Data Residency & Compliance

- Region `ap-southeast-1` (Singapore) — data không rời khu vực APAC
- Encryption at rest: AWS managed (KMS)
- Encryption in transit: TLS 1.2+
- GDPR Delete: `DeleteFaces` API xóa face khỏi collection
- DPA: AWS Data Processing Addendum sẵn có

## 10. Rollback Procedure

Nếu provider gặp sự cố:

```bash
# 1. Chuyển về mock ngay lập tức (Vercel Dashboard → Environment Variables)
FACE_PROVIDER=mock
# Hoặc set ALLOW_MOCK_IN_PRODUCTION=true (chỉ DEMO)

# 2. Redeploy (hoặc promote deployment cũ)
vercel rollback

# 3. Thời gian rollback: < 5 phút
```

## 11. Troubleshooting

| Lỗi | Nguyên nhân | Giải pháp |
|-----|-------------|-----------|
| `PROVIDER_NOT_CONFIGURED` | Thiếu env vars | Kiểm tra `FACE_PROVIDER_API_KEY`, `FACE_PROVIDER_SECRET_KEY` trên Vercel |
| `unauthorized` | Sai Access Key/Secret | Tạo lại IAM user, cập nhật credentials |
| `provider_unavailable` | Region sai / service down | Kiểm tra region, AWS Status Page |
| `enrollment_missing` | FaceId không tồn tại trong collection | Re-enroll employee |
| `poor_image_quality` | Ảnh quá tối/mờ/sai pose | Hướng dẫn user chụp lại |
| `rate_limited` | Vượt quota AWS | Request quota increase hoặc implement client-side retry |
| `timeout` | Network chậm / provider quá tải | Tăng `FACE_PROVIDER_TIMEOUT_MS` (mặc định 8000ms) |

## 12. Monitoring & Alerts

Khuyến nghị setup CloudWatch alarms:
- `ThrottlingException` count > 0
- `InternalServerError` rate > 1%
- Latency p95 > 5s
- Collection face count > 800k (cảnh báo trước limit 1M)

## 13. Security Checklist

- [ ] IAM user chỉ có quyền `rekognition:*` trên collection cần thiết
- [ ] Access Key / Secret Key **không** commit vào Git
- [ ] Vercel Environment Variables marcada "Sensitive"
- [ ] Collection ID khác nhau per environment
- [ ] Audit log ghi mọi enroll/verify/delete
- [ ] Rollback procedure đã test

## 14. Liên Hệ & Hỗ Trợ

- AWS Rekognition Docs: https://docs.aws.amazon.com/rekognition/
- AWS Support: Business/Enterprise plan cho SLA
- Project issues: GitHub Issues