-- =============================================================================
-- fonetik — Supabase Postgres Schema + RLS
-- Migration: 20260612_004_add_pattern_drill_sessions
--
-- Creates the pattern_drill_sessions table to persist Drill Mode summaries
-- without storing raw speech transcripts or audio.
-- =============================================================================

create table pattern_drill_sessions (
  id                              uuid        primary key default gen_random_uuid(),
  owner_id                        text        not null,
  brief_id                        text        not null,
  target_pattern                  text        not null,
  target_steps                    jsonb       not null,
  common_mistakes                 jsonb       not null,
  quick_check_status              text        not null,
  entry_phase                     integer     not null,
  phase1_baseline_completeness    text        not null,
  phase1_completed_prompt_count   integer     not null,
  phase2_accuracy                 integer     not null,
  full_credit_count               integer     not null,
  partial_credit_count            integer     not null,
  no_credit_count                 integer     not null,
  evaluated_attempt_count         integer     not null,
  final_full_credit_streak        integer     not null,
  most_missed_steps               jsonb       not null,
  simplified_topic_used           boolean     not null default false,
  improvement_signal              text        not null,
  next_session_recommendation     text        not null,
  weakness_update                 jsonb,
  phase3_pressure_accuracy        integer,
  pressure_fail_rate              integer,
  saved_summary                   jsonb       not null,
  created_at                      timestamptz not null default now(),

  constraint pattern_drill_sessions_brief_id_not_empty check (length(trim(brief_id)) > 0),
  constraint pattern_drill_sessions_target_pattern_not_empty check (length(trim(target_pattern)) > 0),
  constraint pattern_drill_sessions_quick_check_status_valid check (quick_check_status in ('detected', 'not_detected_or_partial', 'skipped')),
  constraint pattern_drill_sessions_entry_phase_valid check (entry_phase in (1, 3)),
  constraint pattern_drill_sessions_phase1_baseline_completeness_valid check (phase1_baseline_completeness in ('complete', 'partial', 'missing')),
  constraint pattern_drill_sessions_phase1_completed_prompt_count_non_negative check (phase1_completed_prompt_count >= 0),
  constraint pattern_drill_sessions_phase2_accuracy_bounds check (phase2_accuracy between 0 and 100),
  constraint pattern_drill_sessions_full_credit_count_non_negative check (full_credit_count >= 0),
  constraint pattern_drill_sessions_partial_credit_count_non_negative check (partial_credit_count >= 0),
  constraint pattern_drill_sessions_no_credit_count_non_negative check (no_credit_count >= 0),
  constraint pattern_drill_sessions_evaluated_attempt_count_non_negative check (evaluated_attempt_count >= 0),
  constraint pattern_drill_sessions_final_full_credit_streak_non_negative check (final_full_credit_streak >= 0),
  constraint pattern_drill_sessions_improvement_signal_valid check (improvement_signal in ('strong', 'emerging', 'needs_more_repetition')),
  constraint pattern_drill_sessions_phase3_pressure_accuracy_bounds check (phase3_pressure_accuracy is null or (phase3_pressure_accuracy between 0 and 100)),
  constraint pattern_drill_sessions_pressure_fail_rate_bounds check (pressure_fail_rate is null or (pressure_fail_rate between 0 and 100)),
  constraint pattern_drill_sessions_target_steps_array check (jsonb_typeof(target_steps) = 'array'),
  constraint pattern_drill_sessions_common_mistakes_array check (jsonb_typeof(common_mistakes) = 'array'),
  constraint pattern_drill_sessions_most_missed_steps_array check (jsonb_typeof(most_missed_steps) = 'array'),
  constraint pattern_drill_sessions_saved_summary_object check (jsonb_typeof(saved_summary) = 'object'),
  constraint pattern_drill_sessions_weakness_update_object check (weakness_update is null or jsonb_typeof(weakness_update) = 'object')
);

alter table pattern_drill_sessions enable row level security;

create policy "pattern_drill_sessions_select_own"
  on pattern_drill_sessions for select
  using (owner_id = auth.jwt()->>'sub');

create policy "pattern_drill_sessions_insert_own"
  on pattern_drill_sessions for insert
  with check (owner_id = auth.jwt()->>'sub');

create index pattern_drill_sessions_owner_created_idx
  on pattern_drill_sessions (owner_id, created_at desc);
