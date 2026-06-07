-- =============================================================================
-- fonetik - Commonplace Main Mind Map Schema + RLS
-- Migration: 20260606_002_add_commonplace_mainmap_tables
--
-- This migration creates the tables for the Main Mind Map cluster nodes
-- and edges (Option B from audit report).
--
-- RLS policies use Clerk JWT subject via: auth.jwt()->>'sub'
-- Owner IDs are Clerk user IDs (text, not uuid).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. commonplace_main_map_nodes
-- ---------------------------------------------------------------------------

create table commonplace_main_map_nodes (
  id                uuid             primary key default gen_random_uuid(),
  owner_id          text             not null,
  main_mindmap_id   uuid             not null references commonplace_mindmaps(id) on delete cascade,
  sub_mindmap_id    uuid             not null references commonplace_mindmaps(id) on delete cascade,
  position_x        double precision not null default 0,
  position_y        double precision not null default 0,
  created_at        timestamptz      not null default now(),
  updated_at        timestamptz      not null default now(),

  constraint commonplace_main_map_nodes_owner_main_sub_unique unique (owner_id, main_mindmap_id, sub_mindmap_id),
  constraint commonplace_main_map_nodes_distinct_maps check (main_mindmap_id <> sub_mindmap_id)
);

alter table commonplace_main_map_nodes enable row level security;

create policy "commonplace_main_map_nodes_select_own"
  on commonplace_main_map_nodes for select
  to authenticated
  using (owner_id = auth.jwt()->>'sub');

create policy "commonplace_main_map_nodes_insert_own"
  on commonplace_main_map_nodes for insert
  to authenticated
  with check (owner_id = auth.jwt()->>'sub');

create policy "commonplace_main_map_nodes_update_own"
  on commonplace_main_map_nodes for update
  to authenticated
  using (owner_id = auth.jwt()->>'sub')
  with check (owner_id = auth.jwt()->>'sub');

create policy "commonplace_main_map_nodes_delete_own"
  on commonplace_main_map_nodes for delete
  to authenticated
  using (owner_id = auth.jwt()->>'sub');

create trigger commonplace_main_map_nodes_set_updated_at
  before update on commonplace_main_map_nodes
  for each row execute function set_updated_at();

create index commonplace_main_map_nodes_owner_main_idx
  on commonplace_main_map_nodes (owner_id, main_mindmap_id);

create index commonplace_main_map_nodes_owner_sub_idx
  on commonplace_main_map_nodes (owner_id, sub_mindmap_id);

-- ---------------------------------------------------------------------------
-- 2. commonplace_main_map_edges
-- ---------------------------------------------------------------------------

create table commonplace_main_map_edges (
  id              uuid        primary key default gen_random_uuid(),
  owner_id        text        not null,
  main_mindmap_id uuid        not null references commonplace_mindmaps(id) on delete cascade,
  source_node_id  uuid        not null references commonplace_main_map_nodes(id) on delete cascade,
  target_node_id  uuid        not null references commonplace_main_map_nodes(id) on delete cascade,
  label           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint commonplace_main_map_edges_distinct_nodes check (source_node_id <> target_node_id),
  constraint commonplace_main_map_edges_owner_main_source_target_unique unique (owner_id, main_mindmap_id, source_node_id, target_node_id)
);

alter table commonplace_main_map_edges enable row level security;

create policy "commonplace_main_map_edges_select_own"
  on commonplace_main_map_edges for select
  to authenticated
  using (owner_id = auth.jwt()->>'sub');

create policy "commonplace_main_map_edges_insert_own"
  on commonplace_main_map_edges for insert
  to authenticated
  with check (owner_id = auth.jwt()->>'sub');

create policy "commonplace_main_map_edges_update_own"
  on commonplace_main_map_edges for update
  to authenticated
  using (owner_id = auth.jwt()->>'sub')
  with check (owner_id = auth.jwt()->>'sub');

create policy "commonplace_main_map_edges_delete_own"
  on commonplace_main_map_edges for delete
  to authenticated
  using (owner_id = auth.jwt()->>'sub');

create trigger commonplace_main_map_edges_set_updated_at
  before update on commonplace_main_map_edges
  for each row execute function set_updated_at();

create index commonplace_main_map_edges_owner_main_idx
  on commonplace_main_map_edges (owner_id, main_mindmap_id);
