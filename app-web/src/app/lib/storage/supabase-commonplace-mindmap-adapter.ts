import type { FonetikSupabaseClient } from "../supabase";
import type { CommonplaceError } from "./supabase-commonplace-adapter";

const MINDMAPS_TABLE = "commonplace_mindmaps";
const NODES_TABLE = "commonplace_mindmap_nodes";
const EDGES_TABLE = "commonplace_mindmap_edges";
const NOTES_TABLE = "commonplace_notes";

export type CommonplaceMindMapSummary = {
  id: string;
  ownerId: string;
  title: string;
  type: "main" | "sub";
  parentMindMapId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommonplaceMindMapNodeInput = {
  localId: string;
  noteId: string;
  positionX: number;
  positionY: number;
};

export type CommonplaceMindMapEdgeInput = {
  sourceLocalId: string;
  targetLocalId: string;
  label?: string | null;
};

export type CommonplaceMindMapNode = {
  id: string;
  noteId: string;
  positionX: number;
  positionY: number;
  noteShortcode: string;
  noteTitle: string | null;
  noteInsight: string;
  noteTags: string[];
};

export type CommonplaceMindMapEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string | null;
};

export type CommonplaceMindMapGraph = {
  summary: CommonplaceMindMapSummary;
  nodes: CommonplaceMindMapNode[];
  edges: CommonplaceMindMapEdge[];
};

export type CreateCommonplaceMindMapInput = {
  ownerId: string;
  title: string;
  parentMindMapId?: string | null;
};

export type CommonplaceMindMapType = "main" | "sub";

export type CreateCommonplaceMindMapRegistryInput = {
  ownerId: string;
  title: string;
  type: CommonplaceMindMapType;
};

export type RenameCommonplaceMindMapInput = {
  ownerId: string;
  mindMapId: string;
  title: string;
};

export type SaveCommonplaceMindMapInput = {
  ownerId: string;
  mindMapId: string;
  title?: string | null;
  nodes: CommonplaceMindMapNodeInput[];
  edges: CommonplaceMindMapEdgeInput[];
};

export type CommonplaceMindMapResult =
  | { ok: true; mindMap: CommonplaceMindMapSummary }
  | { ok: false; error: CommonplaceError };

export type CommonplaceMindMapListResult =
  | { ok: true; mindMaps: CommonplaceMindMapSummary[] }
  | { ok: false; error: CommonplaceError };

export type CommonplaceMindMapGraphResult =
  | { ok: true; graph: CommonplaceMindMapGraph }
  | { ok: false; error: CommonplaceError };

export type CommonplaceMindMapDeleteResult =
  | { ok: true }
  | { ok: false; error: CommonplaceError };

export type CommonplaceMapCanvasNode = {
  id: string;
  noteId: string;
  positionX: number;
  positionY: number;
  noteShortcode: string;
  noteTitle: string | null;
  noteSourceBook: string;
  noteTags: string[];
};

export type CommonplaceMapNodePositionUpdate = {
  nodeId: string;
  position: {
    x: number;
    y: number;
  };
};

export type CommonplaceMapNodeListResult =
  | { ok: true; nodes: CommonplaceMapCanvasNode[] }
  | { ok: false; error: CommonplaceError };

export type CommonplaceMapNodePositionSaveResult =
  | { ok: true }
  | { ok: false; error: CommonplaceError };

const MAINMAP_NODES_TABLE = "commonplace_main_map_nodes";
const MAINMAP_EDGES_TABLE = "commonplace_main_map_edges";

export type CommonplaceMainMapSummary = CommonplaceMindMapSummary;

export type CommonplaceMainMapClusterInput = {
  localId: string;
  subMindMapId: string;
  positionX: number;
  positionY: number;
};

export type CommonplaceMainMapEdgeInput = {
  sourceLocalId: string;
  targetLocalId: string;
  label?: string | null;
};

export type CommonplaceMainMapCluster = {
  id: string;
  subMindMapId: string;
  subMindMapTitle: string;
  positionX: number;
  positionY: number;
  updatedAt: string;
};

export type CommonplaceMainMapEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string | null;
};

export type CommonplaceMainMapGraph = {
  summary: CommonplaceMainMapSummary;
  clusters: CommonplaceMainMapCluster[];
  edges: CommonplaceMainMapEdge[];
};

export type SaveCommonplaceMainMapGraphInput = {
  ownerId: string;
  title?: string | null;
  clusters: CommonplaceMainMapClusterInput[];
  edges: CommonplaceMainMapEdgeInput[];
};

export type CommonplaceMainMapGraphResult =
  | { ok: true; graph: CommonplaceMainMapGraph }
  | { ok: false; error: CommonplaceError };

export type CommonplaceMainMapSaveResult =
  | { ok: true; graph: CommonplaceMainMapGraph }
  | { ok: false; error: CommonplaceError };

type MindMapRow = {
  id: string;
  owner_id: string;
  title: string;
  type: string;
  parent_mindmap_id: string | null;
  created_at: string;
  updated_at: string;
};

type NodeJoinedRow = {
  id: string;
  note_id: string;
  position_x: number;
  position_y: number;
  commonplace_notes: {
    shortcode: string;
    title: string | null;
    source_book: string;
    insight: string;
    tags: string[] | null;
  } | Array<{
    shortcode: string;
    title: string | null;
    source_book: string;
    insight: string;
    tags: string[] | null;
  }> | null;
};

type EdgeRow = {
  id: string;
  source_node_id: string;
  target_node_id: string;
  label: string | null;
};

function cleanRequiredText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapMindMapRow(row: MindMapRow): CommonplaceMindMapSummary {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    type: row.type as "main" | "sub",
    parentMindMapId: row.parent_mindmap_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function cleanMindMapType(value: unknown): CommonplaceMindMapType | null {
  return value === "main" || value === "sub" ? value : null;
}

async function verifyOwnerScopedMap(
  ownerId: string,
  mindMapId: string,
  type: CommonplaceMindMapType,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMindMapDeleteResult> {
  const { data, error } = await supabaseClient
    .from(MINDMAPS_TABLE)
    .select("id")
    .eq("owner_id", ownerId)
    .eq("id", mindMapId)
    .eq("type", type)
    .maybeSingle();

  if (error) return { ok: false, error: "commonplace_save_failed" };
  if (!data) return { ok: false, error: "commonplace_not_found" };

  return { ok: true };
}

function cleanPositionUpdate(
  update: CommonplaceMapNodePositionUpdate,
): CommonplaceMapNodePositionUpdate | null {
  const nodeId = cleanRequiredText(update.nodeId);
  const x = update.position?.x;
  const y = update.position?.y;

  if (!nodeId || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    nodeId,
    position: { x, y },
  };
}

export async function listCommonplaceMapNodes(
  ownerId: string,
  mindMapId: string,
  type: CommonplaceMindMapType,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMapNodeListResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanMindMapId = cleanRequiredText(mindMapId);
  const cleanType = cleanMindMapType(type);

  if (!cleanOwnerId || !cleanMindMapId || !cleanType) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const mapResult = await verifyOwnerScopedMap(
      cleanOwnerId,
      cleanMindMapId,
      cleanType,
      supabaseClient,
    );
    if (!mapResult.ok) return mapResult;

    if (cleanType === "main") {
      return { ok: true, nodes: [] };
    }

    const { data, error } = await supabaseClient
      .from(NODES_TABLE)
      .select(`
        id,
        note_id,
        position_x,
        position_y,
        commonplace_notes (
          shortcode,
          title,
          source_book,
          insight,
          tags
        )
      `)
      .eq("owner_id", cleanOwnerId)
      .eq("mindmap_id", cleanMindMapId)
      .order("updated_at", { ascending: false });

    if (error) return { ok: false, error: "commonplace_save_failed" };

    const nodes: CommonplaceMapCanvasNode[] = (
      (data as unknown as NodeJoinedRow[] | null) ?? []
    ).map((row) => {
      const notesRel = row.commonplace_notes;
      const noteObj = Array.isArray(notesRel) ? notesRel[0] : notesRel;

      return {
        id: row.id,
        noteId: row.note_id,
        positionX: row.position_x,
        positionY: row.position_y,
        noteShortcode: noteObj?.shortcode || "",
        noteTitle: noteObj?.title?.trim() || null,
        noteSourceBook: noteObj?.source_book || "Untitled Source",
        noteTags: noteObj?.tags ?? [],
      };
    });

    return { ok: true, nodes };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function batchUpdateCommonplaceMapNodePositions(
  ownerId: string,
  mindMapId: string,
  type: CommonplaceMindMapType,
  updates: CommonplaceMapNodePositionUpdate[],
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMapNodePositionSaveResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanMindMapId = cleanRequiredText(mindMapId);
  const cleanType = cleanMindMapType(type);

  if (!cleanOwnerId || !cleanMindMapId || !cleanType || updates.length > 100) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  const cleanUpdates: CommonplaceMapNodePositionUpdate[] = [];
  const seenNodeIds = new Set<string>();
  for (const update of updates) {
    const cleanUpdate = cleanPositionUpdate(update);
    if (!cleanUpdate || seenNodeIds.has(cleanUpdate.nodeId)) {
      return { ok: false, error: "commonplace_validation_failed" };
    }
    seenNodeIds.add(cleanUpdate.nodeId);
    cleanUpdates.push(cleanUpdate);
  }

  try {
    const mapResult = await verifyOwnerScopedMap(
      cleanOwnerId,
      cleanMindMapId,
      cleanType,
      supabaseClient,
    );
    if (!mapResult.ok) return mapResult;

    if (cleanType === "main") {
      return cleanUpdates.length === 0
        ? { ok: true }
        : { ok: false, error: "commonplace_validation_failed" };
    }

    if (cleanUpdates.length === 0) {
      return { ok: true };
    }

    const nodeIds = cleanUpdates.map((update) => update.nodeId);
    const { data: existingNodes, error: existingNodesError } =
      await supabaseClient
        .from(NODES_TABLE)
        .select("id")
        .eq("owner_id", cleanOwnerId)
        .eq("mindmap_id", cleanMindMapId)
        .in("id", nodeIds);

    if (existingNodesError) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    if (((existingNodes as Array<unknown> | null) ?? []).length !== nodeIds.length) {
      return { ok: false, error: "commonplace_not_found" };
    }

    const updatedAt = new Date().toISOString();
    for (const update of cleanUpdates) {
      const { error } = await supabaseClient
        .from(NODES_TABLE)
        .update({
          position_x: update.position.x,
          position_y: update.position.y,
          updated_at: updatedAt,
        })
        .eq("owner_id", cleanOwnerId)
        .eq("mindmap_id", cleanMindMapId)
        .eq("id", update.nodeId);

      if (error) return { ok: false, error: "commonplace_save_failed" };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function listCommonplaceMindMaps(
  ownerId: string,
  supabaseClient: FonetikSupabaseClient,
  type?: CommonplaceMindMapType | null,
): Promise<CommonplaceMindMapListResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  if (!cleanOwnerId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    let query = supabaseClient
      .from(MINDMAPS_TABLE)
      .select("*")
      .eq("owner_id", cleanOwnerId);

    if (type) {
      query = query.eq("type", type);
    }

    const { data, error } = await query.order("updated_at", { ascending: false });

    if (error) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    return {
      ok: true,
      mindMaps: ((data as MindMapRow[] | null) ?? []).map(mapMindMapRow),
    };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function createCommonplaceMindMap(
  input: CreateCommonplaceMindMapRegistryInput,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMindMapResult> {
  const ownerId = cleanRequiredText(input.ownerId);
  const title = cleanRequiredText(input.title);
  const type = cleanMindMapType(input.type);

  if (!ownerId || !title || !type || title.length > 120) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const { data, error } = await supabaseClient
      .from(MINDMAPS_TABLE)
      .insert({
        owner_id: ownerId,
        title,
        type,
        parent_mindmap_id: null,
      })
      .select("*")
      .single();

    if (error || !data) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    return { ok: true, mindMap: mapMindMapRow(data as MindMapRow) };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function renameCommonplaceMindMap(
  input: RenameCommonplaceMindMapInput,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMindMapResult> {
  const ownerId = cleanRequiredText(input.ownerId);
  const mindMapId = cleanRequiredText(input.mindMapId);
  const title = cleanRequiredText(input.title);

  if (!ownerId || !mindMapId || !title || title.length > 120) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const { data, error } = await supabaseClient
      .from(MINDMAPS_TABLE)
      .update({ title, updated_at: new Date().toISOString() })
      .eq("owner_id", ownerId)
      .eq("id", mindMapId)
      .select("*")
      .maybeSingle();

    if (error) return { ok: false, error: "commonplace_save_failed" };
    if (!data) return { ok: false, error: "commonplace_not_found" };

    return { ok: true, mindMap: mapMindMapRow(data as MindMapRow) };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function deleteCommonplaceMindMapFromRegistry(
  ownerId: string,
  mindMapId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMindMapDeleteResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanMindMapId = cleanRequiredText(mindMapId);

  if (!cleanOwnerId || !cleanMindMapId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const { data: existingMap, error: readError } = await supabaseClient
      .from(MINDMAPS_TABLE)
      .select("id")
      .eq("owner_id", cleanOwnerId)
      .eq("id", cleanMindMapId)
      .maybeSingle();

    if (readError) return { ok: false, error: "commonplace_save_failed" };
    if (!existingMap) return { ok: false, error: "commonplace_not_found" };

    const { data: subNodes, error: subNodeError } = await supabaseClient
      .from(NODES_TABLE)
      .select("id")
      .eq("owner_id", cleanOwnerId)
      .eq("mindmap_id", cleanMindMapId)
      .limit(1);

    if (subNodeError) return { ok: false, error: "commonplace_save_failed" };
    if (((subNodes as Array<unknown> | null) ?? []).length > 0) {
      return { ok: false, error: "commonplace_conflict" };
    }

    const { data: mainNodes, error: mainNodeError } = await supabaseClient
      .from(MAINMAP_NODES_TABLE)
      .select("id")
      .eq("owner_id", cleanOwnerId)
      .eq("main_mindmap_id", cleanMindMapId)
      .limit(1);

    if (mainNodeError) return { ok: false, error: "commonplace_save_failed" };
    if (((mainNodes as Array<unknown> | null) ?? []).length > 0) {
      return { ok: false, error: "commonplace_conflict" };
    }

    const { data: clusterRefs, error: clusterRefsError } = await supabaseClient
      .from(MAINMAP_NODES_TABLE)
      .select("id")
      .eq("owner_id", cleanOwnerId)
      .eq("sub_mindmap_id", cleanMindMapId)
      .limit(1);

    if (clusterRefsError) return { ok: false, error: "commonplace_save_failed" };
    if (((clusterRefs as Array<unknown> | null) ?? []).length > 0) {
      return { ok: false, error: "commonplace_conflict" };
    }

    const { error } = await supabaseClient
      .from(MINDMAPS_TABLE)
      .delete()
      .eq("owner_id", cleanOwnerId)
      .eq("id", cleanMindMapId);

    if (error) return { ok: false, error: "commonplace_save_failed" };

    return { ok: true };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function createCommonplaceSubMindMap(
  input: CreateCommonplaceMindMapInput,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMindMapResult> {
  const ownerId = cleanRequiredText(input.ownerId);
  const title = cleanRequiredText(input.title);

  if (!ownerId || !title || title.length > 120) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const { data, error } = await supabaseClient
      .from(MINDMAPS_TABLE)
      .insert({
        owner_id: ownerId,
        title: title.trim(),
        type: "sub",
        parent_mindmap_id: input.parentMindMapId || null,
      })
      .select("*")
      .single();

    if (error || !data) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    return { ok: true, mindMap: mapMindMapRow(data as MindMapRow) };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function listCommonplaceSubMindMaps(
  ownerId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMindMapListResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  if (!cleanOwnerId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const { data, error } = await supabaseClient
      .from(MINDMAPS_TABLE)
      .select("*")
      .eq("owner_id", cleanOwnerId)
      .eq("type", "sub")
      .order("updated_at", { ascending: false });

    if (error) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    const mindMaps = ((data as MindMapRow[] | null) ?? []).map(mapMindMapRow);
    return { ok: true, mindMaps };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function getCommonplaceMindMapGraph(
  ownerId: string,
  mindMapId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMindMapGraphResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanMindMapId = cleanRequiredText(mindMapId);

  if (!cleanOwnerId || !cleanMindMapId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    // 1. Fetch mind map summary
    const { data: mapData, error: mapError } = await supabaseClient
      .from(MINDMAPS_TABLE)
      .select("*")
      .eq("owner_id", cleanOwnerId)
      .eq("id", cleanMindMapId)
      .maybeSingle();

    if (mapError) return { ok: false, error: "commonplace_save_failed" };
    if (!mapData) return { ok: false, error: "commonplace_not_found" };

    const summary = mapMindMapRow(mapData as MindMapRow);

    // 2. Fetch nodes joined with commonplace_notes
    const { data: nodesData, error: nodesError } = await supabaseClient
      .from(NODES_TABLE)
      .select(`
        id,
        note_id,
        position_x,
        position_y,
        commonplace_notes (
          shortcode,
          title,
          source_book,
          insight,
          tags
        )
      `)
      .eq("owner_id", cleanOwnerId)
      .eq("mindmap_id", cleanMindMapId);

    if (nodesError) return { ok: false, error: "commonplace_save_failed" };

    const nodes: CommonplaceMindMapNode[] = ((nodesData as unknown as NodeJoinedRow[] | null) ?? []).map((row) => {
      const notesRel = row.commonplace_notes;
      const noteObj = Array.isArray(notesRel) ? notesRel[0] : notesRel;

      return {
        id: row.id,
        noteId: row.note_id,
        positionX: row.position_x,
        positionY: row.position_y,
        noteShortcode: noteObj?.shortcode || "",
        noteTitle: noteObj?.title?.trim() || noteObj?.source_book || "Untitled Source",
        noteInsight: noteObj?.insight || "",
        noteTags: noteObj?.tags ?? [],
      };
    });

    // 3. Fetch edges
    const { data: edgesData, error: edgesError } = await supabaseClient
      .from(EDGES_TABLE)
      .select("id, source_node_id, target_node_id, label")
      .eq("owner_id", cleanOwnerId)
      .eq("mindmap_id", cleanMindMapId);

    if (edgesError) return { ok: false, error: "commonplace_save_failed" };

    const edges: CommonplaceMindMapEdge[] = ((edgesData as EdgeRow[] | null) ?? []).map((row) => ({
      id: row.id,
      sourceNodeId: row.source_node_id,
      targetNodeId: row.target_node_id,
      label: row.label,
    }));

    return { ok: true, graph: { summary, nodes, edges } };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function saveCommonplaceMindMapGraph(
  input: SaveCommonplaceMindMapInput,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMindMapDeleteResult> {
  const ownerId = cleanRequiredText(input.ownerId);
  const mindMapId = cleanRequiredText(input.mindMapId);

  if (!ownerId || !mindMapId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  const nodes = input.nodes || [];
  const edges = input.edges || [];

  if (nodes.length > 100 || edges.length > 200) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  // Node validations
  const seenLocalIds = new Set<string>();
  const seenNoteIds = new Set<string>();

  for (const node of nodes) {
    const localId = cleanRequiredText(node.localId);
    const noteId = cleanRequiredText(node.noteId);

    if (!localId || !noteId || !Number.isFinite(node.positionX) || !Number.isFinite(node.positionY)) {
      return { ok: false, error: "commonplace_validation_failed" };
    }

    if (seenLocalIds.has(localId) || seenNoteIds.has(noteId)) {
      return { ok: false, error: "commonplace_validation_failed" };
    }

    seenLocalIds.add(localId);
    seenNoteIds.add(noteId);
  }

  // Edge validations
  const seenUndirected = new Set<string>();

  for (const edge of edges) {
    const sourceLocalId = cleanRequiredText(edge.sourceLocalId);
    const targetLocalId = cleanRequiredText(edge.targetLocalId);

    if (!sourceLocalId || !targetLocalId || sourceLocalId === targetLocalId) {
      return { ok: false, error: "commonplace_validation_failed" };
    }

    if (!seenLocalIds.has(sourceLocalId) || !seenLocalIds.has(targetLocalId)) {
      return { ok: false, error: "commonplace_validation_failed" };
    }

    // Undirected duplicate check
    const sortedPair = [sourceLocalId, targetLocalId].sort().join("->");
    if (seenUndirected.has(sortedPair)) {
      return { ok: false, error: "commonplace_validation_failed" };
    }
    seenUndirected.add(sortedPair);

    // Label length check
    if (edge.label !== undefined && edge.label !== null) {
      const trimmedLabel = edge.label.trim();
      if (trimmedLabel.length > 80) {
        return { ok: false, error: "commonplace_validation_failed" };
      }
    }
  }

  try {
    // 1. Verify mind map belongs to owner
    const { data: existingMap, error: mapError } = await supabaseClient
      .from(MINDMAPS_TABLE)
      .select("id")
      .eq("owner_id", ownerId)
      .eq("id", mindMapId)
      .maybeSingle();

    if (mapError) return { ok: false, error: "commonplace_save_failed" };
    if (!existingMap) return { ok: false, error: "commonplace_not_found" };

    // 2. Validate note ownership
    const noteIds = Array.from(seenNoteIds);
    if (noteIds.length > 0) {
      const { data: notesData, error: notesError } = await supabaseClient
        .from(NOTES_TABLE)
        .select("id")
        .eq("owner_id", ownerId)
        .in("id", noteIds);

      if (notesError || !notesData || notesData.length !== noteIds.length) {
        return { ok: false, error: "commonplace_validation_failed" };
      }
    }

    // 3. Delete existing edges first
    const { error: deleteEdgesError } = await supabaseClient
      .from(EDGES_TABLE)
      .delete()
      .eq("owner_id", ownerId)
      .eq("mindmap_id", mindMapId);

    if (deleteEdgesError) return { ok: false, error: "commonplace_save_failed" };

    // 4. Delete existing nodes next
    const { error: deleteNodesError } = await supabaseClient
      .from(NODES_TABLE)
      .delete()
      .eq("owner_id", ownerId)
      .eq("mindmap_id", mindMapId);

    if (deleteNodesError) return { ok: false, error: "commonplace_save_failed" };

    // 5. Insert new nodes
    const localIdToDbIdMap = new Map<string, string>();

    if (nodes.length > 0) {
      const nodesToInsert = nodes.map((n) => ({
        owner_id: ownerId,
        mindmap_id: mindMapId,
        note_id: n.noteId,
        position_x: n.positionX,
        position_y: n.positionY,
      }));

      const { data: insertedNodes, error: insertNodesError } = await supabaseClient
        .from(NODES_TABLE)
        .insert(nodesToInsert)
        .select("id, note_id");

      if (insertNodesError || !insertedNodes) {
        return { ok: false, error: "commonplace_save_failed" };
      }

      // Map noteId to localId
      const noteIdToLocalIdMap = new Map<string, string>();
      for (const node of nodes) {
        noteIdToLocalIdMap.set(node.noteId, node.localId);
      }

      // Map localId to database node UUID
      for (const insertedNode of insertedNodes) {
        const localId = noteIdToLocalIdMap.get(insertedNode.note_id);
        if (localId) {
          localIdToDbIdMap.set(localId, insertedNode.id);
        }
      }
    }

    // 6. Insert new edges
    if (edges.length > 0) {
      const edgesToInsert = edges.map((e) => {
        const sourceDbId = localIdToDbIdMap.get(e.sourceLocalId);
        const targetDbId = localIdToDbIdMap.get(e.targetLocalId);

        if (!sourceDbId || !targetDbId) {
          throw new Error("Invalid edge node reference mapping");
        }

        return {
          owner_id: ownerId,
          mindmap_id: mindMapId,
          source_node_id: sourceDbId,
          target_node_id: targetDbId,
          label: e.label ? e.label.trim() : null,
        };
      });

      const { error: insertEdgesError } = await supabaseClient
        .from(EDGES_TABLE)
        .insert(edgesToInsert);

      if (insertEdgesError) {
        return { ok: false, error: "commonplace_save_failed" };
      }
    }

    // 7. Update mind map timestamp/title
    const mapUpdate: { updated_at: string; title?: string } = {
      updated_at: new Date().toISOString(),
    };

    if (input.title !== undefined && input.title !== null) {
      const cleanTitle = input.title.trim();
      if (cleanTitle.length > 0 && cleanTitle.length <= 120) {
        mapUpdate.title = cleanTitle;
      }
    }

    const { error: updateMapError } = await supabaseClient
      .from(MINDMAPS_TABLE)
      .update(mapUpdate)
      .eq("owner_id", ownerId)
      .eq("id", mindMapId);

    if (updateMapError) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function deleteCommonplaceMindMap(
  ownerId: string,
  mindMapId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMindMapDeleteResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanMindMapId = cleanRequiredText(mindMapId);

  if (!cleanOwnerId || !cleanMindMapId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const { error } = await supabaseClient
      .from(MINDMAPS_TABLE)
      .delete()
      .eq("owner_id", cleanOwnerId)
      .eq("id", cleanMindMapId);

    if (error) return { ok: false, error: "commonplace_save_failed" };

    return { ok: true };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function createOrGetMainMindMap(
  ownerId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMindMapResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);

  if (!cleanOwnerId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const { data: existingData, error: readError } = await supabaseClient
      .from(MINDMAPS_TABLE)
      .select("*")
      .eq("owner_id", cleanOwnerId)
      .eq("type", "main")
      .maybeSingle();

    if (readError) return { ok: false, error: "commonplace_save_failed" };

    if (existingData) {
      return { ok: true, mindMap: mapMindMapRow(existingData as MindMapRow) };
    }

    const { data: createdData, error: createError } = await supabaseClient
      .from(MINDMAPS_TABLE)
      .insert({
        owner_id: cleanOwnerId,
        title: "Main Mind Map",
        type: "main",
      })
      .select("*")
      .single();

    if (createError || !createdData) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    return { ok: true, mindMap: mapMindMapRow(createdData as MindMapRow) };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function createOrGetCommonplaceMainMindMap(
  ownerId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMindMapResult> {
  return createOrGetMainMindMap(ownerId, supabaseClient);
}

export async function getCommonplaceMainMindMapGraph(
  ownerId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMainMapGraphResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  if (!cleanOwnerId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const mainMapResult = await createOrGetMainMindMap(cleanOwnerId, supabaseClient);
    if (!mainMapResult.ok) {
      return { ok: false, error: mainMapResult.error };
    }
    const summary = mainMapResult.mindMap;

    const { data: clustersData, error: clustersError } = await supabaseClient
      .from(MAINMAP_NODES_TABLE)
      .select(`
        id,
        sub_mindmap_id,
        position_x,
        position_y,
        commonplace_mindmaps:sub_mindmap_id (
          title,
          updated_at
        )
      `)
      .eq("owner_id", cleanOwnerId)
      .eq("main_mindmap_id", summary.id);

    if (clustersError) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    type ClusterJoinedRow = {
      id: string;
      sub_mindmap_id: string;
      position_x: number;
      position_y: number;
      commonplace_mindmaps: {
        title: string;
        updated_at: string;
      } | Array<{
        title: string;
        updated_at: string;
      }> | null;
    };

    const clusters: CommonplaceMainMapCluster[] = ((clustersData as unknown as ClusterJoinedRow[] | null) ?? []).map((row) => {
      const mindmapRel = row.commonplace_mindmaps;
      const mindmapObj = Array.isArray(mindmapRel) ? mindmapRel[0] : mindmapRel;

      return {
        id: row.id,
        subMindMapId: row.sub_mindmap_id,
        subMindMapTitle: mindmapObj?.title || "Untitled Mind Map",
        positionX: row.position_x,
        positionY: row.position_y,
        updatedAt: mindmapObj?.updated_at || new Date().toISOString(),
      };
    });

    const { data: edgesData, error: edgesError } = await supabaseClient
      .from(MAINMAP_EDGES_TABLE)
      .select("id, source_node_id, target_node_id, label")
      .eq("owner_id", cleanOwnerId)
      .eq("main_mindmap_id", summary.id);

    if (edgesError) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    type EdgeRow = {
      id: string;
      source_node_id: string;
      target_node_id: string;
      label: string | null;
    };

    const edges: CommonplaceMainMapEdge[] = ((edgesData as EdgeRow[] | null) ?? []).map((row) => ({
      id: row.id,
      sourceNodeId: row.source_node_id,
      targetNodeId: row.target_node_id,
      label: row.label,
    }));

    return {
      ok: true,
      graph: {
        summary,
        clusters,
        edges,
      },
    };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function saveCommonplaceMainMindMapGraph(
  input: SaveCommonplaceMainMapGraphInput,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMainMapSaveResult> {
  const ownerId = cleanRequiredText(input.ownerId);
  if (!ownerId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  const clusters = input.clusters || [];
  const edges = input.edges || [];

  if (clusters.length > 100 || edges.length > 200) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  const seenLocalIds = new Set<string>();
  const seenSubMapIds = new Set<string>();

  for (const c of clusters) {
    const localId = cleanRequiredText(c.localId);
    const subMindMapId = cleanRequiredText(c.subMindMapId);

    if (!localId || !subMindMapId || !Number.isFinite(c.positionX) || !Number.isFinite(c.positionY)) {
      return { ok: false, error: "commonplace_validation_failed" };
    }

    if (seenLocalIds.has(localId) || seenSubMapIds.has(subMindMapId)) {
      return { ok: false, error: "commonplace_validation_failed" };
    }

    seenLocalIds.add(localId);
    seenSubMapIds.add(subMindMapId);
  }

  const seenUndirected = new Set<string>();
  for (const e of edges) {
    const sourceLocalId = cleanRequiredText(e.sourceLocalId);
    const targetLocalId = cleanRequiredText(e.targetLocalId);

    if (!sourceLocalId || !targetLocalId || sourceLocalId === targetLocalId) {
      return { ok: false, error: "commonplace_validation_failed" };
    }

    if (!seenLocalIds.has(sourceLocalId) || !seenLocalIds.has(targetLocalId)) {
      return { ok: false, error: "commonplace_validation_failed" };
    }

    const sortedPair = [sourceLocalId, targetLocalId].sort().join("->");
    if (seenUndirected.has(sortedPair)) {
      return { ok: false, error: "commonplace_validation_failed" };
    }
    seenUndirected.add(sortedPair);

    if (e.label !== undefined && e.label !== null) {
      const trimmedLabel = e.label.trim();
      if (trimmedLabel.length > 80) {
        return { ok: false, error: "commonplace_validation_failed" };
      }
    }
  }

  try {
    const mainMapResult = await createOrGetMainMindMap(ownerId, supabaseClient);
    if (!mainMapResult.ok) {
      return { ok: false, error: mainMapResult.error };
    }
    const summary = mainMapResult.mindMap;

    const subMapIds = Array.from(seenSubMapIds);
    if (subMapIds.length > 0) {
      const { data: subMapsData, error: subMapsError } = await supabaseClient
        .from(MINDMAPS_TABLE)
        .select("id, type")
        .eq("owner_id", ownerId)
        .in("id", subMapIds);

      if (subMapsError || !subMapsData || subMapsData.length !== subMapIds.length) {
        return { ok: false, error: "commonplace_validation_failed" };
      }

      for (const m of subMapsData) {
        if (m.type !== "sub") {
          return { ok: false, error: "commonplace_validation_failed" };
        }
      }
    }

    const { error: deleteEdgesError } = await supabaseClient
      .from(MAINMAP_EDGES_TABLE)
      .delete()
      .eq("owner_id", ownerId)
      .eq("main_mindmap_id", summary.id);

    if (deleteEdgesError) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    const { error: deleteNodesError } = await supabaseClient
      .from(MAINMAP_NODES_TABLE)
      .delete()
      .eq("owner_id", ownerId)
      .eq("main_mindmap_id", summary.id);

    if (deleteNodesError) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    const localIdToDbIdMap = new Map<string, string>();
    const clustersToInsert = clusters.map((c) => ({
      owner_id: ownerId,
      main_mindmap_id: summary.id,
      sub_mindmap_id: c.subMindMapId,
      position_x: c.positionX,
      position_y: c.positionY,
    }));

    if (clustersToInsert.length > 0) {
      const { data: insertedClusters, error: insertNodesError } = await supabaseClient
        .from(MAINMAP_NODES_TABLE)
        .insert(clustersToInsert)
        .select("id, sub_mindmap_id");

      if (insertNodesError || !insertedClusters) {
        return { ok: false, error: "commonplace_save_failed" };
      }

      const subIdToLocalIdMap = new Map<string, string>();
      for (const c of clusters) {
        subIdToLocalIdMap.set(c.subMindMapId, c.localId);
      }

      for (const ic of insertedClusters) {
        const localId = subIdToLocalIdMap.get(ic.sub_mindmap_id);
        if (localId) {
          localIdToDbIdMap.set(localId, ic.id);
        }
      }
    }

    const edgesToInsert = edges.map((e) => {
      const sourceDbId = localIdToDbIdMap.get(e.sourceLocalId);
      const targetDbId = localIdToDbIdMap.get(e.targetLocalId);
      if (!sourceDbId || !targetDbId) {
        throw new Error("Invalid edge node reference mapping");
      }

      return {
        owner_id: ownerId,
        main_mindmap_id: summary.id,
        source_node_id: sourceDbId,
        target_node_id: targetDbId,
        label: e.label ? e.label.trim() : null,
      };
    });

    if (edgesToInsert.length > 0) {
      const { error: insertEdgesError } = await supabaseClient
        .from(MAINMAP_EDGES_TABLE)
        .insert(edgesToInsert);

      if (insertEdgesError) {
        return { ok: false, error: "commonplace_save_failed" };
      }
    }

    const mapUpdate: { updated_at: string; title?: string } = {
      updated_at: new Date().toISOString(),
    };

    if (input.title !== undefined && input.title !== null) {
      const cleanTitle = input.title.trim();
      if (cleanTitle.length > 0 && cleanTitle.length <= 120) {
        mapUpdate.title = cleanTitle;
      }
    }

    const { error: updateMapError } = await supabaseClient
      .from(MINDMAPS_TABLE)
      .update(mapUpdate)
      .eq("owner_id", ownerId)
      .eq("id", summary.id);

    if (updateMapError) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    return getCommonplaceMainMindMapGraph(ownerId, supabaseClient);
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function deleteCommonplaceMainMapCluster(
  ownerId: string,
  mainMapNodeId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMindMapDeleteResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanNodeId = cleanRequiredText(mainMapNodeId);

  if (!cleanOwnerId || !cleanNodeId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const { error } = await supabaseClient
      .from(MAINMAP_NODES_TABLE)
      .delete()
      .eq("owner_id", cleanOwnerId)
      .eq("id", cleanNodeId);

    if (error) return { ok: false, error: "commonplace_save_failed" };

    return { ok: true };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}
