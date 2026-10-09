# Test Data & Scenarios (Phase 1 — foundation)

> Fixtures ở phase này chỉ bao phủ tầng foundation (utils, validation, env gate,
> UI states). Scenario nghiệp vụ (enrollment, attendance, RLS A/B) triển khai
> cùng Phase 2–6 và được liệt kê trước ở đây để giữ định hướng.

## 1. Nguyên tắc

- Không dùng khuôn mặt người thật trong fixtures; ảnh fixture là vector/flag
  (`pass` / `low-confidence` / `fail` / `blur`) do `MockFaceRecognitionProvider` đọc.
- Test DB không gọi provider thật, không ghi biometrics thật.
- Mỗi feature: happy path + empty + error/edge + permission tests.

## 2. Fixtures Phase 1 (`tests/fixtures.ts`)

- `demoUsers`: employee A/B (khác department — dùng cho RLS ở Phase 2).
- `shifts`: ca ngày, ca đêm qua ngày, ca không grace (dùng từ Phase 2).
- `faceFixtures`: `good` / `blurry` / `no-match` / `liveness-fail` (dùng từ Phase 5).

## 3. Scenario matrix (toàn MVP — triển khai dần)

| # | Scenario | Expected | Phase |
|---|---|---|---|
| F-01 | Env production thiếu provider | `getFaceProvider()` throw `PROVIDER_NOT_CONFIGURED` | 1 ✅ |
| F-02 | Mock ở production | Không khởi tạo được, fail closed | 1 ✅ |
| F-03 | Logger nhận field `image/template` | Bị redact thành `[REDACTED]` | 1 ✅ |
| F-04 | Validation email/password login | Báo lỗi tiếng Việt, không submit | 1 ✅ |
| S-01 | Employee mới chưa enroll | Check-in bị chặn, hướng dẫn enroll | 5–6 |
| S-02 | Enroll bị thu hồi | Verify fail, yêu cầu re-enroll | 5–6 |
| S-03 | Camera denied / no device | Hướng dẫn cấp quyền + fallback | 5–6 |
| S-04 | Liveness fail / provider timeout | Retry giới hạn → fallback, vào HR queue | 5–6 |
| S-05 | Match low-confidence | Không success, chờ review | 6 |
| S-06 | Trễ / về sớm / ca đêm / không ca | Tính đúng theo `Asia/Ho_Chi_Minh` | 6 |
| S-07 | Double submit check-in | 1 event (idempotency key) | 6 |
| S-08 | Check-out trước check-in | Từ chối + hướng dẫn | 6 |
| S-09 | Employee A đọc dữ liệu B | 403 / empty qua RLS | 2–3 |
| S-10 | Manager xem khác team; export không quyền | Bị chặn + audit | 7 |
| S-11 | Adjustment pending → approved | Days tính lại, audit before/after | 8 |
| S-12 | Employee disabled / role changed | Session/route bị chặn | 3 |

## 4. Seed / reset (áp dụng từ Phase 2)

```bash
npx supabase start
npx supabase db reset   # migrations + seed idempotent
npm run test:rls
```
