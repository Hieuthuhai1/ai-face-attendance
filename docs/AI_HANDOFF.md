# AI Handoff — AI Face Attendance

## Phase 1 — Foundation (completed 2026-10-09)

**Stack chốt:** Next.js 16.4.0 (App Router, `src/`) + React 19 + TypeScript strict +
Tailwind v4 + zod + vitest 5. ESLint 9 (0 errors). `@types/node` nâng lên v22
(khớp Node runtime 22.14.0; vitest 5 yêu cầu, cài mặc định v20 gây ERESOLVE).

**Hoàn thành:**
- Scaffold + scripts: `dev | build | start | lint | typecheck | test | test:watch`.
- Docs: `README.md`, `AGENTS.md`, `docs/{IMPLEMENTATION_PLAN,ARCHITECTURE,TEST_DATA,BIOMETRIC_DATA_POLICY,PROVIDER_SETUP}.md`, `.env.example` (tên + giá trị giả).
- Design system: button, input, card, dialog, badge, table, status-indicator,
  loading/empty/error states, confirm-dialog, demo-banner + brand tokens.
- Server: `FaceRecognitionProvider` interface + `MockFaceRecognitionProvider`
  (dev/test) + `getFaceProvider()` fail-closed ở production + logger tự redact
  + mã lỗi API ổn định + zod validation conventions.
- Error handling: `error.tsx`, `global-error.tsx`, `not-found.tsx`; trang chủ
  showcase responsive, `lang="vi"`, labels/focus đầy đủ.
- Tests: 3 files / 9 tests pass (face gate F-01/F-02, logger redact F-03,
  validation F-04 + utils). `server-only` được stub rỗng trong vitest;
  production build vẫn dùng package thật.

**Migrations:** chưa có (Phase 2). **Env vars mới:** chỉ tên trong `.env.example`.

**Kết quả kiểm tra:**
- `npm run typecheck` ✅ · `npm run lint` ✅ (0 errors, 0 warnings)
- `npm test` ✅ 9/9 · `npm run build` ✅ (2 static routes: `/`, `/_not-found`)
- Secret scan: `grep` không thấy `AKIA|sk-|service_role|BEGIN PRIVATE KEY` trong diff;
  không file `.env*` nào được commit (`.env.example` đã un-ignore hợp lệ).

**Commit:** `chore(setup): initialize attendance app foundation` — SHA: `28735b3` (pushed `main`).
**Deployment:** chưa link Vercel → không Preview ở phase này.
**Known issues:**
- create-next-app 16 sinh `layout.tsx` dùng `LayoutProps` không tồn tại → đã sửa
  thành `{ children: React.ReactNode }`.
- `Button` không forward `ref` (React 19 types) → Dialog dùng `autoFocus`.

## Phase 2 — Database/RLS/seed (completed 2026-10-09)

**Migrations** (`supabase/migrations/`, đã apply 2 lần sạch qua `start` + `db reset`):
`20261009120000_core` (orgs, profiles+role guard trigger, departments, employees,
`handle_new_user`, helpers `my_role/my_org/my_employee_id`) →
`...121000_shifts` (work_shifts, assignments + exclusion chống overlap ca) →
`...122000_face` (enrollments: chỉ subject ref + quality + consent, partial unique active) →
`...123000_attendance` (events: server timestamp + idempotency unique + trigger harden,
summaries PK(employee,work_date,shift)) →
`...124000_requests_audit` (adjustments, leave, audit append-only, app_settings) →
`...125000_rls` (grants + policies 4 roles; manager KHÔNG đọc face refs;
browser cấm insert success; summaries/audit client chỉ đọc).

**Seed** (`supabase/seed.sql`, idempotent): 2 orgs, 6 auth users (A/B khác dept,
manager X, HR, sysadmin, outsider org2), 3 ca (ngày/đêm overnight/chiều),
enrollments (active/pending/revoked), 5 events (success/failed/pending_review),
summary, adjustments (pending/approved/rejected), leave, audit, settings.

**Kết quả kiểm tra (chạy thật trên local, KHÔNG cloud):**
- `supabase db reset` ✅ 2 lần · `test_rls.sql` ✅ 7/7 sections
  (anon 0 rows · A/B isolation · insert downgrade+ép giờ · chặn success giả ·
  duplicate 23505 · chặn tự nâng role · cross-org · manager scope/duyệt ·
  HR active · sysadmin đa org), tự ROLLBACK.
- `typecheck` ✅ · `lint` ✅ · `test` 9/9 ✅ · `build` ✅.
- Secret scan: grep sạch; seed chứa bcrypt + password local-only đã document
  trong TEST_DATA (không dùng cho cloud).

**Commit:** `feat(database): add attendance schema rls and seed` — SHA: `24d3ca1` (pushed `main`).
**Deployment:** Vercel chưa link → không Preview.
**Known issues/blockers:** Docker Desktop phải khởi động tay trước `supabase start`;
máy có project local khác (`english-kid`, ports 544xx) — tuyệt đối không reset/db push
vào đó; mọi lệnh Phase 2 chỉ chạy trong `D:\web-app\timekeeping` (ports 543xx).
**Local DB:** `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (user/pass local mặc định).

## Phase 3 — Auth/RBAC + Nhân sự + Ca làm (completed 2026-10-09)

**Auth:** `@supabase/ssr` clients (browser/server) + `src/proxy.ts` (Next 16 KHÔNG dùng
`middleware.ts` — phát hiện qua smoke test) + `requireUser/requireRole` server-side +
`/login`, `/dashboard`, logout action. Role từ `profiles` (DB), client không tự nâng.
**HR:** server actions CRUD employees (mã duy nhất/org, verify tham chiếu đúng org,
vô hiệu hóa giữ lịch sử, chặn tự vô hiệu chính mình) + shifts/assignments
(overlap → 23P01 map tiếng Việt) + UI search/pagination/dialogs/confirm.
`src/lib/attendance/rules.ts`: grace/rounding/overnight pure service.

**Kết quả chạy thật (local):** `typecheck` ✅ · `lint` ✅ · unit 19/19 ✅ ·
integration 5/5 qua API thật (login/session/logout, A/B, HR scope+duplicate 23505,
deactivate, overlap 23P01, time 23514, ca đêm, escalation) · RLS SQL 7/7 lại sau
đổi seed · `build` ✅ (Partial Prerender + Proxy) · smoke: `/login` 200 có form,
`/dashboard` anon → 307 `/login` · secret scan sạch.
**Seed fix trong phase:** `instance_id` zero-UUID + token columns `''` + `phone` NULL
(GoTrue scan) — `db reset` sạch. Chưa link cloud/Vercel → không Preview.
**Commit:** `feat(hr): add employee and shift management` — SHA: `e91638e` (pushed `main`).
**Known issues:** E2E browser (Playwright) để Phase 9; mời tài khoản mới cho HR chưa có
(dùng tài khoản seed); `AGENTS.md` có block auto-added của `next dev` (giữ theo yêu cầu tool).

## Phase 4 — Face enrollment + provider adapter (completed 2026-10-09)

**Adapter:** `IFaceProvider` mở rộng (`enroll`, `checkLiveness` riêng, `verify1to1`,
`deleteSubject`) + `withProviderTimeout` (8s) + `getProviderHealth()` (không secret) +
rate limit (enroll 5/10ph, verify 10/1ph, single-instance; đa instance cần Redis).
Mock chỉ dev/test, production fail closed; mock **hủy bytes frame**, verdict theo
fixture DEMO, UI gắn nhãn.
**Flow:** consent v1 (5 mục + checkbox bắt buộc) → camera (permission/denied/unavailable,
preview, chụp, quality gate sáng/mờ/size trung thực) → submit (eligibility, rate,
consent, ≤500KB, liveness→enroll→pending) → HR queue (kích hoạt/từ chối lý do,
trigger stamp verified_by) → revoke/re-enroll + audit. Không template/ảnh về client/log.
**Migrations:** `...130000_enrollment_ops` (audit insert HR + stamp verifier),
`...131000_audit_self_insert` (employee tự ghi audit).

**Kết quả chạy thật (local):** `typecheck` ✅ · `lint` ✅ · unit 27/27
(quality E-01, rate E-05, timeout E-04, mock liveness, health) · RLS SQL 8/8
(+lifecycle/audit E-07/E-08/E-09; sửa test manager-update-0-dòng) · `build` ✅
(`/enrollment`, `/admin/enrollments` PPR) · smoke: anon → 307 `/login` ·
secret scan sạch (kể cả base64 dài).
**Commit:** `feat(biometrics): add face enrollment provider adapter` — SHA: `99f977a`.
**Chưa có:** face provider/liveness thật (NOT CONFIGURED, Phase 10); E2E browser (Phase 9);
action-level test submit (cần session, E2E Phase 9 — đã ghi E-02).
**Next:** Phase 5 check-in/out 1:1 (đã có enrollment tiền đề).

## Next task — Phase 5 (Attendance check-in/out)
