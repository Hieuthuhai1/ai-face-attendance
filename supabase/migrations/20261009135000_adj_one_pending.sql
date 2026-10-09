-- Phase 7 · 0012 one-pending-per-day: mỗi employee/ngày tối đa 1 request pending.
-- (App vẫn check trước để báo lỗi thân thiện; constraint là chốt chặn cuối.)
create unique index adj_one_pending_per_day
  on public.attendance_adjustment_requests (employee_id, work_date)
  where status = 'pending';
