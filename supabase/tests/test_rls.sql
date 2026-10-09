-- Phase 2 · RLS tests (S-09/S-10 + role escalation + cross-org).
-- Chạy trên LOCAL sau `supabase db reset` (KHÔNG chạy lên cloud):
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/test_rls.sql
-- Mọi thao tác test nằm trong 1 transaction và ROLLBACK cuối file.
-- Assert fail → RAISE EXCEPTION, psql exit != 0.

begin;
set role authenticated;

-- Đóng vai user: mỗi test tự set JWT claims (auth.uid()/auth.role() đọc từ đây).
-- (Không dùng helper function để tránh cần CREATE ON SCHEMA public với role authenticated.)

-- ================= 1. anon (không JWT): không đọc được gì =================
do $$
declare n int;
begin
  perform set_config('request.jwt.claims', '', true);
  select count(*) into n from public.employees;
  if n <> 0 then raise exception 'FAIL anon đọc được employees (%)', n; end if;
  select count(*) into n from public.attendance_events;
  if n <> 0 then raise exception 'FAIL anon đọc được events (%)', n; end if;
  raise notice 'PASS anon blocked (0 rows)';
end $$;

-- ================= 2. Employee A: chỉ thấy của mình =================
do $$
declare n int; r record; denied boolean;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","aud":"authenticated"}', true);
  select count(*) into n from public.attendance_events
    where employee_id = 'e0000000-0000-0000-0000-000000000001';
  if n < 2 then raise exception 'FAIL A không thấy đủ events của mình (%)', n; end if;

  -- A/B isolation: A không thấy event của B.
  select count(*) into n from public.attendance_events
    where employee_id = 'e0000000-0000-0000-0000-000000000002';
  if n <> 0 then raise exception 'FAIL A đọc được event của B (%)', n; end if;

  -- A không đọc enrollment của B.
  select count(*) into n from public.face_enrollments
    where employee_id = 'e0000000-0000-0000-0000-000000000002';
  if n <> 0 then raise exception 'FAIL A đọc được enrollment của B'; end if;

  -- Browser tự insert success + giờ quá khứ → trigger ép giờ server + hạ pending_review.
  insert into public.attendance_events
    (organization_id, employee_id, event_type, occurred_at, status, method, idempotency_key)
  values ('11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000001',
          'check_in', '2020-01-01T00:00:00+07', 'success', 'face', 'evt_rls_test_0001')
  returning * into r;
  if r.status <> 'pending_review' then
    raise exception 'FAIL insert success không verification_ref vẫn success';
  end if;
  if r.occurred_at < now() - interval '5 minutes' then
    raise exception 'FAIL occurred_at client không bị ép về giờ server';
  end if;

  -- WITH CHECK cấm insert success trực tiếp: thử status success + verification_ref
  -- (qua được trigger nhưng vi phạm WITH CHECK) → phải bị từ chối.
  denied := false;
  begin
    insert into public.attendance_events
      (organization_id, employee_id, event_type, status, method, verification_ref, idempotency_key)
    values ('11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000001',
            'check_in', 'success', 'face', 'fake_ref', 'evt_rls_test_0002');
  exception when sqlstate '42501' then denied := true;
  end;
  if not denied then raise exception 'FAIL browser insert được event success'; end if;

  -- Duplicate idempotency key → unique violation.
  denied := false;
  begin
    insert into public.attendance_events
      (organization_id, employee_id, event_type, status, idempotency_key)
    values ('11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000001',
            'check_in', 'failed', 'evt_rls_test_0001');
  exception when sqlstate '23505' then denied := true;
  end;
  if not denied then raise exception 'FAIL trùng idempotency key vẫn insert được'; end if;

  -- Role escalation: A tự sửa role → trigger chặn.
  denied := false;
  begin
    update public.profiles set role = 'hr_admin'
      where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  exception when sqlstate '42501' then denied := true;
  end;
  if not denied then raise exception 'FAIL employee tự nâng role'; end if;

  -- Cross-org: A không thấy nhân viên org khác.
  select count(*) into n from public.employees
    where organization_id = '22222222-2222-2222-2222-222222222222';
  if n <> 0 then raise exception 'FAIL A đọc được dữ liệu org khác'; end if;

  raise notice 'PASS employee A isolation + hardening';
end $$;

-- ================= 3. Employee B: không thấy A =================
do $$
declare n int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","aud":"authenticated"}', true);
  select count(*) into n from public.attendance_events
    where employee_id = 'e0000000-0000-0000-0000-000000000001';
  if n <> 0 then raise exception 'FAIL B đọc được event của A (%)', n; end if;
  raise notice 'PASS employee B isolation';
end $$;

-- ================= 4. Manager: thấy team, không thấy face refs, duyệt được =================
do $$
declare n int; rows int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated","aud":"authenticated"}', true);
  -- Manager vẫn thấy enrollment revoked của chính mình, nhưng không thấy của team:
  -- assert dưới đếm dòng của NGƯỜI KHÁC.
  select count(*) into n from public.employees
    where manager_id = 'e0000000-0000-0000-0000-000000000003';
  if n < 2 then raise exception 'FAIL manager không thấy đủ team (%)', n; end if;

  select count(*) into n from public.attendance_events
    where employee_id in ('e0000000-0000-0000-0000-000000000001',
                          'e0000000-0000-0000-0000-000000000002');
  if n < 3 then raise exception 'FAIL manager không thấy event team (%)', n; end if;

  -- Manager không được đọc provider references của team (chỉ thấy dòng của chính mình).
  select count(*) into n from public.face_enrollments
    where employee_id <> public.my_employee_id();
  if n <> 0 then raise exception 'FAIL manager đọc được face_enrollments của team (%)', n; end if;

  -- Manager duyệt adjustment của team → tự đóng dấu reviewer.
  update public.attendance_adjustment_requests
    set status = 'approved', resolution_note = 'RLS test'
    where id = 'b0000000-0000-0000-0000-000000000001';
  get diagnostics rows = row_count;
  if rows <> 1 then raise exception 'FAIL manager không duyệt được adjustment team'; end if;

  raise notice 'PASS manager scope';
end $$;

-- ================= 5. HR: toàn org1, active enrollment, không chạm org2 =================
do $$
declare n int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated","aud":"authenticated"}', true);
  select count(*) into n from public.attendance_events
    where organization_id = '11111111-1111-1111-1111-111111111111';
  if n < 4 then raise exception 'FAIL HR không thấy đủ event org (%)', n; end if;

  update public.face_enrollments set status = 'active',
    provider_subject_id = 'mock_subject_NV002', quality = 0.85,
    verified_by = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
    where id = 'f0000000-0000-0000-0000-000000000002';
  select count(*) into n from public.face_enrollments where status = 'active';
  if n < 2 then raise exception 'FAIL HR không active được enrollment'; end if;

  select count(*) into n from public.employees
    where organization_id = '22222222-2222-2222-2222-222222222222';
  if n <> 0 then raise exception 'FAIL HR đọc được org khác'; end if;

  raise notice 'PASS hr_admin scope';
end $$;

-- ================= 6. System admin: đọc được org khác =================
do $$
declare n int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated","aud":"authenticated"}', true);
  select count(*) into n from public.employees
    where organization_id = '22222222-2222-2222-2222-222222222222';
  if n < 1 then raise exception 'FAIL sysadmin không đọc được org khác'; end if;
  raise notice 'PASS system_admin scope';
end $$;

-- ================= 7. Outsider org2: không thấy org1 =================
do $$
declare n int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"ffffffff-ffff-ffff-ffff-ffffffffffff","role":"authenticated","aud":"authenticated"}', true);
  select count(*) into n from public.attendance_events
    where organization_id = '11111111-1111-1111-1111-111111111111';
  if n <> 0 then raise exception 'FAIL outsider đọc được event org1'; end if;
  select count(*) into n from public.employees
    where organization_id = '11111111-1111-1111-1111-111111111111';
  if n <> 0 then raise exception 'FAIL outsider đọc được employees org1'; end if;
  raise notice 'PASS cross-org isolation';
end $$;

-- ================= 8. Enrollment lifecycle + audit (Phase 4) =================
do $$
declare denied boolean; v text;
begin
  -- B nộp thêm pending (chưa có active) → được.
  perform set_config('request.jwt.claims',
    '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","aud":"authenticated"}', true);
  insert into public.face_enrollments (organization_id, employee_id, provider, status, consent_version, consent_at)
  values ('11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000002',
          'mock', 'pending', 'v1', now());

  -- Employee tự insert thẳng active → WITH CHECK chặn.
  denied := false;
  begin
    insert into public.face_enrollments (organization_id, employee_id, provider, provider_subject_id, status)
    values ('11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000002',
            'mock', 'fake', 'active');
  exception when sqlstate '42501' then denied := true;
  end;
  if not denied then raise exception 'FAIL employee tự tạo enrollment active'; end if;

  -- B thu hồi pending của mình → được.
  update public.face_enrollments set status = 'revoked'
    where id = 'f0000000-0000-0000-0000-000000000002';
  select status into v from public.face_enrollments where id = 'f0000000-0000-0000-0000-000000000002';
  if v <> 'revoked' then raise exception 'FAIL employee không revoke được của mình'; end if;

  -- Manager sửa enrollment của team → RLS lọc, 0 dòng đổi (không raise, kiểm tra status).
  perform set_config('request.jwt.claims',
    '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated","aud":"authenticated"}', true);
  update public.face_enrollments set status = 'revoked'
    where id = 'f0000000-0000-0000-0000-000000000001';
  select status into v from public.face_enrollments where id = 'f0000000-0000-0000-0000-000000000001';
  if v <> 'active' then raise exception 'FAIL manager sửa được enrollment team'; end if;

  -- HR duyệt pending mới của B → active + đóng dấu verified_by.
  perform set_config('request.jwt.claims',
    '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated","aud":"authenticated"}', true);
  update public.face_enrollments set status = 'active', provider_subject_id = 'mock_subject_NV002', quality = 0.85
    where employee_id = 'e0000000-0000-0000-0000-000000000002' and status = 'pending'
    and id <> 'f0000000-0000-0000-0000-000000000002';
  select verified_by::text into v from public.face_enrollments
    where employee_id = 'e0000000-0000-0000-0000-000000000002' and status = 'active' limit 1;
  if v <> 'dddddddd-dddd-dddd-dddd-dddddddddddd' then
    raise exception 'FAIL thiếu dấu verified_by của HR (%)', v;
  end if;

  -- HR ghi audit → được; employee ghi audit cho chính mình → được; ghi hộ → bị chặn.
  insert into public.audit_logs (organization_id, actor_id, action, resource_type, resource_id)
  values ('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          'enrollment.approved', 'face_enrollment', 'test');
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","aud":"authenticated"}', true);
  insert into public.audit_logs (organization_id, actor_id, action, resource_type, resource_id)
  values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          'enrollment.submitted', 'face_enrollment', 'test');
  denied := false;
  begin
    insert into public.audit_logs (organization_id, actor_id, action, resource_type, resource_id)
    values ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            'enrollment.submitted', 'face_enrollment', 'test');
  exception when sqlstate '42501' then denied := true;
  end;
  if not denied then raise exception 'FAIL employee ghi audit hộ người khác'; end if;

  raise notice 'PASS enrollment lifecycle + audit';
end $$;

-- ================= 9. Attendance RPC (Phase 5) =================
do $$
declare denied boolean; v text; d date;
begin
  -- A ghi check-in qua RPC → được, occurred_at do server set, summary tạo kèm.
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","aud":"authenticated"}', true);
  perform public.record_attendance_event(
    'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
    'check_in', 'success', 'face', 'rpc_ref_1', 'pass', 0.95,
    'evt_rls_rpc_0001', null, current_date,
    '50000000-0000-0000-0000-000000000001', 0, 0);
  select status into v from public.attendance_daily_summaries
    where employee_id = 'e0000000-0000-0000-0000-000000000001' and work_date = current_date
    and shift_id = '50000000-0000-0000-0000-000000000001';
  if v not in ('incomplete', 'present', 'late') then
    raise exception 'FAIL summary không được tạo/cập nhật (%)', v;
  end if;

  -- A gọi RPC với employee của B → ownership chặn.
  denied := false;
  begin
    perform public.record_attendance_event(
      'e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002',
      'check_in', 'success', 'face', 'rpc_ref_x', 'pass', 0.95,
      'evt_rls_rpc_0002', null, current_date,
      '50000000-0000-0000-0000-000000000002', 0, 0);
  exception when sqlstate '42501' then denied := true;
  end;
  if not denied then raise exception 'FAIL RPC cho phép ghi hộ nhân viên khác'; end if;

  -- A dùng assignment của B → chặn.
  denied := false;
  begin
    perform public.record_attendance_event(
      'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
      'check_in', 'success', 'face', 'rpc_ref_y', 'pass', 0.95,
      'evt_rls_rpc_0003', null, current_date,
      '50000000-0000-0000-0000-000000000002', 0, 0);
  exception when sqlstate '42501' then denied := true;
  end;
  if not denied then raise exception 'FAIL RPC cho phép dùng phân ca người khác'; end if;

  -- Trùng idempotency key qua RPC → unique violation (client retry cùng key).
  denied := false;
  begin
    perform public.record_attendance_event(
      'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
      'check_in', 'failed', 'face', 'rpc_ref_z', 'fail', 0.2,
      'evt_rls_rpc_0001', null, current_date,
      '50000000-0000-0000-0000-000000000001', 0, 0);
  exception when sqlstate '23505' then denied := true;
  end;
  if not denied then raise exception 'FAIL RPC cho trùng idempotency key'; end if;

  raise notice 'PASS attendance rpc guards';
end $$;

reset role;
rollback;
