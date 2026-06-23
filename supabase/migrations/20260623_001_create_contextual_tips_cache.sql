-- =============================================================================
-- Migration: 20260623_001_create_contextual_tips_cache
-- Creates the contextual_tips_cache table to store user-scoped cached AI tips.
-- =============================================================================

create table contextual_tips_cache (
  id            uuid        primary key default gen_random_uuid(),
  owner_id      text        not null,
  weakness_key  text        not null,
  tips          jsonb       not null,
  created_at    timestamptz not null default now()
);

-- Enable Row Level Security (RLS)
alter table contextual_tips_cache enable row level security;

-- Owner RLS policies
create policy "contextual_tips_select_own"
  on contextual_tips_cache for select
  using (owner_id = auth.jwt()->>'sub');

create policy "contextual_tips_insert_own"
  on contextual_tips_cache for insert
  with check (owner_id = auth.jwt()->>'sub');

create policy "contextual_tips_update_own"
  on contextual_tips_cache for update
  using (owner_id = auth.jwt()->>'sub');

create policy "contextual_tips_delete_own"
  on contextual_tips_cache for delete
  using (owner_id = auth.jwt()->>'sub');

-- Index for lookup by owner and weakness key
create index contextual_tips_cache_lookup_idx
  on contextual_tips_cache (owner_id, weakness_key);
