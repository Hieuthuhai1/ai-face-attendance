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

> E2E (`npm run test:e2e`) chạy trên **production build** (`next start`), không chạy
> trên `next dev`: Turbopack dev + PPR trong môi trường này không hydrate đầy đủ
> (đã verify bằng marker effect — dev null, prod `"1"`), gây fail giả ở test cần JS.
> ```bash
> npm run build
> npx next start -p 3100   # terminal riêng
> npm run test:e2e
> ```

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
| W-01 | Tạo request (thiếu giờ/cross-user/trùng pending) | validation + 42501 + 23505 | 7 ✅ unit + SQL §11 + integration |
| W-02 | Duyệt qua RPC (manager team) | approved + reviewer + audit + correction | 7 ✅ SQL §11 + integration |
| W-03 | Duyệt trùng (idempotent) | `ALREADY_DECIDED` | 7 ✅ SQL §11 + integration |
| W-04 | Employee/HR ngoài phạm vi duyệt | 42501 | 7 ✅ SQL §11 + integration |
| W-05 | Leave tạo + duyệt team | approved qua RLS + stamp | 7 ✅ SQL §11 + integration |
| W-06 | Routes `/adjustments` `/leave` `/audit` anon | 307 `/login` | 7 (smoke, như R-05) |
| G-01 | Provider allowlist + chống open-redirect | chỉ `google`, next lạ → `/dashboard` | ✅ unit |
| G-02 | Trigger map tên OAuth (`full_name`/`name`) | profile display_name đúng | SQL `test_oauth_profile.sql` |
| G-03 | Provider chưa bật → bấm nút Google | báo "chưa được cấu hình", không crash | code path (verify khi có credentials) |
| G-04 | Login Google thật local/staging | về `/dashboard`, profile auto-tạo | browser thủ công (cần bạn bật provider theo `GOOGLE_OAUTH_SETUP.md`) |
| G-05 | User Google mới chưa có employee record | "Không đủ điều kiện", HR link sau | flow đã có (verify ở G-04) |
| S-01 | Gmail mới nộp enrollment (chưa có employee) | tự tạo employee `G-*` + org mặc định, enrollment pending chờ HR | SQL `test_self_enrollment.sql` |
| S-02 | Gọi lại ensure (idempotent) | trả đúng id cũ, không trùng | SQL |
| S-03 | Employee tự đổi organization | 42501 (mở rộng role guard) | SQL |
| S-04 | Anon gọi ensure_self_employee | 42501 | SQL |
| S-05 | Gmail mới check-in khi chưa phân ca | `NO_SHIFT` + hướng dẫn gặp HR (HR vẫn giữ cửa gán ca) | flow (E2E khi có browser) |
| S-01/02/03/04/05/08 | Enroll revoked, camera, liveness, low-conf, checkout | Theo đặc tả §11 | 5–6 |

## 6. E2E browser (Playwright — chạy trên production build)

```bash
npm run build
npx next start -p 3100   # terminal riêng
npm run test:e2e
```

- `e2e/shell.spec.ts`: anon guard, HR login + sidebar + logout, check-in stepper/camera states, mobile bottom-bar.
- `e2e/responsive-a11y.spec.ts`: 5 viewports không overflow, nav mobile/desktop, keyboard Tab, contrast AA, reduced-motion, employee bị chặn trang HR.
- Camera dùng fake device (`--use-fake-device-for-media-stream`); không bấm chụp thật để tránh ghi event vào DB dev.

## 7. Face Attendance UX Test Scenarios (Phase 9)

### 7.1 Camera States & Face Detection
| # | Scenario | Expected | Test Type |
|---|---|---|---|
| FA-01 | Camera denied | Show guidance + fallback option | E2E |
| FA-02 | No camera hardware | Show fallback option | E2E |
| FA-03 | Camera permission granted | Camera preview shows | E2E |
| FA-04 | Face detected & centered | Green indicators, ready to capture | Unit + E2E |
| FA-05 | Face off-center (left/right/up/down) | Yellow warning + guidance | Unit + E2E |
| FA-06 | Face too close/far | Size warning + guidance | Unit + E2E |
| FA-07 | Multiple faces detected | Warning badge with count | Unit + E2E |
| FA-08 | No face detected | "Chưa phát hiện khuôn mặt" | Unit + E2E |
| FA-09 | Poor lighting (dark) | "Thiếu sáng" warning | Unit + E2E |
| FA-10 | Poor lighting (bright) | "Quá sáng" warning | Unit + E2E |
| FA-11 | Blurry image | "Mờ" warning | Unit + E2E |
| FA-12 | Multiple faces warning | Badge with count | Unit + E2E |

### 7.2 Verification Flow
| # | Scenario | Expected | Test Type |
|---|---|---|---|
| VF-01 | Liveness check pass | Progress to matching | E2E |
| VF-02 | Liveness check fail | Show error + retry | E2E |
| VF-03 | Face match success | Show success receipt | E2E |
| VF-04 | Face match low confidence | Pending review status | E2E |
| VF-05 | Face no match | Show error + retry + fallback | E2E |
| VF-05 | Provider timeout | Error + retry + fallback | E2E |
| VF-06 | Network error | Offline handling | E2E |
| VF-07 | Duplicate submission | Idempotent - return existing | Unit + Integration |

### 7.3 Success State
| # | Scenario | Expected | Test Type |
|---|---|---|---|
| SS-01 | Check-in success | Receipt with time, shift, status | E2E |
| SS-02 | Check-out success | Receipt with early/late info | E2E |
| SS-03 | Pending review | Warning badge + HR queue link | E2E |
| SS-06 | Fallback success | Fallback badge + HR queue link | E2E |

### 7.4 Failure State
| # | Scenario | Expected | Test Type |
|---|---|---|---|
| FS-01 | Liveness failed | Error + retry + guidance | E2E |
| FS-02 | No match | Error + retry + fallback option | E2E |
| FS-03 | Provider unavailable | Error + retry + fallback | E2E |
| FS-04 | Network error | Offline banner + retry | E2E |
| FS-05 | Already checked in | Error + guidance | E2E |
| FS-06 | No active shift | Error + HR contact | E2E |
| FS-07 | No enrollment | Error + enrollment link | E2E |

### 7.4 Mobile Specific
| # | Scenario | Expected | Test Type |
|---|---|---|---|
| MB-01 | Portrait camera preview | Full screen, correct aspect | E2E |
| MB-02 | Large touch targets | Buttons ≥44px | E2E |
| MB-03 | Handle orientation change | Preview adapts | E2E |
| MB-04 | Insecure origin (HTTP) | HTTPS warning | E2E |
| MB-05 | No camera hardware | Fallback option | E2E |

### 7.5 Privacy & Compliance
| # | Scenario | Expected | Test Type |
|---|---|---|---|
| PR-01 | Privacy notice shown | Banner displayed on first visit | E2E |
| PR-02 | Consent stored | localStorage flag set | Unit |
| PR-03 | No raw images in logs | Logger redacts image data | Unit |
| PR-04 | Camera stream cleanup | Stream stopped on unmount | Unit |

## 8. Enrollment Security Test Scenarios (Phase 14)

### 8.1 Enrollment Statuses
| # | Scenario | Expected | Test Type |
|---|---|---|---|
| ES-01 | Employee enrollment active | `status = 'active'`, `provider_subject_id` set, `enrolled_at` set | SQL + Unit |
| ES-02 | Employee enrollment pending | `status = 'pending'`, no `provider_subject_id` | SQL + Unit |
| ES-03 | Employee enrollment failed | `status = 'failed'`, `failed_reason` set, `failed_at` set | SQL + Unit |
| ES-04 | Employee enrollment needs_review | `status = 'needs_review'`, `failed_reason` set | SQL + Unit |
| ES-05 | Employee enrollment revoked | `status = 'revoked'`, `disabled_at` set | SQL + Unit |
| ES-06 | Employee enrollment rejected | `status = 'rejected'`, `failed_reason` set, `failed_at` set | SQL + Unit |
| ES-07 | No enrollment | Không có row trong `face_enrollments` | SQL + Unit |

### 8.2 Enrollment Lifecycle & Functions
| # | Scenario | Expected | Test Type |
|---|---|---|---|
| EL-01 | HR approve enrollment via `hr_approve_enrollment` | `status = 'active'`, `verified_by` = HR user, `enrolled_at` = now(), audit log | SQL |
| EL-02 | HR reject enrollment via `hr_reject_enrollment` | `status = 'rejected'`, `failed_reason` = reason, `failed_at` = now(), audit log | SQL |
| EL-03 | Employee revoke own via `revoke_my_enrollment` | `status = 'revoked'`, `disabled_at` = now(), audit log `by = 'owner'` | SQL |
| EL-04 | Provider callback mark failed via `mark_enrollment_failed` | `status = 'failed'`, `failed_reason`, `failed_at`, audit log | SQL (service_role) |
| EL-05 | Provider callback mark needs_review via `mark_enrollment_needs_review` | `status = 'needs_review'`, `failed_reason`, audit log | SQL (service_role) |
| EL-06 | Duplicate active enrollment blocked | Unique violation 23505 trên `face_enrollments_one_active_or_review` | SQL |
| EL-07 | Active + needs_review blocked | Unique violation 23505 | SQL |
| EL-08 | Employee cannot self-set active/needs_review/failed | Update bị chặn (42501) qua RLS `face_update_own` | SQL |

### 8.3 Enrollment RLS & Permissions
| # | Scenario | Expected | Test Type |
|---|---|---|---|
| ER-01 | Employee chỉ đọc enrollment của mình | `face_select` policy | SQL (test_rls §2, 8b) |
| ER-02 | Manager không đọc provider_subject_id của team | `face_select` lọc `employee_id = my_employee_id()` | SQL (test_rls §4) |
| ER-03 | HR duyệt enrollment trong org mình | `face_write_hr` + function `hr_approve_enrollment` | SQL (test_rls §5, 8b) |
| ER-04 | HR không duyệt enrollment org khác | Function raise `FORBIDDEN` | SQL |
| ER-05 | Employee insert chỉ được status pending | `face_insert` WITH CHECK | SQL (test_rls §8) |
| ER-06 | Employee update chỉ được revoke pending/active | `face_update_own` WITH CHECK | SQL (test_rls §8, 8b) |
| ER-07 | Attendance history không bị ảnh hưởng | Attendance events/summaries intact sau enrollment changes | SQL |

## 9. Seed / reset

`supabase db reset` chạy lại toàn bộ migrations + seed (upsert theo id cố định nên idempotent).
Tuyệt đối không chạy `db reset`/`db push` lên project đã link cloud khi chưa được duyệt.
