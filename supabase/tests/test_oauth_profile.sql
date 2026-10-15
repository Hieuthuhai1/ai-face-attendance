-- OAuth profile mapping (migration 0013): Google-style metadata → display_name.
-- Chạy trên LOCAL sau `supabase db reset`:
--   docker exec -i supabase_db_timekeeping psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/test_oauth_profile.sql
-- Tự ROLLBACK cuối file.
begin;

-- Giả lập user Google: metadata full_name/name, đã confirm email.
insert into auth.users
  (id, instance_id, aud, role, email, email_change, phone_change,
   raw_app_meta_data, raw_user_meta_data, encrypted_password,
   email_confirmed_at, confirmation_token, recovery_token,
   email_change_token_current, email_change_token_new,
   phone_change_token, reauthentication_token, created_at, updated_at)
values (
  '99999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'o.test@gmail.com', '', '',
  '{"provider": "google"}', '{"full_name": "O Test", "name": "O Test", "email": "o.test@gmail.com"}',
  '', now(), '', '', '', '', '', '', now(), now()
);

do $$
declare v text;
begin
  select display_name into v from public.profiles where id = '99999999-9999-9999-9999-999999999999';
  if v <> 'O Test' then
    raise exception 'FAIL oauth display_name từ full_name (%)', v;
  end if;
  raise notice 'PASS oauth profile mapping (full_name)';
end $$;

-- Email-style metadata cũ vẫn hoạt động.
insert into auth.users
  (id, instance_id, aud, role, email, email_change, phone_change,
   raw_app_meta_data, raw_user_meta_data, encrypted_password,
   email_confirmed_at, confirmation_token, recovery_token,
   email_change_token_current, email_change_token_new,
   phone_change_token, reauthentication_token, created_at, updated_at)
values (
  '88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'e.test@demo.vn', '', '',
  '{}', '{"display_name": "E Test"}',
  crypt('Passw0rd!', gen_salt('bf')), now(), '', '', '', '', '', '', now(), now()
);

do $$
declare v text;
begin
  select display_name into v from public.profiles where id = '88888888-8888-8888-8888-888888888888';
  if v <> 'E Test' then
    raise exception 'FAIL email display_name regression (%)', v;
  end if;
  raise notice 'PASS email profile mapping (regression)';
end $$;

rollback;
