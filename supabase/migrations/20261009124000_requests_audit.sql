-- Phase 2 · 0005 requests & audit: adjustments, leave, audit_logs (append-only), app_settings.

create table public.attendance_adjustment_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  event_id uuid references public.attendance_events (id) on delete set null,
  work_date date not null,
  requested_in timestamptz,
  requested_out timestamptz,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewer_id uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index adjustments_emp_date_idx
  on public.attendance_adjustment_requests (employee_id, work_date desc);
create index adjustments_org_status_idx
  on public.attendance_adjustment_requests (organization_id, status);

-- Tự đóng dấu người duyệt + thời điểm khi đổi sang approved/rejected.
create or replace function public.stamp_reviewer()
returns trigger language plpgsql as $$
begin
  if new.status in ('approved', 'rejected') and old.status = 'pending' then
    new.reviewer_id := coalesce(new.reviewer_id, auth.uid());
    new.reviewed_at := coalesce(new.reviewed_at, now());
  end if;
  return new;
end $$;

create trigger adjustments_stamp_reviewer before update on public.attendance_adjustment_requests
  for each row execute function public.stamp_reviewer();

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewer_id uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create trigger leave_stamp_reviewer before update on public.leave_requests
  for each row execute function public.stamp_reviewer();

create trigger adjustments_updated_at before update on public.attendance_adjustment_requests
  for each row execute function public.set_updated_at();
create trigger leave_updated_at before update on public.leave_requests
  for each row execute function public.set_updated_at();

-- Audit log append-only: không có policy UPDATE/DELETE cho client roles (xem rls).
create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_logs_org_time_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id);

-- Settings theo organization; giá trị quan trọng validate server-side (Phase 4+).
create table public.app_settings (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key text not null,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (organization_id, key)
);

create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();
