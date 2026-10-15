# UX/UI Redesign Plan — AI Face Attendance (Plan Mode)

Ngày lập: 2026-10-15. Phạm vi: **chỉ frontend** (routes/components/CSS).
Không migration, không đổi DB/auth/AI backend, không commit/deploy ở bước này.
Tham khảo EasyHRM ở mức **nguyên tắc tổ chức thông tin** (nhóm chức năng rõ,
hành động chính nổi bật, trạng thái minh bạch, hàng đợi ngoại lệ, duyệt mobile);
không sao chép thương hiệu/nội dung/thiết kế của họ.

## 1. Audit giao diện hiện tại

| # | Màn hình (route) | Hiện trạng | Vấn đề chính |
|---|---|---|---|
| 1 | `/` home | Trang showcase components + text Phase | Không phải landing cũng không phải app home; user lạc sau login |
| 2 | `/login` | Card email/pass + nút Google + divider | Đạt cơ bản; thiếu logo/brand, thiếu link quên mật khẩu (ngoài phạm vi — Auth chưa có reset) |
| 3 | `/dashboard` | Chào tên + grid cards theo role | Không nav chung; cards chữ nhiều, thiếu số liệu hôm nay của chính user |
| 4 | `/check-in` | Nút In/Out + camera + states + fallback | Luồng tốt; trọng tâm camera chưa đủ lớn trên mobile; thiếu stepper/checklist trước chụp |
| 5 | `/history` | Lọc tháng + bảng + StatusIndicator | Bảng 7 cột chật mobile; không sort; phân trang chỉ text |
| 6 | `/enrollment` | Consent + fixture DEMO + camera + status | Dài, nhiều Card nối nhau; thiếu stepper (1 Thông báo → 2 Chụp → 3 Chờ duyệt) |
| 7 | `/admin/employees` | Tìm kiếm + bảng + dialog CRUD + confirm | Bảng 6 cột khó mobile; select manager theo mã khó đọc; thiếu avatar/tên nổi bật |
| 8 | `/admin/shifts` | Bảng ca + form phân ca + bảng assignment | Form 5 cột dồn mobile; thiếu view lịch theo tuần |
| 9 | `/admin/enrollments` | Lọc + bảng queue + approve/reject dialog | Không hiện ảnh/template (đúng privacy); thiếu SLA/bộ đếm chờ duyệt |
| 10 | `/reports` | 6 thẻ + form lọc 6 cột + bảng + export | Form lọc dồn mobile; thẻ số chưa có so sánh/kỳ trước; bảng 6 cột |
| 11 | `/adjustments`, `/leave` | Form + của tôi + queue duyệt | Tốt; thiếu badge đếm pending trên tiêu đề/tab |
| 12 | `/audit` | Filter + bảng read-only | Đạt; metadata JSON thô khó đọc |
| 13 | `/auth/callback` | Route kỹ thuật (không UI) | Ngoài phạm vi redesign |

**Vấn đề xuyên suốt (đã verify trong code):**
- U1. Không có AppShell/navigation chung — mỗi page là đảo riêng, không breadcrumb, không biết đang ở đâu.
- U2. Dark mode vỡ: `globals.css` đổi `--background/--foreground` theo `prefers-color-scheme`
  nhưng components dùng màu cứng (`bg-white`, `text-slate-*`) → nền đen chữ khó đọc. Chưa có chính sách theme.
- U3. Icons = ký tự unicode (◌ ✓ ✕ ⏳ ⚑) — thiếu nhất quán, khó kiểm soát a11y/kích thước.
- U4. Không skeleton — mọi Suspense dùng spinner chữ; bảng dài gây layout shift.
- U5. Bảng chỉ `overflow-x` + sort không có + phân trang text thuần.
- U6. Tokens sơ khai: chỉ `--brand` (+contrast); thiếu semantic palette (success/warning/danger/info),
  radius/shadow/spacing/focus-ring chuẩn.
- U7. Form lọc reports/shifts là grid cố định, dồn trên mobile; chưa có SearchInput chuẩn.
- U8. Audit metadata hiển thị JSON thô.
- U9. Home `/` không có vai trò trong app — nên thành redirect theo session (login ↔ dashboard).

## 2. Vấn đề UX/UI theo mức ưu tiên

| Ưu tiên | Vấn đề | Tác động |
|---|---|---|
| P0 | AppShell + navigation theo role (desktop sidebar / mobile bottom-bar + topbar) | User lạc, thao tác thừa; HR khó chuyển module |
| P0 | Design tokens đầy đủ + sửa dark mode (quyết định: light-only có chủ đích HOẶC dark đầy đủ) | Vỡ giao diện người dùng dark OS |
| P0 | Màn hình check-in mobile-first: viewfinder lớn, stepper, kết quả + giờ + hành động tiếp theo | Đây là màn hình dùng nhiều nhất |
| P1 | DataTable chuẩn (sort, pagination số trang, responsive card-mode) + SearchInput + Pagination | Mọi bảng HR |
| P1 | Skeleton + Empty có hướng dẫn hành động | Giảm cảm giác chờ, giảm ticket "trang trắng" |
| P1 | Stepper enrollment (consent → chụp → chờ duyệt) + badge pending cho reviewer | Giảm bỏ dở enrollment |
| P2 | StatCard dashboard (số hôm nay của tôi; HR: tồn đọng duyệt) + PageHeader chuẩn mọi trang | Nhận biết trạng thái nhanh |
| P2 | Icon set SVG nội bộ thay unicode rời rạc | Nhất quán, a11y |
| P3 | Audit metadata render dạng key-value gọn | Đọc được |
| P3 | Home `/` thành router theo session | Không còn trang showcase lạc lõng |

## 3. Design direction mới — "Enterprise SaaS calm"

- Nền trung tính ấm (`#f6f7f9`), surface trắng, text slate-900/500, border slate-200.
- Thương hiệu: giữ họ xanh dương (đang `#1d4ed8`) — đổi sang **navy `#1e3a8a` primary + blue `#2563eb` action + teal `#0d9488` accent thành công-phụ** sau khi bạn duyệt (không tự đổi brand khi chưa confirm).
- Radius 12px card / 8px control; shadow-sm card, shadow-md dialog; spacing 4px base.
- Typography: Geist (đã có) + tabular-nums cho giờ/số liệu.
- Không gradient/glass/cute illustration; icon outline 1.5px đồng bộ.
- Motion: transition 150ms cho hover/focus; Skeleton shimmer tắt khi `prefers-reduced-motion`.

## 4. Design tokens (mở rộng `globals.css` + `@theme`)

```css
--brand-900:#1e3a8a; --brand-600:#2563eb; --brand-50:#eff6ff;
--teal-600:#0d9488;
--bg:#f6f7f9; --surface:#ffffff; --surface-muted:#f1f5f9;
--text-1:#0f172a; --text-2:#475569; --text-3:#94a3b8;
--border:#e2e8f0;
--success:#15803d; --success-bg:#f0fdf4;
--warning:#b45309; --warning-bg:#fffbeb;
--danger:#b91c1c; --danger-bg:#fef2f2;
--info:#1d4ed8; --info-bg:#eff6ff;
--radius-card:12px; --radius-control:8px;
--shadow-card:0 1px 2px rgb(15 23 42 / .06);
--focus-ring:0 0 0 3px rgb(37 99 235 / .25);
```

## 5. Sơ đồ navigation (theo role, server render theo `profile.role`)

- Employee: Chấm công (`/check-in`) • Hôm nay (`/dashboard`) • Lịch sử (`/history`) • Đơn từ (`/adjustments`, `/leave`) • Đăng ký khuôn mặt (`/enrollment`)
- Manager: + Báo cáo (`/reports`) • Duyệt (badges pending trên Đơn từ)
- HR/Admin: + Nhân sự • Ca làm • Xác minh khuôn mặt • Audit • (Báo cáo)
- Desktop: sidebar trái 240px (icon + label, badge count). Mobile: topbar gọn (logo + avatar/menu) + bottom-bar 5 mục chính. Không sidebar trên `/login`.

## 6. Đề xuất bố cục từng màn hình (giữ nguyên backend/actions)

1. **Login:** card giữa, logo + tên app, nút Google trước (primary use), divider "Hoặc", form email/pass, lỗi gần trường + alert tóm tắt; giữ thông báo cấu hình thiếu.
2. **Dashboard:** PageHeader (chào + ngày + ca hôm nay) → employee: thẻ "Hôm nay" (giờ vào/ra, tổng giờ, trạng thái) + actions; HR: hàng đợi (enrollments/adjustments/leave pending counts) + link.
3. **Check-in:** stepper (1 Chọn In/Ra → 2 Xác minh → 3 Kết quả); viewfinder 4:3 lớn, khung căn mặt bằng CSS (không overlay ML), checklist ánh sáng/nhìn thẳng; kết quả: icon lớn + giờ server + ca + nút "Chấm tiếp/Chụp lại/Dùng thay thế".
4. **History:** PageHeader + month picker + StatCards mini (ngày công, trễ, sớm) + DataTable responsive.
5. **Employees/Shifts/Enrollments/Reports/Adjustments/Leave/Audit:** PageHeader (title + description + primary action) + filter bar chuẩn + DataTable + pagination; reports giữ export + ghi chú vắng-có-ca.

## 7. Component tái sử dụng (giữ nguyên)

`button, input, card, dialog, badge, confirm-dialog, demo-banner, status-indicator`
(logic + API giữ, chỉ restyle qua tokens).

## 8. Component sửa/thay/thêm

- Sửa: `table` → `DataTable` (sort client-side trong trang, card-mode mobile); `states` (thêm Skeleton + Empty có action); `input` (thêm SearchInput, DateInput style); `badge` (thêm dot + count).
- Thêm: `AppShell/Sidebar/BottomBar/Topbar/PageHeader/StatCard/Stepper/Avatar/Pagination/Tabs/EmptyIllustration(css)/Icon(svg set)/Toast(nhẹ, cho copy/export)` .
- Xóa ý định: không thêm chart lib/charts ở đợt này (dùng StatCard + bảng).

## 9. Responsive strategy

- Breakpoints Tailwind: `sm:640 lg:1024`. Mobile-first: check-in/enrollment/login ưu tiên một cột, viewfinder full-width, nút chính sticky-bottom trong flow chụp.
- Bảng → card-mode dưới `md` (mỗi row thành 1 card, cột chính + 2 meta + actions).
- Sidebar → bottom-bar dưới `lg`; topbar thu gọn; filter bar cuộn ngang có snap.
- Touch target ≥ 44px cho primary/danger; bảng chữ ≥ 14px.

## 10. Accessibility checklist

- Mọi icon có `aria-hidden` + text đi kèm (kế thừa quy ước hiện tại).
- Focus-visible dùng `--focus-ring`; thứ tự tab logic trong Dialog (giữ autoFocus nút an toàn).
- Form: label thật, `aria-describedby` lỗi, lỗi gần trường (Input đã có).
- Tương phản text ≥ 4.5:1 (palette trên đạt với slate trên trắng).
- Không chỉ dùng màu: giữ icon+chữ mọi status.
- `prefers-reduced-motion`: tắt shimmer/transition.
- Test keyboard-only cho login → check-in → duyệt (ghi trong kế hoạch kiểm thử).

## 11. Trạng thái & tương tác (áp cho mọi trang)

Loading (skeleton theo hình trang) • Empty (minh họa CSS + 1 primary action) •
Error (mã lỗi + Thử lại) • Success • Warning/Review • Disabled (kèm lý do qua title/hint) •
Retry (giữ idempotency key như hiện tại). Form: validate sát trường, disable submit khi đang gửi.

## 12. File dự kiến thay đổi

- `src/app/globals.css` (tokens + theme policy), `src/app/layout.tsx` (lồng AppShell).
- Mới: `src/components/app/*` (shell/nav/header), `src/components/ui/{data-table,pagination,skeleton,avatar,stepper,stat-card,tabs,search-input,icon,empty-illustration}.tsx`.
- Sửa UI (không đổi actions/RLS): 12 `page.tsx` + 5 `features/*` panels + `login-form`.
- Xóa/sửa: `src/app/page.tsx` thành router session (server redirect).
- Docs: cập nhật `AGENTS.md` (quy ước UI mới) khi xong.

## 13. Kế hoạch kiểm thử

- `lint/typecheck/build` sau mỗi task; unit cho tokens? (không cần) + giữ 48 unit hiện tại xanh.
- Visual smoke: dev server + curl mã trạng thái + screenshot từng route (bạn duyệt bằng mắt).
- Regression chức năng: integration suite + RLS suite chạy lại cuối (không đổi backend nhưng đề phòng import/CSS vỡ build).
- A11y: checklist keyboard + tab order + contrast spot-check.
- Không merge task nào làm vỡ test hiện có.

## 14. Acceptance criteria (toàn redesign)

- Mọi route cũ hoạt động y hệt (actions/RLS/validations không đổi — diff chứng minh).
- Không còn trang trắng/lỗi dark mode ở cấu hình đã chọn.
- Mobile 360px: check-in chụp được bằng 1 tay (nút trong tầm ngón cái), bảng đọc được.
- Lighthouse a11y ≥ 90 các trang chính (đo thủ công, ghi số liệu).
- Bạn duyệt visual từng nhóm màn hình.

## 15. Git/Vercel workflow

- Branch `ui/redesign` từ `main`; mỗi task 1 commit conventional; PR Preview Vercel để bạn duyệt visual (không merge khi chưa duyệt).
- Không push thẳng `main`; không migration; secret scan như thường lệ.

## 16. Rủi ro với chức năng hiện có & giảm thiểu

- Restyle làm vỡ layout logic (dialog focus, form grid) → giữ nguyên component API, chỉ đổi class/tokens; smoke từng dialog.
- Dark-mode: chọn 1 trong 2 (khuyến nghị **light-only có chủ đích**: xóa media query, ép light) — quyết định của bạn trước Task 1.
- Icon SVG mới thiếu nghĩa → mỗi icon có label mapping review cùng bạn.
- Scope creep sang backend → cấm trong plan này; mọi thiếu dữ liệu ghi backlog, không tự thêm API.

---

## Task list (dependency order)

| Task | Việc | Phụ thuộc | Files chính |
|---|---|---|---|
| R0 | Chốt: light-only vs dark đầy đủ + duyệt brand navy (bạn quyết) | — | (quyết định, không code) |
| R1 | Tokens + theme policy + sửa dark | R0 | `globals.css` |
| R2 | Icon set SVG + restyle Badge/StatusIndicator | R1 | `ui/icon*`, badge, status |
| R3 | AppShell + nav theo role + PageHeader + `/` router | R1,R2 | `components/app/*`, layout, `app/page` |
| R4 | DataTable + Pagination + SearchInput + Skeleton/Empty | R1,R2 | `ui/*` mới |
| R5 | Login + Dashboard + History (áp shell + components) | R3,R4 | 3 routes |
| R6 | Check-in + Enrollment (mobile-first + stepper) | R3,R4 | 2 routes + camera panels (UI only) |
| R7 | Admin tables (employees/shifts/enrollments) | R4,R5 | 3 routes |
| R8 | Reports/Adjustments/Leave/Audit | R4,R5 | 4 routes |
| R9 | A11y pass + visual QA + regression suite + docs | R5–R8 | toàn bộ + AGENTS.md |

**Task đầu tiên (Build): R1 — Tokens + theme policy.**
Acceptance R1: `globals.css` có đủ tokens mục 4; dark mode hoặc bị xóa hẳn (theo R0) hoặc render đúng cả app ở cả 2 theme (smoke 3 routes mỗi theme); `lint/typecheck/build` xanh; không đổi bất kỳ logic nào (diff chỉ CSS/tokens); commit `style(ui): add design tokens and theme policy`.
