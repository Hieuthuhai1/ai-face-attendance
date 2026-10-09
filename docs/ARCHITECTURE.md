# Architecture — AI Face Attendance (Phase 1)

## Tổng quan

Next.js App Router trên Vercel; Supabase Postgres/Auth/RLS làm data layer.
Mọi thao tác đặc quyền và face verification chạy server-side.

```text
Browser ──► Next.js routes (src/app)
               ├─► Server Actions / Route Handlers (src/server/api)
               │      ├─► Supabase (RLS, service-role chỉ ở server + verify role)
               │      └─► FaceRecognitionProvider (src/server/face)
               │             ├─► MockFaceRecognitionProvider (dev/test only)
               │             └─► Production adapter (Phase 10, fail closed nếu thiếu)
               └─► Supabase Auth (client: anon key + user JWT)
```

## Module boundaries

| Thư mục | Trách nhiệm | Không được |
|---|---|---|
| `src/app` | Routes, layout, error boundary | Chứa luật nghiệp vụ |
| `src/components/ui` | Design system thuần | Gọi API trực tiếp |
| `src/features/*` | UI + hooks từng domain | Cầm secret, tính giờ công ở client |
| `src/lib` | Pure utils (timezone, idempotency, formatting) | Import server-only module |
| `src/server` | Provider adapter, API, logger, RBAC | Import từ client component |
| `src/config` | Env parsing + ngưỡng cấu hình | Chứa giá trị secret thật |
| `supabase/` | Migrations, seed, RLS tests (Phase 2) | — |

## Face verification pipeline (mục tiêu, triển khai đầy đủ ở Phase 5–6)

1. Employee đăng nhập, mở trang chấm công.
2. Frontend xin camera permission, lấy frame tạm.
3. Server verify session, employee status, shift, enrollment, rate limit.
4. Server gọi provider: liveness/anti-spoof trước.
5. Server verify 1:1 với enrollment của chính employee.
6. Áp ngưỡng cấu hình; provider error/low confidence ≠ thành công.
7. Ghi `attendance_events` với server timestamp + idempotency key.
8. Xóa frame ngay sau xử lý; frontend chỉ nhận success/failure/retry/fallback.

## Định nghĩa số liệu báo cáo (Phase 6, nguồn chuẩn: summaries + events)

- **Tổng nhân sự (totalActive):** employees `employment_status='active'` trong scope
  (manager: team + chính mình; HR: toàn org).
- **Đã chấm công (checkedIn):** số nhân viên có summary `first_in NOT NULL` trong ngày xem.
- **Đi trễ (late):** summaries `status='late'` (`late_min > 0`, đã trừ grace, làm tròn xuống).
- **Về sớm (earlyLeave):** summaries `status='early_leave'`.
- **Vắng (absent):** CHỈ kết luận khi có shift data — nhân viên active có phân ca phủ
  ngày xem nhưng không có `first_in`. Không ca → không tính vắng.
- **Chờ rà soát (pendingReview):** events `status IN (pending_review, fallback)` từ 00:00
  ngày xem (theo giờ server, so sánh chuỗi ISO theo tz tổ chức ở tầng gọi).
- Summary là dữ liệu tổng hợp tái tính từ events (RPC `record_attendance_event`);
  events là nguồn sự thật cho lịch sử chi tiết.
- **Correction model (Phase 7):** events gốc bất biến; điều chỉnh công là records riêng
  (`attendance_adjustment_requests`) + audit. Khi duyệt, RPC `decide_adjustment_request`
  áp `requested_in/out` vào summaries (giữ nguyên events) trong cùng transaction với
  quyết định và audit row. Leave không sửa công đã ghi.

## Data & validation conventions
- Zod schemas ở biên (form + API). Server re-validate mọi thứ client gửi.
- `occurred_at` luôn do server set (`now()`); client time chỉ hiển thị.
- Idempotency: client sinh key `evt_<uuid>`; DB unique constraint (Phase 2).
- Tổng hợp ngày (`attendance_daily_summaries`) tái tính được, không phải source of truth.

## Environments

Local (Supabase CLI + `FACE_PROVIDER=mock`) → Vercel Preview (staging, mock) →
Production (Supabase Cloud + provider thật, Phase 10).
