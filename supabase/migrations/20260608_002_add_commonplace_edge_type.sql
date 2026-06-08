-- =============================================================================
-- fonetik - Add edge type support for Commonplace Sub Mind Map edges
-- Migration: 20260608_002_add_commonplace_edge_type
--
-- Sub Mind Map edges connect visual node instances by node id. The edge_type
-- column records whether a manual connection is direct/strong or speculative.
-- =============================================================================

alter table public.commonplace_mindmap_edges
  add column if not exists edge_type text not null default 'solid';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'commonplace_mindmap_edges_edge_type_valid'
      and conrelid = 'public.commonplace_mindmap_edges'::regclass
  ) then
    alter table public.commonplace_mindmap_edges
      add constraint commonplace_mindmap_edges_edge_type_valid
      check (edge_type in ('solid', 'dashed'));
  end if;
end
$$;

-- =============================================================================
-- End of migration
-- =============================================================================
