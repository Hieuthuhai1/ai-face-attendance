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

**Commit:** `chore(setup): initialize attendance app foundation` — SHA: _điền sau push_.
**Deployment:** chưa link Vercel → không Preview ở phase này.
**Known issues:**
- create-next-app 16 sinh `layout.tsx` dùng `LayoutProps` không tồn tại → đã sửa
  thành `{ children: React.ReactNode }`.
- `Button` không forward `ref` (React 19 types) → Dialog dùng `autoFocus`.

## Next task — Phase 2 (Database/RLS/seed)

Supabase CLI + migrations `0001–0007` (schema mục 7 plan), RLS matrix + tests A/B
(S-09), seed idempotent. Chưa code provider thật, attendance hay quản lý ca.
