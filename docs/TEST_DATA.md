# Test Data & Scenarios

> Fixtures unit (Phase 1) ở `tests/fixtures.ts` — không biometrics thật.
> Seed DB + RLS tests (Phase 2) ở `supabase/seed.sql` và `supabase/tests/test_rls.sql`.

## 1. Nguyên tắc

- Không dùng khuôn mặt người thật; ảnh fixture chỉ là flag (`good`/`blurry`/`no-match`/`liveness-fail`).
- Test DB không gọi provider thật, không ghi biometrics thật.
- Mỗi feature: happy path + empty + error/edge + permission tests.

## 2. Chạy local (đã verify Docker + Supabase CLI trên máy)

```bash
supabase start          # local only — KHÔNG supabase link/db push khi chưa được duyệt
supabase db reset       # chạy migrations + supabase/seed.sql (idempotent)
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/test_rls.sql
```

Integration tests qua API thật (cần DB local + keys từ `.env.local`, không in keys ra màn hình):

```powershell
$lines = Get-Content .env.local
foreach ($l in $lines) {
  if ($l -match 'SUPABASE_URL=(.*)') { $env:SUPABASE_TEST_URL = $Matches[1] }
  if ($l -match 'SUPABASE_ANON_KEY=(.*)') { $env:SUPABASE_TEST_ANON_KEY = $Matches[1] }
}
$env:RUN_DB_TESTS='1'; npx vitest run tests/integration
```

`test_rls.sql` tự `ROLLBACK` nên không làm bẩn seed. Assert fail → `RAISE EXCEPTION`, psql exit != 0.

## 3. Tài khoản seed (password: `Passw0rd!` — local only)

| Email | Role | Org | Employee | Ghi chú |
|---|---|---|---|---|
| `nv.a@demo.vn` | employee | Demo | NV001 (Kinh doanh) | enrollment active, ca hành chính |
| `nv.b@demo.vn` | employee | Demo | NV002 (Kỹ thuật) | enrollment pending, ca đêm |
| `quan.ly@demo.vn` | manager | Demo | QL001 | quản lý NV001 + NV002 |
| `hr@demo.vn` | hr_admin | Demo | HR001 | duyệt enrollment/adjustment |
| `admin@demo.vn` | system_admin | Demo | AD001 | đọc đa org |
| `ngoai@khac.vn` | employee | Org Khác | NV999 | kiểm tra cross-org isolation |

Ca: `Ca hanh chinh` 08:00–17:00 · `Ca dem` 22:00–06:00 (overnight) · `Ca chieu` 13:00–21:00.
Events seed: A in/out success 09/10, B in success ca đêm 08/10, 1 failed (liveness fail),
1 pending_review (confidence 0.65). Adjustments: pending/approved/rejected. Leave: pending.

## 4. Scenario matrix (kết quả Phase 3 — chạy thật trên local)

| # | Scenario | Expected | Kết quả |
|---|---|---|---|
| Login/session/logout | signIn đúng/sai, getUser, signOut | pass | ✅ integration 5/5 |
| Protected route | `/dashboard` chưa login → 307 `/login` | pass | ✅ smoke (curl) |
| Proxy convention | Next 16 dùng `src/proxy.ts` (không phải `middleware.ts`) | pass | ✅ (fix trong phase) |
| Role escalation API | employee tự set `hr_admin` bị chặn | pass | ✅ integration |
| Employee A/B | A chỉ thấy NV001 + events mình | pass | ✅ integration |
| HR org scope | thấy ≥5 NV, trùng mã → 23505 | pass | ✅ integration |
| Deactivate | terminated, giữ lịch sử | pass | ✅ integration |
| Overlap assignment | exclusion → 23P01 | pass | ✅ integration |
| Invalid shift time | start==end → 23514 | pass | ✅ integration |
| Ca đêm | `Ca dem` overnight 22:00–06:00 | pass | ✅ integration + unit S-06 |
| Rules service | grace/rounding/overnight | pass | ✅ unit 6/6 |

| # | Scenario | Expected | Phase |
|---|---|---|---|
| F-01 | Env production thiếu provider | throw `PROVIDER_NOT_CONFIGURED` | 1 ✅ |
| F-02 | Mock ở production | Không khởi tạo, fail closed | 1 ✅ |
| F-03 | Logger nhận `image/template` | Redact `[REDACTED]` | 1 ✅ |
| F-04 | Validation login | Lỗi tiếng Việt, không submit | 1 ✅ |
| S-09a | anon đọc employees/events | 0 dòng | 2 (test_rls §1) |
| S-09b | A đọc event/enrollment của B | 0 dòng; B đọc A: 0 dòng | 2 (test_rls §2–3) |
| S-09c | Browser insert success + giờ quá khứ | `occurred_at`→giờ server, status→`pending_review` | 2 (test_rls §2) |
| S-09d | Browser insert success có verification_ref giả | Bị từ chối (42501) | 2 (test_rls §2) |
| S-07 | Trùng idempotency key | unique violation (23505) | 2 (test_rls §2) |
| S-09e | Employee tự nâng role | Bị chặn (42501) | 2 (test_rls §2) |
| S-09f | Cross-org (A→org2, HR→org2, outsider→org1) | 0 dòng | 2 (test_rls §2,5,7) |
| S-10a | Manager đọc team + event team | ≥2 NV, ≥3 events | 2 (test_rls §4) |
| S-10b | Manager đọc face_enrollments | 0 dòng (cấm provider refs) | 2 (test_rls §4) |
| S-10c | Manager duyệt adjustment team | 1 dòng, tự đóng dấu reviewer | 2 (test_rls §4) |
| S-11 | HR active enrollment B + đọc toàn org | ≥2 active, ≥4 events | 2 (test_rls §5) |
| S-06 | Ca đêm 22:00–06:00 | event 08/10 22:05 thuộc ca đêm | 2 (seed) + 6 |
| E-01 | Quality gate (tối/mờ/nhỏ) | từ chối + hướng dẫn cụ thể | 4 ✅ unit |
| E-02 | Submit thiếu consent | `CONSENT_REQUIRED` | 4 (action, chưa test tự động — E2E Phase 9) |
| E-03 | Liveness fail (fixture) | `LIVENESS_FAILED`, không tạo row | 4 (mock unit + flow) |
| E-04 | Provider timeout | `PROVIDER_UNAVAILABLE` sau 8s | 4 ✅ unit |
| E-05 | Rate limit enroll | chặn sau 5 lần/10 phút | 4 ✅ unit |
| E-06 | Duplicate active | `ALREADY_ACTIVE`, phải revoke trước | 4 (action + SQL partial unique) |
| E-07 | HR approve/deny/revoke + audit | verified_by stamp, audit rows | 4 ✅ SQL §8 |
| E-08 | Manager sửa enrollment team | 0 dòng đổi | 4 ✅ SQL §8 |
| E-09 | Employee ghi audit hộ | 42501 | 4 ✅ SQL §8 |
| C-01 | check-in/out hợp lệ (rpc) | server timestamp + summary | 5 ✅ integration |
| C-02 | Retry cùng key | 23505 → trả bản ghi cũ, không trùng | 5 ✅ integration + SQL §9 |
| C-03 | Ghi hộ NV khác / assignment lạ | 42501 (ownership trong RPC) | 5 ✅ integration + SQL §9 |
| C-04 | Rollback | lỗi validation → không side-effect | 5 ✅ integration |
| C-05 | Thresholds | success/review/failed, review ≠ gian lận | 5 ✅ unit |
| C-06 | Ca qua đêm resolve | spill → work_date hôm trước | 5 ✅ unit |
| C-07 | Out trước in / đã check-in | `OUT_WITHOUT_IN` / `ALREADY_CHECKED_IN` | 5 (action, E2E Phase 9) |
| C-08 | Fallback PIN + lý do | status fallback, chờ HR | 5 (action, E2E Phase 9) |
| C-09 | Liveness fail / no-match / timeout | failed + event audit / unavailable, key giữ để retry | 5 (mock unit + flow) |
| R-01 | CSV injection (= + - @ tab) | tiền tố ' + quote RFC4180 | 6 ✅ unit |
| R-02 | Khoảng ngày (biên tháng nhuận, thứ tự, ≤62 ngày) | validate đúng | 6 ✅ unit |
| R-03 | Employee A/B summaries | chỉ thấy mình | 6 ✅ SQL §10 + integration |
| R-04 | Manager scope | team + mình, export audit ok, org khác chặn | 6 ✅ SQL §10 + integration |
| R-05 | Routes anon | `/history`, `/reports` → 307 `/login` | 6 ✅ smoke |
| R-06 | Export action + dashboard counts (authenticated render) | cần session browser | 6 (E2E Phase 9) |
| S-01/02/03/04/05/08 | Enroll revoked, camera, liveness, low-conf, checkout | Theo đặc tả §11 | 5–6 |

## 5. Seed / reset

`supabase db reset` chạy lại toàn bộ migrations + seed (upsert theo id cố định nên idempotent).
Tuyệt đối không chạy `db reset`/`db push` lên project đã link cloud khi chưa được duyệt.
