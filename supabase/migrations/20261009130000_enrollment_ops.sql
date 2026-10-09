-- Phase 4 · 0007 enrollment ops: HR/system được ghi audit (scoped org);
-- tự đóng dấu verified_by khi enrollment chuyển sang active.

create policy audit_insert_hr on public.audit_logs for insert to authenticated
  with check (
    public.my_role() = 'system_admin'
    or (public.my_role() = 'hr_admin' and organization_id = public.my_org())
  );

create or replace function public.stamp_enrollment_verifier()
returns trigger language plpgsql as $$
begin
  if new.status = 'active' and old.status <> 'active' then
    new.verified_by := coalesce(new.verified_by, auth.uid());
    new.enrolled_at := coalesce(new.enrolled_at, now());
  end if;
  if new.status = 'revoked' and old.status <> 'revoked' then
    new.revoked_at := coalesce(new.revoked_at, now());
  end if;
  return new;
end $$;

create trigger enrollment_stamp_verifier before update on public.face_enrollments
  for each row execute function public.stamp_enrollment_verifier();
