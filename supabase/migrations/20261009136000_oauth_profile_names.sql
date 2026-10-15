-- Phase 9 · 0013 oauth profile names: Google (và IdP khác) trả tên trong
-- raw_user_meta_data->>'full_name'/'name', không phải 'display_name' như form email.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, ''), '@', 1),
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end $$;
