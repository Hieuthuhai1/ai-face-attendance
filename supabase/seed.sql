-- Phase 2 · seed.sql: dữ liệu giả, idempotent, KHÔNG biometrics thật.
-- Chạy bằng `supabase db reset` (local). Mọi id đều cố định để tests tham chiếu.

-- ============ organizations ============
insert into public.organizations (id, name, timezone) values
  ('11111111-1111-1111-1111-111111111111', 'Cong ty Demo', 'Asia/Ho_Chi_Minh'),
  ('22222222-2222-2222-2222-222222222222', 'Org Khac', 'Asia/Ho_Chi_Minh')
on conflict (id) do update set name = excluded.name, timezone = excluded.timezone;

-- ============ auth.users (trigger handle_new_user tự tạo profiles employee) ============
-- instance_id bắt buộc = instance local (zero UUID; auth.instances để trống ở local).
-- Thiếu cột này → GoTrue không tìm thấy user → "Invalid login credentials".
insert into auth.users (id, instance_id, aud, role, email, email_change, phone_change, raw_app_meta_data, raw_user_meta_data, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change_token_current, email_change_token_new, phone_change_token, reauthentication_token, created_at, updated_at) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nv.a@demo.vn', '', '', '{}', '{}', crypt('Passw0rd!', gen_salt('bf')), now(), '', '', '', '', '', '', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nv.b@demo.vn', '', '', '{}', '{}', crypt('Passw0rd!', gen_salt('bf')), now(), '', '', '', '', '', '', now(), now()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'quan.ly@demo.vn', '', '', '{}', '{}', crypt('Passw0rd!', gen_salt('bf')), now(), '', '', '', '', '', '', now(), now()),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hr@demo.vn', '', '', '{}', '{}', crypt('Passw0rd!', gen_salt('bf')), now(), '', '', '', '', '', '', now(), now()),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@demo.vn', '', '', '{}', '{}', crypt('Passw0rd!', gen_salt('bf')), now(), '', '', '', '', '', '', now(), now()),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ngoai@khac.vn', '', '', '{}', '{}', crypt('Passw0rd!', gen_salt('bf')), now(), '', '', '', '', '', '', now(), now())
on conflict (id) do nothing;

-- Gán role + organization (service_role/postgres bypass RLS; trigger cho phép).
update public.profiles set display_name = 'Nhan vien A', role = 'employee',
  organization_id = '11111111-1111-1111-1111-111111111111'
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
update public.profiles set display_name = 'Nhan vien B', role = 'employee',
  organization_id = '11111111-1111-1111-1111-111111111111'
  where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
update public.profiles set display_name = 'Quan ly X', role = 'manager',
  organization_id = '11111111-1111-1111-1111-111111111111'
  where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
update public.profiles set display_name = 'Nhan su HR', role = 'hr_admin',
  organization_id = '11111111-1111-1111-1111-111111111111'
  where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
update public.profiles set display_name = 'Sys Admin', role = 'system_admin',
  organization_id = '11111111-1111-1111-1111-111111111111'
  where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
update public.profiles set display_name = 'Nguoi ngoai', role = 'employee',
  organization_id = '22222222-2222-2222-2222-222222222222'
  where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

-- ============ departments ============
insert into public.departments (id, organization_id, name, manager_id) values
  ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Kinh doanh', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  ('d0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Ky thuat', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  ('d0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Phong ngoai', null)
on conflict (id) do update set name = excluded.name, manager_id = excluded.manager_id;

-- ============ employees (A/B khác dept, cùng manager X) ============
insert into public.employees (id, organization_id, profile_id, employee_code, department_id, manager_id, title) values
  ('e0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'QL001', 'd0000000-0000-0000-0000-000000000001', null, 'Truong phong'),
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'NV001', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'Nhan vien'),
  ('e0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'NV002', 'd0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'Nhan vien'),
  ('e0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'HR001', 'd0000000-0000-0000-0000-000000000001', null, 'Chuyen vien HR'),
  ('e0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'AD001', 'd0000000-0000-0000-0000-000000000001', null, 'System Admin'),
  ('e0000000-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'NV999', 'd0000000-0000-0000-0000-000000000003', null, 'Nhan vien ngoai')
on conflict (id) do update set employee_code = excluded.employee_code,
  department_id = excluded.department_id, manager_id = excluded.manager_id, title = excluded.title;

-- ============ work_shifts (ngày / đêm qua ngày / chiều) ============
insert into public.work_shifts (id, organization_id, name, start_time, end_time, overnight, grace_in_min, grace_out_min) values
  ('50000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Ca hanh chinh', '08:00', '17:00', false, 5, 5),
  ('50000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Ca dem', '22:00', '06:00', true, 10, 10),
  ('50000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Ca chieu', '13:00', '21:00', false, 5, 5)
on conflict (id) do update set start_time = excluded.start_time, end_time = excluded.end_time,
  overnight = excluded.overnight;

-- ============ shift_assignments ============
insert into public.shift_assignments (id, organization_id, employee_id, shift_id, effective_from, effective_to) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '2026-01-01', null),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '2026-01-01', null)
on conflict (id) do update set shift_id = excluded.shift_id, effective_from = excluded.effective_from;

-- ============ face_enrollments (A active, B pending, manager revoked) ============
insert into public.face_enrollments (id, organization_id, employee_id, provider, provider_subject_id, quality, status, consent_version, consent_at, verified_by, enrolled_at) values
  ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000001', 'mock', 'mock_subject_NV001', 0.9, 'active', 'v1', '2026-10-01T08:00:00+07', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-10-01T08:05:00+07'),
  ('f0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000002', 'mock', null, null, 'pending', 'v1', '2026-10-08T09:00:00+07', null, null)
on conflict (id) do update set status = excluded.status, provider_subject_id = excluded.provider_subject_id,
  quality = excluded.quality, verified_by = excluded.verified_by;
insert into public.face_enrollments (id, organization_id, employee_id, provider, status, consent_version, consent_at, revoked_at) values
  ('f0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000003', 'mock', 'revoked', 'v1', '2026-09-01T08:00:00+07', '2026-10-01T08:00:00+07')
on conflict (id) do update set status = excluded.status, revoked_at = excluded.revoked_at;

-- ============ attendance_events (seed chạy as postgres → giữ occurred_at cố định) ============
insert into public.attendance_events (id, organization_id, employee_id, shift_assignment_id, event_type, occurred_at, status, method, verification_ref, liveness_status, confidence, idempotency_key, created_by) values
  ('90000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'check_in', '2026-10-09T07:58:00+07', 'success', 'face', 'seed_ref_in_1', 'pass', 0.95, 'evt_90000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('90000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'check_out', '2026-10-09T17:02:00+07', 'success', 'face', 'seed_ref_out_1', 'pass', 0.93, 'evt_90000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('90000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'check_in', '2026-10-08T22:05:00+07', 'success', 'face', 'seed_ref_in_2', 'pass', 0.88, 'evt_90000000-0000-0000-0000-000000000003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('90000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'check_in', '2026-10-09T08:10:00+07', 'failed', 'face', 'seed_ref_fail_1', 'fail', 0.4, 'evt_90000000-0000-0000-0000-000000000004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('90000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'check_in', '2026-10-08T08:01:00+07', 'pending_review', 'face', 'seed_ref_review_1', 'unknown', 0.65, 'evt_90000000-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
on conflict (id) do nothing;

-- ============ attendance_daily_summaries ============
insert into public.attendance_daily_summaries (employee_id, work_date, shift_id, organization_id, first_in, last_out, late_min, total_work_min, status) values
  ('e0000000-0000-0000-0000-000000000001', '2026-10-09', '50000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2026-10-09T07:58:00+07', '2026-10-09T17:02:00+07', 0, 544, 'present')
on conflict (employee_id, work_date, shift_id) do update set status = excluded.status,
  first_in = excluded.first_in, last_out = excluded.last_out;

-- ============ adjustments (pending / approved / rejected) ============
insert into public.attendance_adjustment_requests (id, organization_id, employee_id, work_date, requested_in, reason, status, reviewer_id, reviewed_at, resolution_note) values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000001', '2026-10-08', '2026-10-08T08:00:00+07', 'Quen check-out, nho quan ly xac nhan', 'pending', null, null, null),
  ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000002', '2026-10-07', '2026-10-07T22:00:00+07', 'Camera loi, dung PIN thay the', 'approved', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-10-08T09:00:00+07', 'Da xac minh voi bao ve ca dem'),
  ('b0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000001', '2026-10-06', '2026-10-06T07:30:00+07', 'Bao den muon do ket xe', 'rejected', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-10-07T09:00:00+07', 'Khong co minh chung')
on conflict (id) do update set status = excluded.status, reviewer_id = excluded.reviewer_id,
  reviewed_at = excluded.reviewed_at, resolution_note = excluded.resolution_note;

-- ============ leave_requests ============
insert into public.leave_requests (id, organization_id, employee_id, leave_type, start_date, end_date, reason, status) values
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000002', 'annual', '2026-10-15', '2026-10-16', 'Viec gia dinh', 'pending')
on conflict (id) do update set status = excluded.status;

-- ============ audit_logs ============
insert into public.audit_logs (organization_id, actor_id, action, resource_type, resource_id, metadata) values
  ('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'enrollment.approved', 'face_enrollment', 'f0000000-0000-0000-0000-000000000001', '{"employee_code": "NV001"}'),
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'adjustment.approved', 'adjustment_request', 'b0000000-0000-0000-0000-000000000002', '{"employee_code": "NV002"}');

-- ============ app_settings ============
insert into public.app_settings (organization_id, key, value) values
  ('11111111-1111-1111-1111-111111111111', 'attendance_rules', '{"overtime_requires_approval": true, "duplicate_window_seconds": 60}')
on conflict (organization_id, key) do update set value = excluded.value;
