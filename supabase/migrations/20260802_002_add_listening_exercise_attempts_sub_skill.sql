-- =============================================================================
-- fonetik — Supabase Postgres Schema + RLS
-- Migration: 20260802_002_add_listening_exercise_attempts_sub_skill
--
-- Adds sub_skill column to listening_exercise_question_attempts table,
-- along with a check constraint for valid sub-skills and an index for
-- owner/sub_skill aggregation queries.
-- =============================================================================

ALTER TABLE listening_exercise_question_attempts
  ADD COLUMN sub_skill text;

ALTER TABLE listening_exercise_question_attempts
  ADD CONSTRAINT listening_exercise_question_attempts_sub_skill_valid
    CHECK (sub_skill IS NULL OR sub_skill IN ('gist', 'detail', 'inference', 'speaker-attitude', 'paraphrase-recognition'));

CREATE INDEX listening_exercise_question_attempts_owner_sub_skill_idx
  ON listening_exercise_question_attempts (owner_id, sub_skill);
