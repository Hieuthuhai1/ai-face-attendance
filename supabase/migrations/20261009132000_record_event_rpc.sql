-- Phase 5 · 0009 record_attendance_event: ghi event + upsert summary trong 1 transaction.
-- SECURITY DEFINER nhưng tự enforce ownership (caller chỉ ghi cho chính mình),
-- vì server actions production dùng service-role còn browser bị RLS chặn insert success.

create or replace function public.record_attendance_event(
  p_employee_id uuid,
  p_shift_assignment_id uuid,
  p_event_type text,
  p_status text,
  p_method text,
  p_verification_ref text,
  p_liveness text,
  p_confidence numeric,
  p_idempotency_key text,
  p_note text,
  p_work_date date,
  p_shift_id uuid,
  p_late_min integer,
  p_early_leave_min integer
) returns public.attendance_events
language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid;
  v_org uuid;
  result public.attendance_events;
begin
  if p_event_type not in ('check_in', 'check_out') then
    raise exception 'INVALID_EVENT_TYPE' using errcode = '23514';
  end if;
  if p_status not in ('success', 'pending_review', 'failed', 'fallback') then
    raise exception 'INVALID_STATUS' using errcode = '23514';
  end if;
  if p_shift_id is null then
    raise exception 'SHIFT_REQUIRED' using errcode = '23514';
  end if;

  -- Ownership: employee của session.
  select id, organization_id into v_emp, v_org
    from public.employees where profile_id = auth.uid();
  if v_emp is null or v_emp <> p_employee_id then
    raise exception 'FORBIDDEN_EVENT_OWNER' using errcode = '42501';
  end if;
  if p_shift_assignment_id is not null then
    perform 1 from public.shift_assignments s
      where s.id = p_shift_assignment_id and s.employee_id = v_emp and s.organization_id = v_org;
    if not found then
      raise exception 'FORBIDDEN_ASSIGNMENT' using errcode = '42501';
    end if;
  end if;

  insert into public.attendance_events (
    organization_id, employee_id, shift_assignment_id, event_type, occurred_at,
    status, method, verification_ref, liveness_status, confidence,
    idempotency_key, note, created_by
  ) values (
    v_org, v_emp, p_shift_assignment_id, p_event_type, now(),
    p_status, p_method, p_verification_ref, p_liveness, p_confidence,
    p_idempotency_key, p_note, auth.uid()
  )
  returning * into result;

  insert into public.attendance_daily_summaries (
    employee_id, work_date, shift_id, organization_id,
    first_in, last_out, late_min, early_leave_min, total_work_min, status
  ) values (
    v_emp, p_work_date, p_shift_id, v_org,
    case when p_event_type = 'check_in' then result.occurred_at end,
    case when p_event_type = 'check_out' then result.occurred_at end,
    coalesce(p_late_min, 0), coalesce(p_early_leave_min, 0), 0, 'incomplete'
  )
  on conflict (employee_id, work_date, shift_id) do update set
    first_in = coalesce(
      least(attendance_daily_summaries.first_in, excluded.first_in),
      attendance_daily_summaries.first_in, excluded.first_in),
    last_out = coalesce(
      greatest(attendance_daily_summaries.last_out, excluded.last_out),
      attendance_daily_summaries.last_out, excluded.last_out),
    late_min = greatest(attendance_daily_summaries.late_min, excluded.late_min),
    early_leave_min = greatest(attendance_daily_summaries.early_leave_min, excluded.early_leave_min);

  update public.attendance_daily_summaries s set
    total_work_min = case
      when s.first_in is not null and s.last_out is not null
      then greatest(0, (floor(extract(epoch from (s.last_out - s.first_in)) / 60))::int)
      else 0 end,
    status = case
      when s.first_in is null then 'incomplete'
      when s.last_out is null then 'incomplete'
      when s.late_min > 0 then 'late'
      when s.early_leave_min > 0 then 'early_leave'
      else 'present' end,
    computed_at = now()
  where s.employee_id = v_emp and s.work_date = p_work_date and s.shift_id = p_shift_id;

  return result;
end $$;

grant execute on function public.record_attendance_event(
  uuid, uuid, text, text, text, text, text, numeric, text, text, date, uuid, integer, integer
) to authenticated;
