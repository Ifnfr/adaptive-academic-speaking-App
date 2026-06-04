-- =============================================================================
-- fonetik — Supabase Postgres Schema + RLS
-- Migration: 20260604_001_add_learning_memory_tables
--
-- This migration creates the tables for persistent learning memories,
-- including speaking sessions (podchat), writing sessions, error patterns,
-- and weekly reviews.
--
-- RLS policies use Clerk JWT subject via: auth.jwt()->>'sub'
-- Owner IDs are Clerk user IDs (text, not uuid).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. podchat_sessions
-- ---------------------------------------------------------------------------

create table podchat_sessions (
  id               uuid        primary key default gen_random_uuid(),
  owner_id         text        not null,
  client_id        text,
  topic            text        not null,
  difficulty       text        not null,
  article_context  jsonb,
  duration_seconds integer     not null,
  elapsed_seconds  integer,
  evaluation       jsonb       not null,
  provider         text,
  created_at       timestamptz not null default now(),

  constraint podchat_sessions_topic_not_empty check (length(trim(topic)) > 0),
  constraint podchat_sessions_difficulty_valid check (difficulty in ('Beginner', 'Intermediate', 'Advanced')),
  constraint podchat_sessions_duration_positive check (duration_seconds > 0),
  constraint podchat_sessions_elapsed_valid check (elapsed_seconds is null or elapsed_seconds >= 0),
  constraint podchat_sessions_article_context_object check (article_context is null or jsonb_typeof(article_context) = 'object')
);

alter table podchat_sessions enable row level security;

create policy "podchat_sessions_select_own"
  on podchat_sessions for select
  using (owner_id = auth.jwt()->>'sub');

create policy "podchat_sessions_insert_own"
  on podchat_sessions for insert
  with check (owner_id = auth.jwt()->>'sub');

create policy "podchat_sessions_update_own"
  on podchat_sessions for update
  using (owner_id = auth.jwt()->>'sub');

create policy "podchat_sessions_delete_own"
  on podchat_sessions for delete
  using (owner_id = auth.jwt()->>'sub');

create index podchat_sessions_owner_created_idx
  on podchat_sessions (owner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. podchat_turns
-- ---------------------------------------------------------------------------

create table podchat_turns (
  id         uuid        primary key default gen_random_uuid(),
  session_id uuid        not null references podchat_sessions(id) on delete cascade,
  owner_id   text        not null,
  turn_index integer     not null,
  speaker    text        not null,
  text       text        not null,
  created_at timestamptz not null default now(),

  constraint podchat_turns_turn_index_valid check (turn_index >= 0),
  constraint podchat_turns_speaker_valid check (speaker in ('host', 'learner')),
  constraint podchat_turns_text_not_empty check (length(trim(text)) > 0)
);

alter table podchat_turns enable row level security;

create policy "podchat_turns_select_own"
  on podchat_turns for select
  using (owner_id = auth.jwt()->>'sub');

create policy "podchat_turns_insert_own"
  on podchat_turns for insert
  with check (owner_id = auth.jwt()->>'sub');

create policy "podchat_turns_update_own"
  on podchat_turns for update
  using (owner_id = auth.jwt()->>'sub');

create policy "podchat_turns_delete_own"
  on podchat_turns for delete
  using (owner_id = auth.jwt()->>'sub');

create index podchat_turns_session_idx
  on podchat_turns (session_id);

-- ---------------------------------------------------------------------------
-- 3. article_writing_sessions
-- ---------------------------------------------------------------------------

create table article_writing_sessions (
  id                uuid        primary key default gen_random_uuid(),
  owner_id          text        not null,
  client_id         text,
  level             text        not null,
  feedback_language text        not null,
  article_context   jsonb       not null,
  questions         jsonb       not null,
  evaluation        jsonb       not null,
  provider          text,
  created_at        timestamptz not null default now(),

  constraint article_writing_sessions_level_valid check (level in ('Beginner', 'Intermediate', 'Advanced')),
  constraint article_writing_sessions_feedback_language_valid check (feedback_language in ('English', 'Indonesian')),
  constraint article_writing_sessions_article_context_object check (jsonb_typeof(article_context) = 'object'),
  constraint article_writing_sessions_questions_array check (jsonb_typeof(questions) = 'array'),
  constraint article_writing_sessions_evaluation_object check (jsonb_typeof(evaluation) = 'object')
);

alter table article_writing_sessions enable row level security;

create policy "article_writing_sessions_select_own"
  on article_writing_sessions for select
  using (owner_id = auth.jwt()->>'sub');

create policy "article_writing_sessions_insert_own"
  on article_writing_sessions for insert
  with check (owner_id = auth.jwt()->>'sub');

create policy "article_writing_sessions_update_own"
  on article_writing_sessions for update
  using (owner_id = auth.jwt()->>'sub');

create policy "article_writing_sessions_delete_own"
  on article_writing_sessions for delete
  using (owner_id = auth.jwt()->>'sub');

create index article_writing_sessions_owner_created_idx
  on article_writing_sessions (owner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. article_writing_answers
-- ---------------------------------------------------------------------------

create table article_writing_answers (
  id          uuid        primary key default gen_random_uuid(),
  session_id  uuid        not null references article_writing_sessions(id) on delete cascade,
  owner_id    text        not null,
  question_id text        not null,
  answer      text        not null,
  created_at  timestamptz not null default now(),

  constraint article_writing_answers_question_id_not_empty check (length(trim(question_id)) > 0),
  constraint article_writing_answers_answer_not_empty check (length(trim(answer)) > 0),
  constraint article_writing_answers_answer_length check (length(answer) <= 1200)
);

alter table article_writing_answers enable row level security;

create policy "article_writing_answers_select_own"
  on article_writing_answers for select
  using (owner_id = auth.jwt()->>'sub');

create policy "article_writing_answers_insert_own"
  on article_writing_answers for insert
  with check (owner_id = auth.jwt()->>'sub');

create policy "article_writing_answers_update_own"
  on article_writing_answers for update
  using (owner_id = auth.jwt()->>'sub');

create policy "article_writing_answers_delete_own"
  on article_writing_answers for delete
  using (owner_id = auth.jwt()->>'sub');

create index article_writing_answers_session_idx
  on article_writing_answers (session_id);

-- ---------------------------------------------------------------------------
-- 5. learner_error_patterns
-- ---------------------------------------------------------------------------

create table learner_error_patterns (
  id             uuid        primary key default gen_random_uuid(),
  owner_id       text        not null,
  source_kind    text        not null,
  source_id      uuid        not null,
  category       text        not null,
  label          text        not null,
  evidence       text,
  correction     text,
  practice_focus text,
  created_at     timestamptz not null default now(),

  constraint learner_error_patterns_source_kind_valid check (source_kind in ('podchat', 'article_writing')),
  constraint learner_error_patterns_category_not_empty check (length(trim(category)) > 0),
  constraint learner_error_patterns_label_not_empty check (length(trim(label)) > 0)
);

alter table learner_error_patterns enable row level security;

create policy "learner_error_patterns_select_own"
  on learner_error_patterns for select
  using (owner_id = auth.jwt()->>'sub');

create policy "learner_error_patterns_insert_own"
  on learner_error_patterns for insert
  with check (owner_id = auth.jwt()->>'sub');

create policy "learner_error_patterns_update_own"
  on learner_error_patterns for update
  using (owner_id = auth.jwt()->>'sub');

create policy "learner_error_patterns_delete_own"
  on learner_error_patterns for delete
  using (owner_id = auth.jwt()->>'sub');

create index learner_error_patterns_owner_kind_created_idx
  on learner_error_patterns (owner_id, source_kind, created_at desc);

-- ---------------------------------------------------------------------------
-- 6. weekly_reviews
-- ---------------------------------------------------------------------------

create table weekly_reviews (
  id                 uuid        primary key default gen_random_uuid(),
  owner_id           text        not null,
  period_start       date        not null,
  period_end         date        not null,
  summary            jsonb       not null,
  source_session_ids uuid[]      null,
  created_at         timestamptz not null default now(),

  constraint weekly_reviews_period_valid check (period_end >= period_start),
  constraint weekly_reviews_summary_object check (jsonb_typeof(summary) = 'object'),
  constraint weekly_reviews_owner_period_unique unique (owner_id, period_start, period_end)
);

alter table weekly_reviews enable row level security;

create policy "weekly_reviews_select_own"
  on weekly_reviews for select
  using (owner_id = auth.jwt()->>'sub');

create policy "weekly_reviews_insert_own"
  on weekly_reviews for insert
  with check (owner_id = auth.jwt()->>'sub');

create policy "weekly_reviews_update_own"
  on weekly_reviews for update
  using (owner_id = auth.jwt()->>'sub');

create policy "weekly_reviews_delete_own"
  on weekly_reviews for delete
  using (owner_id = auth.jwt()->>'sub');

create index weekly_reviews_owner_period_idx
  on weekly_reviews (owner_id, period_start, period_end);
