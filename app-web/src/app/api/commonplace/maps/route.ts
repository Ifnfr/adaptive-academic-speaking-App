import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  createCommonplaceMindMap,
  deleteCommonplaceMindMapFromRegistry,
  listCommonplaceMindMaps,
  renameCommonplaceMindMap,
  type CommonplaceMindMapType,
} from "../../../lib/storage/supabase-commonplace-mindmap-adapter";

export const runtime = "nodejs";

type CreateMapRequest = {
  title?: string | null;
  type?: string | null;
};

type RenameMapRequest = {
  mapId?: string | null;
  title?: string | null;
};

type DeleteMapRequest = {
  mapId?: string | null;
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

export async function GET(request: Request) {
  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return NextResponse.json({ error: "map_save_failed" }, { status: 500 });
  }

  const url = new URL(request.url);
  const rawType = url.searchParams.get("type");
  const type = rawType ? cleanMapType(rawType) : null;
  if (rawType && !type) {
    return NextResponse.json({ error: "invalid_map_fields" }, { status: 400 });
  }

  const result = await listCommonplaceMindMaps(ownerId, supabaseClient, type);
  if (!result.ok) {
    const status =
      result.error === "commonplace_validation_failed" ? 400 : 500;
    return NextResponse.json({ error: "map_save_failed" }, { status });
  }

  return NextResponse.json({ maps: result.mindMaps }, { status: 200 });
}

export async function POST(request: Request) {
  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const parsed = (await parseObjectBody(request)) as CreateMapRequest | null;
  const type = cleanMapType(parsed?.type);
  if (!parsed || !type) {
    return NextResponse.json({ error: "invalid_map_fields" }, { status: 400 });
  }

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return NextResponse.json({ error: "map_save_failed" }, { status: 500 });
  }

  const result = await createCommonplaceMindMap(
    { ownerId, title: parsed.title ?? "", type },
    supabaseClient,
  );

  if (!result.ok) {
    const status =
      result.error === "commonplace_validation_failed" ? 400 : 500;
    const error =
      result.error === "commonplace_validation_failed"
        ? "invalid_map_fields"
        : "map_save_failed";
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ map: result.mindMap }, { status: 201 });
}

export async function PATCH(request: Request) {
  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const parsed = (await parseObjectBody(request)) as RenameMapRequest | null;
  if (
    !parsed ||
    typeof parsed.mapId !== "string" ||
    !parsed.mapId.trim()
  ) {
    return NextResponse.json({ error: "invalid_map_fields" }, { status: 400 });
  }

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return NextResponse.json({ error: "map_save_failed" }, { status: 500 });
  }

  const result = await renameCommonplaceMindMap(
    { ownerId, mindMapId: parsed.mapId, title: parsed.title ?? "" },
    supabaseClient,
  );

  if (!result.ok) {
    if (result.error === "commonplace_not_found") {
      return NextResponse.json({ error: "map_not_found" }, { status: 404 });
    }

    const status =
      result.error === "commonplace_validation_failed" ? 400 : 500;
    const error =
      result.error === "commonplace_validation_failed"
        ? "invalid_map_fields"
        : "map_save_failed";
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ map: result.mindMap }, { status: 200 });
}

export async function DELETE(request: Request) {
  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const parsed = (await parseObjectBody(request)) as DeleteMapRequest | null;
  if (
    !parsed ||
    typeof parsed.mapId !== "string" ||
    !parsed.mapId.trim()
  ) {
    return NextResponse.json({ error: "invalid_map_fields" }, { status: 400 });
  }

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return NextResponse.json({ error: "map_save_failed" }, { status: 500 });
  }

  const result = await deleteCommonplaceMindMapFromRegistry(
    ownerId,
    parsed.mapId,
    supabaseClient,
  );

  if (!result.ok) {
    if (result.error === "commonplace_not_found") {
      return NextResponse.json({ error: "map_not_found" }, { status: 404 });
    }
    if (result.error === "commonplace_conflict") {
      return NextResponse.json(
        { error: "map_has_related_graph_data" },
        { status: 409 },
      );
    }

    const status =
      result.error === "commonplace_validation_failed" ? 400 : 500;
    const error =
      result.error === "commonplace_validation_failed"
        ? "invalid_map_fields"
        : "map_save_failed";
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
