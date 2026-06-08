-- =============================================================================
-- fonetik - Allow duplicate note instances in Sub Mind Maps
-- Migration: 20260608_001_allow_duplicate_commonplace_sub_note_nodes
--
-- Note rows are source ideas. Mind map node rows are visual instances.
-- A note may appear more than once in the same sub mind map, so uniqueness must
-- remain on the node id primary key instead of owner_id + mindmap_id + note_id.
-- =============================================================================

alter table public.commonplace_mindmap_nodes
  drop constraint if exists commonplace_mindmap_nodes_owner_mindmap_note_unique;

create index if not exists commonplace_mindmap_nodes_owner_mindmap_note_idx
  on public.commonplace_mindmap_nodes (owner_id, mindmap_id, note_id);

-- =============================================================================
-- End of migration
-- =============================================================================
