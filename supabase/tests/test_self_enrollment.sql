-- Self enrollment (migration 0014): auto-provision employee + chặn tự đổi org.
-- Chạy trên LOCAL sau `supabase db reset`:
--   docker exec -i supabase_db_timekeeping psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/test_self_enrollment.sql
-- Tự ROLLBACK cuối file.
begin;

-- Insert auth user as postgres (authenticated role không có quyền insert auth.users).
insert into auth.users
  (id, instance_id, aud, role, email, email_change, phone_change,
   raw_app_meta_data, raw_user_meta_data, encrypted_password,
   email_confirmed_at, confirmation_token, recovery_token,
   email_change_token_current, email_change_token_new,
   phone_change_token, reauthentication_token, created_at, updated_at)
values (
  '77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'tu.dang.ky@gmail.com', '', '',
  '{"provider": "google"}', '{"full_name": "Tu Dang Ky"}', '',
  now(), '', '', '', '', '', '', now(), now()
);

set role authenticated;

do $$
declare eid uuid; code text; org uuid; denied boolean;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated","aud":"authenticated"}', true);

  -- Lần 1: tự tạo employee ở org Demo + gán org cho profile.
  eid := public.ensure_self_employee();
  select employee_code, organization_id into code, org from public.employees where id = eid;
  if code is null or code not like 'G-%' then
    raise exception 'FAIL mã employee tự sinh (%)', code;
  end if;
  if org <> '11111111-1111-1111-1111-111111111111' then
    raise exception 'FAIL org mặc định không phải Demo (%)', org;
  end if;

  -- Lần 2: idempotent, trả đúng id cũ.
  if public.ensure_self_employee() <> eid then
    raise exception 'FAIL ensure_self_employee không idempotent';
  end if;

  -- Employee tự đổi org của mình → bị chặn (mở rộng của role guard).
  denied := false;
  begin
    update public.profiles set organization_id = '22222222-2222-2222-2222-222222222222'
      where id = '77777777-7777-7777-7777-777777777777';
  exception when sqlstate '42501' then denied := true;
  end;
  if not denied then raise exception 'FAIL employee tự đổi organization'; end if;

  -- HR đổi org cho người khác → được.
  perform set_config('request.jwt.claims',
    '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated","aud":"authenticated"}', true);
  update public.profiles set organization_id = '11111111-1111-1111-1111-111111111111'
    where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

  raise notice 'PASS self enrollment + org guard';
end $$;

-- Anon gọi RPC → 42501.
do $$
declare denied boolean := false;
begin
  perform set_config('request.jwt.claims', '', true);
  begin
    perform public.ensure_self_employee();
  exception when sqlstate '42501' then denied := true;
  end;
  if not denied then raise exception 'FAIL anon gọi được ensure_self_employee'; end if;
  raise notice 'PASS ensure_self_employee anon blocked';
end $$;

reset role;
rollback;
