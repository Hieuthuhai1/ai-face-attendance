# Final Audit Report — AI Face Attendance (Phase 8, 2026-10-09)

Phạm vi: toàn app trên local (Next.js dev + Supabase local). Mọi verdict đều có evidence
chạy thật; mục không chạy được ghi NOT RUN + lý do, không đánh dấu PASS.

**Kết luận: NOT PRODUCTION-READY** — face provider/liveness thật chưa cấu hình
(mock-only), chưa có privacy review pháp lý, chưa environment/cloud, chưa E2E browser.

## Verdicts

| # | Hạng mục | Kết quả | Evidence |
|---|---|---|---|
| 1 | Auth/session/routes/RBAC | PASS | integration login đúng/sai + session + logout (5/5); 9/9 routes anon → 307 `/login` (curl); `requireRole` server-side; proxy-matcher parity test |
| 2 | RLS A/B, manager, org scope | PASS | `test_rls.sql` 11/11 sections (anon, A/B, manager team, HR org, sysadmin, cross-org) |
| 3 | Enrollment consent/HR verify/revoke | PARTIAL | PASS: SQL §8 (lifecycle, verified_by stamp, manager 0-dòng, audit) + unit quality/rate/timeout/mock. Chưa chạy: submit/approve qua UI với session thật (cần browser, Phase 9) |
| 4 | Mock vs production | PASS | `getProviderHealth` production → NOT CONFIGURED + fail closed (unit); DEMO banner mọi UI mock; grep không có tuyên bố production-ready |
| 5 | Liveness/timeout/no-match/low-conf | PASS | unit decision matrix (review ≠ gian lận), timeout 8s, mock fixtures, UI states riêng từng lỗi. Liveness thật: không có (đúng như thiết kế mock) |
| 6 | Server timestamp/tampering | PASS | SQL §2: browser gửi giờ quá khứ + success giả → `occurred_at` ép giờ server + hạ `pending_review`; WITH CHECK cấm success trực tiếp |
| 7 | Duplicate/idempotency/concurrent | PASS | unique constraint; retry cùng key trả bản ghi cũ; **concurrent 2 RPC cùng key → đúng 1 row** (integration mới) |
| 8 | Fallback workflow | PARTIAL | PASS: policy cho status fallback (SQL §9), action + UI form + lý do bắt buộc. Chưa chạy: flow fallback→HR duyệt qua browser |
| 9 | Reports/CSV perms + injection | PASS | unit escape `=+-@` + quote; scope SQL §10 + integration (A/B, manager team, audit export); export giới hạn 5000 dòng + khoảng 62 ngày |
| 10 | Adjustments/audit | PASS | RPC idempotent (`ALREADY_DECIDED`), phân quyền trong DB, correction không sửa events gốc, audit completeness (SQL §11), metadata tối thiểu |
| 11 | Không lộ biometrics/secrets | PASS | grep sạch (service_role/storage/key trong `src` không có; base64 dài không); logger redact (unit); response shapes không chứa confidence/template/subject gửi client |
| 12 | Retention + no raw images | PASS | `BIOMETRIC_DATA_POLICY.md` (bảng retention, TTL, SLA 72h); code: frame validate → discard, không storage/bucket call nào |
| 13 | Responsive/a11y/camera/states | PARTIAL | Code checklist đạt: labels/focus, text+icon (không chỉ màu), loading/empty/error/success mọi trang, camera permission/denied/unavailable states. Chưa verify trên thiết bị/thiết bị thật |
| 14 | Errors/rate/validation/headers | PASS | rate limiter unit, validation unit 46/46, security headers mới thêm + verify qua curl (nosniff, referrer, DENY, camera=(self)); HSTS để Vercel lo ở prod |
| — | Production build | PASS | `next build` xanh (PPR + Proxy) |
| — | E2E browser (Playwright) | NOT RUN | Chưa cài browser tooling; flows đã phủ bằng integration + curl smoke. Cài Playwright + suite ở Phase 9 |

## Bugs found & fixed trong audit

- **B1 — Thiếu security headers** (repro: `curl -I /login` không có header bảo mật).
  Root cause: `next.config.ts` mặc định. Fix nhỏ nhất: thêm 4 headers
  (X-Content-Type-Options, Referrer-Policy, X-Frame-Options DENY, Permissions-Policy).
  Regression: smoke curl xác nhận headers trên mọi response.
- **B2 — Test concurrency assertion phụ thuộc thứ tự** (repro: `toEqual([null, "23505"])`
  fail khi `r2` thắng race). Root cause: `Array.sort` đẩy null xuống cuối.
  Fix: assert membership (`toContain`). Hành vi đúng (1 row) đã được khẳng định lại.

## Gap register (không chặn local, chặn production)

1. Provider/liveness thật + DPA/region/chi phí (Phase 10) — app báo NOT CONFIGURED.
2. Privacy review pháp lý + HR chốt retention 24 tháng (policy đang là đề xuất).
3. Cloud Supabase + Vercel env prod + monitoring (chưa link).
4. E2E browser suite + kiểm tra thiết bị thật (camera/permission matrix).
5. Rate limit đa instance (hiện tại bộ nhớ tiến trình) + HSTS prod.
