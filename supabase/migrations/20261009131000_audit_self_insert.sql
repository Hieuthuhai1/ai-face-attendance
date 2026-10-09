-- Phase 4 · 0008 audit self-insert: employee được ghi audit cho thao tác của chính mình.
create policy audit_insert_own on public.audit_logs for insert to authenticated
  with check (actor_id = auth.uid() and organization_id = public.my_org());
