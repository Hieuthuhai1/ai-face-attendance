# AI Face Attendance — IMPLEMENTATION PLAN (Plan Mode, không code)

> Ngày lập: 2026-10-09. Repo `D:\web-app\timekeeping` tại thời điểm audit là **thư mục trống**:
> không git, không `package.json`/lock, không `README.md`/`AGENTS.md`/`docs/`, không Supabase/Vercel config.
> Vì vậy đây là plan **greenfield** — mọi mục "hiện trạng" dưới đây đều ghi rõ là *chưa có*.
> Tuyệt đối không commit secrets. Mặc định **không lưu ảnh thô**.

---

## 1. Current repository status & gap analysis

| Hạng mục kiểm tra | Kết quả (đã verify bằng shell) | Gap |
|---|---|---|
| `README.md`, `AGENTS.md`, `docs/AI_HANDOFF.md` | Không tồn tại | Phải tạo mới từ plan này |
| `git status/log/branch` | `fatal: not a git repository` | Cần `git init`, branch `main`, remote GitHub (Decision D1) |
| `package.json`, lock file | Không tồn tại | Cần scaffold app mới (Decision D2: Next.js vs Vite) |
| Source (`src/`, `app/`) | Thư mục trống | Chưa có gì |
| Supabase config/migrations/seed | Chưa có | Thiết kế mới (mục 7) |
| Test scripts, Vercel config | Chưa có | Thiết kế mới (mục 13, 15) |
| Tài liệu đặc tả chấm công trong repo | Không có | Mọi nghiệp vụ ca/kíp dưới đây là **assumption** (mục 2) |
| Thư mục anh em `D:\web-app\app1`, `appTA` | Tồn tại nhưng **ngoài scope** — không đọc/không copy, tránh tạo cấu trúc song song | Ghi nhận để không nhầm lẫn |

**Kết luận:** không có gì để tái sử dụng hay migrate. Plan đi theo hướng scaffold mới, phase 0–1 tạo nền.

---

## 2. Assumptions / Decisions Needed (chưa phải yêu cầu chính thức)

| ID | Nội dung | Giả định tạm thời trong plan | Cần bạn xác nhận |
|---|---|---|---|
| D1 | Remote Git + hosting | GitHub + Vercel (theo đề xuất) | Tên org/repo, ai tạo |
| D2 | Frontend stack | **Next.js App Router + TypeScript + Tailwind** (lý do: cần server-side route để giấu provider credentials; Vite SPA không giấu được key) — alternative: Vite + Supabase Edge Functions | Chốt Next.js hay Vite |
| D3 | Supabase project | Tạo mới 2 project (staging + production) hoặc 1 project + branch | Bạn đã có Supabase org chưa |
| D4 | Face provider production | **Chưa chọn.** Dùng `IFaceProvider` adapter + `MockFaceAdapter` local cho tới Phase 10 | Ngân sách, yêu cầu data residency VN, đã có contract với provider nào chưa |
| D5 | Timezone chuẩn | `Asia/Ho_Chi_Minh`, lưu `timestamptz` = server `now()` | Công ty có chi nhánh khác múi giờ không |
| D6 | Luật ca/grace | Grace 5', làm tròn 1', ca đêm qua ngày, 1 cặp in/out mỗi ngày-ca | Lấy theo nội quy công ty bạn |
| D7 | Phương thức fallback | PIN cá nhân + duyệt thủ công của quản lý (không dùng vân tay/thẻ) | Chấp nhận fallback PIN không |
| D8 | Lưu trữ sinh trắc | Chỉ lưu **template/vector reference + provider subject ID**, không lưu ảnh thô; ảnh enrollment tạm thời xóa sau khi tạo template (TTL ≤ 24h) | Pháp chế/HR đồng ý consent flow ở mục 10 |
| D9 | Vai trò | 4 roles: employee / manager / hr / admin (kiêm system admin) | Có cần thêm kế toán/payroll read-only không |
| D10 | Ngôn ngữ UI | Tiếng Việt mặc định, i18n sau | Xác nhận |

---

## 3. Personas, roles, permissions

- **Employee**: đăng nhập, enroll khuôn mặt, xem lịch sử của mình, check-in/out bằng face (+ fallback PIN), gửi yêu cầu chỉnh công.
- **Manager**: + xem/điểm danh team, duyệt/từ chối adjustment của team, xuất CSV team.
- **HR**: + CRUD employees/departments/shifts, phê duyệt enrollment, duyệt adjustment toàn công ty, xuất báo cáo, xem audit.
- **Admin (system)**: + quản lý roles, cấu hình provider/env, retention/xóa dữ liệu, **không** xem template sinh trắc thô (chỉ metadata).
- Nguyên tắc: least privilege; mọi quyền cưỡng bức qua RLS + server-side check, không tin client role.

---

## 4. User flows

1. **Login**: nhập email/password (Supabase Auth) → phân role → redirect dashboard theo role → error/retry khi sai pass, khóa tạm sau N lần (rate limit).
2. **Enrollment**: employee đăng nhập → đọc consent notice → chụp N ảnh (quality check: đủ sáng, chính diện, không mờ) → gửi server → server gọi provider tạo template → trạng thái `pending` → HR approve → `active`. Reject → kèm lý do, cho enroll lại.
3. **HR approval**: queue enrollments pending → xem metadata (không xem ảnh thô nếu đã xóa) + quality score → approve/reject.
4. **Check-in/out**: chọn ca → chụp + liveness (passive trước, active khi confidence thấp) → server verify 1:1 với template của chính user → ghi event với server timestamp → hiện kết quả (giờ, ca, muộn/sớm bao nhiêu).
5. **Fallback**: khi camera/provider lỗi → PIN + lý do → event gắn cờ `method=pin_fallback`, yêu cầu manager xác nhận sau.
6. **Report**: chọn khoảng ngày/phòng ban → bảng + tổng hợp → export CSV (giới hạn theo role).
7. **Adjustment**: employee tạo request (sai giờ/quên checkout) + minh chứng → manager/HR duyệt → attendance_day tính lại + audit log cả before/after.

---

## 5. Routes & UX states

| Route | Vai trò | States |
|---|---|---|
| `/login` | public | loading, error (sai TK/MK), retry, disabled khi đang submit |
| `/dashboard` | all | loading skeleton, empty (chưa có ca hôm nay), error + retry |
| `/check-in` | employee | idle → capturing → verifying → success (giờ + trạng thái) / failed (lý do + nút thử lại / chuyển fallback); camera-denied → hướng dẫn cấp quyền |
| `/history` | employee | loading, empty, error, phân trang |
| `/enrollment` | employee | chưa enroll / pending / active / rejected + consent checkbox (disabled nút chụp nếu chưa tick) |
| `/team` | manager | empty team, error |
| `/admin/employees`, `/admin/departments`, `/admin/shifts` | hr/admin | CRUD states + optimistic UI + rollback khi lỗi |
| `/admin/enrollments` | hr | approve queue |
| `/admin/adjustments` | manager/hr | approve flow |
| `/reports` | manager/hr | filter + export loading/disabled khi dữ liệu lớn |
| `/audit` | hr/admin | read-only log |

Toàn app: toast lỗi mạng, offline banner (không cho check-in offline — phải online để lấy server timestamp), 404, 403.

---

## 6. Feature architecture / module boundaries

```
/app              routes (Next.js) — mỏng, gọi server actions/API
/components       UI thuần (camera-capture, liveness-prompt, tables)
/lib/attendance   luật tính công (timezone, grace, overnight, idempotency) — pure, test được
/lib/shifts       resolve ca tại thời điểm check
/server/face      IFaceProvider + adapters (mock | production) — CHỈ chạy server-side
/server/api       check-in/out, enrollment, adjustments, reports — verify Auth + RBAC + RLS
/supabase         migrations, seed, RLS policies, tests SQL
```

Ranh giới cứng: **browser không bao giờ** gọi trực tiếp face provider production, không cầm service-role key, không tự tính giờ công (server là source of truth).

```ts
// Hình dung interface (chưa code):
interface IFaceProvider {
  enroll(input: { userId: string; images: Blob[] }): Promise<{ subjectId: string; quality: number }>;
  verify(input: { subjectId: string; image: Blob }): Promise<{ match: boolean; confidence: number; liveness: 'pass'|'fail'|'unknown' }>;
  deleteSubject(subjectId: string): Promise<void>;
}
```

---

## 7. Database schema, constraints, indexes, migrations & seed

Bảng (PostgreSQL, Supabase):

- `profiles (id uuid PK = auth.users.id, email, full_name, role enum[employee,manager,hr,admin], department_id FK, is_active, created_at)`
- `departments (id, name unique, manager_id FK profiles, created_at)`
- `shifts (id, name, start_time, end_time, overnight bool, grace_in_min int, grace_out_min int, rounding_min int, tz text default 'Asia/Ho_Chi_Minh')`
- `shift_assignments (id, employee_id FK, shift_id FK, effective_from date, effective_to date nullable)` + constraint chống overlap cùng employee.
- `face_enrollments (id, employee_id FK unique partial where status='active', provider text, provider_subject_id text, quality numeric, status enum[pending,active,rejected,revoked], consent_at timestamptz, reviewed_by, created_at)` — **không cột ảnh**.
- `attendance_events (id uuid default gen_random_uuid(), employee_id FK, shift_id FK nullable, direction enum[in,out], occurred_at timestamptz default now(), method enum[face,pin_fallback,manual], confidence numeric nullable, liveness text nullable, idempotency_key text unique, device_hash text, note, created_by)` — `occurred_at` **luôn do server set**, client gửi `direction` + ảnh/PIN, không gửi giờ.
- `attendance_days (employee_id, work_date date, shift_id, first_in, last_out, late_min, early_leave_min, overtime_min, status enum[present,late,absent,incomplete], computed_at, PRIMARY KEY (employee_id, work_date, shift_id))` — bảng tính sẵn, recompute khi event/adjustment đổi.
- `adjustment_requests (id, employee_id, work_date, shift_id, requested_in, requested_out, reason, status enum[pending,approved,rejected], decided_by, decided_at)`
- `audit_logs (id, actor_id, action, entity, entity_id, before jsonb, after jsonb, at timestamptz default now())` — append-only (không UPDATE/DELETE qua RLS).

Indexes: `(employee_id, occurred_at)`, `(work_date, department)`, idempotency unique, partial index enrollments active.
Migrations: `0001_enums_core.sql` → `0002_org_shifts.sql` → `0003_face_enrollment.sql` → `0004_attendance.sql` → `0005_adjust_audit.sql` → `0006_rls.sql` → `0007_seed_dev.sql` (seed chỉ dev: 2 dept, 3 shift incl. overnight, users A/B test isolation, events mẫu).

---

## 8. RLS matrix

| Table | employee | manager | hr | admin |
|---|---|---|---|---|
| `profiles` | đọc+sửa chính mình (trừ role) | đọc team | đọc/sửa all (trừ role admin) | full (gán role qua server function) |
| `departments`/`shifts` | đọc | đọc | CRUD | CRUD |
| `shift_assignments` | đọc của mình | đọc team | CRUD | CRUD |
| `face_enrollments` | tạo/đọc của mình, không đọc người khác | đọc metadata team (không subject_id) | đọc + approve | đọc + revoke/xóa |
| `attendance_events` | tạo check của mình, đọc của mình | đọc team | đọc all | đọc all |
| `attendance_days` | đọc của mình | đọc team | đọc all | đọc all |
| `adjustment_requests` | tạo/đọc của mình | duyệt team | duyệt all | duyệt all |
| `audit_logs` | không | không | đọc | đọc |

Isolation test bắt buộc: user A (dept X) không đọc được event/day/enrollment của user B (dept Y); manager dept X không đọc dept Y. Mọi query production đều qua RLS; service-role chỉ dùng trong server route đã xác thực + kiểm tra role.

---

## 9. Face verification pipeline (1:1, enrollment, liveness, adapter)

- **1:1 (không phải 1:N):** user đã đăng nhập → chỉ so ảnh live với đúng `provider_subject_id` của user đó. Giảm false accept và đúng bản chất "xác minh người đã đăng nhập".
- **Enrollment:** N ảnh → quality gate (độ sáng/blur/khuôn mặt chính diện, ≥2 ảnh đạt) → provider tạo subject → `pending` → HR approve → `active`. Ảnh tạm lưu bucket riêng TTL ≤24h rồi xóa (scheduled job), chỉ giữ subject_id + quality.
- **Liveness/anti-spoof:** yêu cầu provider có passive liveness; khi `liveness != pass` hoặc confidence dưới ngưỡng → yêu cầu active challenge (quay đầu/chớp mắt theo provider SDK) tối đa 2 lần → vẫn fail → chuyển fallback PIN + gắn cờ review.
- **Provider adapter:** mọi tích hợp production nằm sau `IFaceProvider`, chạy server-side. Đánh giá provider theo: (a) liveness thật (chứng chỉ/đánh giá độc lập), (b) 1:1 + passive liveness qua web, (c) nơi xử lý/lưu trữ dữ liệu + DPA, (d) chi phí/enroll + /verify, (e) data residency & xóa dữ liệu, (f) SDK web/camera UX. **Chưa có credentials → Phase 5–6 chỉ dùng `MockFaceAdapter`** (deterministic theo fixture, mô phỏng pass/fail/low-quality) và ghi rõ mock ≠ production.
- **Confidence handling:** ngưỡng `VERIFY_THRESHOLD` (vd 0.72) và `REVIEW_BAND` (0.60–0.72 → cần liveness pass + manager review). Ngưỡng là config, không hardcode.
- **Failure/fallback:** provider timeout (>8s) → retry 1 lần → fallback PIN; outage kéo dài → banner + chế độ PIN toàn công ty (có audit).

---

## 10. Privacy: minimization, retention/deletion, consent, audit

- **Mặc định không lưu ảnh thô.** Chỉ giữ: subject_id, quality score, timestamps, consent record.
- **Consent/notice:** trước enroll hiện notice (mục đích, provider xử lý, quyền rút consent) + checkbox; `consent_at` lưu DB; rút consent → revoke subject + xóa enrollment trong SLA 72h.
- **Retention:** events/days theo chính sách (đề xuất 24 tháng rồi archive), ảnh tạm ≤24h, log truy cập enrollment giữ 12 tháng.
- **Access audit:** mọi đọc/duyệt enrollment và export báo cáo ghi `audit_logs`; admin không có quyền xem template/ảnh.
- **Quyền:** nhân viên được xem/xuất dữ liệu của mình, yêu cầu xóa theo quy định; mọi xóa sinh trắc lan tới provider (`deleteSubject`).

---

## 11. Attendance calculation

- **Server timestamp:** `occurred_at = now()` tại server (Postgres), client không được gửi giờ. Hiển thị theo `tz` của shift (mặc định Asia/Ho_Chi_Minh).
- **Shift resolve:** tìm assignment hiệu lực tại work_date; ca đêm (`overnight`) thì event từ 00:00–`end+buffer` vẫn thuộc work_date hôm trước.
- **Grace/rounding:** đến trễ ≤ grace → on-time; làm tròn xuống/phút theo `rounding_min` (config/ca).
- **Late/early/overtime:** `late_min = max(0, first_in - (start+grace))`; `early_leave = max(0, (end-grace) - last_out)`; overtime = ngoài giờ (chỉ tính khi có phê duyệt — Decision D6b).
- **Idempotency & duplicate:** client sinh `idempotency_key` (uuid/check-direction/ngày); DB unique → double-tap/camera gửi 2 lần không tạo 2 event; thêm dedupe cửa sổ 60s cùng direction.
- **Incomplete:** có in thiếu out (quá `end+buffer`) → `incomplete`, nhắc employee + cho adjustment.

---

## 12. Reports / CSV & quyền

- Employee: lịch sử + tổng của mình. Manager: team. HR: toàn công ty. Mọi export ghi audit (ai, filter, số dòng).
- CSV cột: ngày, nhân viên, phòng ban, ca, in/out, muộn/sớm, tăng ca, trạng thái, phương thức (face/pin/manual). Giới hạn 10k dòng/lần, phân trang server-side.

---

## 13. Testing strategy

- **Unit (vitest):** luật tính công (grace, overnight, rounding, late/overtime), shift resolve, idempotency key.
- **Integration (API contract):** check-in/out với MockFaceAdapter: pass → 201 + event; low confidence → fallback band; duplicate key → 1 event; client gửi giờ → bị bỏ qua.
- **RLS tests (pgTAP hoặc script SQL + supabase-js với JWT từng role):** matrix mục 8 + user A/B isolation; chạy trên local Supabase CI.
- **E2E (Playwright):** login → enroll (mock camera fixture) → approve → check-in/out → report CSV → adjustment duyệt; camera-denied path; provider-outage path (mock 500).
- **Fixtures:** users A/B khác dept, shifts (ngày/đêm), ảnh fixture (pass/fail/blur), ngưỡng confidence cố định trong test env.

---

## 14. Environment variables (tên only — không giá trị, không commit)

```
# Public (client-safe)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_TZ=Asia/Ho_Chi_Minh
# Server-only (Vercel env / supabase secrets, KHÔNG prefix NEXT_PUBLIC_)
SUPABASE_SERVICE_ROLE_KEY
FACE_PROVIDER=mock            # mock | <tên-provider-chốt-ở-Phase-10>
FACE_PROVIDER_API_KEY
FACE_PROVIDER_REGION
VERIFY_THRESHOLD=0.72
REVIEW_BAND_LOW=0.60
ENROLL_BUCKET_TTL_HOURS=24
PIN_FALLBACK_ENABLED=true
```

`.env.local` chỉ local + gitignored; document trong `.env.example` (chỉ tên + ví dụ giả).

---

## 15. Deployment (dependencies rõ ràng)

- **Local:** Supabase CLI (`supabase start`) → `supabase db reset` (migrations + seed) → `npm run dev`. Phụ thuộc: Docker đang chạy.
- **Cloud Supabase:** project staging trước; `supabase db push --db-url $STAGING`; production chỉ push từ tag; PITR bật ở production.
- **Vercel:** Preview cho mọi PR (gắn Supabase staging + `FACE_PROVIDER=mock`); Production gắn Supabase production, env server-only, chỉ deploy từ `main` sau khi E2E + RLS tests pass.
- Thứ tự: Supabase migrations merge trước → Vercel deploy sau (app mới đọc schema mới phải backward-compatible trong 1 bản).

---

## 16. Failure / risk register

| Risk | Tác động | Giảm thiểu |
|---|---|---|
| False reject (ánh sáng/camera yếu) | Xếp hàng chấm công | Quality gate + retry + fallback PIN có review |
| False accept / spoofing (ảnh, video) | Chấm công hộ | 1:1 + liveness bắt buộc; ngưỡng + review band; audit bất thường (2 nơi cùng lúc) |
| Provider outage | Không verify được | Timeout+retry → fallback PIN + banner; health check |
| Camera permission denied | Không chụp | Hướng dẫn cấp quyền + fallback PIN |
| Network chập chờn | Double submit | Idempotency key + dedupe 60s |
| Duplicate events | Sai công | Unique constraint + recompute days từ events |
| Access leakage (đọc chéo dept) | Lộ lương/giờ | RLS matrix + tests A/B mỗi PR |
| Lưu ảnh thô quá hạn | Vi phạm privacy | Bucket TTL + cron xóa + audit |
| Sai múi giờ/ca đêm | Tính sai late/OT | Server now() + tz/ca test overnight fixture |
| Secrets lọt repo | Mất key | `.env.example` chỉ tên; secret scanning; key chỉ server-side |

---

## 17. Phase plan (nhỏ, có dependencies, files, migration, acceptance, tests, commands, rollback, commit msg)

### Phase 0 — Plan/audit ✅ (bước hiện tại)
- Dep: không. Files: `docs/IMPLEMENTATION_PLAN.md` (file này). Acceptance: bạn xác nhận D1–D10. Rollback: xóa file. Commit: `docs: add AI Face Attendance implementation plan`

### Phase 1 — Foundation (scaffold + CI)
- Dep: D1, D2. Files: `package.json`, `tsconfig`, `tailwind`, `app/layout`, `.env.example`, `.gitignore`, `.github/workflows/ci.yml`, `vercel.json`.
- Acceptance: `npm run dev/build/lint` xanh; PR preview hiện trang trắng đúng brand.
- Tests: lint + typecheck. Commands: `npx create-next-app@latest . --ts --tailwind --app; npm run dev`.
- Rollback: revert commit scaffold. Commit: `feat: scaffold nextjs app with ci`

### Phase 2 — DB/RLS/seed (local Supabase)
- Dep: P1, D5. Migrations `supabase/migrations/0001–0007*.sql` + `seed.sql` theo mục 7–8.
- Acceptance: `supabase db reset` xanh; RLS tests A/B pass.
- Tests/fixtures: script RLS matrix + users A/B. Commands: `supabase start; supabase db reset; npm run test:rls`.
- Rollback: `supabase db reset` về migration trước. Commit: `feat(db): core schema rls and seed`

### Phase 3 — Auth/RBAC
- Dep: P2. Files: `app/login`, `middleware.ts`, `lib/roles.ts`, dashboard theo role.
- Acceptance: 4 roles login đúng redirect; 403 khi vào route чужой role; rate limit login.
- Tests: e2e login matrix. Rollback: revert. Commit: `feat(auth): supabase auth with rbac`

### Phase 4 — Employees/Departments/Shifts CRUD
- Dep: P3. Files: `app/admin/*`, server actions + RLS verify.
- Acceptance: HR CRUD đủ 3 đối tượng; manager chỉ xem; validation overlap ca.
- Tests: integration CRUD + RLS. Rollback: revert. Commit: `feat(admin): org and shift management`

### Phase 5 — Face enrollment + provider adapter (mock)
- Dep: P4, D4, D8. Files: `server/face/*` (interface + MockFaceAdapter), `app/enrollment`, bucket tạm TTL, queue approve HR.
- Acceptance: enroll → pending → approve → active với mock; ảnh tạm tự xóa; rút consent xóa subject.
- Tests: contract enroll pass/low-quality/fail. Rollback: revert + xóa bucket. Commit: `feat(face): enrollment with mock provider adapter`

### Phase 6 — Attendance check-in/out
- Dep: P5, D6. Files: `app/check-in`, `server/api/attendance/*`, `lib/attendance/*`, recompute `attendance_days`.
- Acceptance: verify 1:1 mock → event server timestamp; dedupe double-tap; overnight đúng work_date; fallback PIN gắn cờ.
- Tests: unit luật công + contract API + dedupe. Rollback: revert. Commit: `feat(attendance): face check-in-out with idempotency`

### Phase 7 — History/dashboard/reports CSV
- Dep: P6. Files: `app/history`, `app/reports`, export CSV + audit.
- Acceptance: đúng scope role; CSV 10k dòng; export ghi audit.
- Tests: e2e report + phân quyền. Rollback: revert. Commit: `feat(reports): history dashboard and csv export`

### Phase 8 — Adjustments/leave/audit trail
- Dep: P7. Files: `app/adjustments`, `app/audit`, recompute sau duyệt.
- Acceptance: request → approve → days tính lại + audit before/after.
- Tests: e2e adjustment flow. Rollback: revert. Commit: `feat: adjustment requests with audit trail`

### Phase 9 — Security/E2E QA hardening
- Dep: P8. Files: rate limit, headers, secret scan, Playwright suite full, RLS re-run.
- Acceptance: toàn bộ suites xanh; camera-denied/outage paths có UX đúng; không ảnh thô tồn tại quá TTL.
- Rollback: revert từng hardening. Commit: `chore(security): hardening and full e2e`

### Phase 10 — Production provider integration + deploy
- Dep: P9 + **D4 đã chốt + credentials staging**. Files: `server/face/<provider>-adapter.ts`, Vercel env, runbook.
- Acceptance: staging verify thật + liveness pass; chi phí/latency trong ngưỡng; switch flag `FACE_PROVIDER`; production deploy từ tag.
- Tests: smoke staging + rollback drill. Rollback: `FACE_PROVIDER=mock` + revert adapter (giữ interface).
- Commit: `feat(face): integrate production provider <name>`

---

## 18. Definition of Done

**Mỗi feature:** acceptance của phase đạt + tests tương ứng xanh trên CI + RLS check (nếu chạm DB) + không secret trong diff + docs cập nhật + preview deploy có link.
**Toàn app:** P0–P9 xanh với mock; P10 chỉ "done" khi provider thật verify được trên staging, privacy checklist (mục 10) ký bởi HR/pháp chế, runbook vận hành + rollback đã drill, production deploy từ tag kèm migration đã review.

---

## Build task đầu tiên (đề xuất chạy sau khi bạn xác nhận D1–D10)

> `Phase 1 — Foundation`: `git init`, tạo GitHub repo, scaffold Next.js+TS+Tailwind, `.env.example` (tên only), CI lint/typecheck, Vercel project + Preview. Lệnh và acceptance theo Phase 1 ở trên.
