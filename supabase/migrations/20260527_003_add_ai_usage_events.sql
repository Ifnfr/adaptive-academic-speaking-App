-- =============================================================================
-- fonetik — AI Usage Events Schema
-- Migration: 20260527_003_add_ai_usage_events
--
-- Append-only usage and cost metadata for AI provider calls.
-- Writes are server-only via SUPABASE_SERVICE_ROLE_KEY.
-- No public INSERT, UPDATE, DELETE, or SELECT policies.
-- =============================================================================

create table ai_usage_events (
  id                      uuid          primary key default gen_random_uuid(),
  owner_id                text          null,
  feature                 text          not null,
  provider                text          not null,
  model                   text          not null,
  prompt_version          text          not null,
  cached                  boolean       not null default false,
  request_status          text          not null,
  estimated_input_tokens  integer       null,
  estimated_output_tokens integer       null,
  estimated_cost_usd      numeric(12,8) null,
  error_code              text          null,
  created_at              timestamptz   not null default now()
);

-- Enable Row Level Security (RLS)
alter table ai_usage_events enable row level security;

-- No public policies: all reads and writes require the service role key.

-- Indexes for querying usage data
create index ai_usage_events_created_at_idx
  on ai_usage_events (created_at desc);

create index ai_usage_events_feature_created_at_idx
  on ai_usage_events (feature, created_at desc);

create index ai_usage_events_owner_created_at_idx
  on ai_usage_events (owner_id, created_at desc)
  where owner_id is not null;

create index ai_usage_events_provider_model_created_at_idx
  on ai_usage_events (provider, model, created_at desc);
