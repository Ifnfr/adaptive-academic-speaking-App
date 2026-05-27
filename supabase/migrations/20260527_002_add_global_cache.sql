-- =============================================================================
-- fonetik — Global AI Cache Schema
-- Migration: 20260527_002_add_global_cache
--
-- This migration creates the global_ai_response_cache table used for stateless,
-- copyright-safe cached responses (like scraped URL speaking tasks).
-- =============================================================================

create table global_ai_response_cache (
  id            uuid        primary key default gen_random_uuid(),
  cache_key     text        not null unique,
  feature       text        not null,
  response_json jsonb       not null,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- Enable Row Level Security (RLS)
alter table global_ai_response_cache enable row level security;

-- Allow select for all roles (anon and authenticated)
create policy "global_cache_select_all"
  on global_ai_response_cache for select
  using (true);

-- Allow insert for all roles (anon and authenticated)
create policy "global_cache_insert_all"
  on global_ai_response_cache for insert
  with check (true);

-- Index cache keys for fast lookup
create index global_ai_response_cache_key_idx
  on global_ai_response_cache (cache_key);
