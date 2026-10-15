# Google OAuth Setup (bạn làm trên browser — credentials không qua chat/app)

Code app đã hỗ trợ nút "Đăng nhập bằng Google" + callback `/auth/callback`.
Supabase chỉ cho login khi provider được bật **và** client ID/secret đúng.
Các bước dưới làm một lần cho mỗi môi trường (local test + staging cloud).

## A. Tạo OAuth client trên Google Cloud (1 lần, dùng chung local + staging)

1. Vào **console.cloud.google.com** → tạo/chọn project → **APIs & Services → Credentials**.
2. **Configure Consent Screen** (nếu chưa): User type **Internal** (nếu dùng Google
   Workspace công ty) hoặc **External** → điền tên app → **không** thêm scope nhạy cảm
   (chỉ cần `email`, `profile` — app đã xin đúng 2 scope này).
3. **Create Credentials → OAuth client ID** → loại **Web application** → đặt tên
   `AI Face Attendance`.
4. **Authorized redirect URIs** — thêm ĐỦ các dòng (thiếu dòng nào thì môi trường đó lỗi):
   - Local: `http://127.0.0.1:54321/auth/v1/callback`
   - Staging cloud: `https://vbqfcrptytzogskmornm.supabase.co/auth/v1/callback`
   - (Production sau này: URL tương tự của project production.)
5. **Create** → copy **Client ID** + **Client secret** (giữ kín secret).

## B. Bật provider trên Supabase

**Local (test trước khi lên cloud):**
- Cách không commit secret: mở terminal của bạn, chạy:
  ```powershell
  cd /d D:\web-app\timekeeping
  ```
  rồi thêm tạm vào Supabase local qua Studio (`http://127.0.0.1:54323` →
  Authentication → Providers → Google → enable, dán Client ID/Secret → Save).
  Lưu ý: Studio local không persist sau `db reset` — reset xong làm lại, hoặc báo
  tôi để chuyển sang cách khác.

**Staging cloud:**
1. Supabase dashboard → project staging → **Authentication → Providers → Google** →
   **Enable**, dán Client ID/Secret → **Save**.
2. Cùng trang Authentication → **URL Configuration**: Site URL =
   `https://ai-face-attendance-zeta.vercel.app`; **Redirect URLs** thêm:
   - `http://127.0.0.1:3100/auth/callback`
   - `https://ai-face-attendance-zeta.vercel.app/auth/callback`
   - `https://*.vercel.app/auth/callback` (cho Preview deploys, nếu Supabase cho wildcard)

## C. Kiểm tra (bạn chạy trên browser)

1. Mở `/login` → bấm **Đăng nhập bằng Google** → chọn tài khoản → phải về `/dashboard`.
2. User Google mới: có profile (role employee) nhưng **chưa có employee record** →
   trang chấm công hiện "Không đủ điều kiện" — HR tạo employee + link profile
   (trang `/admin/employees`, chọn tài khoản trong dropdown) rồi mới dùng tiếp.
3. Báo tôi kết quả từng môi trường (local/staging) để ghi nhận.

## Ghi chú kỹ thuật (cho dev)

- Callback `/auth/callback` validate `next` chống open-redirect (unit `tests/oauth.test.ts`).
- `redirectTo` lấy từ request origin; Supabase đối chiếu allowlist nên origin lạ vô hại.
- Trigger `handle_new_user` (migration `...136000`) lấy tên theo thứ tự
  `display_name` → `full_name` → `name` → prefix email (test `test_oauth_profile.sql`).
- Khi provider chưa bật: nút Google báo "chưa được cấu hình" (fail-closed UX),
  không crash app.
