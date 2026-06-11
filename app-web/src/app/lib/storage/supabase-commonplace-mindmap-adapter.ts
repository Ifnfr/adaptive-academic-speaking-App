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

export type CommonplaceMindMapEdgeType = "solid" | "dashed";

export type CommonplaceMindMapEdgeInput = {
  sourceLocalId: string;
  targetLocalId: string;
  edgeType?: CommonplaceMindMapEdgeType | null;
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
  edgeType: CommonplaceMindMapEdgeType;
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

export type CommonplaceMapCanvasNoteNode = {
  id: string;
  nodeKind: "note";
  noteId: string;
  positionX: number;
  positionY: number;
  noteShortcode: string;
  noteTitle: string | null;
  noteSourceBook: string;
  noteTags: string[];
};

export type CommonplaceMapCanvasClusterNode = {
  id: string;
  nodeKind: "cluster";
  subMindMapId: string;
  subMindMapTitle: string;
  subMindMapUpdatedAt: string;
  positionX: number;
  positionY: number;
};

export type CommonplaceMapCanvasNode =
  | CommonplaceMapCanvasNoteNode
  | CommonplaceMapCanvasClusterNode;

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

export type CommonplaceMapNoteNodeCreateResult =
  | { ok: true; node: CommonplaceMapCanvasNoteNode }
  | { ok: false; error: CommonplaceError };

export type CreateMainMapClusterNodeInput = {
  mainMapId: string;
  subMindmapId: string;
  position: {
    x: number;
    y: number;
  };
};

export type CreateMainMapNoteNodeInput = {
  mainMapId: string;
  noteId: string;
  position: {
    x: number;
    y: number;
  };
};

export type CommonplaceMapClusterNodeCreateResult =
  | { ok: true; node: CommonplaceMapCanvasClusterNode }
  | { ok: false; error: CommonplaceError };

export type CommonplaceSubMapEdge = {
  id: string;
  mapId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: CommonplaceMindMapEdgeType;
  label: string | null;
};

export type CreateCommonplaceSubMapEdgeInput = {
  mapId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: CommonplaceMindMapEdgeType;
  label?: string | null;
};

export type UpdateCommonplaceSubMapEdgeInput = {
  mapId: string;
  edgeId: string;
  edgeType?: CommonplaceMindMapEdgeType | null;
  label?: string | null;
};

export type CommonplaceSubMapEdgeListResult =
  | { ok: true; edges: CommonplaceSubMapEdge[] }
  | { ok: false; error: CommonplaceError };

export type CommonplaceSubMapEdgeResult =
  | { ok: true; edge: CommonplaceSubMapEdge }
  | { ok: false; error: CommonplaceError };

export type CreateCommonplaceMainMapEdgeInput = {
  mainMapId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: CommonplaceMindMapEdgeType;
  label?: string | null;
};

export type UpdateCommonplaceMainMapEdgeInput = {
  mainMapId: string;
  edgeId: string;
  edgeType?: CommonplaceMindMapEdgeType | null;
  label?: string | null;
};

export type CommonplaceMainMapEdgeListResult = CommonplaceSubMapEdgeListResult;

export type CommonplaceMainMapEdgeResult = CommonplaceSubMapEdgeResult;

const MAINMAP_NODES_TABLE = "commonplace_main_map_nodes";
const MAINMAP_EDGES_TABLE = "commonplace_main_map_edges";

export type CommonplaceMainMapSummary = CommonplaceMindMapSummary;

export type CommonplaceMainMapNodeKind = "cluster" | "note";

export type CommonplaceMainMapEdgeType = CommonplaceMindMapEdgeType;

export type CommonplaceMainMapClusterInput = {
  localId: string;
  subMindMapId: string;
  positionX: number;
  positionY: number;
};

export type CommonplaceMainMapEdgeInput = {
  sourceLocalId: string;
  targetLocalId: string;
  edgeType?: CommonplaceMainMapEdgeType | null;
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
  edgeType: CommonplaceMainMapEdgeType;
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

type MainClusterJoinedRow = {
  id: string;
  node_kind?: string | null;
  note_id?: string | null;
  sub_mindmap_id: string | null;
  position_x: number;
  position_y: number;
  commonplace_mindmaps: {
    title: string | null;
    updated_at: string | null;
  } | Array<{
    title: string | null;
    updated_at: string | null;
  }> | null;
  commonplace_notes?: {
    shortcode: string;
    title: string | null;
    source_book: string;
    tags: string[] | null;
  } | Array<{
    shortcode: string;
    title: string | null;
    source_book: string;
    tags: string[] | null;
  }> | null;
};

type EdgeRow = {
  id: string;
  mindmap_id?: string;
  main_mindmap_id?: string;
  source_node_id: string;
  target_node_id: string;
  edge_type?: string | null;
  label: string | null;
};

type EdgeNodeRow = {
  id: string;
  mindmap_id: string;
};

type MainEdgeNodeRow = {
  id: string;
  main_mindmap_id: string;
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

function cleanEdgeType(value: unknown): CommonplaceMindMapEdgeType | null {
  return value === "solid" || value === "dashed" ? value : null;
}

function cleanOptionalEdgeLabel(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length > 80) return undefined;
  return trimmed || null;
}

function mapSubMapEdgeRow(
  row: EdgeRow,
  fallbackMapId: string,
): CommonplaceSubMapEdge {
  return {
    id: row.id,
    mapId: row.mindmap_id ?? fallbackMapId,
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id,
    edgeType: cleanEdgeType(row.edge_type) ?? "solid",
    label: row.label,
  };
}

function mapMainMapEdgeRow(
  row: EdgeRow,
  fallbackMainMapId: string,
): CommonplaceSubMapEdge {
  return {
    id: row.id,
    mapId: row.main_mindmap_id ?? fallbackMainMapId,
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id,
    edgeType: cleanEdgeType(row.edge_type) ?? "solid",
    label: row.label,
  };
}

function mapMainClusterNodeRow(
  row: MainClusterJoinedRow,
): CommonplaceMapCanvasClusterNode {
  const mindmapRel = row.commonplace_mindmaps;
  const mindmapObj = Array.isArray(mindmapRel) ? mindmapRel[0] : mindmapRel;

  return {
    id: row.id,
    nodeKind: "cluster",
    subMindMapId: row.sub_mindmap_id ?? "",
    subMindMapTitle: mindmapObj?.title?.trim() || "Untitled Sub Mind Map",
    subMindMapUpdatedAt: mindmapObj?.updated_at || new Date().toISOString(),
    positionX: row.position_x,
    positionY: row.position_y,
  };
}

function mapMainNoteNodeRow(
  row: MainClusterJoinedRow,
): CommonplaceMapCanvasNoteNode {
  const notesRel = row.commonplace_notes;
  const noteObj = Array.isArray(notesRel) ? notesRel[0] : notesRel;

  return {
    id: row.id,
    nodeKind: "note",
    noteId: row.note_id ?? "",
    positionX: row.position_x,
    positionY: row.position_y,
    noteShortcode: noteObj?.shortcode || "",
    noteTitle: noteObj?.title?.trim() || null,
    noteSourceBook: noteObj?.source_book || "Untitled Source",
    noteTags: noteObj?.tags ?? [],
  };
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

function cleanPosition(value: unknown): { x: number; y: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const position = value as { x?: unknown; y?: unknown };
  return typeof position.x === "number" &&
    typeof position.y === "number" &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y)
    ? { x: position.x, y: position.y }
    : null;
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
      return listMainMapNodes(cleanOwnerId, cleanMindMapId, supabaseClient);
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
        nodeKind: "note",
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

export async function listMainMapNodes(
  ownerId: string,
  mainMapId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMapNodeListResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanMainMapId = cleanRequiredText(mainMapId);

  if (!cleanOwnerId || !cleanMainMapId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const mapResult = await verifyOwnerScopedMap(
      cleanOwnerId,
      cleanMainMapId,
      "main",
      supabaseClient,
    );
    if (!mapResult.ok) return mapResult;

    const { data, error } = await supabaseClient
      .from(MAINMAP_NODES_TABLE)
      .select(`
        id,
        node_kind,
        note_id,
        sub_mindmap_id,
        position_x,
        position_y,
        commonplace_mindmaps:sub_mindmap_id (
          title,
          updated_at
        ),
        commonplace_notes:note_id (
          shortcode,
          title,
          source_book,
          tags
        )
      `)
      .eq("owner_id", cleanOwnerId)
      .eq("main_mindmap_id", cleanMainMapId)
      .order("updated_at", { ascending: false });

    if (error) return { ok: false, error: "commonplace_save_failed" };

    const nodes: CommonplaceMapCanvasNode[] = (
      (data as unknown as MainClusterJoinedRow[] | null) ?? []
    ).flatMap((row): CommonplaceMapCanvasNode[] =>
      row.node_kind === "note"
        ? [mapMainNoteNodeRow(row)]
        : row.node_kind === "cluster" || !row.node_kind
          ? [mapMainClusterNodeRow(row)]
          : [],
    );

    return { ok: true, nodes };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function createMainMapClusterNode(
  ownerId: string,
  input: CreateMainMapClusterNodeInput,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMapClusterNodeCreateResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanMainMapId = cleanRequiredText(input.mainMapId);
  const cleanSubMindMapId = cleanRequiredText(input.subMindmapId);
  const cleanNodePosition = cleanPosition(input.position);

  if (
    !cleanOwnerId ||
    !cleanMainMapId ||
    !cleanSubMindMapId ||
    !cleanNodePosition
  ) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const mainMapResult = await verifyOwnerScopedMap(
      cleanOwnerId,
      cleanMainMapId,
      "main",
      supabaseClient,
    );
    if (!mainMapResult.ok) return mainMapResult;

    const { data: subMapData, error: subMapError } = await supabaseClient
      .from(MINDMAPS_TABLE)
      .select("id, title, updated_at")
      .eq("owner_id", cleanOwnerId)
      .eq("id", cleanSubMindMapId)
      .eq("type", "sub")
      .maybeSingle();

    if (subMapError) return { ok: false, error: "commonplace_save_failed" };
    if (!subMapData) return { ok: false, error: "commonplace_not_found" };

    const { data: insertedNode, error: insertError } = await supabaseClient
      .from(MAINMAP_NODES_TABLE)
      .insert({
        owner_id: cleanOwnerId,
        main_mindmap_id: cleanMainMapId,
        node_kind: "cluster",
        sub_mindmap_id: cleanSubMindMapId,
        note_id: null,
        position_x: cleanNodePosition.x,
        position_y: cleanNodePosition.y,
      })
      .select("id, sub_mindmap_id, position_x, position_y")
      .single();

    if (insertError || !insertedNode) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    const subMapRow = subMapData as {
      title?: string | null;
      updated_at?: string | null;
    };
    const nodeRow = insertedNode as {
      id: string;
      sub_mindmap_id: string;
      position_x: number;
      position_y: number;
    };

    return {
      ok: true,
      node: {
        id: nodeRow.id,
        nodeKind: "cluster",
        subMindMapId: nodeRow.sub_mindmap_id,
        subMindMapTitle: subMapRow.title?.trim() || "Untitled Sub Mind Map",
        subMindMapUpdatedAt: subMapRow.updated_at || new Date().toISOString(),
        positionX: nodeRow.position_x,
        positionY: nodeRow.position_y,
      },
    };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function createSubMapNoteNode(
  ownerId: string,
  mindMapId: string,
  noteId: string,
  position: { x: number; y: number },
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMapNoteNodeCreateResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanMindMapId = cleanRequiredText(mindMapId);
  const cleanNoteId = cleanRequiredText(noteId);
  const cleanNodePosition = cleanPosition(position);

  if (!cleanOwnerId || !cleanMindMapId || !cleanNoteId || !cleanNodePosition) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const mapResult = await verifyOwnerScopedMap(
      cleanOwnerId,
      cleanMindMapId,
      "sub",
      supabaseClient,
    );
    if (!mapResult.ok) return mapResult;

    const { data: noteData, error: noteError } = await supabaseClient
      .from(NOTES_TABLE)
      .select("id, shortcode, title, source_book, tags")
      .eq("owner_id", cleanOwnerId)
      .eq("id", cleanNoteId)
      .maybeSingle();

    if (noteError) return { ok: false, error: "commonplace_save_failed" };
    if (!noteData) return { ok: false, error: "commonplace_not_found" };

    const { data: insertedNode, error: insertError } = await supabaseClient
      .from(NODES_TABLE)
      .insert({
        owner_id: cleanOwnerId,
        mindmap_id: cleanMindMapId,
        note_id: cleanNoteId,
        position_x: cleanNodePosition.x,
        position_y: cleanNodePosition.y,
      })
      .select("id, note_id, position_x, position_y")
      .single();

    if (insertError || !insertedNode) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    const noteRow = noteData as {
      shortcode?: string | null;
      title?: string | null;
      source_book?: string | null;
      tags?: string[] | null;
    };
    const nodeRow = insertedNode as {
      id: string;
      note_id: string;
      position_x: number;
      position_y: number;
    };

    return {
      ok: true,
      node: {
        id: nodeRow.id,
        nodeKind: "note",
        noteId: nodeRow.note_id,
        positionX: nodeRow.position_x,
        positionY: nodeRow.position_y,
        noteShortcode: noteRow.shortcode || "",
        noteTitle: noteRow.title?.trim() || null,
        noteSourceBook: noteRow.source_book || "Untitled Source",
        noteTags: noteRow.tags ?? [],
      },
    };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function createMainMapNoteNode(
  ownerId: string,
  input: CreateMainMapNoteNodeInput,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMapNoteNodeCreateResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanMainMapId = cleanRequiredText(input.mainMapId);
  const cleanNoteId = cleanRequiredText(input.noteId);
  const cleanNodePosition = cleanPosition(input.position);

  if (!cleanOwnerId || !cleanMainMapId || !cleanNoteId || !cleanNodePosition) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const mainMapResult = await verifyOwnerScopedMap(
      cleanOwnerId,
      cleanMainMapId,
      "main",
      supabaseClient,
    );
    if (!mainMapResult.ok) return mainMapResult;

    const { data: noteData, error: noteError } = await supabaseClient
      .from(NOTES_TABLE)
      .select("id, shortcode, title, source_book, tags")
      .eq("owner_id", cleanOwnerId)
      .eq("id", cleanNoteId)
      .maybeSingle();

    if (noteError) return { ok: false, error: "commonplace_save_failed" };
    if (!noteData) return { ok: false, error: "commonplace_not_found" };

    const { data: insertedNode, error: insertError } = await supabaseClient
      .from(MAINMAP_NODES_TABLE)
      .insert({
        owner_id: cleanOwnerId,
        main_mindmap_id: cleanMainMapId,
        node_kind: "note",
        sub_mindmap_id: null,
        note_id: cleanNoteId,
        position_x: cleanNodePosition.x,
        position_y: cleanNodePosition.y,
      })
      .select("id, note_id, position_x, position_y")
      .single();

    if (insertError || !insertedNode) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    const noteRow = noteData as {
      shortcode?: string | null;
      title?: string | null;
      source_book?: string | null;
      tags?: string[] | null;
    };
    const nodeRow = insertedNode as {
      id: string;
      note_id: string;
      position_x: number;
      position_y: number;
    };

    return {
      ok: true,
      node: {
        id: nodeRow.id,
        nodeKind: "note",
        noteId: nodeRow.note_id,
        positionX: nodeRow.position_x,
        positionY: nodeRow.position_y,
        noteShortcode: noteRow.shortcode || "",
        noteTitle: noteRow.title?.trim() || null,
        noteSourceBook: noteRow.source_book || "Untitled Source",
        noteTags: noteRow.tags ?? [],
      },
    };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

async function verifySubMapEdgeNodes(
  ownerId: string,
  mindMapId: string,
  sourceNodeId: string,
  targetNodeId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMindMapDeleteResult> {
  if (sourceNodeId === targetNodeId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  const { data, error } = await supabaseClient
    .from(NODES_TABLE)
    .select("id, mindmap_id")
    .eq("owner_id", ownerId)
    .eq("mindmap_id", mindMapId)
    .in("id", [sourceNodeId, targetNodeId]);

  if (error) return { ok: false, error: "commonplace_save_failed" };

  const rows = ((data as EdgeNodeRow[] | null) ?? []).filter(
    (row) => row.mindmap_id === mindMapId,
  );
  const foundIds = new Set(rows.map((row) => row.id));
  if (
    rows.length !== 2 ||
    !foundIds.has(sourceNodeId) ||
    !foundIds.has(targetNodeId)
  ) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  return { ok: true };
}

async function verifyMainMapEdgeNodes(
  ownerId: string,
  mainMapId: string,
  sourceNodeId: string,
  targetNodeId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMindMapDeleteResult> {
  if (sourceNodeId === targetNodeId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  const { data, error } = await supabaseClient
    .from(MAINMAP_NODES_TABLE)
    .select("id, main_mindmap_id")
    .eq("owner_id", ownerId)
    .eq("main_mindmap_id", mainMapId)
    .in("id", [sourceNodeId, targetNodeId]);

  if (error) return { ok: false, error: "commonplace_save_failed" };

  const rows = ((data as MainEdgeNodeRow[] | null) ?? []).filter(
    (row) => row.main_mindmap_id === mainMapId,
  );
  const foundIds = new Set(rows.map((row) => row.id));
  if (
    rows.length !== 2 ||
    !foundIds.has(sourceNodeId) ||
    !foundIds.has(targetNodeId)
  ) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  return { ok: true };
}

export async function listSubMapEdges(
  ownerId: string,
  mindMapId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceSubMapEdgeListResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanMindMapId = cleanRequiredText(mindMapId);
  if (!cleanOwnerId || !cleanMindMapId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const mapResult = await verifyOwnerScopedMap(
      cleanOwnerId,
      cleanMindMapId,
      "sub",
      supabaseClient,
    );
    if (!mapResult.ok) return mapResult;

    const { data, error } = await supabaseClient
      .from(EDGES_TABLE)
      .select("id, mindmap_id, source_node_id, target_node_id, edge_type, label")
      .eq("owner_id", cleanOwnerId)
      .eq("mindmap_id", cleanMindMapId)
      .order("created_at", { ascending: true });

    if (error) return { ok: false, error: "commonplace_save_failed" };

    return {
      ok: true,
      edges: ((data as EdgeRow[] | null) ?? []).map((row) =>
        mapSubMapEdgeRow(row, cleanMindMapId),
      ),
    };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function createSubMapEdge(
  ownerId: string,
  input: CreateCommonplaceSubMapEdgeInput,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceSubMapEdgeResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanMindMapId = cleanRequiredText(input.mapId);
  const sourceNodeId = cleanRequiredText(input.sourceNodeId);
  const targetNodeId = cleanRequiredText(input.targetNodeId);
  const edgeType = cleanEdgeType(input.edgeType);
  const label = cleanOptionalEdgeLabel(input.label);

  if (
    !cleanOwnerId ||
    !cleanMindMapId ||
    !sourceNodeId ||
    !targetNodeId ||
    !edgeType ||
    label === undefined
  ) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const mapResult = await verifyOwnerScopedMap(
      cleanOwnerId,
      cleanMindMapId,
      "sub",
      supabaseClient,
    );
    if (!mapResult.ok) return mapResult;

    const nodeResult = await verifySubMapEdgeNodes(
      cleanOwnerId,
      cleanMindMapId,
      sourceNodeId,
      targetNodeId,
      supabaseClient,
    );
    if (!nodeResult.ok) return nodeResult;

    const { data, error } = await supabaseClient
      .from(EDGES_TABLE)
      .insert({
        owner_id: cleanOwnerId,
        mindmap_id: cleanMindMapId,
        source_node_id: sourceNodeId,
        target_node_id: targetNodeId,
        edge_type: edgeType,
        label,
      })
      .select("id, mindmap_id, source_node_id, target_node_id, edge_type, label")
      .single();

    if (error || !data) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    return {
      ok: true,
      edge: mapSubMapEdgeRow(data as EdgeRow, cleanMindMapId),
    };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function updateSubMapEdge(
  ownerId: string,
  input: UpdateCommonplaceSubMapEdgeInput,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceSubMapEdgeResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanMindMapId = cleanRequiredText(input.mapId);
  const edgeId = cleanRequiredText(input.edgeId);
  const hasEdgeType = input.edgeType !== undefined && input.edgeType !== null;
  const hasLabel = Object.prototype.hasOwnProperty.call(input, "label");
  const edgeType = hasEdgeType ? cleanEdgeType(input.edgeType) : null;
  const label = hasLabel ? cleanOptionalEdgeLabel(input.label) : undefined;

  if (
    !cleanOwnerId ||
    !cleanMindMapId ||
    !edgeId ||
    (!hasEdgeType && !hasLabel) ||
    (hasEdgeType && !edgeType) ||
    (hasLabel && label === undefined)
  ) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const mapResult = await verifyOwnerScopedMap(
      cleanOwnerId,
      cleanMindMapId,
      "sub",
      supabaseClient,
    );
    if (!mapResult.ok) return mapResult;

    const updatePayload: {
      updated_at: string;
      edge_type?: CommonplaceMindMapEdgeType;
      label?: string | null;
    } = { updated_at: new Date().toISOString() };
    if (edgeType) updatePayload.edge_type = edgeType;
    if (hasLabel) updatePayload.label = label ?? null;

    const { data, error } = await supabaseClient
      .from(EDGES_TABLE)
      .update(updatePayload)
      .eq("owner_id", cleanOwnerId)
      .eq("mindmap_id", cleanMindMapId)
      .eq("id", edgeId)
      .select("id, mindmap_id, source_node_id, target_node_id, edge_type, label")
      .maybeSingle();

    if (error) return { ok: false, error: "commonplace_save_failed" };
    if (!data) return { ok: false, error: "commonplace_not_found" };

    return {
      ok: true,
      edge: mapSubMapEdgeRow(data as EdgeRow, cleanMindMapId),
    };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function deleteSubMapEdge(
  ownerId: string,
  mindMapId: string,
  edgeId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMindMapDeleteResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanMindMapId = cleanRequiredText(mindMapId);
  const cleanEdgeId = cleanRequiredText(edgeId);
  if (!cleanOwnerId || !cleanMindMapId || !cleanEdgeId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const mapResult = await verifyOwnerScopedMap(
      cleanOwnerId,
      cleanMindMapId,
      "sub",
      supabaseClient,
    );
    if (!mapResult.ok) return mapResult;

    const { data: existingEdge, error: readError } = await supabaseClient
      .from(EDGES_TABLE)
      .select("id")
      .eq("owner_id", cleanOwnerId)
      .eq("mindmap_id", cleanMindMapId)
      .eq("id", cleanEdgeId)
      .maybeSingle();

    if (readError) return { ok: false, error: "commonplace_save_failed" };
    if (!existingEdge) return { ok: false, error: "commonplace_not_found" };

    const { error } = await supabaseClient
      .from(EDGES_TABLE)
      .delete()
      .eq("owner_id", cleanOwnerId)
      .eq("mindmap_id", cleanMindMapId)
      .eq("id", cleanEdgeId);

    if (error) return { ok: false, error: "commonplace_save_failed" };

    return { ok: true };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function listMainMapEdges(
  ownerId: string,
  mainMapId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMainMapEdgeListResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanMainMapId = cleanRequiredText(mainMapId);
  if (!cleanOwnerId || !cleanMainMapId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const mapResult = await verifyOwnerScopedMap(
      cleanOwnerId,
      cleanMainMapId,
      "main",
      supabaseClient,
    );
    if (!mapResult.ok) return mapResult;

    const { data, error } = await supabaseClient
      .from(MAINMAP_EDGES_TABLE)
      .select("id, main_mindmap_id, source_node_id, target_node_id, edge_type, label")
      .eq("owner_id", cleanOwnerId)
      .eq("main_mindmap_id", cleanMainMapId)
      .order("created_at", { ascending: true });

    if (error) return { ok: false, error: "commonplace_save_failed" };

    return {
      ok: true,
      edges: ((data as EdgeRow[] | null) ?? []).map((row) =>
        mapMainMapEdgeRow(row, cleanMainMapId),
      ),
    };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function createMainMapEdge(
  ownerId: string,
  input: CreateCommonplaceMainMapEdgeInput,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMainMapEdgeResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanMainMapId = cleanRequiredText(input.mainMapId);
  const sourceNodeId = cleanRequiredText(input.sourceNodeId);
  const targetNodeId = cleanRequiredText(input.targetNodeId);
  const edgeType = cleanEdgeType(input.edgeType);
  const label = cleanOptionalEdgeLabel(input.label);

  if (
    !cleanOwnerId ||
    !cleanMainMapId ||
    !sourceNodeId ||
    !targetNodeId ||
    sourceNodeId === targetNodeId ||
    !edgeType ||
    label === undefined
  ) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const mapResult = await verifyOwnerScopedMap(
      cleanOwnerId,
      cleanMainMapId,
      "main",
      supabaseClient,
    );
    if (!mapResult.ok) return mapResult;

    const nodeResult = await verifyMainMapEdgeNodes(
      cleanOwnerId,
      cleanMainMapId,
      sourceNodeId,
      targetNodeId,
      supabaseClient,
    );
    if (!nodeResult.ok) return nodeResult;

    const { data, error } = await supabaseClient
      .from(MAINMAP_EDGES_TABLE)
      .insert({
        owner_id: cleanOwnerId,
        main_mindmap_id: cleanMainMapId,
        source_node_id: sourceNodeId,
        target_node_id: targetNodeId,
        edge_type: edgeType,
        label,
      })
      .select("id, main_mindmap_id, source_node_id, target_node_id, edge_type, label")
      .single();

    if (error || !data) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    return {
      ok: true,
      edge: mapMainMapEdgeRow(data as EdgeRow, cleanMainMapId),
    };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function updateMainMapEdge(
  ownerId: string,
  input: UpdateCommonplaceMainMapEdgeInput,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMainMapEdgeResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanMainMapId = cleanRequiredText(input.mainMapId);
  const edgeId = cleanRequiredText(input.edgeId);
  const hasEdgeType = input.edgeType !== undefined && input.edgeType !== null;
  const hasLabel = Object.prototype.hasOwnProperty.call(input, "label");
  const edgeType = hasEdgeType ? cleanEdgeType(input.edgeType) : null;
  const label = hasLabel ? cleanOptionalEdgeLabel(input.label) : undefined;

  if (
    !cleanOwnerId ||
    !cleanMainMapId ||
    !edgeId ||
    (!hasEdgeType && !hasLabel) ||
    (hasEdgeType && !edgeType) ||
    (hasLabel && label === undefined)
  ) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const mapResult = await verifyOwnerScopedMap(
      cleanOwnerId,
      cleanMainMapId,
      "main",
      supabaseClient,
    );
    if (!mapResult.ok) return mapResult;

    const updatePayload: {
      updated_at: string;
      edge_type?: CommonplaceMindMapEdgeType;
      label?: string | null;
    } = { updated_at: new Date().toISOString() };
    if (edgeType) updatePayload.edge_type = edgeType;
    if (hasLabel) updatePayload.label = label ?? null;

    const { data, error } = await supabaseClient
      .from(MAINMAP_EDGES_TABLE)
      .update(updatePayload)
      .eq("owner_id", cleanOwnerId)
      .eq("main_mindmap_id", cleanMainMapId)
      .eq("id", edgeId)
      .select("id, main_mindmap_id, source_node_id, target_node_id, edge_type, label")
      .maybeSingle();

    if (error) return { ok: false, error: "commonplace_save_failed" };
    if (!data) return { ok: false, error: "commonplace_not_found" };

    return {
      ok: true,
      edge: mapMainMapEdgeRow(data as EdgeRow, cleanMainMapId),
    };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export async function deleteMainMapEdge(
  ownerId: string,
  mainMapId: string,
  edgeId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMindMapDeleteResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanMainMapId = cleanRequiredText(mainMapId);
  const cleanEdgeId = cleanRequiredText(edgeId);
  if (!cleanOwnerId || !cleanMainMapId || !cleanEdgeId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const mapResult = await verifyOwnerScopedMap(
      cleanOwnerId,
      cleanMainMapId,
      "main",
      supabaseClient,
    );
    if (!mapResult.ok) return mapResult;

    const { data: existingEdge, error: readError } = await supabaseClient
      .from(MAINMAP_EDGES_TABLE)
      .select("id")
      .eq("owner_id", cleanOwnerId)
      .eq("main_mindmap_id", cleanMainMapId)
      .eq("id", cleanEdgeId)
      .maybeSingle();

    if (readError) return { ok: false, error: "commonplace_save_failed" };
    if (!existingEdge) return { ok: false, error: "commonplace_not_found" };

    const { error } = await supabaseClient
      .from(MAINMAP_EDGES_TABLE)
      .delete()
      .eq("owner_id", cleanOwnerId)
      .eq("main_mindmap_id", cleanMainMapId)
      .eq("id", cleanEdgeId);

    if (error) return { ok: false, error: "commonplace_save_failed" };

    return { ok: true };
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

    if (cleanUpdates.length === 0) {
      return { ok: true };
    }

    if (cleanType === "main") {
      return batchUpdateMainMapNodePositions(
        cleanOwnerId,
        cleanMindMapId,
        cleanUpdates,
        supabaseClient,
      );
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

export async function batchUpdateMainMapNodePositions(
  ownerId: string,
  mainMapId: string,
  updates: CommonplaceMapNodePositionUpdate[],
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMapNodePositionSaveResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanMainMapId = cleanRequiredText(mainMapId);

  if (!cleanOwnerId || !cleanMainMapId || updates.length > 100) {
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

  if (cleanUpdates.length === 0) {
    return { ok: true };
  }

  try {
    const mapResult = await verifyOwnerScopedMap(
      cleanOwnerId,
      cleanMainMapId,
      "main",
      supabaseClient,
    );
    if (!mapResult.ok) return mapResult;

    const nodeIds = cleanUpdates.map((update) => update.nodeId);
    const { data: existingNodes, error: existingNodesError } =
      await supabaseClient
        .from(MAINMAP_NODES_TABLE)
        .select("id")
        .eq("owner_id", cleanOwnerId)
        .eq("main_mindmap_id", cleanMainMapId)
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
        .from(MAINMAP_NODES_TABLE)
        .update({
          position_x: update.position.x,
          position_y: update.position.y,
          updated_at: updatedAt,
        })
        .eq("owner_id", cleanOwnerId)
        .eq("main_mindmap_id", cleanMainMapId)
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
      .select("id, source_node_id, target_node_id, edge_type, label")
      .eq("owner_id", cleanOwnerId)
      .eq("mindmap_id", cleanMindMapId);

    if (edgesError) return { ok: false, error: "commonplace_save_failed" };

    const edges: CommonplaceMindMapEdge[] = ((edgesData as EdgeRow[] | null) ?? []).map((row) => ({
      id: row.id,
      sourceNodeId: row.source_node_id,
      targetNodeId: row.target_node_id,
      edgeType: cleanEdgeType(row.edge_type) ?? "solid",
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
  const noteIdsForOwnership = new Set<string>();

  for (const node of nodes) {
    const localId = cleanRequiredText(node.localId);
    const noteId = cleanRequiredText(node.noteId);

    if (!localId || !noteId || !Number.isFinite(node.positionX) || !Number.isFinite(node.positionY)) {
      return { ok: false, error: "commonplace_validation_failed" };
    }

    if (seenLocalIds.has(localId)) {
      return { ok: false, error: "commonplace_validation_failed" };
    }

    seenLocalIds.add(localId);
    noteIdsForOwnership.add(noteId);
  }

  // Edge validations
  const seenUndirected = new Set<string>();

  for (const edge of edges) {
    const sourceLocalId = cleanRequiredText(edge.sourceLocalId);
    const targetLocalId = cleanRequiredText(edge.targetLocalId);

    if (!sourceLocalId || !targetLocalId || sourceLocalId === targetLocalId) {
      return { ok: false, error: "commonplace_validation_failed" };
    }

    if (edge.edgeType !== undefined && edge.edgeType !== null && !cleanEdgeType(edge.edgeType)) {
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
    const noteIds = Array.from(noteIdsForOwnership);
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
        .select("id");

      if (insertNodesError || !insertedNodes || insertedNodes.length !== nodes.length) {
        return { ok: false, error: "commonplace_save_failed" };
      }

      insertedNodes.forEach((insertedNode, index) => {
        localIdToDbIdMap.set(nodes[index].localId, insertedNode.id);
      });
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
          edge_type: cleanEdgeType(e.edgeType) ?? "solid",
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
        node_kind,
        sub_mindmap_id,
        note_id,
        position_x,
        position_y,
        commonplace_mindmaps:sub_mindmap_id (
          title,
          updated_at
        )
      `)
      .eq("owner_id", cleanOwnerId)
      .eq("main_mindmap_id", summary.id)
      .eq("node_kind", "cluster");

    if (clustersError) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    type ClusterJoinedRow = {
      id: string;
      node_kind?: CommonplaceMainMapNodeKind | null;
      sub_mindmap_id: string;
      note_id?: string | null;
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
      .select("id, source_node_id, target_node_id, edge_type, label")
      .eq("owner_id", cleanOwnerId)
      .eq("main_mindmap_id", summary.id);

    if (edgesError) {
      return { ok: false, error: "commonplace_save_failed" };
    }

    type EdgeRow = {
      id: string;
      source_node_id: string;
      target_node_id: string;
      edge_type?: string | null;
      label: string | null;
    };

    const edges: CommonplaceMainMapEdge[] = ((edgesData as EdgeRow[] | null) ?? []).map((row) => ({
      id: row.id,
      sourceNodeId: row.source_node_id,
      targetNodeId: row.target_node_id,
      edgeType: cleanEdgeType(row.edge_type) ?? "solid",
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
  const subMapIdsForOwnership = new Set<string>();

  for (const c of clusters) {
    const localId = cleanRequiredText(c.localId);
    const subMindMapId = cleanRequiredText(c.subMindMapId);

    if (!localId || !subMindMapId || !Number.isFinite(c.positionX) || !Number.isFinite(c.positionY)) {
      return { ok: false, error: "commonplace_validation_failed" };
    }

    if (seenLocalIds.has(localId)) {
      return { ok: false, error: "commonplace_validation_failed" };
    }

    seenLocalIds.add(localId);
    subMapIdsForOwnership.add(subMindMapId);
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

    if (e.edgeType !== undefined && e.edgeType !== null && !cleanEdgeType(e.edgeType)) {
      return { ok: false, error: "commonplace_validation_failed" };
    }

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

    const subMapIds = Array.from(subMapIdsForOwnership);
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
      node_kind: "cluster" satisfies CommonplaceMainMapNodeKind,
      sub_mindmap_id: c.subMindMapId,
      note_id: null,
      position_x: c.positionX,
      position_y: c.positionY,
    }));

    if (clustersToInsert.length > 0) {
      const { data: insertedClusters, error: insertNodesError } = await supabaseClient
        .from(MAINMAP_NODES_TABLE)
        .insert(clustersToInsert)
        .select("id");

      if (insertNodesError || !insertedClusters || insertedClusters.length !== clusters.length) {
        return { ok: false, error: "commonplace_save_failed" };
      }

      insertedClusters.forEach((insertedCluster, index) => {
        localIdToDbIdMap.set(clusters[index].localId, insertedCluster.id);
      });
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
        edge_type: cleanEdgeType(e.edgeType) ?? "solid",
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

export async function deleteMainMapNode(
  ownerId: string,
  mainMapId: string,
  nodeId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<CommonplaceMindMapDeleteResult> {
  const cleanOwnerId = cleanRequiredText(ownerId);
  const cleanMainMapId = cleanRequiredText(mainMapId);
  const cleanNodeId = cleanRequiredText(nodeId);

  if (!cleanOwnerId || !cleanMainMapId || !cleanNodeId) {
    return { ok: false, error: "commonplace_validation_failed" };
  }

  try {
    const mapResult = await verifyOwnerScopedMap(
      cleanOwnerId,
      cleanMainMapId,
      "main",
      supabaseClient,
    );
    if (!mapResult.ok) return mapResult;

    const { data: existingNode, error: readError } = await supabaseClient
      .from(MAINMAP_NODES_TABLE)
      .select("id")
      .eq("owner_id", cleanOwnerId)
      .eq("main_mindmap_id", cleanMainMapId)
      .eq("id", cleanNodeId)
      .maybeSingle();

    if (readError) return { ok: false, error: "commonplace_save_failed" };
    if (!existingNode) return { ok: false, error: "commonplace_not_found" };

    const { error } = await supabaseClient
      .from(MAINMAP_NODES_TABLE)
      .delete()
      .eq("owner_id", cleanOwnerId)
      .eq("main_mindmap_id", cleanMainMapId)
      .eq("id", cleanNodeId);

    if (error) return { ok: false, error: "commonplace_save_failed" };

    return { ok: true };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}
