-- Phase 9 · 0014 self enrollment: user đăng nhập (kể cả Google) chưa có employee
-- được tự tạo hồ sơ khi nộp enrollment. HR vẫn giữ cửa duyệt active + gán ca.
-- Đồng thời bịt: employee không được tự đổi organization_id (như role).

create or replace function public.enforce_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor_role text;
begin
  if old.role = new.role
     and (old.organization_id = new.organization_id
          or (old.organization_id is null and new.organization_id is null)) then
    return new;
  end if;
  -- Cờ nội bộ cho ensure_self_employee (GUC transaction-local, user API không
  -- có SQL trực tiếp nên không tự set được). Không dùng current_user ở đây vì
  -- function này là SECURITY DEFINER (current_user luôn là owner).
  if current_setting('app.allow_org_assign', true) = 'on' then
    return new;
  end if;
  if coalesce(auth.role(), 'postgres') in ('service_role', 'postgres') then
    return new;
  end if;
  select role into actor_role from public.profiles where id = auth.uid();
  if actor_role in ('hr_admin', 'system_admin') then
    return new;
  end if;
  raise exception 'FORBIDDEN_ROLE_CHANGE' using errcode = '42501';
end $$;

-- Tự tạo employee cho chính caller (idempotent theo user). Org mặc định =
-- organization active đầu tiên (giả định MVP một công ty; đa org cần gán tay).
create or replace function public.ensure_self_employee()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_emp uuid;
  v_code text;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  select organization_id into v_org from public.profiles where id = v_user;
  if v_org is null then
    select id into v_org from public.organizations
      where is_active order by created_at, id limit 1;
    if v_org is null then
      raise exception 'NO_ORGANIZATION' using errcode = 'P0001';
    end if;
    begin
      perform set_config('app.allow_org_assign', 'on', true);
      update public.profiles set organization_id = v_org where id = v_user;
      perform set_config('app.allow_org_assign', 'off', true);
    exception when others then
      perform set_config('app.allow_org_assign', 'off', true);
      raise;
    end;
  end if;

  select id into v_emp from public.employees
    where profile_id = v_user and organization_id = v_org;
  if v_emp is not null then
    return v_emp;
  end if;

  v_code := 'G-' || upper(substr(md5(v_user::text), 1, 8));
  insert into public.employees
    (organization_id, profile_id, employee_code, title, employment_status)
  values (v_org, v_user, v_code, 'Tu dang ky (Google)', 'active')
  on conflict do nothing;
  select id into v_emp from public.employees
    where profile_id = v_user and organization_id = v_org;
  if v_emp is null then
    raise exception 'SELF_ENROLL_FAILED' using errcode = 'P0001';
  end if;
  return v_emp;
end $$;

grant execute on function public.ensure_self_employee() to authenticated;
