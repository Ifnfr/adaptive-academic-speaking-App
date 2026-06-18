-- =============================================================================
-- fonetik — Supabase Postgres Schema + RLS
-- Migration: 20260618_001_add_weekly_mission_reviews
--
-- Stores one generated Weekly Mission Review per owner/week. Progress remains
-- derived from deterministic source tables; this table stores the mission plan
-- and bounded aggregate snapshot only.
-- =============================================================================

create table weekly_mission_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  week_start date not null,
  week_end date not null,
  timezone text not null default 'UTC',
  generated_at timestamptz not null default now(),
  diagnosis_summary text not null,
  data_sufficiency text not null,
  missions jsonb not null,
  mission_count int not null,
  status text not null,
  source_snapshot jsonb not null default '{}'::jsonb,
  next_review_available_at timestamptz not null,
  provider text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint weekly_mission_reviews_week_valid check (week_end >= week_start),
  constraint weekly_mission_reviews_data_sufficiency_valid check (data_sufficiency in ('starter', 'partial', 'strong')),
  constraint weekly_mission_reviews_status_valid check (status in ('active', 'completed', 'expired')),
  constraint weekly_mission_reviews_missions_array check (jsonb_typeof(missions) = 'array'),
  constraint weekly_mission_reviews_source_snapshot_object check (jsonb_typeof(source_snapshot) = 'object'),
  constraint weekly_mission_reviews_mission_count_bounds check (mission_count between 1 and 5),
  constraint weekly_mission_reviews_owner_week_unique unique (owner_id, week_start, week_end)
);

alter table weekly_mission_reviews enable row level security;

create policy "weekly_mission_reviews_select_own"
  on weekly_mission_reviews for select
  using (owner_id = auth.jwt()->>'sub');

create policy "weekly_mission_reviews_insert_own"
  on weekly_mission_reviews for insert
  with check (owner_id = auth.jwt()->>'sub');

create policy "weekly_mission_reviews_update_own"
  on weekly_mission_reviews for update
  using (owner_id = auth.jwt()->>'sub')
  with check (owner_id = auth.jwt()->>'sub');

create policy "weekly_mission_reviews_delete_own"
  on weekly_mission_reviews for delete
  using (owner_id = auth.jwt()->>'sub');

create trigger weekly_mission_reviews_set_updated_at
  before update on weekly_mission_reviews
  for each row execute function set_updated_at();

create index weekly_mission_reviews_owner_week_idx
  on weekly_mission_reviews (owner_id, week_start desc, week_end desc);

create index weekly_mission_reviews_owner_status_idx
  on weekly_mission_reviews (owner_id, status, week_end);
