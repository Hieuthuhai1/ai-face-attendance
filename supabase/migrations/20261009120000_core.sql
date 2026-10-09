-- Phase 2 · 0001 core: extensions, organizations, profiles, departments, employees.
-- Roles (đặc tả §3): employee, manager, hr_admin, system_admin.

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- Bảng organizations: đa tổ chức từ đầu (mặc định timezone Asia/Ho_Chi_Minh).
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- profiles gắn 1:1 với auth.users; role do server quản lý (client không tự nâng).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'employee'
    check (role in ('employee', 'manager', 'hr_admin', 'system_admin')),
  organization_id uuid references public.organizations (id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_org_idx on public.profiles (organization_id);
create index profiles_role_idx on public.profiles (role);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  manager_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid unique references public.profiles (id) on delete set null,
  employee_code text not null,
  department_id uuid references public.departments (id) on delete set null,
  manager_id uuid references public.employees (id) on delete set null,
  title text not null default '',
  employment_status text not null default 'active'
    check (employment_status in ('active', 'inactive', 'terminated')),
  hired_at date,
  terminated_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_code),
  check (terminated_at is null or hired_at is null or terminated_at >= hired_at)
);
create index employees_org_idx on public.employees (organization_id);
create index employees_profile_idx on public.employees (profile_id);
create index employees_manager_idx on public.employees (manager_id);

-- Tự cập nhật updated_at.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger departments_updated_at before update on public.departments
  for each row execute function public.set_updated_at();
create trigger employees_updated_at before update on public.employees
  for each row execute function public.set_updated_at();

-- Helpers đọc role/org của caller (SECURITY DEFINER, dùng trong RLS).
create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.my_org()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.my_employee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.employees where profile_id = auth.uid();
$$;

-- Chặn tự nâng role: chỉ hr_admin/system_admin (hoặc service_role/seed) được đổi role.
create or replace function public.enforce_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor_role text;
begin
  if old.role = new.role then
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

create trigger profiles_role_guard before update on public.profiles
  for each row execute function public.enforce_role_change();

-- Tự tạo profile employee khi có auth.users mới (role mặc định employee).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'display_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
