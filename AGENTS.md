# AGENTS.md — Quy ước cho AI agent & contributor

## Mục tiêu

Xây dựng web chấm công bằng xác minh khuôn mặt 1:1 theo `docs/IMPLEMENTATION_PLAN.md`
và đặc tả sản phẩm. Face recognition là bước xác minh, không phải căn cứ duy nhất
để kỷ luật. Luôn có phương án thay thế. Đọc `docs/AI_HANDOFF.md` trước mỗi phase.

## Stack

Next.js App Router + TypeScript (strict) + Tailwind CSS · Supabase Postgres/Auth/RLS ·
Vercel · Vitest (unit) · Playwright (e2e, từ Phase 3).

## Folder rules

```text
src/app            routes (mỏng — gọi server actions / route handlers)
src/components/ui  design system: button, input, card, dialog, badge, table,
                   status, loading, empty, error, confirmation
src/features/*     mỗi domain một thư mục (auth, employees, shifts,
                   face-enrollment, attendance, reports, adjustments, settings)
src/lib            pure utils: tính công, timezone, idempotency (test được)
src/server         CHỈ chạy server: face provider adapter, API, RBAC verify
src/config         env parsing, constants theo organization
src/types          shared types
supabase/          migrations, seed, RLS tests
tests/             fixtures (KHÔNG dữ liệu sinh trắc thật)
```

- Browser KHÔNG gọi trực tiếp face provider production, KHÔNG cầm service-role key,
  KHÔNG tự tính giờ công.
- Không tạo cấu trúc song song với code hiện tại; chỉ bổ sung phần còn thiếu.
- Không đưa template/embedding/frame camera vào API response, log, hay test fixtures.

## Coding conventions

- TypeScript strict, không `any` trừ khi ép kiểu có kiểm tra.
- Validation mọi input ở biên (zod schemas trong `src/lib/validation.ts`).
- Logging qua `src/server/logger.ts` — tự động redact trường nhạy cảm
  (`image`, `frame`, `template`, `embedding`, `apiKey`, ...). Không `console.log`
  dữ liệu khuôn mặt.
- Error handling: route dùng `error.tsx` / `global-error.tsx`; API trả
  `{ error: { code, message } }` với mã ổn định (`UNAUTHORIZED`, `FORBIDDEN`,
  `VALIDATION_ERROR`, `PROVIDER_UNAVAILABLE`, `DUPLICATE_EVENT`, ...).
- UI: responsive mobile-first; mọi trạng thái có text + icon (không chỉ màu);
  primary action rõ; label/focus cho accessibility.
- Ngưỡng verify/liveness là config (`src/config`), không hardcode.

## Lệnh

```bash
npm run dev | lint | typecheck | test | test:watch | build
```

Không khai báo script không tồn tại. Không báo PASS khi chưa chạy được.

## Security / privacy rules (bắt buộc)

1. Secrets chỉ qua env / secret manager; không commit `.env*` (trừ `.env.example`
   chỉ tên + giá trị giả). Quét secret trước mỗi commit.
2. `FACE_PROVIDER` production fail closed: chưa cấu hình → từ chối verify,
   không fallback lén sang mock.
3. Mock provider chỉ bật ở `development`/`test` và UI gắn nhãn
   “DEMO – không dùng chấm công thật”.
4. Role do server quản lý; không tin role từ localStorage/client request.
5. Attendance event: server set timestamp; idempotency key chống duplicate.
6. Mọi thao tác đặc quyền (duyệt enrollment, sửa công, đổi role, export) ghi audit log.

## Definition of Done (mỗi feature)

Acceptance của phase đạt + tests xanh trên CI + RLS check (nếu chạm DB) +
không secret trong diff + docs cập nhật + Vercel Preview có link.

## Git workflow

- Mỗi feature một commit riêng, message conventional (`feat:`, `fix:`, `chore:`, `docs:`).
- Kiểm tra `git diff` + secret scan trước commit. Push branch hiện tại khi remote đã có.
- Cập nhật `docs/AI_HANDOFF.md` sau mỗi module: files, commands, results,
  commit SHA, deployment/known issues, Next task.
