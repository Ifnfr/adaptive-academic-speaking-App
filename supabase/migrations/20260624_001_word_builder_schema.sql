-- =============================================================================
-- Migration: 20260624_001_word_builder_schema
-- Creates tables and RLS policies for the Word Builder feature.
-- =============================================================================

-- Table: word_builder_prompts
create table word_builder_prompts (
  id uuid primary key default gen_random_uuid(),
  prompt_text text not null,
  topic_domain text not null check (topic_domain in ('economics', 'technology', 'daily_habits', 'opinion')),
  mode text not null default 'guided' check (mode in ('guided', 'semi_free', 'transfer')),
  implied_structures jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- Table: word_builder_sessions
create table word_builder_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  prompts_attempted integer not null default 0,
  prompts_correct_first_try integer not null default 0
);

-- Table: word_builder_attempts
create table word_builder_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references word_builder_sessions(id) on delete cascade,
  prompt_id uuid not null references word_builder_prompts(id),
  prompt_mode text not null,
  attempt_text text not null,
  is_correct boolean not null default false,
  attempt_number integer not null default 1,
  hints_used integer not null default 0,
  is_echo_attempt boolean not null default false,
  created_at timestamptz not null default now()
);

-- Table: word_builder_errors
create table word_builder_errors (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references word_builder_attempts(id) on delete cascade,
  category text not null check (category in (
    'auxiliary_verb',
    'subject_verb_agreement',
    'tense',
    'article',
    'preposition',
    'word_order',
    'verb_form'
  )),
  severity text not null check (severity in ('critical', 'minor')),
  resolved boolean not null default false,
  hints_used_for_error integer not null default 0
);

-- Enable Row Level Security (RLS)
alter table word_builder_prompts enable row level security;
alter table word_builder_sessions enable row level security;
alter table word_builder_attempts enable row level security;
alter table word_builder_errors enable row level security;

-- Policies for word_builder_prompts: SELECT for authenticated users only
create policy "word_builder_prompts_select_authenticated"
  on word_builder_prompts for select
  to authenticated
  using (true);

-- Policies for word_builder_sessions: service role only
create policy "service_role_only"
  on word_builder_sessions as restrictive
  to anon
  using (false);

-- Policies for word_builder_attempts: service role only
create policy "service_role_only"
  on word_builder_attempts as restrictive
  to anon
  using (false);

-- Policies for word_builder_errors: service role only
create policy "service_role_only"
  on word_builder_errors as restrictive
  to anon
  using (false);

-- Indexes for performance
create index word_builder_sessions_user_id_idx on word_builder_sessions (user_id);
create index word_builder_attempts_session_id_idx on word_builder_attempts (session_id);
create index word_builder_attempts_prompt_id_idx on word_builder_attempts (prompt_id);
create index word_builder_errors_attempt_id_idx on word_builder_errors (attempt_id);

-- Seed Data for word_builder_prompts
insert into word_builder_prompts (prompt_text, topic_domain, mode, implied_structures) values
('Describe what happens to consumer purchasing power when inflation rises faster than wages.', 'economics', 'guided', '["auxiliary_verb", "tense"]'),
('Explain why a government might choose to increase interest rates during a period of high inflation.', 'economics', 'guided', '["tense", "verb_form"]'),
('What does opportunity cost mean, and give an example from your own daily life.', 'economics', 'guided', '["auxiliary_verb", "subject_verb_agreement"]'),
('Describe the difference between a need and a want, using a real example.', 'economics', 'guided', '["auxiliary_verb", "article"]'),
('Explain what happens to unemployment when an economy enters a recession.', 'economics', 'guided', '["tense", "auxiliary_verb"]'),
('Describe how a technology you use every day has changed the way people work or communicate.', 'technology', 'guided', '["tense", "verb_form"]'),
('Explain what artificial intelligence is and give one example of how it is used in daily life.', 'technology', 'guided', '["auxiliary_verb", "article"]'),
('Describe what happens when people become too dependent on their smartphones.', 'technology', 'guided', '["tense", "preposition"]'),
('Explain how social media platforms make money from their users.', 'technology', 'guided', '["tense", "preposition"]'),
('Describe one way that online learning is different from learning in a classroom.', 'technology', 'guided', '["auxiliary_verb", "preposition"]'),
('Describe your typical morning routine from the moment you wake up until you leave the house.', 'daily_habits', 'guided', '["subject_verb_agreement", "preposition"]'),
('Explain what you usually do when you feel stressed or overwhelmed by your studies.', 'daily_habits', 'guided', '["subject_verb_agreement", "tense"]'),
('Describe a habit you have that you think is good for your health or productivity.', 'daily_habits', 'guided', '["subject_verb_agreement", "article"]'),
('Explain what you do to prepare before an important exam or presentation.', 'daily_habits', 'guided', '["tense", "preposition"]'),
('Describe how your daily routine changes on weekends compared to weekdays.', 'daily_habits', 'guided', '["tense", "subject_verb_agreement"]');
