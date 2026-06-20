-- =============================================================================
-- fonetik — Supabase Postgres Schema + RLS
-- Migration: 20260620_001_create_listening_exercise_tables
--
-- Creates the isolated three-table schema for the Listening Exercise feature.
-- All user metrics, progress models, and error evaluations are stored within
-- these tables only. No shared tables (learner_error_patterns, weekly_reviews,
-- etc.) are read from or written to by this feature's data layer.
--
-- RLS policies use Clerk JWT subject via: auth.jwt()->>'sub'
-- Owner IDs are Clerk user IDs (text, not uuid).
--
-- SECURITY NOTES:
--   - No raw audio binary data is stored.
--   - Audio scripts are stored as server-generated text only.
--   - All tables enforce owner-scoped RLS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. listening_exercise_sessions
--    One row per listening exercise attempt. Holds session-level metadata,
--    CEFR level, overall score, and final band estimate once completed.
-- ---------------------------------------------------------------------------

create table listening_exercise_sessions (
  id               uuid        primary key default gen_random_uuid(),
  owner_id         text        not null,
  is_placement     boolean     not null default false,
  cefr_level       text        not null,
  section_count    integer     not null,
  generation_plan  jsonb,
  status           text        not null default 'in_progress',
  overall_score    integer,
  estimated_band   text,
  provider         text,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz,

  constraint listening_exercise_sessions_cefr_level_not_empty
    check (length(trim(cefr_level)) > 0),
  constraint listening_exercise_sessions_section_count_positive
    check (section_count > 0),
  constraint listening_exercise_sessions_status_valid
    check (status in ('in_progress', 'completed', 'abandoned')),
  constraint listening_exercise_sessions_overall_score_bounds
    check (overall_score is null or (overall_score between 0 and 100)),
  constraint listening_exercise_sessions_generation_plan_object
    check (generation_plan is null or jsonb_typeof(generation_plan) = 'object')
);

alter table listening_exercise_sessions enable row level security;

create policy "listening_exercise_sessions_select_own"
  on listening_exercise_sessions for select
  using (owner_id = (auth.jwt()->>'sub')::text);

create policy "listening_exercise_sessions_insert_own"
  on listening_exercise_sessions for insert
  with check (owner_id = (auth.jwt()->>'sub')::text);

create policy "listening_exercise_sessions_update_own"
  on listening_exercise_sessions for update
  using (owner_id = (auth.jwt()->>'sub')::text);

create policy "listening_exercise_sessions_delete_own"
  on listening_exercise_sessions for delete
  using (owner_id = (auth.jwt()->>'sub')::text);

create index listening_exercise_sessions_owner_created_idx
  on listening_exercise_sessions (owner_id, created_at desc);

create index listening_exercise_sessions_owner_status_idx
  on listening_exercise_sessions (owner_id, status);

-- ---------------------------------------------------------------------------
-- 2. listening_exercise_sections
--    One row per section within a session. Holds the AI-generated audio
--    script, structured fact units, questions, learner answers, replay
--    tracking, and section-level score.
-- ---------------------------------------------------------------------------

create table listening_exercise_sections (
  id                uuid        primary key default gen_random_uuid(),
  session_id        uuid        not null
                      references listening_exercise_sessions(id) on delete cascade,
  owner_id          text        not null,
  section_index     integer     not null,
  cefr_level        text        not null,
  topic             text,
  audio_script      text,
  fact_units        jsonb,
  questions         jsonb,
  max_replays       integer     not null default 3,
  answers           jsonb,
  replay_count      integer     not null default 0,
  section_score     integer,
  generation_status text        not null default 'pending',
  created_at        timestamptz not null default now(),

  constraint listening_exercise_sections_section_index_non_negative
    check (section_index >= 0),
  constraint listening_exercise_sections_cefr_level_not_empty
    check (length(trim(cefr_level)) > 0),
  constraint listening_exercise_sections_max_replays_positive
    check (max_replays > 0),
  constraint listening_exercise_sections_replay_count_non_negative
    check (replay_count >= 0),
  constraint listening_exercise_sections_section_score_bounds
    check (section_score is null or (section_score between 0 and 100)),
  constraint listening_exercise_sections_generation_status_valid
    check (generation_status in ('pending', 'generating', 'ready', 'error')),
  constraint listening_exercise_sections_fact_units_array
    check (fact_units is null or jsonb_typeof(fact_units) = 'array'),
  constraint listening_exercise_sections_questions_array
    check (questions is null or jsonb_typeof(questions) = 'array'),
  constraint listening_exercise_sections_answers_object
    check (answers is null or jsonb_typeof(answers) = 'object')
);

alter table listening_exercise_sections enable row level security;

create policy "listening_exercise_sections_select_own"
  on listening_exercise_sections for select
  using (owner_id = (auth.jwt()->>'sub')::text);

create policy "listening_exercise_sections_insert_own"
  on listening_exercise_sections for insert
  with check (owner_id = (auth.jwt()->>'sub')::text);

create policy "listening_exercise_sections_update_own"
  on listening_exercise_sections for update
  using (owner_id = (auth.jwt()->>'sub')::text);

create policy "listening_exercise_sections_delete_own"
  on listening_exercise_sections for delete
  using (owner_id = (auth.jwt()->>'sub')::text);

create index listening_exercise_sections_session_idx
  on listening_exercise_sections (session_id, section_index);

create index listening_exercise_sections_owner_created_idx
  on listening_exercise_sections (owner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. listening_exercise_question_attempts
--    One row per question attempt within a section. Stores the question type,
--    CEFR level, raw learner answer, distractor type (if applicable), and
--    correctness result.
-- ---------------------------------------------------------------------------

create table listening_exercise_question_attempts (
  id              uuid        primary key default gen_random_uuid(),
  section_id      uuid        not null
                    references listening_exercise_sections(id) on delete cascade,
  owner_id        text        not null,
  question_id     text        not null,
  question_type   text        not null,
  cefr_level      text        not null,
  distractor_type text,
  is_correct      boolean     not null,
  raw_answer      text,
  created_at      timestamptz not null default now(),

  constraint listening_exercise_question_attempts_question_id_not_empty
    check (length(trim(question_id)) > 0),
  constraint listening_exercise_question_attempts_question_type_not_empty
    check (length(trim(question_type)) > 0),
  constraint listening_exercise_question_attempts_cefr_level_not_empty
    check (length(trim(cefr_level)) > 0)
);

alter table listening_exercise_question_attempts enable row level security;

create policy "listening_exercise_question_attempts_select_own"
  on listening_exercise_question_attempts for select
  using (owner_id = (auth.jwt()->>'sub')::text);

create policy "listening_exercise_question_attempts_insert_own"
  on listening_exercise_question_attempts for insert
  with check (owner_id = (auth.jwt()->>'sub')::text);

create policy "listening_exercise_question_attempts_update_own"
  on listening_exercise_question_attempts for update
  using (owner_id = (auth.jwt()->>'sub')::text);

create policy "listening_exercise_question_attempts_delete_own"
  on listening_exercise_question_attempts for delete
  using (owner_id = (auth.jwt()->>'sub')::text);

create index listening_exercise_question_attempts_section_idx
  on listening_exercise_question_attempts (section_id);

create index listening_exercise_question_attempts_owner_created_idx
  on listening_exercise_question_attempts (owner_id, created_at desc);

-- =============================================================================
-- End of migration
-- =============================================================================
