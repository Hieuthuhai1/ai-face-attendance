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

## Docs

- `docs/IMPLEMENTATION_PLAN.md` — plan tổng thể 11 phase.
- `docs/AI_HANDOFF.md` — trạng thái sau mỗi phase (đọc file này trước khi tiếp tục).
- `docs/ARCHITECTURE.md` — kiến trúc module.
- `docs/TEST_DATA.md` — fixtures và scenario kiểm thử.
- `docs/BIOMETRIC_DATA_POLICY.md` — chính sách dữ liệu sinh trắc học.
- `docs/PROVIDER_SETUP.md` — cấu hình face provider (mock hiện tại).
- `AGENTS.md` — quy ước cho AI agent và contributor.
