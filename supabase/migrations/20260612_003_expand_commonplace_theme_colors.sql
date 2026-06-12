-- Expand server-persisted Commonplace theme preferences.
-- Existing rows, RLS, and policies are unchanged.

alter table profiles
  drop constraint if exists profiles_commonplace_canvas_color_valid;

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
      'charcoal',
      'emerald',
      'forest',
      'teal',
      'ocean',
      'navy',
      'plum',
      'terracotta',
      'graphite'
    )
  );

alter table profiles
  drop constraint if exists profiles_commonplace_card_color_valid;

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
      'charcoal',
      'emerald',
      'forest',
      'teal',
      'ocean',
      'navy',
      'plum',
      'terracotta',
      'graphite'
    )
  );
