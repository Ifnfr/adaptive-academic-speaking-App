-- =============================================================================
-- fonetik — AI Request Idempotency Schema
-- Migration: 20260527_004_add_ai_request_idempotency
--
-- Request locks and response caching for idempotency.
-- Writes and reads are server-only via SUPABASE_SERVICE_ROLE_KEY.
-- No public INSERT, UPDATE, DELETE, or SELECT policies.
-- =============================================================================

create table ai_request_idempotency (
  id                    uuid        primary key default gen_random_uuid(),
  owner_id              text        null,
  scope_key             text        not null,
  feature               text        not null,
  idempotency_key_hash  text        not null,
  request_hash          text        not null,
  request_status        text        not null,
  response_json         jsonb       null,
  error_code            text        null,
  expires_at            timestamptz not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint unique_scope_idempotency_key unique (scope_key, idempotency_key_hash)
);

-- Enable Row Level Security (RLS)
alter table ai_request_idempotency enable row level security;

-- No public policies: all reads and writes require the service role key.

-- Indexes
create index ai_request_idempotency_lookup_idx
  on ai_request_idempotency (scope_key, feature, request_hash);

create index ai_request_idempotency_expires_at_idx
  on ai_request_idempotency (expires_at);
