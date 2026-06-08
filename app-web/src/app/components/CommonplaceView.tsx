import { useCallback, useEffect, useMemo, useState } from "react";

import { createBrowserSupabaseClient, isSupabaseConfigured } from "../lib/supabase";
import type { FonetikSupabaseClient } from "../lib/supabase";
import { CommonplaceMapCanvasFoundation } from "./CommonplaceMapCanvasFoundation";
import {
  createCommonplaceNote,
  deleteCommonplaceNote,
  getCommonplaceNoteById,
  getCommonplaceNoteByShortcode,
  listCommonplaceNotes,
  updateCommonplaceNote,
} from "../lib/storage/supabase-commonplace-adapter";
import type {
  CommonplaceDeleteResult,
  CommonplaceNote,
  CommonplaceNoteListResult,
  CommonplaceNoteResult,
  CreateCommonplaceNoteInput,
  UpdateCommonplaceNoteInput,
} from "../lib/storage/supabase-commonplace-adapter";
import {
  batchUpdateCommonplaceMapNodePositions,
  createSubMapEdge,
  createSubMapNoteNode,
  createCommonplaceMindMap,
  createCommonplaceSubMindMap,
  deleteCommonplaceMindMapFromRegistry,
  deleteCommonplaceMindMap,
  getCommonplaceMindMapGraph,
  listSubMapEdges,
  listCommonplaceMapNodes,
  listCommonplaceMindMaps,
  listCommonplaceSubMindMaps,
  renameCommonplaceMindMap,
  saveCommonplaceMindMapGraph,
  createOrGetCommonplaceMainMindMap,
  getCommonplaceMainMindMapGraph,
  saveCommonplaceMainMindMapGraph,
  updateSubMapEdge,
  deleteSubMapEdge,
  deleteCommonplaceMainMapCluster,
} from "../lib/storage/supabase-commonplace-mindmap-adapter";
import type {
  CommonplaceMindMapListResult,
  CommonplaceMindMapGraphResult,
  CommonplaceMindMapResult,
  CreateCommonplaceMindMapInput,
  SaveCommonplaceMindMapInput,
  CommonplaceMainMapGraphResult,
  SaveCommonplaceMainMapGraphInput,
  CommonplaceMainMapSaveResult,
  CommonplaceMindMapDeleteResult,
  CommonplaceMindMapSummary,
  CommonplaceMindMapType,
  CreateCommonplaceMindMapRegistryInput,
  CommonplaceMapCanvasNode,
  CommonplaceMapNoteNodeCreateResult,
  CommonplaceMapNodeListResult,
  CommonplaceMapNodePositionSaveResult,
  CommonplaceMapNodePositionUpdate,
  CommonplaceSubMapEdge,
  CommonplaceSubMapEdgeListResult,
  CommonplaceSubMapEdgeResult,
  CommonplaceMindMapEdgeType,
  RenameCommonplaceMindMapInput,
} from "../lib/storage/supabase-commonplace-mindmap-adapter";
type CommonplaceMode =
  | "library"
  | "create"
  | "detail"
  | "edit"
  | "main_maps_registry"
  | "sub_maps_chooser"
  | "map_detail_placeholder";

type CommonplaceFormState = {
  sourceBook: string;
  sourcePage: string;
  title: string;
  quote: string;
  insight: string;
  tags: string;
  connections: string;
  relevance: string;
};

type MapNoteContext = {
  shortcode: string;
  title: string;
  sourceBook: string;
};

export type CommonplaceStorage = {
  listCommonplaceNotes(ownerId: string): Promise<CommonplaceNoteListResult>;
  createCommonplaceNote(
    input: CreateCommonplaceNoteInput,
  ): Promise<CommonplaceNoteResult>;
  getCommonplaceNoteById(
    ownerId: string,
    noteId: string,
  ): Promise<CommonplaceNoteResult>;
  getCommonplaceNoteByShortcode(
    ownerId: string,
    shortcode: string,
  ): Promise<CommonplaceNoteResult>;
  updateCommonplaceNote(
    input: UpdateCommonplaceNoteInput,
  ): Promise<CommonplaceNoteResult>;
  deleteCommonplaceNote(
    ownerId: string,
    noteId: string,
  ): Promise<CommonplaceDeleteResult>;
  createCommonplaceSubMindMap(
    input: CreateCommonplaceMindMapInput,
  ): Promise<CommonplaceMindMapResult>;
  listCommonplaceSubMindMaps(
    ownerId: string,
  ): Promise<CommonplaceMindMapListResult>;
  getCommonplaceMindMapGraph(
    ownerId: string,
    mindMapId: string,
  ): Promise<CommonplaceMindMapGraphResult>;
  saveCommonplaceMindMapGraph(
    input: SaveCommonplaceMindMapInput,
  ): Promise<CommonplaceDeleteResult>;
  deleteCommonplaceMindMap(
    ownerId: string,
    mindMapId: string,
  ): Promise<CommonplaceDeleteResult>;
  listCommonplaceMindMaps?(
    ownerId: string,
    type?: CommonplaceMindMapType | null,
  ): Promise<CommonplaceMindMapListResult>;
  createCommonplaceMindMap?(
    input: CreateCommonplaceMindMapRegistryInput,
  ): Promise<CommonplaceMindMapResult>;
  renameCommonplaceMindMap?(
    input: RenameCommonplaceMindMapInput,
  ): Promise<CommonplaceMindMapResult>;
  deleteCommonplaceMindMapFromRegistry?(
    ownerId: string,
    mindMapId: string,
  ): Promise<CommonplaceMindMapDeleteResult>;
  createOrGetCommonplaceMainMindMap?(
    ownerId: string,
  ): Promise<CommonplaceMindMapResult>;
  getCommonplaceMainMindMapGraph?(
    ownerId: string,
  ): Promise<CommonplaceMainMapGraphResult>;
  saveCommonplaceMainMindMapGraph?(
    input: SaveCommonplaceMainMapGraphInput,
  ): Promise<CommonplaceMainMapSaveResult>;
  deleteCommonplaceMainMapCluster?(
    ownerId: string,
    mainMapNodeId: string,
  ): Promise<CommonplaceMindMapDeleteResult>;
  listCommonplaceMapNodes?(
    ownerId: string,
    mindMapId: string,
    type: CommonplaceMindMapType,
  ): Promise<CommonplaceMapNodeListResult>;
  batchUpdateCommonplaceMapNodePositions?(
    ownerId: string,
    mindMapId: string,
    type: CommonplaceMindMapType,
    updates: CommonplaceMapNodePositionUpdate[],
  ): Promise<CommonplaceMapNodePositionSaveResult>;
  createSubMapNoteNode?(
    ownerId: string,
    mindMapId: string,
    noteId: string,
    position: { x: number; y: number },
  ): Promise<CommonplaceMapNoteNodeCreateResult>;
  listSubMapEdges?(
    ownerId: string,
    mindMapId: string,
  ): Promise<CommonplaceSubMapEdgeListResult>;
  createSubMapEdge?(
    ownerId: string,
    input: {
      mapId: string;
      sourceNodeId: string;
      targetNodeId: string;
      edgeType: CommonplaceMindMapEdgeType;
      label?: string | null;
    },
  ): Promise<CommonplaceSubMapEdgeResult>;
  updateSubMapEdge?(
    ownerId: string,
    input: {
      mapId: string;
      edgeId: string;
      edgeType?: CommonplaceMindMapEdgeType | null;
      label?: string | null;
    },
  ): Promise<CommonplaceSubMapEdgeResult>;
  deleteSubMapEdge?(
    ownerId: string,
    mindMapId: string,
    edgeId: string,
  ): Promise<CommonplaceMindMapDeleteResult>;
};

declare global {
  interface Window {
    __COMMONPLACE_TEST_ADAPTER__?: CommonplaceStorage;
  }
}

type CommonplaceViewProps = {
  ownerId?: string | null;
  isSignedIn?: boolean;
  getToken?: (() => Promise<string | null>) | null;
  supabaseConfigured?: boolean;
  onBackToFonetik?: () => void;
  onDiscussInPodchat?: (context: {
    source: "commonplace";
    shortcode: string;
    title?: string;
    sourceBook?: string;
    insight: string;
    tags: string[];
  }) => void;
};

const emptyForm: CommonplaceFormState = {
  sourceBook: "",
  sourcePage: "",
  title: "",
  quote: "",
  insight: "",
  tags: "",
  connections: "",
  relevance: "",
};

const DEFAULT_TEST_OWNER_ID = "commonplace-test-owner";

function splitList(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formFromNote(note: CommonplaceNote): CommonplaceFormState {
  return {
    sourceBook: note.sourceBook,
    sourcePage: note.sourcePage ?? "",
    title: note.title ?? "",
    quote: note.quote ?? "",
    insight: note.insight,
    tags: note.tags.join(", "),
    connections: note.connections.join(", "),
    relevance: note.relevance ?? "",
  };
}

function inputFromForm(
  form: CommonplaceFormState,
): Omit<CreateCommonplaceNoteInput, "ownerId"> {
  return {
    sourceBook: form.sourceBook,
    sourcePage: form.sourcePage,
    title: form.title,
    quote: form.quote,
    insight: form.insight,
    tags: splitList(form.tags),
    connections: splitList(form.connections),
    relevance: form.relevance,
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function displayTitle(note: CommonplaceNote): string {
  return note.title?.trim() || note.sourceBook || "Untitled Source";
}

function noteMatchesSearch(note: CommonplaceNote, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    note.shortcode,
    note.title ?? "",
    note.sourceBook,
    ...note.tags,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function getTestStorage(): CommonplaceStorage | null {
  if (typeof window === "undefined") return null;
  return window.__COMMONPLACE_TEST_ADAPTER__ ?? null;
}

function createSupabaseStorage(
  supabaseClient: FonetikSupabaseClient,
): CommonplaceStorage {
  return {
    listCommonplaceNotes: (ownerId) =>
      listCommonplaceNotes(ownerId, supabaseClient),
    createCommonplaceNote: (input) =>
      createCommonplaceNote(input, supabaseClient),
    getCommonplaceNoteById: (ownerId, noteId) =>
      getCommonplaceNoteById(ownerId, noteId, supabaseClient),
    getCommonplaceNoteByShortcode: (ownerId, shortcode) =>
      getCommonplaceNoteByShortcode(ownerId, shortcode, supabaseClient),
    updateCommonplaceNote: (input) =>
      updateCommonplaceNote(input, supabaseClient),
    deleteCommonplaceNote: (ownerId, noteId) =>
      deleteCommonplaceNote(ownerId, noteId, supabaseClient),
    createCommonplaceSubMindMap: (input) =>
      createCommonplaceSubMindMap(input, supabaseClient),
    listCommonplaceSubMindMaps: (ownerId) =>
      listCommonplaceSubMindMaps(ownerId, supabaseClient),
    getCommonplaceMindMapGraph: (ownerId, mindMapId) =>
      getCommonplaceMindMapGraph(ownerId, mindMapId, supabaseClient),
    saveCommonplaceMindMapGraph: (input) =>
      saveCommonplaceMindMapGraph(input, supabaseClient),
    deleteCommonplaceMindMap: (ownerId, mindMapId) =>
      deleteCommonplaceMindMap(ownerId, mindMapId, supabaseClient),
    listCommonplaceMindMaps: (ownerId, type) =>
      listCommonplaceMindMaps(ownerId, supabaseClient, type),
    createCommonplaceMindMap: (input) =>
      createCommonplaceMindMap(input, supabaseClient),
    renameCommonplaceMindMap: (input) =>
      renameCommonplaceMindMap(input, supabaseClient),
    deleteCommonplaceMindMapFromRegistry: (ownerId, mindMapId) =>
      deleteCommonplaceMindMapFromRegistry(ownerId, mindMapId, supabaseClient),
    createOrGetCommonplaceMainMindMap: (ownerId) =>
      createOrGetCommonplaceMainMindMap(ownerId, supabaseClient),
    getCommonplaceMainMindMapGraph: (ownerId) =>
      getCommonplaceMainMindMapGraph(ownerId, supabaseClient),
    saveCommonplaceMainMindMapGraph: (input) =>
      saveCommonplaceMainMindMapGraph(input, supabaseClient),
    deleteCommonplaceMainMapCluster: (ownerId, mainMapNodeId) =>
      deleteCommonplaceMainMapCluster(ownerId, mainMapNodeId, supabaseClient),
    listCommonplaceMapNodes: (ownerId, mindMapId, type) =>
      listCommonplaceMapNodes(ownerId, mindMapId, type, supabaseClient),
    batchUpdateCommonplaceMapNodePositions: (ownerId, mindMapId, type, updates) =>
      batchUpdateCommonplaceMapNodePositions(
        ownerId,
        mindMapId,
        type,
        updates,
        supabaseClient,
      ),
    createSubMapNoteNode: (ownerId, mindMapId, noteId, position) =>
      createSubMapNoteNode(
        ownerId,
        mindMapId,
        noteId,
        position,
        supabaseClient,
      ),
    listSubMapEdges: (ownerId, mindMapId) =>
      listSubMapEdges(ownerId, mindMapId, supabaseClient),
    createSubMapEdge: (ownerId, input) =>
      createSubMapEdge(ownerId, input, supabaseClient),
    updateSubMapEdge: (ownerId, input) =>
      updateSubMapEdge(ownerId, input, supabaseClient),
    deleteSubMapEdge: (ownerId, mindMapId, edgeId) =>
      deleteSubMapEdge(ownerId, mindMapId, edgeId, supabaseClient),
  };
}

async function createCommonplaceNoteViaServer(
  input: Omit<CreateCommonplaceNoteInput, "ownerId">,
): Promise<CommonplaceNoteResult> {
  try {
    const response = await fetch("/api/commonplace/notes", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await response.json().catch(() => null)) as
      | { note?: CommonplaceNote; error?: string }
      | null;

    if (response.ok && data?.note) {
      return { ok: true, note: data.note };
    }

    if (data?.error === "auth_required") {
      return { ok: false, error: "commonplace_auth_required" };
    }
    if (data?.error === "invalid_note_fields") {
      return { ok: false, error: "commonplace_validation_failed" };
    }

    return { ok: false, error: "commonplace_save_failed" };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

async function updateCommonplaceNoteViaServer(
  input: Omit<UpdateCommonplaceNoteInput, "ownerId">,
): Promise<CommonplaceNoteResult> {
  try {
    const response = await fetch("/api/commonplace/notes", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await response.json().catch(() => null)) as
      | { note?: CommonplaceNote; error?: string }
      | null;

    if (response.ok && data?.note) {
      return { ok: true, note: data.note };
    }

    if (data?.error === "auth_required") {
      return { ok: false, error: "commonplace_auth_required" };
    }
    if (data?.error === "invalid_note_fields") {
      return { ok: false, error: "commonplace_validation_failed" };
    }

    return { ok: false, error: "commonplace_save_failed" };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

async function deleteCommonplaceNoteViaServer(
  noteId: string,
): Promise<CommonplaceDeleteResult> {
  try {
    const response = await fetch("/api/commonplace/notes", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ noteId }),
    });
    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null;

    if (response.ok && data?.ok) {
      return { ok: true };
    }

    if (data?.error === "auth_required") {
      return { ok: false, error: "commonplace_auth_required" };
    }
    if (data?.error === "invalid_note_fields") {
      return { ok: false, error: "commonplace_validation_failed" };
    }

    return { ok: false, error: "commonplace_save_failed" };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

async function listCommonplaceMapsViaServer(
  type: CommonplaceMindMapType,
): Promise<CommonplaceMindMapListResult> {
  try {
    const response = await fetch(`/api/commonplace/maps?type=${type}`, {
      method: "GET",
      credentials: "same-origin",
    });
    const data = (await response.json().catch(() => null)) as
      | { maps?: CommonplaceMindMapSummary[]; error?: string }
      | null;

    if (response.ok && Array.isArray(data?.maps)) {
      return { ok: true, mindMaps: data.maps };
    }
    if (data?.error === "auth_required") {
      return { ok: false, error: "commonplace_auth_required" };
    }
    if (data?.error === "invalid_map_fields") {
      return { ok: false, error: "commonplace_validation_failed" };
    }

    return { ok: false, error: "commonplace_save_failed" };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

async function createCommonplaceMapViaServer(
  title: string,
  type: CommonplaceMindMapType,
): Promise<CommonplaceMindMapResult> {
  try {
    const response = await fetch("/api/commonplace/maps", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, type }),
    });
    const data = (await response.json().catch(() => null)) as
      | { map?: CommonplaceMindMapSummary; error?: string }
      | null;

    if (response.ok && data?.map) {
      return { ok: true, mindMap: data.map };
    }
    if (data?.error === "auth_required") {
      return { ok: false, error: "commonplace_auth_required" };
    }
    if (data?.error === "invalid_map_fields") {
      return { ok: false, error: "commonplace_validation_failed" };
    }

    return { ok: false, error: "commonplace_save_failed" };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

async function renameCommonplaceMapViaServer(
  mapId: string,
  title: string,
): Promise<CommonplaceMindMapResult> {
  try {
    const response = await fetch("/api/commonplace/maps", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mapId, title }),
    });
    const data = (await response.json().catch(() => null)) as
      | { map?: CommonplaceMindMapSummary; error?: string }
      | null;

    if (response.ok && data?.map) {
      return { ok: true, mindMap: data.map };
    }
    if (data?.error === "auth_required") {
      return { ok: false, error: "commonplace_auth_required" };
    }
    if (data?.error === "invalid_map_fields") {
      return { ok: false, error: "commonplace_validation_failed" };
    }
    if (data?.error === "map_not_found") {
      return { ok: false, error: "commonplace_not_found" };
    }

    return { ok: false, error: "commonplace_save_failed" };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

async function deleteCommonplaceMapViaServer(
  mapId: string,
): Promise<CommonplaceMindMapDeleteResult> {
  try {
    const response = await fetch("/api/commonplace/maps", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mapId }),
    });
    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null;

    if (response.ok && data?.ok) {
      return { ok: true };
    }
    if (data?.error === "auth_required") {
      return { ok: false, error: "commonplace_auth_required" };
    }
    if (data?.error === "invalid_map_fields") {
      return { ok: false, error: "commonplace_validation_failed" };
    }
    if (data?.error === "map_not_found") {
      return { ok: false, error: "commonplace_not_found" };
    }
    if (data?.error === "map_has_related_graph_data") {
      return { ok: false, error: "commonplace_conflict" };
    }

    return { ok: false, error: "commonplace_save_failed" };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

async function listCommonplaceMapNodesViaServer(
  mapId: string,
  type: CommonplaceMindMapType,
): Promise<CommonplaceMapNodeListResult> {
  try {
    const params = new URLSearchParams({ mapId, type });
    const response = await fetch(`/api/commonplace/maps/nodes?${params}`, {
      method: "GET",
      credentials: "same-origin",
    });
    const data = (await response.json().catch(() => null)) as
      | { nodes?: CommonplaceMapCanvasNode[]; error?: string }
      | null;

    if (response.ok && Array.isArray(data?.nodes)) {
      return { ok: true, nodes: data.nodes };
    }
    if (data?.error === "auth_required") {
      return { ok: false, error: "commonplace_auth_required" };
    }
    if (data?.error === "invalid_map_node_fields") {
      return { ok: false, error: "commonplace_validation_failed" };
    }
    if (data?.error === "map_not_found") {
      return { ok: false, error: "commonplace_not_found" };
    }

    return { ok: false, error: "commonplace_save_failed" };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

async function batchUpdateCommonplaceMapNodePositionsViaServer(
  mapId: string,
  type: CommonplaceMindMapType,
  updates: CommonplaceMapNodePositionUpdate[],
): Promise<CommonplaceMapNodePositionSaveResult> {
  try {
    const response = await fetch("/api/commonplace/maps/nodes", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mapId, type, updates }),
    });
    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null;

    if (response.ok && data?.ok) {
      return { ok: true };
    }
    if (data?.error === "auth_required") {
      return { ok: false, error: "commonplace_auth_required" };
    }
    if (data?.error === "invalid_map_node_fields") {
      return { ok: false, error: "commonplace_validation_failed" };
    }
    if (data?.error === "map_not_found") {
      return { ok: false, error: "commonplace_not_found" };
    }

    return { ok: false, error: "commonplace_save_failed" };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

async function createSubMapNoteNodeViaServer(
  mapId: string,
  noteId: string,
  position: { x: number; y: number },
): Promise<CommonplaceMapNoteNodeCreateResult> {
  try {
    const response = await fetch("/api/commonplace/maps/nodes", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mapId, type: "sub", noteId, position }),
    });
    const data = (await response.json().catch(() => null)) as
      | { node?: CommonplaceMapCanvasNode; error?: string }
      | null;

    if (response.ok && data?.node) {
      return { ok: true, node: data.node };
    }
    if (data?.error === "auth_required") {
      return { ok: false, error: "commonplace_auth_required" };
    }
    if (data?.error === "invalid_map_node_fields") {
      return { ok: false, error: "commonplace_validation_failed" };
    }
    if (data?.error === "map_not_found") {
      return { ok: false, error: "commonplace_not_found" };
    }

    return { ok: false, error: "commonplace_save_failed" };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

async function listSubMapEdgesViaServer(
  mapId: string,
): Promise<CommonplaceSubMapEdgeListResult> {
  try {
    const params = new URLSearchParams({ mapId, type: "sub" });
    const response = await fetch(`/api/commonplace/maps/edges?${params}`, {
      method: "GET",
      credentials: "same-origin",
    });
    const data = (await response.json().catch(() => null)) as
      | { edges?: CommonplaceSubMapEdge[]; error?: string }
      | null;

    if (response.ok && Array.isArray(data?.edges)) {
      return { ok: true, edges: data.edges };
    }
    if (data?.error === "auth_required") {
      return { ok: false, error: "commonplace_auth_required" };
    }
    if (data?.error === "invalid_map_edge_fields") {
      return { ok: false, error: "commonplace_validation_failed" };
    }
    if (data?.error === "map_not_found") {
      return { ok: false, error: "commonplace_not_found" };
    }

    return { ok: false, error: "commonplace_save_failed" };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

async function createSubMapEdgeViaServer(input: {
  mapId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: CommonplaceMindMapEdgeType;
  label?: string | null;
}): Promise<CommonplaceSubMapEdgeResult> {
  try {
    const response = await fetch("/api/commonplace/maps/edges", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...input, type: "sub" }),
    });
    const data = (await response.json().catch(() => null)) as
      | { edge?: CommonplaceSubMapEdge; error?: string }
      | null;

    if (response.ok && data?.edge) {
      return { ok: true, edge: data.edge };
    }
    if (data?.error === "auth_required") {
      return { ok: false, error: "commonplace_auth_required" };
    }
    if (data?.error === "invalid_map_edge_fields") {
      return { ok: false, error: "commonplace_validation_failed" };
    }
    if (data?.error === "map_not_found") {
      return { ok: false, error: "commonplace_not_found" };
    }

    return { ok: false, error: "commonplace_save_failed" };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

async function updateSubMapEdgeViaServer(input: {
  mapId: string;
  edgeId: string;
  edgeType?: CommonplaceMindMapEdgeType | null;
  label?: string | null;
}): Promise<CommonplaceSubMapEdgeResult> {
  try {
    const response = await fetch("/api/commonplace/maps/edges", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...input, type: "sub" }),
    });
    const data = (await response.json().catch(() => null)) as
      | { edge?: CommonplaceSubMapEdge; error?: string }
      | null;

    if (response.ok && data?.edge) {
      return { ok: true, edge: data.edge };
    }
    if (data?.error === "auth_required") {
      return { ok: false, error: "commonplace_auth_required" };
    }
    if (data?.error === "invalid_map_edge_fields") {
      return { ok: false, error: "commonplace_validation_failed" };
    }
    if (data?.error === "map_not_found") {
      return { ok: false, error: "commonplace_not_found" };
    }

    return { ok: false, error: "commonplace_save_failed" };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

async function deleteSubMapEdgeViaServer(
  mapId: string,
  edgeId: string,
): Promise<CommonplaceMindMapDeleteResult> {
  try {
    const response = await fetch("/api/commonplace/maps/edges", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mapId, edgeId, type: "sub" }),
    });
    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null;

    if (response.ok && data?.ok) {
      return { ok: true };
    }
    if (data?.error === "auth_required") {
      return { ok: false, error: "commonplace_auth_required" };
    }
    if (data?.error === "invalid_map_edge_fields") {
      return { ok: false, error: "commonplace_validation_failed" };
    }
    if (data?.error === "map_not_found") {
      return { ok: false, error: "commonplace_not_found" };
    }

    return { ok: false, error: "commonplace_save_failed" };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export function CommonplaceView({
  ownerId,
  isSignedIn = false,
  getToken,
  supabaseConfigured = isSupabaseConfigured(),
  onBackToFonetik,
  onDiscussInPodchat,
}: CommonplaceViewProps) {
  const [mode, setMode] = useState<CommonplaceMode>("library");
  const [notes, setNotes] = useState<CommonplaceNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<CommonplaceNote | null>(null);
  const [form, setForm] = useState<CommonplaceFormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"sourceBook" | "title" | "insight", string>>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [mainMaps, setMainMaps] = useState<CommonplaceMindMapSummary[]>([]);
  const [subMaps, setSubMaps] = useState<CommonplaceMindMapSummary[]>([]);
  const [selectedMap, setSelectedMap] =
    useState<CommonplaceMindMapSummary | null>(null);
  const [mapDetailReturnMode, setMapDetailReturnMode] =
    useState<CommonplaceMode>("main_maps_registry");
  const [mapNoteContext, setMapNoteContext] = useState<MapNoteContext | null>(
    null,
  );
  const [newMainMapTitle, setNewMainMapTitle] = useState("");
  const [newSubMapTitle, setNewSubMapTitle] = useState("");
  const [renameMapId, setRenameMapId] = useState<string | null>(null);
  const [renameMapTitle, setRenameMapTitle] = useState("");
  const [deleteMapId, setDeleteMapId] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [isMapSaving, setIsMapSaving] = useState(false);

  const testStorage = getTestStorage();
  const effectiveOwnerId = ownerId ?? (testStorage ? DEFAULT_TEST_OWNER_ID : null);

  const storage = useMemo<CommonplaceStorage | null>(() => {
    if (testStorage) return testStorage;
    if (!supabaseConfigured || !effectiveOwnerId || !isSignedIn) return null;

    const supabaseClient = createBrowserSupabaseClient({
      accessToken: async () => (await getToken?.()) ?? null,
    });

    return supabaseClient ? createSupabaseStorage(supabaseClient) : null;
  }, [effectiveOwnerId, getToken, isSignedIn, supabaseConfigured, testStorage]);

  const unavailableMessage = useMemo(() => {
    if (testStorage) return null;
    if (!isSignedIn || !effectiveOwnerId) {
      return "Sign in to use Commonplace notes.";
    }
    if (!supabaseConfigured || !storage) {
      return "Commonplace storage is not available right now.";
    }
    return null;
  }, [effectiveOwnerId, isSignedIn, storage, supabaseConfigured, testStorage]);

  const loadNotes = useCallback(async () => {
    if (!storage || !effectiveOwnerId) return;

    setIsLoading(true);
    setError(null);
    const result = await storage.listCommonplaceNotes(effectiveOwnerId);
    setIsLoading(false);

    if (!result.ok) {
      setError("Could not load Commonplace notes. Please try again.");
      return;
    }

    setNotes(result.notes);
  }, [effectiveOwnerId, storage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNotes();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadNotes]);

  const openCreate = () => {
    setForm(emptyForm);
    setFieldErrors({});
    setSelectedNote(null);
    setDeleteConfirmVisible(false);
    setError(null);
    setMode("create");
  };

  const openLibrary = () => {
    setMode("library");
    setSelectedNote(null);
    setDeleteConfirmVisible(false);
    setSelectedMap(null);
    setMapNoteContext(null);
    setDeleteMapId(null);
    setRenameMapId(null);
    setError(null);
    setFieldErrors({});
  };

  const loadMaps = useCallback(
    async (type: CommonplaceMindMapType) => {
      if (!effectiveOwnerId) return;

      setIsMapLoading(true);
      setError(null);
      const result =
        testStorage && storage?.listCommonplaceMindMaps
          ? await storage.listCommonplaceMindMaps(effectiveOwnerId, type)
          : await listCommonplaceMapsViaServer(type);
      setIsMapLoading(false);

      if (!result.ok) {
        setError("Could not load Commonplace maps. Please try again.");
        return;
      }

      if (type === "main") {
        setMainMaps(result.mindMaps);
      } else {
        setSubMaps(result.mindMaps);
      }
    },
    [effectiveOwnerId, storage, testStorage],
  );

  const openMainMapsRegistry = () => {
    setSelectedNote(null);
    setSelectedMap(null);
    setMapNoteContext(null);
    setDeleteMapId(null);
    setRenameMapId(null);
    setNewMainMapTitle("");
    setMode("main_maps_registry");
    void loadMaps("main");
  };

  const openSubMapChooser = (note?: CommonplaceNote | null) => {
    setSelectedMap(null);
    setDeleteMapId(null);
    setRenameMapId(null);
    setNewSubMapTitle("");
    setMapNoteContext(
      note
        ? {
            shortcode: note.shortcode,
            title: displayTitle(note),
            sourceBook: note.sourceBook,
          }
        : null,
    );
    setMode("sub_maps_chooser");
    void loadMaps("sub");
  };

  const createMap = async (type: CommonplaceMindMapType) => {
    if (!effectiveOwnerId) return;
    const title = type === "main" ? newMainMapTitle : newSubMapTitle;

    setIsMapSaving(true);
    setError(null);
    const result =
      testStorage && storage?.createCommonplaceMindMap
        ? await storage.createCommonplaceMindMap({
            ownerId: effectiveOwnerId,
            title,
            type,
          })
        : await createCommonplaceMapViaServer(title, type);
    setIsMapSaving(false);

    if (!result.ok) {
      setError(
        result.error === "commonplace_validation_failed"
          ? "Map title is required."
          : "Could not save this map. Please try again.",
      );
      return;
    }

    if (type === "main") {
      setMainMaps((current) => [result.mindMap, ...current]);
      setNewMainMapTitle("");
    } else {
      setSubMaps((current) => [result.mindMap, ...current]);
      setNewSubMapTitle("");
    }
  };

  const startRenameMap = (map: CommonplaceMindMapSummary) => {
    setRenameMapId(map.id);
    setRenameMapTitle(map.title);
    setDeleteMapId(null);
  };

  const saveRenameMap = async (map: CommonplaceMindMapSummary) => {
    if (!effectiveOwnerId) return;

    setIsMapSaving(true);
    setError(null);
    const result =
      testStorage && storage?.renameCommonplaceMindMap
        ? await storage.renameCommonplaceMindMap({
            ownerId: effectiveOwnerId,
            mindMapId: map.id,
            title: renameMapTitle,
          })
        : await renameCommonplaceMapViaServer(map.id, renameMapTitle);
    setIsMapSaving(false);

    if (!result.ok) {
      setError(
        result.error === "commonplace_validation_failed"
          ? "Map title is required."
          : "Could not rename this map. Please try again.",
      );
      return;
    }

    const updateList = (current: CommonplaceMindMapSummary[]) =>
      current.map((item) =>
        item.id === result.mindMap.id ? result.mindMap : item,
      );
    if (result.mindMap.type === "main") {
      setMainMaps(updateList);
    } else {
      setSubMaps(updateList);
    }
    setSelectedMap((current) =>
      current?.id === result.mindMap.id ? result.mindMap : current,
    );
    setRenameMapId(null);
    setRenameMapTitle("");
  };

  const deleteMap = async (map: CommonplaceMindMapSummary) => {
    if (!effectiveOwnerId) return;

    setIsMapSaving(true);
    setError(null);
    const result =
      testStorage && storage?.deleteCommonplaceMindMapFromRegistry
        ? await storage.deleteCommonplaceMindMapFromRegistry(
            effectiveOwnerId,
            map.id,
          )
        : await deleteCommonplaceMapViaServer(map.id);
    setIsMapSaving(false);

    if (!result.ok) {
      setError(
        result.error === "commonplace_conflict"
          ? "This map already has graph data, so Phase 3 will not delete it."
          : "Could not delete this map. Please try again.",
      );
      return;
    }

    if (map.type === "main") {
      setMainMaps((current) => current.filter((item) => item.id !== map.id));
    } else {
      setSubMaps((current) => current.filter((item) => item.id !== map.id));
    }
    setDeleteMapId(null);
    if (selectedMap?.id === map.id) {
      setSelectedMap(null);
      setMode(map.type === "main" ? "main_maps_registry" : "sub_maps_chooser");
    }
  };

  const openMapPlaceholder = (
    map: CommonplaceMindMapSummary,
    returnMode: CommonplaceMode,
  ) => {
    setSelectedMap(map);
    setMapDetailReturnMode(returnMode);
    setDeleteMapId(null);
    setRenameMapId(null);
    setMode("map_detail_placeholder");
  };

  const loadMapCanvasNodes = useCallback(
    async (map: CommonplaceMindMapSummary): Promise<CommonplaceMapNodeListResult> => {
      if (testStorage && storage?.listCommonplaceMapNodes && effectiveOwnerId) {
        return storage.listCommonplaceMapNodes(effectiveOwnerId, map.id, map.type);
      }

      return listCommonplaceMapNodesViaServer(map.id, map.type);
    },
    [effectiveOwnerId, storage, testStorage],
  );

  const saveMapCanvasNodePositions = useCallback(
    async (
      map: CommonplaceMindMapSummary,
      updates: CommonplaceMapNodePositionUpdate[],
    ): Promise<CommonplaceMapNodePositionSaveResult> => {
      if (
        testStorage &&
        storage?.batchUpdateCommonplaceMapNodePositions &&
        effectiveOwnerId
      ) {
        return storage.batchUpdateCommonplaceMapNodePositions(
          effectiveOwnerId,
          map.id,
          map.type,
          updates,
        );
      }

      return batchUpdateCommonplaceMapNodePositionsViaServer(
        map.id,
        map.type,
        updates,
      );
    },
    [effectiveOwnerId, storage, testStorage],
  );

  const createMapCanvasNoteNode = useCallback(
    async (
      map: CommonplaceMindMapSummary,
      noteId: string,
      position: { x: number; y: number },
    ): Promise<CommonplaceMapNoteNodeCreateResult> => {
      if (map.type !== "sub") {
        return { ok: false, error: "commonplace_conflict" };
      }

      if (
        testStorage &&
        storage?.createSubMapNoteNode &&
        effectiveOwnerId
      ) {
        return storage.createSubMapNoteNode(
          effectiveOwnerId,
          map.id,
          noteId,
          position,
        );
      }

      return createSubMapNoteNodeViaServer(map.id, noteId, position);
    },
    [effectiveOwnerId, storage, testStorage],
  );

  const loadMapCanvasEdges = useCallback(
    async (map: CommonplaceMindMapSummary): Promise<CommonplaceSubMapEdgeListResult> => {
      if (map.type !== "sub") {
        return { ok: true, edges: [] };
      }

      if (testStorage && storage?.listSubMapEdges && effectiveOwnerId) {
        return storage.listSubMapEdges(effectiveOwnerId, map.id);
      }

      return listSubMapEdgesViaServer(map.id);
    },
    [effectiveOwnerId, storage, testStorage],
  );

  const createMapCanvasEdge = useCallback(
    async (
      map: CommonplaceMindMapSummary,
      input: {
        sourceNodeId: string;
        targetNodeId: string;
        edgeType: CommonplaceMindMapEdgeType;
        label?: string | null;
      },
    ): Promise<CommonplaceSubMapEdgeResult> => {
      if (map.type !== "sub") {
        return { ok: false, error: "commonplace_conflict" };
      }

      const payload = { mapId: map.id, ...input };
      if (testStorage && storage?.createSubMapEdge && effectiveOwnerId) {
        return storage.createSubMapEdge(effectiveOwnerId, payload);
      }

      return createSubMapEdgeViaServer(payload);
    },
    [effectiveOwnerId, storage, testStorage],
  );

  const updateMapCanvasEdge = useCallback(
    async (
      map: CommonplaceMindMapSummary,
      input: {
        edgeId: string;
        edgeType?: CommonplaceMindMapEdgeType | null;
        label?: string | null;
      },
    ): Promise<CommonplaceSubMapEdgeResult> => {
      if (map.type !== "sub") {
        return { ok: false, error: "commonplace_conflict" };
      }

      const payload = { mapId: map.id, ...input };
      if (testStorage && storage?.updateSubMapEdge && effectiveOwnerId) {
        return storage.updateSubMapEdge(effectiveOwnerId, payload);
      }

      return updateSubMapEdgeViaServer(payload);
    },
    [effectiveOwnerId, storage, testStorage],
  );

  const deleteMapCanvasEdge = useCallback(
    async (
      map: CommonplaceMindMapSummary,
      edgeId: string,
    ): Promise<CommonplaceMindMapDeleteResult> => {
      if (map.type !== "sub") {
        return { ok: false, error: "commonplace_conflict" };
      }

      if (testStorage && storage?.deleteSubMapEdge && effectiveOwnerId) {
        return storage.deleteSubMapEdge(effectiveOwnerId, map.id, edgeId);
      }

      return deleteSubMapEdgeViaServer(map.id, edgeId);
    },
    [effectiveOwnerId, storage, testStorage],
  );

  const openDetail = async (noteId: string) => {
    if (!storage || !effectiveOwnerId) return;

    setError(null);
    setDeleteConfirmVisible(false);

    const currentNote = notes.find((note) => note.id === noteId);
    if (currentNote) {
      setSelectedNote(currentNote);
      setMode("detail");
      return;
    }

    const result = await storage.getCommonplaceNoteById(effectiveOwnerId, noteId);
    if (!result.ok) {
      setError(
        result.error === "commonplace_not_found"
          ? "That note is no longer available."
          : "Could not open that note. Please try again.",
      );
      return;
    }

    setSelectedNote(result.note);
    setMode("detail");
  };

  const openDetailByShortcode = async (shortcode: string) => {
    if (!storage || !effectiveOwnerId) return;

    setError(null);
    setDeleteConfirmVisible(false);

    const currentNote = notes.find((note) => note.shortcode === shortcode);
    if (currentNote) {
      setSelectedNote(currentNote);
      setMode("detail");
      return;
    }

    const result = await storage.getCommonplaceNoteByShortcode(
      effectiveOwnerId,
      shortcode,
    );
    if (!result.ok) {
      setError(
        result.error === "commonplace_not_found"
          ? "That connected note is no longer available."
          : "Could not open that connected note. Please try again.",
      );
      return;
    }

    setSelectedNote(result.note);
    setMode("detail");
  };

  const openEdit = () => {
    if (!selectedNote) return;
    setForm(formFromNote(selectedNote));
    setFieldErrors({});
    setDeleteConfirmVisible(false);
    setError(null);
    setMode("edit");
  };

  const handleSubmit = async () => {
    if (!storage || !effectiveOwnerId) return;

    const nextFieldErrors: Partial<
      Record<"sourceBook" | "title" | "insight", string>
    > = {};
    if (form.sourceBook.trim().length === 0) {
      nextFieldErrors.sourceBook = "Source book is required.";
    }
    if (form.title.trim().length === 0) {
      nextFieldErrors.title = "Title is required.";
    }
    if (form.insight.trim().length === 0) {
      nextFieldErrors.insight = "Insight is required.";
    }
    setFieldErrors(nextFieldErrors);

    if (Object.keys(nextFieldErrors).length > 0) {
      setError("Please complete the required fields.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const formInput = inputFromForm(form);
    const isEditing = mode === "edit" && Boolean(selectedNote);
    const result =
      isEditing && selectedNote
        ? testStorage
          ? await storage.updateCommonplaceNote({
              ownerId: effectiveOwnerId,
              noteId: selectedNote.id,
              ...formInput,
            })
          : await updateCommonplaceNoteViaServer({
              noteId: selectedNote.id,
              ...formInput,
            })
        : testStorage
          ? await storage.createCommonplaceNote({
              ownerId: effectiveOwnerId,
              ...formInput,
            })
          : await createCommonplaceNoteViaServer(formInput);

    setIsSaving(false);

    if (!result.ok) {
      if (result.error === "commonplace_auth_required") {
        setError("Please sign in to save notes.");
      } else if (result.error === "commonplace_validation_failed") {
        setError("Please complete the required fields.");
      } else {
        setError("Could not save this note. Please try again.");
      }
      return;
    }

    setNotes((current) => {
      const withoutSaved = current.filter((note) => note.id !== result.note.id);
      return [result.note, ...withoutSaved];
    });
    setForm(emptyForm);
    if (isEditing) {
      setSelectedNote(result.note);
      setMode("detail");
    } else {
      setSelectedNote(null);
      setMode("library");
    }
  };

  const handleDelete = async () => {
    if (!storage || !effectiveOwnerId || !selectedNote) return;

    setIsSaving(true);
    setError(null);
    const result = testStorage
      ? await storage.deleteCommonplaceNote(effectiveOwnerId, selectedNote.id)
      : await deleteCommonplaceNoteViaServer(selectedNote.id);
    setIsSaving(false);

    if (!result.ok) {
      setError("Could not delete this note. Please try again.");
      return;
    }

    setNotes((current) => current.filter((note) => note.id !== selectedNote.id));
    setSelectedNote(null);
    setDeleteConfirmVisible(false);
    setMode("library");
  };

  const handleDiscussInPodchat = () => {
    if (!selectedNote || !onDiscussInPodchat) return;

    const context = {
      source: "commonplace",
      shortcode: selectedNote.shortcode,
      title: selectedNote.title ?? undefined,
      sourceBook: selectedNote.sourceBook || undefined,
      insight: selectedNote.insight,
      tags: selectedNote.tags,
    } as const;

    try {
      window.sessionStorage.setItem(
        "fonetik:commonplace-podchat-context",
        JSON.stringify(context),
      );
    } catch {
      // Session storage is a convenience for resume; the direct handoff remains primary.
    }

    onDiscussInPodchat(context);
  };

  const updateField = (field: keyof CommonplaceFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (
      field === "sourceBook" ||
      field === "title" ||
      field === "insight"
    ) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  };

  const filteredNotes = useMemo(
    () => notes.filter((note) => noteMatchesSearch(note, searchQuery)),
    [notes, searchQuery],
  );
  const libraryMode = mode === "library";
  const sidebarNoteDragMode =
    mode === "map_detail_placeholder" && selectedMap?.type === "sub";

  return (
    <section
      className={`min-h-[calc(100dvh-2rem)] rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm lg:flex-1 ${
        libraryMode ? "lg:h-[calc(100vh_-_2rem)] lg:max-h-[calc(100vh_-_2rem)] lg:min-h-0 lg:overflow-hidden" : ""
      }`}
      data-testid="commonplace-view"
      aria-label="Commonplace"
    >
      <div
        className={`flex min-h-full flex-col lg:grid lg:grid-cols-[260px_minmax(0,1fr)] ${
            libraryMode ? "lg:h-full lg:max-h-full lg:min-h-0 lg:items-stretch lg:overflow-hidden" : "lg:items-start"
        }`}
      >
        <CommonplaceSidebar
          notes={filteredNotes}
          selectedNoteId={selectedNote?.id ?? null}
          searchQuery={searchQuery}
          isLoading={isLoading}
          viewportBounded={libraryMode}
          canDragNotesToCanvas={sidebarNoteDragMode}
          onSearchChange={setSearchQuery}
          onBackToFonetik={onBackToFonetik}
          onCreate={openCreate}
          onOpen={openDetail}
        />

        <div
          className={`min-w-0 bg-[var(--brand-surface)] p-4 pb-10 sm:p-6 sm:pb-12 lg:p-5 lg:pb-5 ${
            libraryMode ? "lg:flex lg:h-full lg:max-h-full lg:min-h-0 lg:flex-col lg:overflow-hidden" : ""
          }`}
        >
          {unavailableMessage ? (
            <div className="rounded-lg border border-[var(--brand-border)] bg-white px-4 py-3 text-sm text-[var(--brand-ink-soft)]">
              {unavailableMessage}
            </div>
          ) : (
            <>
              {error && (
                <p
                  role="alert"
                  className="mb-4 rounded-lg border border-[#B42318]/20 bg-[#FFF4F3] px-4 py-3 text-sm text-[#8A1F15]"
                >
                  {error}
                </p>
              )}

              {mode === "library" && (
                <div className="flex min-h-0 flex-1 flex-col gap-3 lg:h-full lg:max-h-full lg:overflow-hidden">
                  <div className="flex flex-shrink-0 justify-end">
                    <button
                      type="button"
                      onClick={openMainMapsRegistry}
                      className="rounded-lg border border-[var(--brand-teal)]/25 bg-[var(--brand-teal-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-teal-ink)] transition-colors hover:bg-[#BFEDE5]"
                      data-testid="commonplace-main-maps-btn"
                    >
                      Main Maps
                    </button>
                  </div>
                  <LibraryView
                    notes={filteredNotes}
                    isLoading={isLoading}
                    onCreate={openCreate}
                    onOpen={openDetail}
                  />
                </div>
              )}

              {(mode === "create" || mode === "edit") && (
                <NoteForm
                  mode={mode}
                  form={form}
                  fieldErrors={fieldErrors}
                  shortcode={mode === "edit" ? selectedNote?.shortcode : null}
                  isSaving={isSaving}
                  onBack={mode === "edit" && selectedNote ? () => setMode("detail") : openLibrary}
                  onSubmit={handleSubmit}
                  onChange={updateField}
                />
              )}

              {mode === "detail" && selectedNote && (
                <NoteDetail
                  note={selectedNote}
                  isSaving={isSaving}
                  deleteConfirmVisible={deleteConfirmVisible}
                  onBack={openLibrary}
                  onEdit={openEdit}
                  onOpenConnection={openDetailByShortcode}
                  onOpenMindMap={() => openSubMapChooser(selectedNote)}
                  onDiscussInPodchat={onDiscussInPodchat ? handleDiscussInPodchat : undefined}
                  onAskDelete={() => setDeleteConfirmVisible(true)}
                  onCancelDelete={() => setDeleteConfirmVisible(false)}
                  onConfirmDelete={handleDelete}
                />
              )}

              {mode === "main_maps_registry" && (
                <MainMapsRegistry
                  maps={mainMaps}
                  isLoading={isMapLoading}
                  isSaving={isMapSaving}
                  newTitle={newMainMapTitle}
                  renameMapId={renameMapId}
                  renameTitle={renameMapTitle}
                  deleteMapId={deleteMapId}
                  onBack={openLibrary}
                  onNewTitleChange={setNewMainMapTitle}
                  onCreate={() => void createMap("main")}
                  onOpen={(map) => openMapPlaceholder(map, "main_maps_registry")}
                  onStartRename={startRenameMap}
                  onRenameTitleChange={setRenameMapTitle}
                  onSaveRename={(map) => void saveRenameMap(map)}
                  onCancelRename={() => setRenameMapId(null)}
                  onAskDelete={(mapId) => setDeleteMapId(mapId)}
                  onCancelDelete={() => setDeleteMapId(null)}
                  onConfirmDelete={(map) => void deleteMap(map)}
                />
              )}

              {mode === "sub_maps_chooser" && (
                <SubMindMapChooser
                  maps={subMaps}
                  noteContext={mapNoteContext}
                  isLoading={isMapLoading}
                  isSaving={isMapSaving}
                  newTitle={newSubMapTitle}
                  onBack={selectedNote ? () => setMode("detail") : openLibrary}
                  onNewTitleChange={setNewSubMapTitle}
                  onCreate={() => void createMap("sub")}
                  onOpen={(map) => openMapPlaceholder(map, "sub_maps_chooser")}
                />
              )}

              {mode === "map_detail_placeholder" && selectedMap && (
                <CommonplaceMapCanvasFoundation
                  map={selectedMap}
                  noteContext={mapNoteContext}
                  onBack={() => setMode(mapDetailReturnMode)}
                  loadNodes={() => loadMapCanvasNodes(selectedMap)}
                  loadEdges={() => loadMapCanvasEdges(selectedMap)}
                  saveNodePositions={(updates) =>
                    saveMapCanvasNodePositions(selectedMap, updates)
                  }
                  createNoteNode={(noteId, position) =>
                    createMapCanvasNoteNode(selectedMap, noteId, position).then(
                      (result) =>
                        result.ok
                          ? result
                          : {
                              ok: false as const,
                              error:
                                result.error === "commonplace_conflict"
                                  ? "unsupported"
                                  : "failed",
                            },
                    )
                  }
                  createEdge={(input) => createMapCanvasEdge(selectedMap, input)}
                  updateEdge={(input) => updateMapCanvasEdge(selectedMap, input)}
                  deleteEdge={(edgeId) => deleteMapCanvasEdge(selectedMap, edgeId)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function CommonplaceSidebar({
  notes,
  selectedNoteId,
  searchQuery,
  isLoading,
  viewportBounded,
  canDragNotesToCanvas,
  onSearchChange,
  onBackToFonetik,
  onCreate,
  onOpen,
}: {
  notes: CommonplaceNote[];
  selectedNoteId: string | null;
  searchQuery: string;
  isLoading: boolean;
  viewportBounded: boolean;
  canDragNotesToCanvas: boolean;
  onSearchChange: (value: string) => void;
  onBackToFonetik?: () => void;
  onCreate: () => void;
  onOpen: (noteId: string) => void;
}) {
  return (
    <aside
      data-testid="commonplace-sidebar"
      className={`flex min-h-[18rem] flex-col rounded-t-2xl border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 lg:rounded-l-2xl lg:rounded-tr-none lg:border-b-0 lg:border-r ${
        viewportBounded
          ? "lg:h-full lg:max-h-full lg:min-h-0"
          : "lg:sticky lg:top-8 lg:max-h-[calc(100dvh-4rem)]"
      }`}
      aria-label="Commonplace library"
    >
      <button
        type="button"
        onClick={onBackToFonetik}
        className="w-full rounded-lg border border-[var(--brand-border)] bg-white px-3 py-2 text-left text-sm font-semibold text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
      >
        ← Kembali ke Fonetik
      </button>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-muted)]">
          LIBRARY
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-lg bg-[var(--brand-teal)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-teal-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] focus:ring-offset-2"
        >
          + Baru
        </button>
      </div>

      <label
        htmlFor="commonplace-search"
        className="mt-4 flex flex-col gap-2 text-xs font-semibold text-[var(--brand-ink)]"
      >
        Search notes
        <input
          id="commonplace-search"
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Title, book, shortcode, tag"
          className="rounded-lg border border-[var(--brand-border)] bg-white px-3 py-2 text-sm font-normal text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-muted)] focus:border-[var(--brand-teal)] focus:ring-2 focus:ring-[var(--brand-teal)]/20"
        />
      </label>

      <div
        className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]"
        data-testid="commonplace-sidebar-scroll"
        style={viewportBounded ? { maxHeight: "32rem" } : undefined}
      >
        {isLoading ? (
          <p className="rounded-lg border border-[var(--brand-border)] bg-white px-3 py-2 text-sm text-[var(--brand-ink-soft)]">
            Loading notes...
          </p>
        ) : notes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--brand-border-strong)] bg-white/70 px-3 py-4 text-sm leading-6 text-[var(--brand-ink-soft)]">
            No matching notes yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2" data-testid="commonplace-sidebar-note-list">
            {notes.map((note) => (
              <SidebarNoteButton
                key={note.id}
                note={note}
                selected={note.id === selectedNoteId}
                draggable={canDragNotesToCanvas}
                onClick={() => onOpen(note.id)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function SidebarNoteButton({
  note,
  selected,
  draggable,
  onClick,
}: {
  note: CommonplaceNote;
  selected: boolean;
  draggable: boolean;
  onClick: () => void;
}) {
  const visibleTags = note.tags.slice(0, 2);
  const hiddenCount = Math.max(0, note.tags.length - visibleTags.length);
  const dragPayload = {
    noteId: note.id,
    title: displayTitle(note),
    sourceBook: note.sourceBook,
    shortcode: note.shortcode,
    tags: note.tags.slice(0, 6),
  };

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      data-testid="commonplace-sidebar-note"
      onDragStart={(event) => {
        if (!draggable) {
          event.preventDefault();
          return;
        }

        event.dataTransfer.effectAllowed = "copy";
        const serializedPayload = JSON.stringify(dragPayload);
        event.dataTransfer.setData(
          "application/commonplace-note",
          serializedPayload,
        );
        event.dataTransfer.setData("text/plain", note.shortcode || dragPayload.title);
      }}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onClick();
      }}
      aria-label={`${displayTitle(note)} from ${note.sourceBook}`}
      className={`select-none rounded-lg border px-3 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] ${
        selected
          ? "border-[var(--brand-teal)] bg-[var(--brand-teal-soft)]"
          : "border-[var(--brand-border)] bg-white hover:bg-[var(--brand-surface)]"
      } ${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
    >
      <span className="text-[11px] font-semibold text-[var(--brand-teal-ink)]">
        {note.shortcode}
      </span>
      <span className="mt-1 block truncate text-sm font-semibold text-[var(--brand-ink)]">
        {displayTitle(note)}
      </span>
      <span className="mt-1 block truncate text-xs text-[var(--brand-ink-soft)]">
        {note.sourceBook}
      </span>
      {note.tags.length > 0 && (
        <span className="mt-2 flex flex-wrap gap-1.5">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[var(--brand-teal)]/20 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--brand-teal-ink)]"
            >
              #{tag}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span className="rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--brand-muted)]">
              +{hiddenCount}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

function LibraryView({
  notes,
  isLoading,
  onCreate,
  onOpen,
}: {
  notes: CommonplaceNote[];
  isLoading: boolean;
  onCreate: () => void;
  onOpen: (noteId: string) => void;
}) {
  if (isLoading) {
    return (
      <p className="rounded-lg border border-[var(--brand-border)] bg-white px-4 py-3 text-sm text-[var(--brand-ink-soft)] lg:min-h-0 lg:flex-1">
        Loading Commonplace notes...
      </p>
    );
  }

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 pb-3"
      data-testid="commonplace-library-grid"
      style={{ maxHeight: "40rem" }}
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(128px,160px))] justify-start gap-5 xl:grid-cols-[repeat(auto-fill,minmax(140px,172px))]">
        {notes.map((note) => (
          <button
            key={note.id}
            type="button"
            onClick={() => onOpen(note.id)}
            className="group flex h-[172px] flex-col overflow-hidden rounded-lg border border-[var(--brand-border)] bg-white text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-[var(--brand-teal)]/35 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] focus:ring-offset-2 focus:ring-offset-[var(--brand-bg)]"
          >
            <span className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
              <span className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--brand-ink)]">
                {displayTitle(note)}
              </span>
              <span className="mt-1 text-[11px] font-medium leading-4 text-[var(--brand-ink-soft)]">
                {note.sourceBook}
                {note.sourcePage ? `, p. ${note.sourcePage}` : ""}
              </span>
              <span className="mt-2 line-clamp-2 overflow-hidden text-xs leading-5 text-[var(--brand-ink-soft)]">
                {note.insight}
              </span>
              {note.tags.length > 0 && (
                <span className="mt-auto flex flex-wrap gap-1 pt-2">
                  {note.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="max-w-full truncate rounded-full border border-[var(--brand-teal)]/20 bg-[var(--brand-teal-soft)] px-1.5 py-0.5 text-[10px] font-medium leading-4 text-[var(--brand-teal-ink)]"
                    >
                      #{tag}
                    </span>
                  ))}
                </span>
              )}
            </span>
            <span className="flex items-center justify-end border-t border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-1.5">
              <span className="font-mono text-[11px] font-semibold text-[var(--brand-teal-ink)]">
                {note.shortcode}
              </span>
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={onCreate}
          className="flex h-[172px] flex-col items-start justify-between rounded-lg border border-dashed border-[var(--brand-teal)]/45 bg-white p-3 text-left transition-colors hover:bg-[var(--brand-teal-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] focus:ring-offset-2 focus:ring-offset-[var(--brand-bg)]"
          aria-describedby="commonplace-empty-helper"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-teal)] text-white">
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 5v14m7-7H5"
              />
            </svg>
          </span>
          <span>
            <span className="block text-sm font-semibold text-[var(--brand-ink)]">
              Tambah note
            </span>
            <span
              id="commonplace-empty-helper"
              className="mt-1 block text-xs leading-5 text-[var(--brand-ink-soft)]"
            >
              Start by saving one idea from a book.
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
function NoteForm({
  mode,
  form,
  fieldErrors,
  shortcode,
  isSaving,
  onBack,
  onSubmit,
  onChange,
}: {
  mode: "create" | "edit";
  form: CommonplaceFormState;
  fieldErrors: Partial<Record<"sourceBook" | "title" | "insight", string>>;
  shortcode: string | null | undefined;
  isSaving: boolean;
  onBack: () => void;
  onSubmit: () => void;
  onChange: (field: keyof CommonplaceFormState, value: string) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--brand-ink)]">
            {mode === "edit" ? "Edit note" : "Create note"}
          </h3>
          {shortcode && (
            <p className="mt-1 text-sm text-[#534AB7]">
              Shortcode {shortcode}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-[var(--brand-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-surface-2)]"
        >
          ← Library
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          id="commonplace-source-book"
          label="Source book"
          value={form.sourceBook}
          placeholder="Untitled Source"
          required
          error={fieldErrors.sourceBook}
          onChange={(value) => onChange("sourceBook", value)}
        />
        <TextInput
          id="commonplace-source-page"
          label="Source page"
          value={form.sourcePage}
          onChange={(value) => onChange("sourcePage", value)}
        />
        <TextInput
          id="commonplace-note-title"
          label="Title"
          value={form.title}
          required
          error={fieldErrors.title}
          onChange={(value) => onChange("title", value)}
        />
        <TextInput
          id="commonplace-tags"
          label="Tags"
          value={form.tags}
          placeholder="politics, institutions"
          onChange={(value) => onChange("tags", value)}
        />
      </div>

      <TextArea
        id="commonplace-quote"
        label="Quote"
        value={form.quote}
        rows={3}
        onChange={(value) => onChange("quote", value)}
      />
      <TextArea
        id="commonplace-insight"
        label="Insight"
        value={form.insight}
        rows={5}
        required
        error={fieldErrors.insight}
        onChange={(value) => onChange("insight", value)}
      />
      <TextArea
        id="commonplace-connections"
        label="Connections"
        value={form.connections}
        rows={2}
        placeholder="#wnf1, #us1"
        onChange={(value) => onChange("connections", value)}
      />
      <TextArea
        id="commonplace-relevance"
        label="Relevance"
        value={form.relevance}
        rows={3}
        onChange={(value) => onChange("relevance", value)}
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSaving}
          className="rounded-lg bg-[#534AB7] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#413797] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSaving ? "Saving..." : "Save note"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-[var(--brand-border)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-surface-2)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function NoteDetail({
  note,
  isSaving,
  deleteConfirmVisible,
  onBack,
  onEdit,
  onOpenConnection,
  onOpenMindMap,
  onDiscussInPodchat,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  note: CommonplaceNote;
  isSaving: boolean;
  deleteConfirmVisible: boolean;
  onBack: () => void;
  onEdit: () => void;
  onOpenConnection: (shortcode: string) => void;
  onOpenMindMap: () => void;
  onDiscussInPodchat?: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const hasTags = note.tags.length > 0;
  const hasConnections = note.connections.length > 0;

  return (
    <article className="mx-auto flex w-full max-w-[980px] flex-col gap-5">
      <div className="flex flex-col gap-4 border-b border-[var(--brand-border)] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-[var(--brand-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-surface-2)]"
          >
            ← Library
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-[#534AB7]/30 bg-[#EEEDFE] px-4 py-2 text-sm font-semibold text-[#332C85] hover:bg-[#E3E0FF]"
          >
            Edit
          </button>
        </div>

        <div>
          <p className="text-sm font-semibold text-[#534AB7]">
            {note.shortcode}
          </p>
          <h3 className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">
            {displayTitle(note)}
          </h3>
          <p className="mt-1 text-sm text-[var(--brand-ink-soft)]">
            {note.sourceBook}
            {note.sourcePage ? `, p. ${note.sourcePage}` : ""}
          </p>
        </div>
      </div>

      <DetailBlock label="Insight" value={note.insight} />
      {note.quote && <DetailBlock label="Quote" value={note.quote} />}
      {note.relevance && (
        <DetailBlock label="Relevance" value={note.relevance} />
      )}

      {(hasTags || hasConnections) && (
        <div className="grid gap-4 md:grid-cols-2">
          {hasTags && (
            <DetailList label="Tags" values={note.tags.map((tag) => `#${tag}`)} />
          )}
          {hasConnections && (
            <DetailList
              label="Connections"
              values={note.connections}
              onSelectValue={onOpenConnection}
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-[var(--brand-border)] pt-4">
        <button
          type="button"
          onClick={onOpenMindMap}
          className="rounded-lg border border-[#534AB7]/30 bg-white px-4 py-2 text-sm font-semibold text-[#332C85] hover:bg-[#EEEDFE]"
          data-testid="commonplace-note-mind-map-btn"
        >
          Buka Mind Map
        </button>
          {onDiscussInPodchat && (
            <button
              type="button"
              onClick={onDiscussInPodchat}
              className="rounded-lg border border-[#1F7A7A]/30 bg-[#EAF8F7] px-4 py-2 text-sm font-semibold text-[#155E5E] hover:bg-[#D8F0EF]"
            >
              Diskusi di Podchat
            </button>
          )}
          <button
            type="button"
            onClick={onAskDelete}
            className="rounded-lg border border-[#B42318]/25 bg-white px-4 py-2 text-sm font-semibold text-[#8A1F15] hover:bg-[#FFF4F3]"
          >
            Delete
          </button>
      </div>

      <div className="grid gap-4 text-sm text-[var(--brand-ink-soft)] md:grid-cols-2">
        <p>Created {formatDate(note.createdAt)}</p>
        <p>Updated {formatDate(note.updatedAt)}</p>
      </div>

      {deleteConfirmVisible && (
        <div className="rounded-lg border border-[#B42318]/20 bg-[#FFF4F3] p-4">
          <p className="text-sm font-semibold text-[#8A1F15]">
            Delete this note?
          </p>
          <p className="mt-1 text-sm text-[#8A1F15]">
            This removes only this Commonplace note.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onConfirmDelete}
              disabled={isSaving}
              className="rounded-lg bg-[#8A1F15] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? "Deleting..." : "Confirm delete"}
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="rounded-lg border border-[#B42318]/25 bg-white px-4 py-2 text-sm font-semibold text-[#8A1F15]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function TextInput({
  id,
  label,
  value,
  placeholder,
  required = false,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <label htmlFor={id} className="flex flex-col gap-2 text-sm font-semibold text-[var(--brand-ink)]">
      <span>
        {label}
        {required && <span className="text-[#8A1F15]"> *</span>}
      </span>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={errorId}
        onChange={(event) => onChange(event.target.value)}
        className={`rounded-lg border bg-white px-3 py-2 text-sm font-normal text-[var(--brand-ink)] outline-none focus:ring-2 ${
          error
            ? "border-[#B42318] focus:border-[#B42318] focus:ring-[#B42318]/20"
            : "border-[var(--brand-border)] focus:border-[var(--brand-teal)] focus:ring-[var(--brand-teal)]/20"
        }`}
      />
      {error && (
        <span id={errorId} className="text-xs font-medium text-[#8A1F15]">
          {error}
        </span>
      )}
    </label>
  );
}

function TextArea({
  id,
  label,
  value,
  rows,
  required = false,
  placeholder,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  rows: number;
  required?: boolean;
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <label htmlFor={id} className="flex flex-col gap-2 text-sm font-semibold text-[var(--brand-ink)]">
      <span>
        {label}
        {required && <span className="text-[#8A1F15]"> *</span>}
      </span>
      <textarea
        id={id}
        value={value}
        rows={rows}
        required={required}
        placeholder={placeholder}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={errorId}
        onChange={(event) => onChange(event.target.value)}
        className={`resize-y rounded-lg border bg-white px-3 py-2 text-sm font-normal leading-6 text-[var(--brand-ink)] outline-none focus:ring-2 ${
          error
            ? "border-[#B42318] focus:border-[#B42318] focus:ring-[#B42318]/20"
            : "border-[var(--brand-border)] focus:border-[var(--brand-teal)] focus:ring-[var(--brand-teal)]/20"
        }`}
      />
      {error && (
        <span id={errorId} className="text-xs font-medium text-[#8A1F15]">
          {error}
        </span>
      )}
    </label>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-lg border border-[var(--brand-border)] bg-white p-4">
      <h4 className="text-sm font-semibold text-[var(--brand-ink)]">{label}</h4>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--brand-ink-soft)]">
        {value}
      </p>
    </section>
  );
}

function DetailList({
  label,
  values,
  onSelectValue,
}: {
  label: string;
  values: string[];
  onSelectValue?: (value: string) => void;
}) {
  return (
    <section className="rounded-lg border border-[var(--brand-border)] bg-white p-4">
      <h4 className="text-sm font-semibold text-[var(--brand-ink)]">{label}</h4>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.map((value) =>
          onSelectValue ? (
            <button
              key={value}
              type="button"
              onClick={() => onSelectValue(value)}
              className="rounded-full border border-[#534AB7]/20 bg-[#EEEDFE] px-2.5 py-1 text-xs text-[#332C85] hover:bg-[#E3E0FF]"
            >
              {value}
            </button>
          ) : (
            <span
              key={value}
              className="rounded-full border border-[#534AB7]/20 bg-[#EEEDFE] px-2.5 py-1 text-xs text-[#332C85]"
            >
              {value}
            </span>
          ),
        )}
      </div>
    </section>
  );
}

function MainMapsRegistry({
  maps,
  isLoading,
  isSaving,
  newTitle,
  renameMapId,
  renameTitle,
  deleteMapId,
  onBack,
  onNewTitleChange,
  onCreate,
  onOpen,
  onStartRename,
  onRenameTitleChange,
  onSaveRename,
  onCancelRename,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  maps: CommonplaceMindMapSummary[];
  isLoading: boolean;
  isSaving: boolean;
  newTitle: string;
  renameMapId: string | null;
  renameTitle: string;
  deleteMapId: string | null;
  onBack: () => void;
  onNewTitleChange: (value: string) => void;
  onCreate: () => void;
  onOpen: (map: CommonplaceMindMapSummary) => void;
  onStartRename: (map: CommonplaceMindMapSummary) => void;
  onRenameTitleChange: (value: string) => void;
  onSaveRename: (map: CommonplaceMindMapSummary) => void;
  onCancelRename: () => void;
  onAskDelete: (mapId: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (map: CommonplaceMindMapSummary) => void;
}) {
  return (
    <section
      className="flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--brand-border)] bg-white p-5"
      data-testid="commonplace-main-maps-registry"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--brand-border)] pb-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-3 rounded-lg border border-[var(--brand-border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-surface-2)]"
          >
            ← Library
          </button>
          <h2 className="text-2xl font-semibold text-[var(--brand-ink)]">
            Main Maps
          </h2>
          <p className="mt-1 text-sm text-[var(--brand-ink-soft)]">
            Organize big-picture maps across themes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={newTitle}
            onChange={(event) => onNewTitleChange(event.target.value)}
            placeholder="New Main Map title"
            className="rounded-lg border border-[var(--brand-border)] px-3 py-2 text-sm"
            aria-label="New Main Map title"
          />
          <button
            type="button"
            onClick={onCreate}
            disabled={isSaving}
            className="rounded-lg bg-[var(--brand-teal)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            + New Main Map
          </button>
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <p className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 text-sm text-[var(--brand-ink-soft)]">
            Loading Main Maps...
          </p>
        ) : maps.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--brand-border-strong)] bg-[var(--brand-surface-2)] p-4 text-sm text-[var(--brand-ink-soft)]">
            No Main Maps yet.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {maps.map((map) => (
              <MapRegistryCard
                key={map.id}
                map={map}
                renameMapId={renameMapId}
                renameTitle={renameTitle}
                deleteMapId={deleteMapId}
                isSaving={isSaving}
                onOpen={onOpen}
                onStartRename={onStartRename}
                onRenameTitleChange={onRenameTitleChange}
                onSaveRename={onSaveRename}
                onCancelRename={onCancelRename}
                onAskDelete={onAskDelete}
                onCancelDelete={onCancelDelete}
                onConfirmDelete={onConfirmDelete}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MapRegistryCard({
  map,
  renameMapId,
  renameTitle,
  deleteMapId,
  isSaving,
  onOpen,
  onStartRename,
  onRenameTitleChange,
  onSaveRename,
  onCancelRename,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  map: CommonplaceMindMapSummary;
  renameMapId: string | null;
  renameTitle: string;
  deleteMapId: string | null;
  isSaving: boolean;
  onOpen: (map: CommonplaceMindMapSummary) => void;
  onStartRename: (map: CommonplaceMindMapSummary) => void;
  onRenameTitleChange: (value: string) => void;
  onSaveRename: (map: CommonplaceMindMapSummary) => void;
  onCancelRename: () => void;
  onAskDelete: (mapId: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (map: CommonplaceMindMapSummary) => void;
}) {
  const isRenaming = renameMapId === map.id;
  const isConfirmingDelete = deleteMapId === map.id;

  return (
    <article className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 shadow-sm">
      <span className="rounded-full bg-[var(--brand-teal-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--brand-teal-ink)]">
        {map.type === "main" ? "Main Map" : "Sub Mind Map"}
      </span>
      {isRenaming ? (
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={renameTitle}
            onChange={(event) => onRenameTitleChange(event.target.value)}
            className="rounded-lg border border-[var(--brand-border)] px-3 py-2 text-sm"
            aria-label={`Rename ${map.title}`}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSaveRename(map)}
              disabled={isSaving}
              className="rounded-lg bg-[var(--brand-teal)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-70"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onCancelRename}
              className="rounded-lg border border-[var(--brand-border)] bg-white px-3 py-1.5 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="mt-3 text-lg font-semibold text-[var(--brand-ink)]">
            {map.title}
          </h3>
          <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
            Updated {formatDate(map.updatedAt)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpen(map)}
              className="rounded-lg bg-[var(--brand-teal)] px-3 py-1.5 text-xs font-semibold text-white"
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => onStartRename(map)}
              className="rounded-lg border border-[var(--brand-border)] bg-white px-3 py-1.5 text-xs font-semibold"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => onAskDelete(map.id)}
              className="rounded-lg border border-[#B42318]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[#8A1F15]"
            >
              Delete
            </button>
          </div>
        </>
      )}
      {isConfirmingDelete && (
        <div className="mt-3 rounded-lg border border-[#B42318]/20 bg-[#FFF4F3] p-3">
          <p className="text-xs font-semibold text-[#8A1F15]">
            Delete this map?
          </p>
          <p className="mt-1 text-xs text-[#8A1F15]">
            Phase 3 uses hard delete and blocks maps that already have graph data.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => onConfirmDelete(map)}
              disabled={isSaving}
              className="rounded-lg bg-[#8A1F15] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-70"
            >
              Confirm delete
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="rounded-lg border border-[#B42318]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[#8A1F15]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function SubMindMapChooser({
  maps,
  noteContext,
  isLoading,
  isSaving,
  newTitle,
  onBack,
  onNewTitleChange,
  onCreate,
  onOpen,
}: {
  maps: CommonplaceMindMapSummary[];
  noteContext: MapNoteContext | null;
  isLoading: boolean;
  isSaving: boolean;
  newTitle: string;
  onBack: () => void;
  onNewTitleChange: (value: string) => void;
  onCreate: () => void;
  onOpen: (map: CommonplaceMindMapSummary) => void;
}) {
  return (
    <section
      className="rounded-xl border border-[var(--brand-border)] bg-white p-5"
      data-testid="commonplace-sub-map-chooser"
    >
      <button
        type="button"
        onClick={onBack}
        className="rounded-lg border border-[var(--brand-border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-surface-2)]"
      >
        ← Detail Note
      </button>
      <h2 className="mt-4 text-2xl font-semibold text-[var(--brand-ink)]">
        Choose Sub Mind Map
      </h2>
      {noteContext && (
        <p className="mt-1 text-sm text-[var(--brand-ink-soft)]">
          For {noteContext.shortcode} · {noteContext.title}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={newTitle}
          onChange={(event) => onNewTitleChange(event.target.value)}
          placeholder="New Sub Mind Map title"
          className="rounded-lg border border-[var(--brand-border)] px-3 py-2 text-sm"
          aria-label="New Sub Mind Map title"
        />
        <button
          type="button"
          onClick={onCreate}
          disabled={isSaving}
          className="rounded-lg bg-[var(--brand-teal)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-70"
        >
          + New Sub Mind Map
        </button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <p className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 text-sm text-[var(--brand-ink-soft)]">
            Loading Sub Mind Maps...
          </p>
        ) : maps.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--brand-border-strong)] bg-[var(--brand-surface-2)] p-4 text-sm text-[var(--brand-ink-soft)]">
            No Sub Mind Maps yet.
          </p>
        ) : (
          maps.map((map) => (
            <button
              key={map.id}
              type="button"
              onClick={() => onOpen(map)}
              className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-left shadow-sm hover:border-[var(--brand-teal)]"
            >
              <span className="rounded-full bg-[var(--brand-teal-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--brand-teal-ink)]">
                Sub Mind Map
              </span>
              <span className="mt-3 block text-base font-semibold text-[var(--brand-ink)]">
                {map.title}
              </span>
              <span className="mt-1 block text-xs text-[var(--brand-ink-soft)]">
                Updated {formatDate(map.updatedAt)}
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
