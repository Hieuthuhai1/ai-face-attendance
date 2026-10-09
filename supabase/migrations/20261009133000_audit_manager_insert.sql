-- Phase 6 · 0010 manager audit insert: manager được ghi audit cho export trong org mình
-- (HR/system đã có từ 0007; employee tự ghi từ 0008).
create policy audit_insert_manager on public.audit_logs for insert to authenticated
  with check (
    public.my_role() = 'manager' and organization_id = public.my_org()
    and actor_id = auth.uid()
  );
