import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  createMainMapEdge,
  createSubMapEdge,
  deleteMainMapEdge,
  deleteSubMapEdge,
  listMainMapEdges,
  listSubMapEdges,
  updateMainMapEdge,
  updateSubMapEdge,
  type CommonplaceMindMapEdgeType,
  type CommonplaceSubMapEdge,
} from "../../../../lib/storage/supabase-commonplace-mindmap-adapter";
import { testHooks } from "./route-test-hooks";

export const runtime = "nodejs";

type PostEdgeRequest = {
  mapId?: unknown;
  type?: unknown;
  sourceNodeId?: unknown;
  targetNodeId?: unknown;
  edgeType?: unknown;
  label?: unknown;
};

type PatchEdgeRequest = {
  edgeId?: unknown;
  mapId?: unknown;
  type?: unknown;
  edgeType?: unknown;
  label?: unknown;
};

type DeleteEdgeRequest = {
  edgeId?: unknown;
  mapId?: unknown;
  type?: unknown;
};

async function resolveCurrentUserId(): Promise<string | null> {
  if (testHooks.resolveCurrentUserId) {
    return testHooks.resolveCurrentUserId();
  }

  try {
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    return session?.userId || null;
  } catch {
    return null;
  }
}

function getSupabaseClient() {
  if (testHooks.getSupabaseClient) {
    return testHooks.getSupabaseClient() as ReturnType<typeof createClient> | null;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  try {
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch {
    return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanRequiredText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanEdgeType(value: unknown): CommonplaceMindMapEdgeType | null {
  return value === "solid" || value === "dashed" ? value : null;
}

function cleanMapType(value: unknown): "main" | "sub" | null {
  return value === "main" || value === "sub" ? value : null;
}

function cleanOptionalLabel(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length > 80) return undefined;
  return trimmed || null;
}

async function parseObjectBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return null;
  }

  return isPlainObject(parsed) ? parsed : null;
}

function toApiEdge(edge: CommonplaceSubMapEdge) {
  return {
    id: edge.id,
    mapId: edge.mapId,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    edgeType: edge.edgeType,
    label: edge.label,
  };
}

function responseForStorageError(error: string) {
  if (error === "commonplace_validation_failed") {
    return NextResponse.json(
      { error: "invalid_map_edge_fields" },
      { status: 400 },
    );
  }
  if (error === "commonplace_not_found") {
    return NextResponse.json({ error: "map_edge_not_found" }, { status: 404 });
  }
  return NextResponse.json({ error: "map_edge_save_failed" }, { status: 500 });
}

export async function GET(request: Request) {
  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const mapId = cleanRequiredText(url.searchParams.get("mapId"));
  const type = cleanMapType(url.searchParams.get("type"));
  if (!mapId || !type) {
    return NextResponse.json(
      { error: "invalid_map_edge_fields" },
      { status: 400 },
    );
  }
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return NextResponse.json({ error: "map_edge_save_failed" }, { status: 500 });
  }

  const result =
    type === "main"
      ? await listMainMapEdges(ownerId, mapId, supabaseClient)
      : await listSubMapEdges(ownerId, mapId, supabaseClient);
  if (!result.ok) {
    return responseForStorageError(result.error);
  }

  return NextResponse.json(
    { edges: result.edges.map(toApiEdge) },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const parsed = (await parseObjectBody(request)) as PostEdgeRequest | null;
  const mapId = cleanRequiredText(parsed?.mapId);
  const type = cleanMapType(parsed?.type);
  if (!parsed || !mapId || !type) {
    return NextResponse.json(
      { error: "invalid_map_edge_fields" },
      { status: 400 },
    );
  }
  const sourceNodeId = cleanRequiredText(parsed.sourceNodeId);
  const targetNodeId = cleanRequiredText(parsed.targetNodeId);
  const edgeType = cleanEdgeType(parsed.edgeType);
  const label = cleanOptionalLabel(parsed.label);
  if (
    !sourceNodeId ||
    !targetNodeId ||
    sourceNodeId === targetNodeId ||
    !edgeType ||
    label === undefined
  ) {
    return NextResponse.json(
      { error: "invalid_map_edge_fields" },
      { status: 400 },
    );
  }

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return NextResponse.json({ error: "map_edge_save_failed" }, { status: 500 });
  }

  const result =
    type === "main"
      ? await createMainMapEdge(
          ownerId,
          {
            mainMapId: mapId,
            sourceNodeId,
            targetNodeId,
            edgeType,
            label,
          },
          supabaseClient,
        )
      : await createSubMapEdge(
          ownerId,
          { mapId, sourceNodeId, targetNodeId, edgeType, label },
          supabaseClient,
        );
  if (!result.ok) {
    return responseForStorageError(result.error);
  }

  return NextResponse.json({ edge: toApiEdge(result.edge) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const parsed = (await parseObjectBody(request)) as PatchEdgeRequest | null;
  const mapId = cleanRequiredText(parsed?.mapId);
  const edgeId = cleanRequiredText(parsed?.edgeId);
  const type = cleanMapType(parsed?.type);
  if (!parsed || !mapId || !edgeId || !type) {
    return NextResponse.json(
      { error: "invalid_map_edge_fields" },
      { status: 400 },
    );
  }
  const hasEdgeType = parsed.edgeType !== undefined && parsed.edgeType !== null;
  const hasLabel = Object.prototype.hasOwnProperty.call(parsed, "label");
  const edgeType = hasEdgeType ? cleanEdgeType(parsed.edgeType) : null;
  const label = hasLabel ? cleanOptionalLabel(parsed.label) : undefined;
  if (
    (!hasEdgeType && !hasLabel) ||
    (hasEdgeType && !edgeType) ||
    (hasLabel && label === undefined)
  ) {
    return NextResponse.json(
      { error: "invalid_map_edge_fields" },
      { status: 400 },
    );
  }

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return NextResponse.json({ error: "map_edge_save_failed" }, { status: 500 });
  }

  const result =
    type === "main"
      ? await updateMainMapEdge(
          ownerId,
          { mainMapId: mapId, edgeId, edgeType, label },
          supabaseClient,
        )
      : await updateSubMapEdge(
          ownerId,
          { mapId, edgeId, edgeType, label },
          supabaseClient,
        );
  if (!result.ok) {
    return responseForStorageError(result.error);
  }

  return NextResponse.json({ edge: toApiEdge(result.edge) }, { status: 200 });
}

export async function DELETE(request: Request) {
  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const parsed = (await parseObjectBody(request)) as DeleteEdgeRequest | null;
  const mapId = cleanRequiredText(parsed?.mapId);
  const edgeId = cleanRequiredText(parsed?.edgeId);
  const type = cleanMapType(parsed?.type);
  if (!parsed || !mapId || !edgeId || !type) {
    return NextResponse.json(
      { error: "invalid_map_edge_fields" },
      { status: 400 },
    );
  }
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return NextResponse.json({ error: "map_edge_save_failed" }, { status: 500 });
  }

  const result =
    type === "main"
      ? await deleteMainMapEdge(ownerId, mapId, edgeId, supabaseClient)
      : await deleteSubMapEdge(ownerId, mapId, edgeId, supabaseClient);
  if (!result.ok) {
    return responseForStorageError(result.error);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
