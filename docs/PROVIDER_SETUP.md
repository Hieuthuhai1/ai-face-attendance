# Provider Setup — Face Recognition

## Trạng thái hiện tại (Phase 1): MOCK ONLY

- `FACE_PROVIDER=mock` dùng `MockFaceRecognitionProvider` — kết quả xác định
  trước theo fixture, **không nhận diện thật, không liveness thật**.
- Mock chỉ khởi tạo được khi `NODE_ENV` là `development` hoặc `test`.
  Production (`NODE_ENV=production`) + `FACE_PROVIDER=mock`/trống → **fail closed**:
  `getFaceProvider()` throw `PROVIDER_NOT_CONFIGURED`, mọi verify bị từ chối.
- Mọi UI dùng mock phải hiển thị nhãn **“DEMO – không dùng chấm công thật”**
  (`NEXT_PUBLIC_FACE_DEMO_BANNER=true`).

## Chọn provider production (thực hiện ở Phase 10 — tiêu chí)

1. Liveness/anti-spoof có đánh giá độc lập (không chấp nhận blink-check tự chế).
2. Hỗ trợ verify 1:1 qua web + API server-side (không gọi từ browser bằng secret).
3. Vùng xử lý/lưu trữ dữ liệu + DPA rõ ràng; hỗ trợ xóa subject (GDPR-style delete).
4. Chi phí/enroll và /verify, latency p95, uptime SLA.
5. Điều khoản cho phép dùng dữ liệu đúng mục đích chấm công đã thông báo.

**Chưa chọn provider ở phase này. Không hardcode tên provider nào vào code.**

## Cấu hình (khi đã chốt, Phase 10)

```bash
FACE_PROVIDER=<ten-provider>      # server-only, không prefix NEXT_PUBLIC_
FACE_PROVIDER_API_KEY=<secret>    # Vercel env / secret manager, không commit
FACE_PROVIDER_REGION=<region>
VERIFY_THRESHOLD=0.72             # ngưỡng match, cấu hình được
REVIEW_BAND_LOW=0.60              # dưới ngưỡng này = fail; trong band = cần review
```

## Thêm adapter mới (dành cho Phase 10)

1. Implement `FaceRecognitionProvider` trong `src/server/face/<provider>.ts`
   (`enroll`, `verify1to1`, `checkLiveness`, `deleteSubject`).
2. Đăng ký trong factory `getFaceProvider()` theo `FACE_PROVIDER`.
3. Bổ sung contract tests với fixture (không gọi API thật trong CI).
4. Cập nhật file này: tên provider, vùng dữ liệu, retention phía provider.
