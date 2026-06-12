-- Commonplace-only theme preferences for server-persisted Settings.
-- Existing rows receive the default choices. RLS and policies are unchanged.

alter table profiles
  add column if not exists commonplace_canvas_color text not null default 'default',
  add column if not exists commonplace_card_color text not null default 'default';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_commonplace_canvas_color_valid'
  ) then
    alter table profiles
      add constraint profiles_commonplace_canvas_color_valid
      check (
        commonplace_canvas_color in (
          'default',
          'paper',
          'sage',
          'sand',
          'sky',
          'lavender',
          'rose',
          'slate',
          'charcoal'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_commonplace_card_color_valid'
  ) then
    alter table profiles
      add constraint profiles_commonplace_card_color_valid
      check (
        commonplace_card_color in (
          'default',
          'paper',
          'sage',
          'sand',
          'sky',
          'lavender',
          'rose',
          'slate',
          'charcoal'
        )
      );
  end if;
end $$;
