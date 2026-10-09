-- Phase 2 · 0006 RLS: grants + policies cho 4 roles.
-- Role đọc từ public.profiles (server quản lý, trigger chặn tự nâng) — không tin client.
-- audit_logs và summaries: client chỉ đọc theo phạm vi, không sửa/xóa.

grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;

-- ============ organizations ============
alter table public.organizations enable row level security;
create policy org_select on public.organizations for select to authenticated
  using (public.my_role() = 'system_admin' or id = public.my_org());
create policy org_write on public.organizations for all to authenticated
  using (public.my_role() = 'system_admin')
  with check (public.my_role() = 'system_admin');

-- ============ profiles ============
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or (public.my_role() in ('hr_admin', 'system_admin')
        and (organization_id = public.my_org() or public.my_role() = 'system_admin'))
  );
create policy profiles_update on public.profiles for update to authenticated
  using (
    id = auth.uid()
    or (public.my_role() in ('hr_admin', 'system_admin')
        and (organization_id = public.my_org() or public.my_role() = 'system_admin'))
  )
  with check (
    id = auth.uid()
    or (public.my_role() in ('hr_admin', 'system_admin')
        and (organization_id = public.my_org() or public.my_role() = 'system_admin'))
  );

-- ============ departments / work_shifts / shift_assignments ============
alter table public.departments enable row level security;
create policy departments_select on public.departments for select to authenticated
  using (organization_id = public.my_org());
create policy departments_write on public.departments for all to authenticated
  using (public.my_role() = 'system_admin'
         or (public.my_role() = 'hr_admin' and organization_id = public.my_org()))
  with check (public.my_role() = 'system_admin'
         or (public.my_role() = 'hr_admin' and organization_id = public.my_org()));

alter table public.work_shifts enable row level security;
create policy shifts_select on public.work_shifts for select to authenticated
  using (organization_id = public.my_org());
create policy shifts_write on public.work_shifts for all to authenticated
  using (public.my_role() = 'system_admin'
         or (public.my_role() = 'hr_admin' and organization_id = public.my_org()))
  with check (public.my_role() = 'system_admin'
         or (public.my_role() = 'hr_admin' and organization_id = public.my_org()));

alter table public.shift_assignments enable row level security;
create policy assignments_select on public.shift_assignments for select to authenticated
  using (organization_id = public.my_org());
create policy assignments_write on public.shift_assignments for all to authenticated
  using (public.my_role() = 'system_admin'
         or (public.my_role() = 'hr_admin' and organization_id = public.my_org()))
  with check (public.my_role() = 'system_admin'
         or (public.my_role() = 'hr_admin' and organization_id = public.my_org()));

-- ============ employees ============
alter table public.employees enable row level security;
create policy employees_select on public.employees for select to authenticated
  using (
    profile_id = auth.uid()
    or manager_id = public.my_employee_id()
    or (public.my_role() in ('hr_admin', 'system_admin')
        and (organization_id = public.my_org() or public.my_role() = 'system_admin'))
  );
create policy employees_write on public.employees for all to authenticated
  using (public.my_role() = 'system_admin'
         or (public.my_role() = 'hr_admin' and organization_id = public.my_org()))
  with check (public.my_role() = 'system_admin'
         or (public.my_role() = 'hr_admin' and organization_id = public.my_org()));

-- ============ face_enrollments (manager KHÔNG được đọc provider references) ============
alter table public.face_enrollments enable row level security;
create policy face_select on public.face_enrollments for select to authenticated
  using (
    employee_id = public.my_employee_id()
    or (public.my_role() in ('hr_admin', 'system_admin')
        and (organization_id = public.my_org() or public.my_role() = 'system_admin'))
  );
create policy face_insert on public.face_enrollments for insert to authenticated
  with check (employee_id = public.my_employee_id() and status = 'pending'
              and organization_id = public.my_org());
create policy face_update_own on public.face_enrollments for update to authenticated
  using (employee_id = public.my_employee_id())
  with check (employee_id = public.my_employee_id() and status in ('pending', 'revoked'));
create policy face_write_hr on public.face_enrollments for all to authenticated
  using (public.my_role() = 'system_admin'
         or (public.my_role() = 'hr_admin' and organization_id = public.my_org()))
  with check (public.my_role() = 'system_admin'
         or (public.my_role() = 'hr_admin' and organization_id = public.my_org()));

-- ============ attendance_events ============
-- Browser không tự insert success: WITH CHECK cấm status='success' + trigger ép giờ server.
alter table public.attendance_events enable row level security;
create policy events_select on public.attendance_events for select to authenticated
  using (
    employee_id = public.my_employee_id()
    or exists (select 1 from public.employees t
               where t.id = employee_id and t.manager_id = public.my_employee_id())
    or (public.my_role() in ('hr_admin', 'system_admin')
        and (organization_id = public.my_org() or public.my_role() = 'system_admin'))
  );
create policy events_insert on public.attendance_events for insert to authenticated
  with check (employee_id = public.my_employee_id()
              and organization_id = public.my_org()
              and status in ('pending_review', 'failed', 'fallback'));
-- Không policy update/delete cho client: sửa công qua adjustment_requests.

-- ============ attendance_daily_summaries (server recompute, client chỉ đọc) ============
alter table public.attendance_daily_summaries enable row level security;
create policy summaries_select on public.attendance_daily_summaries for select to authenticated
  using (
    employee_id = public.my_employee_id()
    or exists (select 1 from public.employees t
               where t.id = employee_id and t.manager_id = public.my_employee_id())
    or (public.my_role() in ('hr_admin', 'system_admin')
        and (organization_id = public.my_org() or public.my_role() = 'system_admin'))
  );

-- ============ adjustment_requests & leave_requests ============
alter table public.attendance_adjustment_requests enable row level security;
create policy adj_select on public.attendance_adjustment_requests for select to authenticated
  using (
    employee_id = public.my_employee_id()
    or exists (select 1 from public.employees t
               where t.id = employee_id and t.manager_id = public.my_employee_id())
    or (public.my_role() in ('hr_admin', 'system_admin')
        and (organization_id = public.my_org() or public.my_role() = 'system_admin'))
  );
create policy adj_insert on public.attendance_adjustment_requests for insert to authenticated
  with check (employee_id = public.my_employee_id()
              and organization_id = public.my_org() and status = 'pending');
create policy adj_review on public.attendance_adjustment_requests for update to authenticated
  using (
    (exists (select 1 from public.employees t
             where t.id = employee_id and t.manager_id = public.my_employee_id())
     and public.my_role() in ('manager', 'hr_admin', 'system_admin'))
    or (public.my_role() in ('hr_admin', 'system_admin')
        and (organization_id = public.my_org() or public.my_role() = 'system_admin'))
  )
  with check (status in ('pending', 'approved', 'rejected'));

alter table public.leave_requests enable row level security;
create policy leave_select on public.leave_requests for select to authenticated
  using (
    employee_id = public.my_employee_id()
    or exists (select 1 from public.employees t
               where t.id = employee_id and t.manager_id = public.my_employee_id())
    or (public.my_role() in ('hr_admin', 'system_admin')
        and (organization_id = public.my_org() or public.my_role() = 'system_admin'))
  );
create policy leave_insert on public.leave_requests for insert to authenticated
  with check (employee_id = public.my_employee_id()
              and organization_id = public.my_org() and status = 'pending');
create policy leave_review on public.leave_requests for update to authenticated
  using (
    (exists (select 1 from public.employees t
             where t.id = employee_id and t.manager_id = public.my_employee_id())
     and public.my_role() in ('manager', 'hr_admin', 'system_admin'))
    or (public.my_role() in ('hr_admin', 'system_admin')
        and (organization_id = public.my_org() or public.my_role() = 'system_admin'))
  )
  with check (status in ('pending', 'approved', 'rejected'));

-- ============ audit_logs (append-only: chỉ select theo phạm vi) ============
alter table public.audit_logs enable row level security;
create policy audit_select on public.audit_logs for select to authenticated
  using (public.my_role() = 'system_admin'
         or (public.my_role() = 'hr_admin' and organization_id = public.my_org()));

-- ============ app_settings ============
alter table public.app_settings enable row level security;
create policy settings_select on public.app_settings for select to authenticated
  using (organization_id = public.my_org());
create policy settings_write on public.app_settings for all to authenticated
  using (public.my_role() = 'system_admin')
  with check (public.my_role() = 'system_admin');
