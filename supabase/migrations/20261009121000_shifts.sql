-- Phase 2 · 0002 shifts: work_shifts + shift_assignments (chống gán ca overlap).

create table public.work_shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  overnight boolean not null default false,
  grace_in_min integer not null default 5 check (grace_in_min >= 0),
  grace_out_min integer not null default 5 check (grace_out_min >= 0),
  rounding_min integer not null default 1 check (rounding_min >= 1),
  break_min integer not null default 0 check (break_min >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  check (start_time <> end_time)
);

create table public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  shift_id uuid not null references public.work_shifts (id) on delete restrict,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  -- Một nhân viên không có 2 phân ca giao nhau trong cùng khoảng ngày.
  exclude using gist (
    employee_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
  )
);
create index shift_assignments_emp_idx on public.shift_assignments (employee_id, effective_from);

create trigger work_shifts_updated_at before update on public.work_shifts
  for each row execute function public.set_updated_at();
create trigger shift_assignments_updated_at before update on public.shift_assignments
  for each row execute function public.set_updated_at();
