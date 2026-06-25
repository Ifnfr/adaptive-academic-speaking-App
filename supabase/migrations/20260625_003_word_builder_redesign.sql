alter table word_builder_attempts
  add column if not exists prompt_text text,
  add column if not exists corrected_sentence text,
  add column if not exists user_analysis text,
  add column if not exists analysis_feedback text;

create table if not exists word_builder_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references word_builder_sessions(id) on delete cascade,
  attempt_id uuid references word_builder_attempts(id) on delete cascade,
  user_id text not null,
  word text not null,
  note_text text not null,
  created_at timestamptz not null default now()
);

alter table word_builder_notes enable row level security;

create policy if not exists "service_role_only"
  on word_builder_notes as restrictive
  to anon
  using (false);

create index if not exists word_builder_notes_session_id_idx on word_builder_notes (session_id);
create index if not exists word_builder_notes_user_id_idx on word_builder_notes (user_id);
