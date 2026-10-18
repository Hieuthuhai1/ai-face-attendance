# AI Face Attendance — UX/UI Redesign Plan

> **Ngày tạo**: 2026-10-18  
> **Branch**: `ui/redesign` (tạo mới từ `main`)  
> **Mục tiêu**: Cải thiện UX/UI toàn diện hướng tới SaaS HR chuyên nghiệp, hiện đại, triển khai thực tế.  
> **Tham khảo**: 1Office.vn (chỉ ý tưởng chức năng & nguyên tắc UX/UI, **KHÔNG** copy giao diện/code).

---

## 1. TRẠNG THÁI UX/UI HIỆN TẠI (Current State)

### ✅ Đã có (Phases 1–9 hoàn thành)
| Hạng mục | Trạng thái | Chi tiết |
|----------|------------|----------|
| **Design System** | Cơ bản | Button, Card, Icon, Input, DataTable, Pagination, Dialog, ConfirmDialog, Toast, Badge, StatusIndicator, Skeleton, Tooltip, Select, DropdownMenu, DemoBanner |
| **AppShell** | Hoàn thiện | Sidebar desktop (có thu gọn) + Topbar + Mobile Bottom-bar (5 mục), phân quyền 4 role |
| **Navigation** | Hoàn thiện | Route groups `(protected)`, role-based nav, breadcrumb, command palette ready |
| **Routes** | 12 routes | login, dashboard, check-in, history, enrollment, adjustments, leave, reports, admin/employees, admin/shifts, admin/enrollments, audit |
| **Camera Capture** | Hoàn thiện | Preview, quality gate (sáng/mờ/size), permission handling, fallback states |
| **Face Enrollment** | Hoàn thiện | Consent v1 → Camera (3-5 captures) → Submit → Pending → HR Approve/Reject |
| **Check-in/Out** | Hoàn thiện | Stepper (Chọn → Quét → Kết quả), states: idle/verifying/result/failed, fallback PIN, offline queue |
| **DataTable** | Hoàn thiện | Desktop table + Mobile cards (cùng 1 nguồn), sort/filter/paginate |
| **Responsive** | Tested | 5 viewports (360, 390, 430, 768, 1280), no horizontal overflow |
| **Accessibility** | Cơ bản | Focus-visible, ARIA labels, keyboard nav, contrast AA, reduced-motion |
| **E2E Tests** | 14/14 pass | Shell (4) + Responsive/A11y (10) trên production build |

### 🎨 Design Tokens (globals.css)
```css
:root {
  --brand: #1d4ed8; --brand-strong: #1e3a8a; --brand-soft: #eff6ff;
  --background: #f6f7f9; --surface: #ffffff; --surface-muted: #f1f5f9;
  --success: #15803d; --warning: #b45309; --danger: #b91c1c; --info: #1d4ed8;
  --radius-card: 12px; --radius-control: 8px;
  --shadow-card: 0 1px 2px rgb(15 23 42 / 0.06);
  --focus-ring: 0 0 0 3px rgb(37 99 235 / 0.25);
}
```
> Light-only có chủ đích (tránh vỡ components dùng màu cứng).

---

## 2. CÁC VẤN ĐỀ ƯU TIÊN (Priority Issues)

| # | Vấn đề | Mức độ | Mô tả |
|---|--------|--------|-------|
| 1 | **Dashboard thiếu trực quan** | 🔴 Cao | Chỉ stat cards, thiếu charts, heatmap, calendar view, team overview |
| 2 | **Check-in UX chưa mượt** | 🔴 Cao | Camera guide cơ bản, thiếu liveness guidance rõ ràng, recovery flow chưa tốt |
| 3 | **Quản lý nhân viên đơn giản** | 🟡 Trung bình | Thiếu bulk actions, import/export, avatar, org chart, search nâng cao |
| 4 | **Đăng ký khuôn mặt** | 🟡 Trung bình | Flow có sẵn nhưng thiếu progress indicator, better consent UX, re-enroll flow |
| 5 | **Lịch sử chấm công** | 🟡 Trung bình | Chỉ table, thiếu calendar view, heatmap, filter nâng cao, quick stats |
| 6 | **Quản lý ca làm** | 🟡 Trung bình | Thiếu visual calendar, drag-drop assignment, shift templates, conflict warning |
| 7 | **Đơn từ (Leave/OT/Shift Change)** | 🔴 Cao | Chỉ có Leave + Adjustments. **Thiếu**: Overtime requests, Shift change requests |
| 8 | **Approval Center** | 🔴 Cao | Chỉ queue cơ bản. Thiếu: Unified dashboard, bulk actions, SLA tracking, delegation |
| 9 | **Reports & Analytics** | 🔴 Cao | Chỉ xuất CSV. Thiếu: Charts, scheduled reports, dashboard widgets, drill-down |
| 10 | **Settings/Profile** | 🔴 Cao | **Hoàn toàn thiếu**: User profile, notifications, org settings, security, 2FA |
| 11 | **Mobile UX** | 🟡 Trung bình | Bottom bar có nhưng chưa tối ưu (touch targets, gestures, offline banner) |
| 12 | **Design System gaps** | 🟡 Trung bình | Thiếu: Tabs, Avatar, Calendar, Charts, FormWizard, Stepper component |
| 13 | **Loading/Empty/Error states** | 🟢 Thấp | Cơ bản, cần polish: skeleton chuyên biệt, empty state có illustration |

---

## 3. HƯỚNG THIẾT KẾ (Design Direction)

| Yếu tố | Quy chuẩn |
|--------|-----------|
| **Style** | Modern Enterprise SaaS, Clean, Professional |
| **Theme** | Light-only (có chủ đích) |
| **Typography** | Geist Sans/Mono, Tabular-nums cho số liệu/giờ |
| **Spacing** | 4px base, Card radius 12px, Control radius 8px |
| **Color** | Brand tokens + Semantic colors (success/warning/danger/info) |
| **Hierarchy** | Card > Section > Element, Shadow depth nhất quán |
| **Icon** | SVG stroke=currentColor 1.5px (không unicode rời rạc) |
| **Responsive** | Mobile-first, Breakpoints: sm(640), md(768), lg(1024), xl(1280) |
| **States** | Loading (Skeleton), Empty (illustration + action), Error (inline + toast), Success, Warning, Disabled |
| **Accessibility** | Focus-visible ring, ARIA labels, Keyboard navigation, Contrast AA, Reduced-motion |

---

## 4. KIẾN TRÚC MÀN HÌNH (Screen Architecture)

```
1. Login                    → Đã có (polish: social login, remember me, forgot password)
2. Main Dashboard           → REDISIGN hoàn toàn (charts, widgets, team view)
3. AI Face Attendance       → POLISH (liveness guide, better states, offline handling)
4. Employee Management      → NÂNG CẤP (bulk, import, avatar, org chart)
5. Employee Details         → MỚI (modal/drawer chi tiết, timeline, face status)
6. Face Enrollment          → POLISH (progress, consent UX, re-enroll flow)
7. Attendance Records       → NÂNG CẤP (calendar view, heatmap, filters)
8. Shift Management         → NÂNG CẤP (visual calendar, drag-drop, templates)
9. Work Calendar            → MỚI (unified calendar view cho employee/manager)
10. Leave Requests          → POLISH (balance, calendar, types)
11. Overtime Requests       → MỚI (chưa có)
12. Shift Change Requests   → MỚI (chưa có)
13. Approval Center         → NÂNG CẤP (unified, bulk, SLA, delegation)
14. Reports & Analytics     → REDISIGN (charts, scheduled, widgets, drill-down)
15. Departments             → MỚI (CRUD + org chart)
16. Attendance Policies     → MỚI (grace, rounding, OT rules, holiday calendar)
17. User & Role Management  → MỚI (RBAC UI, invitation, 2FA)
18. Security & Audit Logs   → POLISH (filter, export, real-time)
19. Profile & Settings      → MỚI (profile, notifications, security, preferences)
```

> **Chỉ triển khai màn hình có liên quan phạm vi thực tế** (ưu tiên 1–14 trước, 15–19 phase sau).

---

## 5. KẾ HOẠCH BUILD CHI TIẾT (10 Phases)

### Phase 1: Design System + Application Shell ⏱️ ~3-4 ngày
**Dependencies**: Không

**Files mới/cập nhật**:
```
src/components/ui/
├── avatar.tsx, tabs.tsx, stepper.tsx, form-wizard.tsx
├── calendar.tsx, charts/ (bar, line, pie, heatmap)
├── tooltip.tsx, dropdown-menu.tsx, select.tsx (improve)
├── table.tsx (column resize, sort, frozen), pagination.tsx (page size, jump)
├── empty-state.tsx, loading-state.tsx, error-state.tsx (improve)

src/components/app/
├── app-shell.tsx (keyboard shortcuts, command palette Cmd+K)
├── user-menu.tsx (NEW: profile dropdown)
└── nav.ts (update routes)
```

**Acceptance**: 100% unit tests utils, 80% components, a11y audit pass, bundle +<15KB.

---

### Phase 2: Main Dashboard Redesign ⏱️ ~4-5 ngày
**Dependencies**: Phase 1

**Files**:
```
src/app/(protected)/dashboard/
├── page.tsx (rewrite), components/ (stat-grid, attendance-chart, team-heatmap,
│   today-shifts, quick-actions, pending-approvals, upcoming-leaves, alerts-banner)
├── loading.tsx, error.tsx
src/features/reports/ (dashboard-actions.ts, dashboard-queries.ts)
src/lib/attendance/ (dashboard-stats.ts, heatmap-data.ts)
```

**Views theo Role**:
- **Employee**: Personal stats + today shift + upcoming leaves + trend chart
- **Manager**: Team stats + heatmap + pending approvals + team trend
- **HR/Admin**: Org stats + all pending + system alerts + compliance

---

### Phase 3: AI Face Attendance Experience (Check-in/Out) ⏱️ ~5-6 ngày
**Dependencies**: Phase 1

**Files**:
```
src/features/attendance/
├── checkin-flow.tsx (rewrite), components/ (camera-guide, verification-stepper,
│   checkin-result, fallback-form, offline-banner, provider-status)
├── camera-overlay.tsx, liveness-indicator.tsx, pulse-ring.tsx (NEW UI components)
```

**UX cải tiến**:
- Camera guide: Animated overlay (face oval, eye line, distance)
- Liveness: Progress ring + instructions (blink, turn head, smile)
- Stepper: 1.Sẵn sàng → 2.Định vị → 3.Xác minh → 4.Hoàn tất
- States real-time feedback (quá gần/xa, tối, sáng, lệch)
- Offline queue với auto-sync, conflict resolution
- Provider status badge (Online/Degraded/Offline) + latency

---

### Phase 4: Employee Management + Face Enrollment ⏱️ ~5-6 ngày
**Dependencies**: Phase 1

**Files**:
```
src/features/hr/
├── employee-manager.tsx (rewrite), employee-detail.tsx, employee-import.tsx
├── employee-avatar.tsx, org-chart.tsx, actions.ts (bulk, import, avatar)

src/features/face-enrollment/
├── enrollment-flow.tsx (rewrite: multi-step wizard)
├── components/ (consent-step, capture-step, quality-review, enrollment-status, re-enroll-flow)
```

**Employee Management**:
- DataTable + Avatar + Status badge + Quick actions
- Bulk: Activate/Deactivate/Assign Shift/Export/Delete
- Import Wizard: Template → Upload → Validate → Confirm → Result
- Employee Detail (Drawer): Tabs Overview|Attendance|Face|Shifts|Leave|Audit
- Org Chart: Interactive, zoom/pan, search, export PNG

**Face Enrollment Wizard**:
1. Consent: Interactive sections, versioned, checkbox per section
2. Capture: 3-5 captures, progress ring, quality feedback per capture
3. Review: Grid captures + quality scores, retake individual
4. Submit: Confirmation, estimated review time, reference number

---

### Phase 5: Attendance Records + Correction Requests ⏱️ ~4-5 ngày
**Dependencies**: Phase 1, 2

**Files**:
```
src/features/reports/
├── attendance-records.tsx (rewrite), components/
│   calendar-view.tsx, timeline-view.tsx, record-filters.tsx
│   record-detail.tsx, correction-request.tsx, export-dialog.tsx
```

**Views**: Table (default) | Calendar (heatmap) | Timeline (daily shift bars)
**Record Detail Drawer**: Event timeline, verification details, correction history, quick actions
**Correction Request**: Inline form pre-filled, reason templates, attachment support

---

### Phase 6: Shift Management + Work Calendar ⏱️ ~5-6 ngày
**Dependencies**: Phase 1, 4

**Files**:
```
src/features/hr/
├── shift-manager.tsx (rewrite), shift-calendar.tsx, shift-templates.tsx
├── components/ (shift-form, assignment-grid, shift-conflict, recurring-pattern, shift-preview)
```

**Features**:
- Shift Templates Library (reusable patterns)
- Visual Calendar: Drag-drop, color-coded, conflict detection real-time
- Assignment Grid: Employee × Date matrix, bulk range assign
- Recurring Pattern Wizard: Complex patterns (Mon/Wed/Fri night shift 3 months)
- Conflict Detection: Overlaps, 11h rest rule, max hours/week, auto-resolve suggestions

---

### Phase 7: Leave/Overtime/Shift Change + Approval Center ⏱️ ~6-7 ngày
**Dependencies**: Phase 1, 4, 5, 6

**Files**:
```
src/features/workflow/
├── leave-requests.tsx (rewrite), overtime-requests.tsx (NEW)
├── shift-change-requests.tsx (NEW), approval-center.tsx (NEW)
├── components/ (request-form wizard, request-card, request-detail,
│   approval-actions bulk, sla-tracker, leave-balance, overtime-calculator, shift-change-preview)
```

**3 Loại đơn mới**:
| Loại | Fields | Rules |
|------|--------|-------|
| Leave | Type, Date range, Reason, Attachment | Balance check, overlap, max days |
| Overtime | Date, Hours, Reason, Project, Attachment | Pre-approval, max hours/month, rate |
| Shift Change | From/To shift, Date range, Reason, Replacement | Coverage check, max changes/month |

**Approval Center (Unified)**:
- Tabs: All | Pending | Approved | Rejected | Delegated
- Bulk actions: Approve/Reject/Delegate với reason
- SLA Tracker: Color-coded (Green/Yellow/Red), overdue alerts
- Delegation: Set deputy, date range, auto-forward
- Keyboard shortcuts: `a` approve, `r` reject, `d` delegate, `j/k` navigate

---

### Phase 8: Reports & Analytics ⏱️ ~5-6 ngày
**Dependencies**: Phase 1, 2, 5

**Files**:
```
src/features/reports/
├── analytics-dashboard.tsx, report-builder.tsx, scheduled-reports.tsx
├── components/ (metric-cards, trend-charts, department-comparison,
│   employee-ranking, leave-analytics, overtime-analytics, shift-coverage,
│   report-filters, export-options, schedule-form)
```

**Analytics Dashboard (Role-based)**:
- Employee: Personal trends, leave balance, OT history, team comparison
- Manager: Team metrics, coverage, top issues, drill-down
- HR/Admin: Org-wide, dept comparison, compliance, cost analysis

**Visualizations**: Attendance trend, Late/early/absent distribution, Leave utilization, OT hours & cost, Shift coverage heatmap, Employee ranking

**Custom Report Builder**: Drag-drop fields, filter builder (AND/OR), visualization picker, save as template, share

**Scheduled Reports**: Daily/Weekly/Monthly/Custom cron, recipients (email/in-app), format (CSV/Excel/PDF), history

---

### Phase 9: Settings + Security + Permissions ⏱️ ~4-5 ngày
**Dependencies**: Phase 1, 7

**Files**:
```
src/features/settings/
├── profile-settings.tsx, notification-settings.tsx, security-settings.tsx
├── organization-settings.tsx, attendance-policies.tsx
├── components/ (profile-form, avatar-upload, notification-prefs,
│   two-factor-setup, session-list, password-change, org-form,
│   policy-editor, holiday-calendar, role-manager)
```

**Settings Hub Tabs**: Profile | Notifications | Security | Organization* (HR/Admin)

**Security**: 2FA TOTP (QR + backup codes), Active sessions (device, location, revoke), Password change (strength meter), Login history

**Organization (HR/Admin)**: Details, Branding (color, logo), Attendance Policies (grace, rounding, overnight buffer, max OT, leave types), Holidays (CRUD, recurring, ICS import), Roles (assignment, custom permissions future)

**Audit Log Enhanced**: Real-time (Supabase Realtime), advanced filters, metadata search, export audit logged

---

### Phase 10: Full QA + Vercel Production Deployment ⏱️ ~3-4 ngày
**Dependencies**: All previous phases

**Hoạt động QA**:
| Loại | Tool/Method |
|------|-------------|
| E2E Full Suite | Playwright trên production build |
| Visual Regression | Chromatic/Percy so sánh baseline |
| Accessibility Audit | axe-core + manual (WCAG 2.1 AA) |
| Performance Audit | Lighthouse CI (Perf>90, A11y>95, BP>90) |
| Security Scan | Snyk/OWASP ZAP, secret scan, dep audit |
| Load Testing | k6: 100 concurrent, p95<2s, error<0.1% |
| Cross-browser | Chrome, Firefox, Safari, Edge (latest 2) |
| Device Testing | iOS Safari, Android Chrome, iPad, Desktop |
| Production Smoke | Deploy staging → smoke → promote |
| Rollback Drill | Vercel instant rollback + DB fix-forward |

**Vercel Strategy**:
1. **Preview**: Every PR → unique URL, Supabase staging, `FACE_PROVIDER=mock`
2. **Staging**: `main` branch → staging URL, Supabase staging, mock provider
3. **Production**: Tagged release (`v1.x.x`) → production URL, Supabase production, **real provider**
4. **Rollback**: Vercel instant rollback + DB migration fix-forward

---

## 6. MODULE DEPENDENCIES (Dependency Graph)

```
Phase 1 (Design System + Shell)
    │
    ├── Phase 2 (Dashboard) ──────────────────┐
    │                                         │
    ├── Phase 3 (Check-in/Out) ◄──────────────┤
    │        │                                │
    ├── Phase 4 (Employee + Enrollment) ──────┤
    │        │                                │
    ├── Phase 5 (Attendance Records) ─────────┤
    │        │                                │
    ├── Phase 6 (Shifts + Calendar) ──────────┤
    │        │                                │
    ├── Phase 7 (Workflow + Approvals) ◄──────┤
    │        │                                │
    ├── Phase 8 (Reports + Analytics) ◄───────┤
    │        │                                │
    ├── Phase 9 (Settings + Security) ◄───────┤
    │        │                                │
    └── Phase 10 (QA + Deploy) ◄──────────────┘
```

**Critical Path**: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

**Parallelizable**: 
- Phase 2 & 3 song song sau Phase 1
- Phase 4 & 5 song song sau Phase 1
- Phase 6 sau Phase 1 + 4
- Phase 7 cần Phase 4, 5, 6
- Phase 8 cần Phase 2, 5, 7
- Phase 9 sau Phase 1, 7

---

## 7. RỦI RO & VẤN ĐỀ CẦN XÁC MINH (Risks & Open Questions)

| # | Rủi ro/Vấn đề | Mức độ | Mitigation |
|---|---------------|--------|------------|
| 1 | **Face Provider thật chưa có** | 🔴 Cao | Mock dev/test, fail-closed prod, Phase 10 integration |
| 2 | **Supabase Realtime notifications** | 🟡 Trung bình | Test scaling, fallback polling, rate limits |
| 3 | **Large dataset performance** | 🟡 Trung bình | Materialized views, pagination, background jobs, caching |
| 4 | **Mobile camera permissions** | 🔴 Cao | Clear rationale, fallback PIN, PWA install prompt |
| 5 | **Offline check-in sync conflicts** | 🟡 Trung bình | Idempotency keys, server-wins, conflict UI |
| 6 | **Multi-tenant data isolation** | 🔴 Cao | RLS testing every PR, integration tests matrix |
| 7 | **Bundle size growth** (charts, calendar) | 🟡 Trung bình | Code splitting, dynamic imports, tree shaking |
| 8 | **Vercel cold starts** | 🟢 Thấp | Warm functions, edge middleware for auth |
| 9 | **Timezone handling** (overnight shifts) | 🔴 Cao | Comprehensive test fixtures, server-side tz |
| 10 | **Privacy compliance** (biometric data) | 🔴 Cao | Policy review, DPA với provider, retention jobs |
| 11 | **Google OAuth production config** | 🟡 Trung bình | Verified redirect URLs, error handling |
| 12 | **Self-enrollment flow** (OAuth users) | 🟡 Trung bình | Test G-* employee creation, HR approval gate |
| 13 | **E2E flakiness** (camera, timing) | 🟡 Trung bình | Fake media stream, deterministic mocks, retries |
| 14 | **Migration rollback strategy** | 🔴 Cao | Fix-forward only, PITR enabled, tested drill |

**Cần bạn xác minh**:
1. **Face Provider production**: Đã chọn provider nào? Có credentials/staging chưa?
2. **Notification channels**: Email (SendGrid/Resend), Push (FCM/OneSignal), Slack webhook?
3. **Leave types & policies**: Danh sách loại nghỉ, quy đổi, carry-over rules?
4. **Overtime rates**: Hệ số OT (1.5x, 2x, 3x), cap giờ/tháng, project costing?
5. **Holiday calendar**: Năm 2025-2026, recurring rules, regional differences?
6. **2FA enforcement**: Bắt buộc cho tất cả role hay chỉ HR/Admin?
7. **Data retention**: Thời gian giữ events/days/enrollments/audit logs?
8. **Multi-language**: Chỉ tiếng Việt hay có i18n roadmap?

---

## 8. PROMPT BUILD ĐẦU TIÊN (First Build Prompt)

Sau khi bạn xác nhận các vấn đề ở mục 7, chạy lệnh sau để bắt đầu **Phase 1**:

```bash
# 1. Tạo branch redesign
git checkout -b ui/redesign

# 2. Cài dependencies mới (nếu cần cho charts)
npm install recharts @radix-ui/react-tabs @radix-ui/react-avatar
# Hoặc chart.js + react-chartjs-2 tùy chọn lựa

# 3. Tạo cấu trúc components mới
mkdir -p src/components/ui/charts
mkdir -p src/components/app

# 4. Chạy lệnh kiểm tra baseline
npm run lint && npm run typecheck && npm test && npm run build

# 5. Bắt đầu implement Phase 1:
# - Avatar component
# - Tabs component  
# - Stepper component
# - FormWizard component
# - Calendar component
# - Chart components (Bar, Line, Pie, Heatmap)
# - Cải tiến: Tooltip, DropdownMenu, Select, DataTable, Pagination
# - EmptyState, LoadingState, ErrorState variants
# - AppShell: Command Palette (Cmd+K), Keyboard shortcuts
# - UserMenu dropdown

# 6. Commit theo convention
git add -A
git commit -m "feat(design-system): add avatar, tabs, stepper, form-wizard, calendar, charts
feat(ui): improve tooltip, dropdown-menu, select, data-table, pagination
feat(shell): add command palette, keyboard shortcuts, user-menu
chore: update states components with illustrations"
```

**Sau Phase 1 xong**: Chạy full test suite, deploy Vercel Preview, review visual → sang Phase 2.

---

## 9. CONVENTIONS TUÂN THỦ (Từ AGENTS.md)

- ✅ TypeScript strict, không `any` trừ khi ép kiểu có kiểm tra
- ✅ Validation mọi input ở biên (zod trong `src/lib/validation.ts`)
- ✅ Logging qua `src/server/logger.ts` (auto redact sensitive fields)
- ✅ Error handling: `{ error: { code, message } }` với mã ổn định
- ✅ UI: Mobile-first, text+icon cho mọi trạng thái, primary action rõ
- ✅ Icons: `Icon` (SVG), không unicode rời rạc
- ✅ DataTable + Pagination cho bảng
- ✅ Toast chỉ fire-and-forget, form giữ inline error+loading
- ✅ ConfirmDialog cho hành động nguy hiểm (có loading)
- ✅ E2E trên production build (`npm run build` → `next start -p 3100` → `npm run test:e2e`)
- ✅ Ngưỡng verify/liveness là config (`src/config`), không hardcode
- ✅ Secrets chỉ qua env, không commit `.env*`
- ✅ `FACE_PROVIDER` production fail closed
- ✅ Mock provider chỉ dev/test + UI gắn nhãn "DEMO"
- ✅ Role do server quản lý, không tin client
- ✅ Attendance event: server set timestamp + idempotency key
- ✅ Thao tác đặc quyền ghi audit log

---

## 10. DEFINITION OF DONE (Từng Phase)

- [ ] Acceptance criteria đạt
- [ ] Tests xanh trên CI (unit + integration + RLS nếu chạm DB)
- [ ] Không secret trong diff
- [ ] Docs cập nhật (`docs/AI_HANDOFF.md`, README nếu cần)
- [ ] Vercel Preview có link
- [ ] Visual regression baseline cập nhật
- [ ] Accessibility check pass

---

*Kết thúc kế hoạch. Sẵn sàng bắt đầu Phase 1 sau khi bạn xác nhận.*