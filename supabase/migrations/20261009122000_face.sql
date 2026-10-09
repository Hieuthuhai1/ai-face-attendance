-- Phase 2 · 0003 face: face_enrollments.
-- CHỈ lưu provider subject reference + quality + consent. Không cột ảnh/template.

create table public.face_enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  provider text not null default 'mock',
  provider_subject_id text,
  quality numeric check (quality is null or (quality >= 0 and quality <= 1)),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected', 'revoked')),
  consent_version text,
  consent_at timestamptz,
  verified_by uuid references public.profiles (id) on delete set null,
  enrolled_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'active' or provider_subject_id is not null)
);

-- Mỗi nhân viên tối đa 1 enrollment active (partial unique).
create unique index face_enrollments_one_active
  on public.face_enrollments (employee_id) where status = 'active';
create index face_enrollments_status_idx on public.face_enrollments (organization_id, status);

create trigger face_enrollments_updated_at before update on public.face_enrollments
  for each row execute function public.set_updated_at();
