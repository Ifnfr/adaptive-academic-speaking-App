import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  batchUpdateCommonplaceMapNodePositions,
  createSubMapNoteNode,
  listCommonplaceMapNodes,
  type CommonplaceMapNodePositionUpdate,
  type CommonplaceMindMapType,
} from "../../../../lib/storage/supabase-commonplace-mindmap-adapter";

export const runtime = "nodejs";

type PatchNodesRequest = {
  mapId?: unknown;
  type?: unknown;
  updates?: unknown;
};

type PostNodeRequest = {
  mapId?: unknown;
  type?: unknown;
  noteId?: unknown;
  position?: unknown;
};

export const testHooks = {
  resolveCurrentUserId: null as (() => Promise<string | null>) | null,
  getSupabaseClient: null as (() => unknown) | null,
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

function cleanMapType(value: unknown): CommonplaceMindMapType | null {
  return value === "main" || value === "sub" ? value : null;
}

function cleanRequiredText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function cleanPositionUpdates(
  value: unknown,
): CommonplaceMapNodePositionUpdate[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;

  const updates: CommonplaceMapNodePositionUpdate[] = [];
  for (const item of value) {
    if (!isPlainObject(item) || !isPlainObject(item.position)) {
      return null;
    }

    const nodeId = cleanRequiredText(item.nodeId);
    const x = item.position.x;
    const y = item.position.y;
    if (!nodeId || typeof x !== "number" || typeof y !== "number") {
      return null;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }

    updates.push({ nodeId, position: { x, y } });
  }

  return updates;
}

function cleanPosition(value: unknown): { x: number; y: number } | null {
  if (!isPlainObject(value)) return null;

  const x = value.x;
  const y = value.y;
  if (typeof x !== "number" || typeof y !== "number") return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return { x, y };
}

function responseForStorageError(error: string) {
  if (error === "commonplace_validation_failed") {
    return NextResponse.json(
      { error: "invalid_map_node_fields" },
      { status: 400 },
    );
  }
  if (error === "commonplace_not_found") {
    return NextResponse.json({ error: "map_not_found" }, { status: 404 });
  }
  return NextResponse.json({ error: "map_node_save_failed" }, { status: 500 });
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
      { error: "invalid_map_node_fields" },
      { status: 400 },
    );
  }

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return NextResponse.json({ error: "map_node_save_failed" }, { status: 500 });
  }

  const result = await listCommonplaceMapNodes(
    ownerId,
    mapId,
    type,
    supabaseClient,
  );
  if (!result.ok) {
    return responseForStorageError(result.error);
  }

  return NextResponse.json({ nodes: result.nodes }, { status: 200 });
}

export async function POST(request: Request) {
  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const parsed = (await parseObjectBody(request)) as PostNodeRequest | null;
  const mapId = cleanRequiredText(parsed?.mapId);
  const type = cleanMapType(parsed?.type);
  const noteId = cleanRequiredText(parsed?.noteId);
  const position = cleanPosition(parsed?.position);
  if (!parsed || !mapId || !type || !noteId || !position) {
    return NextResponse.json(
      { error: "invalid_map_node_fields" },
      { status: 400 },
    );
  }

  if (type === "main") {
    return NextResponse.json(
      { error: "main_note_nodes_not_supported" },
      { status: 409 },
    );
  }

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return NextResponse.json({ error: "map_node_save_failed" }, { status: 500 });
  }

  const result = await createSubMapNoteNode(
    ownerId,
    mapId,
    noteId,
    position,
    supabaseClient,
  );
  if (!result.ok) {
    return responseForStorageError(result.error);
  }

  return NextResponse.json({ node: result.node }, { status: 201 });
}

export async function PATCH(request: Request) {
  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const parsed = (await parseObjectBody(request)) as PatchNodesRequest | null;
  const mapId = cleanRequiredText(parsed?.mapId);
  const type = cleanMapType(parsed?.type);
  const updates = cleanPositionUpdates(parsed?.updates);
  if (!parsed || !mapId || !type || !updates) {
    return NextResponse.json(
      { error: "invalid_map_node_fields" },
      { status: 400 },
    );
  }

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return NextResponse.json({ error: "map_node_save_failed" }, { status: 500 });
  }

  const result = await batchUpdateCommonplaceMapNodePositions(
    ownerId,
    mapId,
    type,
    updates,
    supabaseClient,
  );
  if (!result.ok) {
    return responseForStorageError(result.error);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
