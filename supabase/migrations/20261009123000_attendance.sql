-- Phase 2 · 0004 attendance: events (server timestamp + idempotency) và daily summaries.

create table public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  shift_assignment_id uuid references public.shift_assignments (id) on delete set null,
  event_type text not null check (event_type in ('check_in', 'check_out')),
  -- Giờ chuẩn do server set (trigger). Client gửi giờ bị bỏ qua.
  occurred_at timestamptz not null default now(),
  status text not null default 'success'
    check (status in ('success', 'pending_review', 'failed', 'fallback')),
  method text not null default 'face'
    check (method in ('face', 'pin_fallback', 'manual')),
  verification_ref text,
  liveness_status text check (liveness_status in ('pass', 'fail', 'unknown')),
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  idempotency_key text not null unique,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index attendance_events_emp_time_idx
  on public.attendance_events (employee_id, occurred_at desc);
create index attendance_events_org_time_idx
  on public.attendance_events (organization_id, occurred_at desc);

-- Harden biên insert: browser (JWT authenticated) không được tự ấn định giờ,
-- không tự tạo event face-success khi thiếu verification_ref.
create or replace function public.harden_attendance_event()
returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(), 'postgres') not in ('service_role', 'postgres') then
    new.occurred_at := now();
    new.created_by := auth.uid();
    if new.method = 'face' and new.status = 'success' and new.verification_ref is null then
      new.status := 'pending_review';
    end if;
  end if;
  return new;
end $$;

create trigger attendance_events_harden before insert on public.attendance_events
  for each row execute function public.harden_attendance_event();

-- Tổng hợp ngày: tái tính được từ events, không phải source of truth duy nhất.
create table public.attendance_daily_summaries (
  employee_id uuid not null references public.employees (id) on delete cascade,
  work_date date not null,
  shift_id uuid references public.work_shifts (id) on delete set null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  first_in timestamptz,
  last_out timestamptz,
  late_min integer not null default 0 check (late_min >= 0),
  early_leave_min integer not null default 0 check (early_leave_min >= 0),
  total_work_min integer not null default 0 check (total_work_min >= 0),
  overtime_min integer not null default 0 check (overtime_min >= 0),
  status text not null default 'incomplete'
    check (status in ('present', 'late', 'early_leave', 'absent', 'incomplete')),
  computed_at timestamptz not null default now(),
  primary key (employee_id, work_date, shift_id)
);
create index attendance_summaries_org_date_idx
  on public.attendance_daily_summaries (organization_id, work_date desc);
