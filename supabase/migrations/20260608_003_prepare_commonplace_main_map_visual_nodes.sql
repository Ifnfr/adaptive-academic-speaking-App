-- =============================================================================
-- fonetik - Prepare Commonplace Main Map visual nodes and edge types
-- Migration: 20260608_003_prepare_commonplace_main_map_visual_nodes
--
-- Main Map nodes are visual instances. They may represent Sub Mind Map clusters
-- or future individual Library notes, and duplicate visual instances are allowed.
-- =============================================================================

alter table public.commonplace_main_map_nodes
  drop constraint if exists commonplace_main_map_nodes_owner_main_sub_unique;

alter table public.commonplace_main_map_nodes
  add column if not exists node_kind text not null default 'cluster';

alter table public.commonplace_main_map_nodes
  add column if not exists note_id uuid;

alter table public.commonplace_main_map_nodes
  alter column sub_mindmap_id drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'commonplace_main_map_nodes_note_id_fkey'
      and conrelid = 'public.commonplace_main_map_nodes'::regclass
  ) then
    alter table public.commonplace_main_map_nodes
      add constraint commonplace_main_map_nodes_note_id_fkey
      foreign key (note_id)
      references public.commonplace_notes(id)
      on delete cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'commonplace_main_map_nodes_node_kind_valid'
      and conrelid = 'public.commonplace_main_map_nodes'::regclass
  ) then
    alter table public.commonplace_main_map_nodes
      add constraint commonplace_main_map_nodes_node_kind_valid
      check (node_kind in ('cluster', 'note'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'commonplace_main_map_nodes_target_valid'
      and conrelid = 'public.commonplace_main_map_nodes'::regclass
  ) then
    alter table public.commonplace_main_map_nodes
      add constraint commonplace_main_map_nodes_target_valid
      check (
        (
          node_kind = 'cluster'
          and sub_mindmap_id is not null
          and note_id is null
        )
        or
        (
          node_kind = 'note'
          and note_id is not null
          and sub_mindmap_id is null
        )
      );
  end if;
end
$$;

create index if not exists commonplace_main_map_nodes_owner_main_sub_idx
  on public.commonplace_main_map_nodes (owner_id, main_mindmap_id, sub_mindmap_id);

create index if not exists commonplace_main_map_nodes_owner_main_kind_idx
  on public.commonplace_main_map_nodes (owner_id, main_mindmap_id, node_kind);

create index if not exists commonplace_main_map_nodes_owner_main_note_idx
  on public.commonplace_main_map_nodes (owner_id, main_mindmap_id, note_id);

alter table public.commonplace_main_map_edges
  add column if not exists edge_type text not null default 'solid';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'commonplace_main_map_edges_edge_type_valid'
      and conrelid = 'public.commonplace_main_map_edges'::regclass
  ) then
    alter table public.commonplace_main_map_edges
      add constraint commonplace_main_map_edges_edge_type_valid
      check (edge_type in ('solid', 'dashed'));
  end if;
end
$$;

-- =============================================================================
-- End of migration
-- =============================================================================
