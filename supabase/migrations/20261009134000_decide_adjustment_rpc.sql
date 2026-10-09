-- Phase 7 · 0011 decide_adjustment_request: duyệt/từ chối điều chỉnh công.
-- Idempotent (đã quyết → ALREADY_DECIDED), kiểm tra quyền reviewer trong function,
-- approved → áp requested_in/out vào summaries (events gốc giữ nguyên),
-- mọi quyết định ghi audit. Không tin role/client từ browser.

create or replace function public.decide_adjustment_request(
  p_request_id uuid,
  p_decision text,
  p_note text
) returns public.attendance_adjustment_requests
language plpgsql security definer set search_path = public as $$
declare
  r public.attendance_adjustment_requests;
  v_role text;
  v_org uuid;
  v_my_employee uuid;
  v_is_manager boolean;
  result public.attendance_adjustment_requests;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'INVALID_DECISION' using errcode = '23514';
  end if;

  select * into r from public.attendance_adjustment_requests where id = p_request_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if r.status <> 'pending' then
    raise exception 'ALREADY_DECIDED' using errcode = 'P0001';
  end if;

  select role, organization_id into v_role, v_org
    from public.profiles where id = auth.uid();
  select id into v_my_employee from public.employees where profile_id = auth.uid();
  select exists(
    select 1 from public.employees e
    where e.id = r.employee_id and e.manager_id = v_my_employee
  ) into v_is_manager;

  if not (
    (v_role in ('hr_admin', 'system_admin') and r.organization_id = v_org)
    or (v_role = 'manager' and v_is_manager)
  ) then
    raise exception 'FORBIDDEN_REVIEWER' using errcode = '42501';
  end if;

  update public.attendance_adjustment_requests
    set status = p_decision,
        reviewer_id = auth.uid(),
        reviewed_at = now(),
        resolution_note = nullif(p_note, '')
  where id = r.id
  returning * into result;

  -- Approved: áp correction vào summaries, KHÔNG sửa events gốc.
  if p_decision = 'approved' and (r.requested_in is not null or r.requested_out is not null) then
    update public.attendance_daily_summaries s set
      first_in = case when r.requested_in is not null
        then coalesce(least(s.first_in, r.requested_in), r.requested_in) else s.first_in end,
      last_out = case when r.requested_out is not null
        then coalesce(greatest(s.last_out, r.requested_out), r.requested_out) else s.last_out end,
      total_work_min = case
        when (case when r.requested_in is not null then coalesce(least(s.first_in, r.requested_in), r.requested_in) else s.first_in end) is not null
         and (case when r.requested_out is not null then coalesce(greatest(s.last_out, r.requested_out), r.requested_out) else s.last_out end) is not null
        then greatest(0, (floor(extract(epoch from (
          (case when r.requested_out is not null then coalesce(greatest(s.last_out, r.requested_out), r.requested_out) else s.last_out end) -
          (case when r.requested_in is not null then coalesce(least(s.first_in, r.requested_in), r.requested_in) else s.first_in end)
        )) / 60))::int)
        else s.total_work_min end,
      status = case
        when (case when r.requested_in is not null then coalesce(least(s.first_in, r.requested_in), r.requested_in) else s.first_in end) is null
          then 'incomplete'::text
        when (case when r.requested_out is not null then coalesce(greatest(s.last_out, r.requested_out), r.requested_out) else s.last_out end) is null
          then 'incomplete'::text
        when s.late_min > 0 then 'late'::text
        when s.early_leave_min > 0 then 'early_leave'::text
        else 'present'::text end,
      computed_at = now()
    where s.employee_id = r.employee_id and s.work_date = r.work_date;
  end if;

  insert into public.audit_logs (organization_id, actor_id, action, resource_type, resource_id, metadata)
  values (r.organization_id, auth.uid(), 'adjustment.' || p_decision, 'adjustment_request',
          r.id::text,
          jsonb_build_object('employee_id', r.employee_id, 'work_date', r.work_date,
                             'note', nullif(p_note, '')));

  return result;
end $$;

grant execute on function public.decide_adjustment_request(uuid, text, text) to authenticated;
