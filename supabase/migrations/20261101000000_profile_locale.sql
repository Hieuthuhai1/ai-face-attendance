-- Phase 25 · per-user display language for the whole app.
alter table public.profiles
  add column if not exists locale text not null default 'vi'
  check (locale in ('vi', 'en'));

comment on column public.profiles.locale is 'UI language: vi (Vietnamese) or en (English).';
