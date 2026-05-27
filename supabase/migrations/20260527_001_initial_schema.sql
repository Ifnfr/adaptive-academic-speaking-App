-- =============================================================================
-- fonetik — Supabase Postgres Schema + RLS
-- Migration: 20260527_001_initial_schema
--
-- This migration creates the full database schema for fonetik cloud
-- persistence. The app is NOT connected to Supabase yet — localStorage
-- remains the source of truth. This file is schema-only preparation.
--
-- RLS policies use Clerk JWT subject via: auth.jwt()->>'sub'
-- Owner IDs are Clerk user IDs (text, not uuid).
--
-- SECURITY NOTES:
--   - No raw article HTML or full article body is stored.
--   - No provider API keys or Clerk secret keys are stored.
--   - All tables enforce owner-scoped RLS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helper: set_updated_at() trigger function
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------------

create table profiles (
  id           uuid        primary key default gen_random_uuid(),
  owner_id     text        not null unique,
  email        text,
  display_name text,
  learner_level     text,
  preferred_provider text,
  preferred_mode     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_own"
  on profiles for select
  using (owner_id = auth.jwt()->>'sub');

create policy "profiles_insert_own"
  on profiles for insert
  with check (owner_id = auth.jwt()->>'sub');

create policy "profiles_update_own"
  on profiles for update
  using (owner_id = auth.jwt()->>'sub');

create policy "profiles_delete_own"
  on profiles for delete
  using (owner_id = auth.jwt()->>'sub');

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. speaking_sessions
-- ---------------------------------------------------------------------------

create table speaking_sessions (
  id               uuid        primary key default gen_random_uuid(),
  owner_id         text        not null,
  client_id        text        not null,
  date             date,
  level            text,
  mode             text,
  feedback_type    text,
  session_type     text,
  provider         text,
  today_target     text,
  duration_seconds integer,
  transcript       text,
  main_weakness    text,
  evidence         text,
  better_phrase    text,
  retry_task       text,
  retry_transcript text,
  csv              text,
  created_at       timestamptz not null default now(),

  constraint speaking_sessions_owner_client_unique
    unique (owner_id, client_id)
);

alter table speaking_sessions enable row level security;

create policy "speaking_sessions_select_own"
  on speaking_sessions for select
  using (owner_id = auth.jwt()->>'sub');

create policy "speaking_sessions_insert_own"
  on speaking_sessions for insert
  with check (owner_id = auth.jwt()->>'sub');

create policy "speaking_sessions_update_own"
  on speaking_sessions for update
  using (owner_id = auth.jwt()->>'sub');

create policy "speaking_sessions_delete_own"
  on speaking_sessions for delete
  using (owner_id = auth.jwt()->>'sub');

create index speaking_sessions_owner_created_idx
  on speaking_sessions (owner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. vocabulary_items
-- ---------------------------------------------------------------------------

create table vocabulary_items (
  id                uuid        primary key default gen_random_uuid(),
  owner_id          text        not null,
  client_id         text        not null,
  word              text        not null,
  meaning           text,
  part_of_speech    text,
  source            text,
  level             text,
  status            text,
  example           text,
  collocations      text[],
  reuse_count       integer     not null default 0,
  correct_use_count integer     not null default 0,
  last_practiced_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint vocabulary_items_owner_client_unique
    unique (owner_id, client_id)
);

alter table vocabulary_items enable row level security;

create policy "vocabulary_items_select_own"
  on vocabulary_items for select
  using (owner_id = auth.jwt()->>'sub');

create policy "vocabulary_items_insert_own"
  on vocabulary_items for insert
  with check (owner_id = auth.jwt()->>'sub');

create policy "vocabulary_items_update_own"
  on vocabulary_items for update
  using (owner_id = auth.jwt()->>'sub');

create policy "vocabulary_items_delete_own"
  on vocabulary_items for delete
  using (owner_id = auth.jwt()->>'sub');

create trigger vocabulary_items_set_updated_at
  before update on vocabulary_items
  for each row execute function set_updated_at();

create index vocabulary_items_owner_created_idx
  on vocabulary_items (owner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. vocabulary_sentences
-- ---------------------------------------------------------------------------

create table vocabulary_sentences (
  id            uuid        primary key default gen_random_uuid(),
  owner_id      text        not null,
  vocab_item_id uuid        not null references vocabulary_items(id) on delete cascade,
  client_id     text        not null,
  sentence      text        not null,
  contains_word boolean     not null default false,
  created_at    timestamptz not null default now(),

  constraint vocabulary_sentences_owner_client_unique
    unique (owner_id, client_id)
);

alter table vocabulary_sentences enable row level security;

create policy "vocabulary_sentences_select_own"
  on vocabulary_sentences for select
  using (owner_id = auth.jwt()->>'sub');

create policy "vocabulary_sentences_insert_own"
  on vocabulary_sentences for insert
  with check (owner_id = auth.jwt()->>'sub');

create policy "vocabulary_sentences_update_own"
  on vocabulary_sentences for update
  using (owner_id = auth.jwt()->>'sub');

create policy "vocabulary_sentences_delete_own"
  on vocabulary_sentences for delete
  using (owner_id = auth.jwt()->>'sub');

create index vocabulary_sentences_owner_vocab_idx
  on vocabulary_sentences (owner_id, vocab_item_id);

-- ---------------------------------------------------------------------------
-- 5. vocabulary_corrections
-- ---------------------------------------------------------------------------

create table vocabulary_corrections (
  id                 uuid        primary key default gen_random_uuid(),
  owner_id           text        not null,
  sentence_id        uuid        not null references vocabulary_sentences(id) on delete cascade,
  status             text,
  explanation        text,
  corrected_sentence text,
  collocation_tip    text,
  retry_instruction  text,
  target_usage_role  text,
  warnings           text[],
  provider_used      text,
  checked_at         timestamptz not null default now(),

  constraint vocabulary_corrections_owner_sentence_unique
    unique (owner_id, sentence_id)
);

alter table vocabulary_corrections enable row level security;

create policy "vocabulary_corrections_select_own"
  on vocabulary_corrections for select
  using (owner_id = auth.jwt()->>'sub');

create policy "vocabulary_corrections_insert_own"
  on vocabulary_corrections for insert
  with check (owner_id = auth.jwt()->>'sub');

create policy "vocabulary_corrections_update_own"
  on vocabulary_corrections for update
  using (owner_id = auth.jwt()->>'sub');

create policy "vocabulary_corrections_delete_own"
  on vocabulary_corrections for delete
  using (owner_id = auth.jwt()->>'sub');

-- ---------------------------------------------------------------------------
-- 6. xp_profiles
-- ---------------------------------------------------------------------------

create table xp_profiles (
  owner_id             text        primary key,
  total_xp             integer     not null default 0,
  pending_daily_xp     integer     not null default 0,
  unclaimed_previous_xp integer    not null default 0,
  active_date          date,
  last_claimed_date    date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table xp_profiles enable row level security;

create policy "xp_profiles_select_own"
  on xp_profiles for select
  using (owner_id = auth.jwt()->>'sub');

create policy "xp_profiles_insert_own"
  on xp_profiles for insert
  with check (owner_id = auth.jwt()->>'sub');

create policy "xp_profiles_update_own"
  on xp_profiles for update
  using (owner_id = auth.jwt()->>'sub');

create policy "xp_profiles_delete_own"
  on xp_profiles for delete
  using (owner_id = auth.jwt()->>'sub');

create trigger xp_profiles_set_updated_at
  before update on xp_profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. xp_events
-- ---------------------------------------------------------------------------

create table xp_events (
  id          uuid        primary key default gen_random_uuid(),
  owner_id    text        not null,
  client_id   text,
  type        text        not null,
  xp          integer     not null,
  local_date  date,
  source_id   text        not null,
  source_kind text,
  reason      text,
  created_at  timestamptz not null default now(),

  constraint xp_events_owner_type_source_unique
    unique (owner_id, type, source_id)
);

alter table xp_events enable row level security;

create policy "xp_events_select_own"
  on xp_events for select
  using (owner_id = auth.jwt()->>'sub');

create policy "xp_events_insert_own"
  on xp_events for insert
  with check (owner_id = auth.jwt()->>'sub');

create policy "xp_events_update_own"
  on xp_events for update
  using (owner_id = auth.jwt()->>'sub');

create policy "xp_events_delete_own"
  on xp_events for delete
  using (owner_id = auth.jwt()->>'sub');

create index xp_events_owner_date_idx
  on xp_events (owner_id, local_date);

create index xp_events_owner_type_source_idx
  on xp_events (owner_id, type, source_id);

-- ---------------------------------------------------------------------------
-- 8. badges
-- ---------------------------------------------------------------------------

create table badges (
  id          uuid        primary key default gen_random_uuid(),
  owner_id    text        not null,
  badge_id    text        not null,
  label       text,
  description text,
  status      text,
  earned_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint badges_owner_badge_unique
    unique (owner_id, badge_id)
);

alter table badges enable row level security;

create policy "badges_select_own"
  on badges for select
  using (owner_id = auth.jwt()->>'sub');

create policy "badges_insert_own"
  on badges for insert
  with check (owner_id = auth.jwt()->>'sub');

create policy "badges_update_own"
  on badges for update
  using (owner_id = auth.jwt()->>'sub');

create policy "badges_delete_own"
  on badges for delete
  using (owner_id = auth.jwt()->>'sub');

create trigger badges_set_updated_at
  before update on badges
  for each row execute function set_updated_at();

create index badges_owner_badge_idx
  on badges (owner_id, badge_id);

-- ---------------------------------------------------------------------------
-- 9. article_practice_records (optional — included as useful for future sync)
-- ---------------------------------------------------------------------------
-- Stores metadata about article practice sessions. Does NOT store raw HTML
-- or the full extracted article body. The practice column (jsonb) holds the
-- structured speaking-task result only (snapshot, brief, key points, etc.).

create table article_practice_records (
  id            uuid        primary key default gen_random_uuid(),
  owner_id      text        not null,
  source_url    text        not null,
  source_title  text,
  source_domain text,
  practice      jsonb,
  created_at    timestamptz not null default now()
);

alter table article_practice_records enable row level security;

create policy "article_practice_records_select_own"
  on article_practice_records for select
  using (owner_id = auth.jwt()->>'sub');

create policy "article_practice_records_insert_own"
  on article_practice_records for insert
  with check (owner_id = auth.jwt()->>'sub');

create policy "article_practice_records_update_own"
  on article_practice_records for update
  using (owner_id = auth.jwt()->>'sub');

create policy "article_practice_records_delete_own"
  on article_practice_records for delete
  using (owner_id = auth.jwt()->>'sub');

create index article_practice_records_owner_created_idx
  on article_practice_records (owner_id, created_at desc);

-- =============================================================================
-- End of migration
-- =============================================================================
