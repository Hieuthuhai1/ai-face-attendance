-- Phase 13 · 0013 enrollment security: improve face_enrollments schema + RLS hardening
-- Thêm trạng thái failed/needs_review, lý do thất bại, timestamp, bảo vệ provider reference.

-- 1. Mở rộng status enum
alter table public.face_enrollments
  drop constraint face_enrollments_status_check;

alter table public.face_enrollments
  add constraint face_enrollments_status_check
  check (status in ('pending', 'active', 'rejected', 'revoked', 'failed', 'needs_review'));

-- 2. Thêm cột failed_reason, failed_at, disabled_at (alias cho revoked_at để rõ nghĩa)
alter table public.face_enrollments
  add column if not exists failed_reason text,
  add column if not exists failed_at timestamptz,
  add column if not exists disabled_at timestamptz;

-- 3. Migrate existing revoked_at -> disabled_at
update public.face_enrollments
set disabled_at = revoked_at
where revoked_at is not null and disabled_at is null;

-- 4. Unique constraint: 1 active enrollment per employee (already exists as partial index)
-- Đảm bảo chỉ có 1 enrollment ở trạng thái 'active' hoặc 'needs_review' per employee
create unique index if not exists face_enrollments_one_active_or_review
  on public.face_enrollments (employee_id)
  where status in ('active', 'needs_review');

-- 5. Index cho query theo status
create index if not exists face_enrollments_status_employee_idx
  on public.face_enrollments (employee_id, status);

-- 6. Trigger updated_at (đã có từ migration 0003)

-- 7. RLS: Cập nhật policy insert - không cho phép client set status = 'active' hay 'needs_review'
-- Policy face_insert hiện tại: with check (employee_id = public.my_employee_id() and status = 'pending')
-- Đã đúng - chỉ cho insert với status = 'pending'

-- 8. RLS: Policy update - nhân viên chỉ được revoke (chuyển sang 'revoked') hoặc xóa pending của mình
-- Policy face_update_own hiện tại: with check (employee_id = public.my_employee_id() and status in ('pending', 'revoked'))
-- Cần mở rộng: cho phép chuyển từ 'pending' -> 'revoked', từ 'active' -> 'revoked' (self-revoke)
-- Không cho phép tự set 'active', 'needs_review', 'failed'

drop policy if exists face_update_own on public.face_enrollments;
create policy face_update_own on public.face_enrollments for update to authenticated
  using (employee_id = public.my_employee_id())
  with check (
    employee_id = public.my_employee_id()
    and (
      -- Chỉ cho phép chuyển sang 'revoked' (tự thu hồi)
      status = 'revoked'
      or
      -- Hoặc xóa enrollment pending của mình (status vẫn 'pending')
      (status = 'pending' and (select status from public.face_enrollments where id = face_enrollments.id) = 'pending')
    )
  );

-- 9. Policy cho HR/admin: full access trong org (đã có face_write_hr)

-- 10. Function helper: get employee enrollment status (dùng cho UI)
create or replace function public.get_my_enrollment_status()
returns table (
  state text,
  provider_subject_id text,
  quality numeric,
  consent_version text,
  consent_at timestamptz,
  enrolled_at timestamptz,
  disabled_at timestamptz,
  failed_reason text,
  failed_at timestamptz
) language sql security definer set search_path = public as $$
  select
    fe.status as state,
    fe.provider_subject_id,
    fe.quality,
    fe.consent_version,
    fe.consent_at,
    fe.enrolled_at,
    fe.disabled_at,
    fe.failed_reason,
    fe.failed_at
  from public.face_enrollments fe
  join public.employees e on e.id = fe.employee_id
  where e.profile_id = auth.uid()
  order by fe.created_at desc
  limit 1;
$$;

grant execute on function public.get_my_enrollment_status() to authenticated;

-- 11. Function: HR approve enrollment (server-side, an toàn)
create or replace function public.hr_approve_enrollment(p_enrollment_id uuid, p_quality numeric default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_emp_id uuid;
  v_actor_id uuid;
begin
  -- Kiểm tra role HR/admin
  if public.my_role() not in ('hr_admin', 'system_admin') then
    raise exception 'FORBIDDEN: chỉ HR/admin được duyệt enrollment' using errcode = '42501';
  end if;

  -- Lấy enrollment
  select fe.organization_id, fe.employee_id, fe.provider_subject_id
  into v_org_id, v_emp_id, v_actor_id
  from public.face_enrollments fe
  where fe.id = p_enrollment_id;

  if not found then
    raise exception 'NOT_FOUND: enrollment không tồn tại' using errcode = 'P0001';
  end if;

  -- Kiểm tra org scope (HR chỉ duyệt trong org mình, system_admin được tất cả)
  if public.my_role() = 'hr_admin' and v_org_id <> public.my_org() then
    raise exception 'FORBIDDEN: HR chỉ duyệt enrollment trong org mình' using errcode = '42501';
  end if;

  -- Cập nhật enrollment
  update public.face_enrollments
  set
    status = 'active',
    quality = coalesce(p_quality, quality),
    verified_by = public.my_user_id(),
    enrolled_at = now(),
    updated_at = now()
  where id = p_enrollment_id;

  -- Ghi audit log
  insert into public.audit_logs (organization_id, actor_id, action, resource_type, resource_id, metadata)
  values (
    v_org_id, public.my_user_id(), 'enrollment.approved', 'face_enrollment', p_enrollment_id,
    jsonb_build_object('employee_id', v_emp_id, 'approved_by_role', public.my_role())
  );

  return true;
end $$;

grant execute on function public.hr_approve_enrollment(uuid, numeric) to authenticated;

-- 12. Function: HR reject enrollment
create or replace function public.hr_reject_enrollment(p_enrollment_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_emp_id uuid;
begin
  if public.my_role() not in ('hr_admin', 'system_admin') then
    raise exception 'FORBIDDEN: chỉ HR/admin được từ chối enrollment' using errcode = '42501';
  end if;

  select fe.organization_id, fe.employee_id
  into v_org_id, v_emp_id
  from public.face_enrollments fe
  where fe.id = p_enrollment_id;

  if not found then
    raise exception 'NOT_FOUND: enrollment không tồn tại' using errcode = 'P0001';
  end if;

  if public.my_role() = 'hr_admin' and v_org_id <> public.my_org() then
    raise exception 'FORBIDDEN: HR chỉ từ chối enrollment trong org mình' using errcode = '42501';
  end if;

  update public.face_enrollments
  set status = 'rejected', failed_reason = p_reason, failed_at = now(), updated_at = now()
  where id = p_enrollment_id;

  insert into public.audit_logs (organization_id, actor_id, action, resource_type, resource_id, metadata)
  values (
    v_org_id, public.my_user_id(), 'enrollment.rejected', 'face_enrollment', p_enrollment_id,
    jsonb_build_object('employee_id', v_emp_id, 'reason', p_reason, 'rejected_by_role', public.my_role())
  );

  return true;
end $$;

grant execute on function public.hr_reject_enrollment(uuid, text) to authenticated;

-- 13. Function: Employee revoke own enrollment
create or replace function public.revoke_my_enrollment()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_enrollment_id uuid;
  v_org_id uuid;
  v_emp_id uuid;
begin
  -- Tìm enrollment active/pending/needs_review của employee hiện tại
  select fe.id, fe.organization_id, fe.employee_id
  into v_enrollment_id, v_org_id, v_emp_id
  from public.face_enrollments fe
  join public.employees e on e.id = fe.employee_id
  where e.profile_id = auth.uid()
    and fe.status in ('active', 'pending', 'needs_review')
  order by fe.created_at desc
  limit 1;

  if not found then
    raise exception 'NOT_FOUND: không có enrollment để thu hồi' using errcode = 'P0001';
  end if;

  update public.face_enrollments
  set status = 'revoked', disabled_at = now(), updated_at = now()
  where id = v_enrollment_id;

  insert into public.audit_logs (organization_id, actor_id, action, resource_type, resource_id, metadata)
  values (
    v_org_id, auth.uid(), 'enrollment.revoked', 'face_enrollment', v_enrollment_id,
    jsonb_build_object('employee_id', v_emp_id, 'by', 'owner')
  );

  return true;
end $$;

grant execute on function public.revoke_my_enrollment() to authenticated;

-- 14. Function: Provider callback - mark enrollment failed (gọi từ server action sau provider error)
create or replace function public.mark_enrollment_failed(p_employee_id uuid, p_reason text, p_provider_subject_id text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_enrollment_id uuid;
begin
  -- Chỉ server (service_role) hoặc HR/admin được gọi
  if public.my_role() not in ('hr_admin', 'system_admin') and current_setting('role') <> 'service_role' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- Tìm enrollment pending của employee
  select fe.id, fe.organization_id
  into v_enrollment_id, v_org_id
  from public.face_enrollments fe
  where fe.employee_id = p_employee_id
    and fe.status = 'pending'
  order by fe.created_at desc
  limit 1;

  if not found then
    raise exception 'NOT_FOUND: không có enrollment pending' using errcode = 'P0001';
  end if;

  update public.face_enrollments
  set
    status = 'failed',
    failed_reason = p_reason,
    failed_at = now(),
    provider_subject_id = coalesce(p_provider_subject_id, provider_subject_id),
    updated_at = now()
  where id = v_enrollment_id;

  insert into public.audit_logs (organization_id, actor_id, action, resource_type, resource_id, metadata)
  values (
    v_org_id, public.my_user_id(), 'enrollment.failed', 'face_enrollment', v_enrollment_id,
    jsonb_build_object('employee_id', p_employee_id, 'reason', p_reason)
  );

  return true;
end $$;

grant execute on function public.mark_enrollment_failed(uuid, text, text) to authenticated, service_role;

-- 15. Function: Mark enrollment needs_review (quality issues)
create or replace function public.mark_enrollment_needs_review(p_employee_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_enrollment_id uuid;
begin
  if public.my_role() not in ('hr_admin', 'system_admin') and current_setting('role') <> 'service_role' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select fe.id, fe.organization_id
  into v_enrollment_id, v_org_id
  from public.face_enrollments fe
  where fe.employee_id = p_employee_id
    and fe.status = 'pending'
  order by fe.created_at desc
  limit 1;

  if not found then
    raise exception 'NOT_FOUND: không có enrollment pending' using errcode = 'P0001';
  end if;

  update public.face_enrollments
  set
    status = 'needs_review',
    failed_reason = p_reason,
    updated_at = now()
  where id = v_enrollment_id;

  insert into public.audit_logs (organization_id, actor_id, action, resource_type, resource_id, metadata)
  values (
    v_org_id, public.my_user_id(), 'enrollment.needs_review', 'face_enrollment', v_enrollment_id,
    jsonb_build_object('employee_id', p_employee_id, 'reason', p_reason)
  );

  return true;
end $$;

grant execute on function public.mark_enrollment_needs_review(uuid, text) to authenticated, service_role;