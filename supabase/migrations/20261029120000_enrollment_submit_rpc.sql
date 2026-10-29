-- Phase 21 · 0018 enrollment submit RPC
--
-- Vì sao cần: policy `face_insert` chỉ cho phép insert với status = 'pending'
-- (xem 20261009125000_rls.sql), nhưng server action cũ insert thẳng
-- status = 'active' → mọi nhân viên (trừ HR) bị RLS chặn, không đăng ký được.
--
-- Cách sửa: đưa việc ghi enrollment vào SECURITY DEFINER function. Function tự
-- xác định employee qua auth.uid(), đọc chính sách của org
-- (`app_settings.face_verification.auto_approve_enrollment`) và quyết định
-- pending (chờ HR duyệt) hay active (tự kích hoạt).
--
-- Mặc định `auto_approve_enrollment = true` để nhân viên đăng ký xong dùng được
-- ngay; HR có thể tắt trong Cài đặt → Nhận diện khuôn mặt để buộc duyệt tay.

-- ---------------------------------------------------------------------------
-- Helper nội bộ: ghi enrollment. KHÔNG cấp quyền cho client.
-- ---------------------------------------------------------------------------
create or replace function public.face_enrollment_persist(
  p_employee_id uuid,
  p_organization_id uuid,
  p_actor_id uuid,
  p_provider text,
  p_provider_subject_id text,
  p_quality numeric,
  p_consent_version text,
  p_auto_approve boolean
)
returns table (enrollment_id uuid, enrollment_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := case when p_auto_approve then 'active' else 'pending' end;
  v_id uuid;
  v_old record;
begin
  if p_provider_subject_id is null or btrim(p_provider_subject_id) = '' then
    raise exception 'INVALID_SUBJECT' using errcode = '22023';
  end if;

  if p_consent_version is null or btrim(p_consent_version) = '' then
    raise exception 'CONSENT_REQUIRED' using errcode = '22023';
  end if;

  if p_quality is not null and (p_quality < 0 or p_quality > 1) then
    raise exception 'INVALID_QUALITY' using errcode = '22023';
  end if;

  -- Không cho đăng ký đè lên enrollment đang active.
  if exists (
    select 1
    from public.face_enrollments fe
    where fe.employee_id = p_employee_id
      and fe.status = 'active'
  ) then
    raise exception 'ALREADY_ACTIVE' using errcode = 'P0001';
  end if;

  -- Chỉ giữ 1 enrollment đang xử lý: các bản pending/needs_review cũ bị thay thế.
  for v_old in
    select fe.id
    from public.face_enrollments fe
    where fe.employee_id = p_employee_id
      and fe.status in ('pending', 'needs_review')
  loop
    update public.face_enrollments
       set status = 'revoked',
           disabled_at = now(),
           failed_reason = coalesce(failed_reason, 'superseded_by_new_submission'),
           updated_at = now()
     where id = v_old.id;
  end loop;

  insert into public.face_enrollments (
    organization_id,
    employee_id,
    provider,
    provider_subject_id,
    quality,
    status,
    consent_version,
    consent_at,
    enrolled_at
  ) values (
    p_organization_id,
    p_employee_id,
    coalesce(nullif(btrim(p_provider), ''), 'mock'),
    p_provider_subject_id,
    p_quality,
    v_status,
    p_consent_version,
    now(),
    case when v_status = 'active' then now() else null end
  )
  returning id into v_id;

  insert into public.audit_logs (
    organization_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    p_organization_id, p_actor_id, 'enrollment.submitted', 'face_enrollment', v_id,
    jsonb_build_object(
      'employee_id', p_employee_id,
      'quality', p_quality,
      'auto_approved', p_auto_approve
    )
  );

  return query select v_id, v_status;
end;
$$;

-- Chỉ 2 wrapper bên dưới được gọi helper này.
revoke all on function public.face_enrollment_persist(uuid, uuid, uuid, text, text, numeric, text, boolean)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Employee tự đăng ký.
-- ---------------------------------------------------------------------------
create or replace function public.submit_my_face_enrollment(
  p_provider text,
  p_provider_subject_id text,
  p_quality numeric,
  p_consent_version text
)
returns table (enrollment_id uuid, enrollment_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_emp_id uuid;
  v_org_id uuid;
  v_auto boolean := true;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  select e.id, e.organization_id
    into v_emp_id, v_org_id
  from public.employees e
  where e.profile_id = v_user
    and e.employment_status = 'active'
  order by e.created_at, e.id
  limit 1;

  if v_emp_id is null then
    raise exception 'NOT_ELIGIBLE' using errcode = 'P0001';
  end if;

  -- Chính sách org. Chỉ đọc giá trị boolean hợp lệ; thiếu/không hợp lệ → true.
  select case
           when jsonb_typeof(s.value -> 'auto_approve_enrollment') = 'boolean'
             then (s.value ->> 'auto_approve_enrollment')::boolean
           else true
         end
    into v_auto
  from public.app_settings s
  where s.organization_id = v_org_id
    and s.key = 'face_verification'
  limit 1;

  v_auto := coalesce(v_auto, true);

  return query
    select *
    from public.face_enrollment_persist(
      v_emp_id, v_org_id, v_user,
      p_provider, p_provider_subject_id, p_quality, p_consent_version,
      v_auto
    );
end;
$$;

grant execute on function public.submit_my_face_enrollment(text, text, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- HR/admin đăng ký hộ nhân viên (HR là người duyệt → active ngay).
-- ---------------------------------------------------------------------------
create or replace function public.hr_submit_face_enrollment(
  p_employee_id uuid,
  p_provider text,
  p_provider_subject_id text,
  p_quality numeric,
  p_consent_version text
)
returns table (enrollment_id uuid, enrollment_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_org_id uuid;
  v_emp_org uuid;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  if coalesce(public.my_role(), '') not in ('hr_admin', 'system_admin') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select e.organization_id
    into v_emp_org
  from public.employees e
  where e.id = p_employee_id
    and e.employment_status = 'active';

  if v_emp_org is null then
    raise exception 'NOT_ELIGIBLE' using errcode = 'P0001';
  end if;

  v_org_id := public.my_org();
  if public.my_role() = 'hr_admin'
     and (v_org_id is null or v_emp_org is distinct from v_org_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
    select *
    from public.face_enrollment_persist(
      p_employee_id, v_emp_org, v_actor,
      p_provider, p_provider_subject_id, p_quality, p_consent_version,
      true
    );
end;
$$;

grant execute on function public.hr_submit_face_enrollment(uuid, text, text, numeric, text)
  to authenticated;
