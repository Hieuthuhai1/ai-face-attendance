-- Local face matcher: descriptor storage for FACE_PROVIDER=local.
-- CHỈ server (service role) được đọc/ghi. Không expose descriptor/template cho
-- client, API response hay log. Bảng này KHÔNG có policy cho anon/authenticated.

create table if not exists public.face_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  provider text not null default 'local',
  provider_subject_id text not null unique,
  model_version text not null,
  -- 128 số thực (face-api descriptor). Không phải ảnh.
  descriptor jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists face_templates_employee_idx
  on public.face_templates (employee_id);
create index if not exists face_templates_org_idx
  on public.face_templates (organization_id);

drop trigger if exists face_templates_updated_at on public.face_templates;
create trigger face_templates_updated_at before update on public.face_templates
  for each row execute function public.set_updated_at();

-- Deny by default: RLS bật nhưng KHÔNG tạo policy.
alter table public.face_templates enable row level security;
alter table public.face_templates force row level security;

-- Supabase cấp quyền mặc định cho anon/authenticated trên bảng mới trong public.
-- Thu hồi toàn bộ; chỉ service_role (server) được truy cập.
revoke all on public.face_templates from anon, authenticated;
grant all on public.face_templates to service_role;
