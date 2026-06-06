-- =============================================================================
-- fonetik - Commonplace Supabase Schema + RLS
-- Migration: 20260606_001_add_commonplace_tables
--
-- This migration creates the Commonplace-only persistence tables.
-- No storage adapter, UI, API route, AI, audio, or provider payload fields are
-- introduced here.
--
-- RLS policies use Clerk JWT subject via: auth.jwt()->>'sub'
-- Owner IDs are Clerk user IDs (text, not uuid).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. commonplace_notes
-- ---------------------------------------------------------------------------

create table commonplace_notes (
  id          uuid        primary key default gen_random_uuid(),
  owner_id    text        not null,
  client_id   text,
  shortcode   text        not null,
  source_book text        not null default 'Untitled Source',
  source_page text,
  title       text,
  quote       text,
  insight     text        not null,
  tags        text[]      not null default '{}',
  connections text[]      not null default '{}',
  relevance   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint commonplace_notes_owner_shortcode_unique unique (owner_id, shortcode),
  constraint commonplace_notes_insight_not_empty check (length(trim(insight)) > 0),
  constraint commonplace_notes_shortcode_not_empty check (length(trim(shortcode)) > 0)
);

alter table commonplace_notes enable row level security;

create policy "commonplace_notes_select_own"
  on commonplace_notes for select
  to authenticated
  using (owner_id = auth.jwt()->>'sub');

create policy "commonplace_notes_insert_own"
  on commonplace_notes for insert
  to authenticated
  with check (owner_id = auth.jwt()->>'sub');

create policy "commonplace_notes_update_own"
  on commonplace_notes for update
  to authenticated
  using (owner_id = auth.jwt()->>'sub')
  with check (owner_id = auth.jwt()->>'sub');

create policy "commonplace_notes_delete_own"
  on commonplace_notes for delete
  to authenticated
  using (owner_id = auth.jwt()->>'sub');

create trigger commonplace_notes_set_updated_at
  before update on commonplace_notes
  for each row execute function set_updated_at();

create index commonplace_notes_owner_created_idx
  on commonplace_notes (owner_id, created_at desc);

create index commonplace_notes_owner_shortcode_idx
  on commonplace_notes (owner_id, shortcode);

create index commonplace_notes_tags_gin_idx
  on commonplace_notes using gin (tags);

-- ---------------------------------------------------------------------------
-- 2. commonplace_shortcode_counters
-- ---------------------------------------------------------------------------

create table commonplace_shortcode_counters (
  owner_id   text    not null,
  prefix     text    not null,
  last_value integer not null default 0,

  constraint commonplace_shortcode_counters_pkey primary key (owner_id, prefix),
  constraint commonplace_shortcode_counters_prefix_not_empty check (length(trim(prefix)) > 0),
  constraint commonplace_shortcode_counters_last_value_nonnegative check (last_value >= 0)
);

alter table commonplace_shortcode_counters enable row level security;

create policy "commonplace_shortcode_counters_select_own"
  on commonplace_shortcode_counters for select
  to authenticated
  using (owner_id = auth.jwt()->>'sub');

create policy "commonplace_shortcode_counters_insert_own"
  on commonplace_shortcode_counters for insert
  to authenticated
  with check (owner_id = auth.jwt()->>'sub');

create policy "commonplace_shortcode_counters_update_own"
  on commonplace_shortcode_counters for update
  to authenticated
  using (owner_id = auth.jwt()->>'sub')
  with check (owner_id = auth.jwt()->>'sub');

create policy "commonplace_shortcode_counters_delete_own"
  on commonplace_shortcode_counters for delete
  to authenticated
  using (owner_id = auth.jwt()->>'sub');

create index commonplace_shortcode_counters_owner_idx
  on commonplace_shortcode_counters (owner_id);

-- ---------------------------------------------------------------------------
-- 3. commonplace_mindmaps
-- ---------------------------------------------------------------------------

create table commonplace_mindmaps (
  id                uuid        primary key default gen_random_uuid(),
  owner_id          text        not null,
  title             text        not null,
  type              text        not null,
  parent_mindmap_id uuid        references commonplace_mindmaps(id) on delete cascade,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint commonplace_mindmaps_type_valid check (type in ('main', 'sub')),
  constraint commonplace_mindmaps_title_not_empty check (length(trim(title)) > 0)
);

alter table commonplace_mindmaps enable row level security;

create policy "commonplace_mindmaps_select_own"
  on commonplace_mindmaps for select
  to authenticated
  using (owner_id = auth.jwt()->>'sub');

create policy "commonplace_mindmaps_insert_own"
  on commonplace_mindmaps for insert
  to authenticated
  with check (owner_id = auth.jwt()->>'sub');

create policy "commonplace_mindmaps_update_own"
  on commonplace_mindmaps for update
  to authenticated
  using (owner_id = auth.jwt()->>'sub')
  with check (owner_id = auth.jwt()->>'sub');

create policy "commonplace_mindmaps_delete_own"
  on commonplace_mindmaps for delete
  to authenticated
  using (owner_id = auth.jwt()->>'sub');

create trigger commonplace_mindmaps_set_updated_at
  before update on commonplace_mindmaps
  for each row execute function set_updated_at();

create index commonplace_mindmaps_owner_updated_idx
  on commonplace_mindmaps (owner_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- 4. commonplace_mindmap_nodes
-- ---------------------------------------------------------------------------

create table commonplace_mindmap_nodes (
  id         uuid             primary key default gen_random_uuid(),
  owner_id   text             not null,
  mindmap_id uuid             not null references commonplace_mindmaps(id) on delete cascade,
  note_id    uuid             not null references commonplace_notes(id) on delete cascade,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  created_at timestamptz      not null default now(),
  updated_at timestamptz      not null default now(),

  constraint commonplace_mindmap_nodes_owner_mindmap_note_unique unique (owner_id, mindmap_id, note_id)
);

alter table commonplace_mindmap_nodes enable row level security;

create policy "commonplace_mindmap_nodes_select_own"
  on commonplace_mindmap_nodes for select
  to authenticated
  using (owner_id = auth.jwt()->>'sub');

create policy "commonplace_mindmap_nodes_insert_own"
  on commonplace_mindmap_nodes for insert
  to authenticated
  with check (owner_id = auth.jwt()->>'sub');

create policy "commonplace_mindmap_nodes_update_own"
  on commonplace_mindmap_nodes for update
  to authenticated
  using (owner_id = auth.jwt()->>'sub')
  with check (owner_id = auth.jwt()->>'sub');

create policy "commonplace_mindmap_nodes_delete_own"
  on commonplace_mindmap_nodes for delete
  to authenticated
  using (owner_id = auth.jwt()->>'sub');

create trigger commonplace_mindmap_nodes_set_updated_at
  before update on commonplace_mindmap_nodes
  for each row execute function set_updated_at();

create index commonplace_mindmap_nodes_owner_mindmap_idx
  on commonplace_mindmap_nodes (owner_id, mindmap_id);

-- ---------------------------------------------------------------------------
-- 5. commonplace_mindmap_edges
-- ---------------------------------------------------------------------------

create table commonplace_mindmap_edges (
  id             uuid        primary key default gen_random_uuid(),
  owner_id       text        not null,
  mindmap_id     uuid        not null references commonplace_mindmaps(id) on delete cascade,
  source_node_id uuid        not null references commonplace_mindmap_nodes(id) on delete cascade,
  target_node_id uuid        not null references commonplace_mindmap_nodes(id) on delete cascade,
  label          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint commonplace_mindmap_edges_distinct_nodes check (source_node_id <> target_node_id)
);

alter table commonplace_mindmap_edges enable row level security;

create policy "commonplace_mindmap_edges_select_own"
  on commonplace_mindmap_edges for select
  to authenticated
  using (owner_id = auth.jwt()->>'sub');

create policy "commonplace_mindmap_edges_insert_own"
  on commonplace_mindmap_edges for insert
  to authenticated
  with check (owner_id = auth.jwt()->>'sub');

create policy "commonplace_mindmap_edges_update_own"
  on commonplace_mindmap_edges for update
  to authenticated
  using (owner_id = auth.jwt()->>'sub')
  with check (owner_id = auth.jwt()->>'sub');

create policy "commonplace_mindmap_edges_delete_own"
  on commonplace_mindmap_edges for delete
  to authenticated
  using (owner_id = auth.jwt()->>'sub');

create trigger commonplace_mindmap_edges_set_updated_at
  before update on commonplace_mindmap_edges
  for each row execute function set_updated_at();

create index commonplace_mindmap_edges_owner_mindmap_idx
  on commonplace_mindmap_edges (owner_id, mindmap_id);

-- =============================================================================
-- End of migration
-- =============================================================================
