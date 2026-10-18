-- Phase 2 · 0006 settings & holidays: structured settings, holidays, role audit trail.

-- Bảng holidays: ngày lễ/nghỉ theo tổ chức.
create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  date date not null,
  is_recurring boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name, date)
);
create index holidays_org_date_idx on public.holidays (organization_id, date);

-- Trigger updated_at cho holidays.
create trigger holidays_updated_at before update on public.holidays
  for each row execute function public.set_updated_at();

-- Mở rộng app_settings với các key chuẩn hóa (validate server-side).
-- Các key dự kiến:
--  attendance_policies: { grace_in_min, grace_out_min, rounding_min, late_threshold_min, early_leave_threshold_min, overtime_requires_approval, max_overtime_hours_per_month, check_in_methods }
--  face_verification: { threshold, review_band_low, provider_timeout_ms }
--  session: { access_token_ttl_min, refresh_token_ttl_days }
--  security: { password_min_length, require_2fa, session_timeout_min }
--  notifications: { email_enabled, push_enabled, reminder_before_shift_min }

-- RLS cho holidays.
alter table public.holidays enable row level security;

-- HR/Admin xem/sửa holidays của org mình.
create policy "holidays_hr_admin_select" on public.holidays
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and organization_id = holidays.organization_id
      and role in ('hr_admin', 'system_admin')
    )
  );

create policy "holidays_hr_admin_insert" on public.holidays
  for insert with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and organization_id = holidays.organization_id
      and role in ('hr_admin', 'system_admin')
    )
  );

create policy "holidays_hr_admin_update" on public.holidays
  for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and organization_id = holidays.organization_id
      and role in ('hr_admin', 'system_admin')
    )
  );

create policy "holidays_hr_admin_delete" on public.holidays
  for delete using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and organization_id = holidays.organization_id
      and role in ('hr_admin', 'system_admin')
    )
  );

-- Manager xem holidays của org (để xem lịch team).
create policy "holidays_manager_select" on public.holidays
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and organization_id = holidays.organization_id
      and role = 'manager'
    )
  );

-- Employee xem holidays của org (để xem lịch nghỉ).
create policy "holidays_employee_select" on public.holidays
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and organization_id = holidays.organization_id
    )
  );

-- RLS cho app_settings (chỉ HR/Admin được ghi, mọi role trong org đọc được).
alter table public.app_settings enable row level security;

create policy "app_settings_org_select" on public.app_settings
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and organization_id = app_settings.organization_id
    )
  );

create policy "app_settings_hr_admin_upsert" on public.app_settings
  for insert with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and organization_id = app_settings.organization_id
      and role in ('hr_admin', 'system_admin')
    )
  );

create policy "app_settings_hr_admin_update" on public.app_settings
  for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and organization_id = app_settings.organization_id
      and role in ('hr_admin', 'system_admin')
    )
  );

-- Function validate attendance_policies JSON.
create or replace function public.validate_attendance_policies(p_value jsonb)
returns void language plpgsql as $$
declare
  v_grace_in int;
  v_grace_out int;
  v_rounding int;
  v_late_thresh int;
  v_early_thresh int;
  v_max_ot int;
  v_methods text[];
begin
  -- Kiểm tra các field bắt buộc và kiểu dữ liệu.
  if p_value ? 'grace_in_min' then
    v_grace_in := (p_value->>'grace_in_min')::int;
    if v_grace_in < 0 or v_grace_in > 120 then
      raise exception 'grace_in_min phải trong [0, 120]' using errcode = '23514';
    end if;
  end if;
  if p_value ? 'grace_out_min' then
    v_grace_out := (p_value->>'grace_out_min')::int;
    if v_grace_out < 0 or v_grace_out > 120 then
      raise exception 'grace_out_min phải trong [0, 120]' using errcode = '23514';
    end if;
  end if;
  if p_value ? 'rounding_min' then
    v_rounding := (p_value->>'rounding_min')::int;
    if v_rounding < 1 or v_rounding > 60 then
      raise exception 'rounding_min phải trong [1, 60]' using errcode = '23514';
    end if;
  end if;
  if p_value ? 'late_threshold_min' then
    v_late_thresh := (p_value->>'late_threshold_min')::int;
    if v_late_thresh < 0 or v_late_thresh > 480 then
      raise exception 'late_threshold_min phải trong [0, 480]' using errcode = '23514';
    end if;
  end if;
  if p_value ? 'early_leave_threshold_min' then
    v_early_thresh := (p_value->>'early_leave_threshold_min')::int;
    if v_early_thresh < 0 or v_early_thresh > 480 then
      raise exception 'early_leave_threshold_min phải trong [0, 480]' using errcode = '23514';
    end if;
  end if;
  if p_value ? 'max_overtime_hours_per_month' then
    v_max_ot := (p_value->>'max_overtime_hours_per_month')::int;
    if v_max_ot < 0 or v_max_ot > 200 then
      raise exception 'max_overtime_hours_per_month phải trong [0, 200]' using errcode = '23514';
    end if;
  end if;
  if p_value ? 'check_in_methods' then
    v_methods := ARRAY(SELECT jsonb_array_elements_text(p_value->'check_in_methods'));
    if not (v_methods <@ ARRAY['face', 'pin_fallback', 'manual']) then
      raise exception 'check_in_methods chỉ chấp nhận face, pin_fallback, manual' using errcode = '23514';
    end if;
  end if;
end $$;

-- Trigger validate cho app_settings key attendance_policies.
create or replace function public.validate_app_settings_attendance_policies()
returns trigger language plpgsql as $$
begin
  if new.key = 'attendance_policies' then
    perform public.validate_attendance_policies(new.value);
  end if;
  return new;
end $$;

create trigger app_settings_validate_attendance_policies
  before insert or update on public.app_settings
  for each row when (new.key = 'attendance_policies')
  execute function public.validate_app_settings_attendance_policies();

-- Audit trail cho settings changes (ghi tự động qua trigger app_settings_updated_at + app_settings_hr_admin_upsert).
-- Không cần trigger riêng vì đã có audit_logs và trigger updated_at.
-- Khi HR/Admin update settings, họ phải tự ghi audit_logs qua server action.

-- Function lấy settings với default an toàn.
create or replace function public.get_attendance_policies(p_org_id uuid)
returns jsonb language sql stable as $$
  select coalesce(value, '{}'::jsonb) from public.app_settings
  where organization_id = p_org_id and key = 'attendance_policies';
$$;

create or replace function public.get_face_verification_config(p_org_id uuid)
returns jsonb language sql stable as $$
  select coalesce(value, '{}'::jsonb) from public.app_settings
  where organization_id = p_org_id and key = 'face_verification';
$$;

-- View holidays với thông tin tổ chức.
create or replace view public.holidays_with_org as
select h.*, o.name as organization_name
from public.holidays h
join public.organizations o on o.id = h.organization_id;

-- Function kiểm tra ngày có phải holiday không.
create or replace function public.is_holiday(p_org_id uuid, p_date date)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.holidays
    where organization_id = p_org_id
    and date = p_date
  );
$$;