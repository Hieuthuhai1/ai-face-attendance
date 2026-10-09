# AI Face Attendance

Web chấm công bằng xác minh khuôn mặt 1:1 cho tổ chức/doanh nghiệp.

- Nhân viên đăng nhập → đăng ký khuôn mặt (HR xác minh + consent) → check-in/out bằng camera.
- Server timestamp là chuẩn; hỗ trợ ca qua đêm, phương án thay thế khi camera/provider lỗi.
- Mặc định **không lưu ảnh camera thô**; xem `docs/BIOMETRIC_DATA_POLICY.md`.
- Face provider thật được tích hợp ở Phase 10; hiện tại chỉ `mock` cho local/test
  (xem `docs/PROVIDER_SETUP.md`). Production **fail closed** khi chưa cấu hình.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS · Supabase (Postgres/Auth/RLS) ·
Vercel · Vitest + Playwright (từ Phase 2/3).

## Quick start

```bash
npm install
cp .env.example .env.local   # chỉ local, không commit
npm run dev
```

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy local |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (vitest, 1 lần) |
| `npm run test:watch` | Unit tests (watch) |
| `npm run build` | Production build |

## Môi trường & Deploy

| Môi trường | Frontend | Database |
|---|---|---|
| Local | `npm run dev` | Supabase CLI (`supabase start`, ports 543xx) |
| Preview/Staging | Vercel Preview deploys | Supabase Cloud project staging |
| Production | `https://ai-face-attendance-zeta.vercel.app` | Supabase Cloud project production (riêng, không seed) |

Env vars (chỉ tên — giá trị cấu hình trong Vercel Dashboard, không commit):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_APP_TZ`, `NEXT_PUBLIC_FACE_DEMO_BANNER` (server-only:
`SUPABASE_SERVICE_ROLE_KEY`, `FACE_PROVIDER*` khi có provider thật).

**Face AI/Liveness: NOT CONFIGURED.** Production fail closed khi thiếu provider;
mock chỉ local/test. Không claim end-to-end success khi chưa có provider thật.

Rollback: Vercel → Deployments → chọn bản Ready cũ → Promote (instant).
Database migrations chỉ tiến (không down tự động) — rollback DB bằng migration
fix-forward mới, tuyệt đối không `db reset` production.

## Docs

- `docs/IMPLEMENTATION_PLAN.md` — plan tổng thể 11 phase.
- `docs/AI_HANDOFF.md` — trạng thái sau mỗi phase (đọc file này trước khi tiếp tục).
- `docs/ARCHITECTURE.md` — kiến trúc module.
- `docs/TEST_DATA.md` — fixtures và scenario kiểm thử.
- `docs/BIOMETRIC_DATA_POLICY.md` — chính sách dữ liệu sinh trắc học.
- `docs/PROVIDER_SETUP.md` — cấu hình face provider (mock hiện tại).
- `AGENTS.md` — quy ước cho AI agent và contributor.
