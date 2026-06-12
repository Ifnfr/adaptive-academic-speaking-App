-- Add appearance_mode to profiles.
-- Existing rows receive the default choice 'system'. RLS and policies are unchanged.

alter table profiles
  add column if not exists appearance_mode text not null default 'system';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_appearance_mode_valid'
  ) then
    alter table profiles
      add constraint profiles_appearance_mode_valid
      check (appearance_mode in ('light', 'dark', 'system'));
  end if;
end $$;
