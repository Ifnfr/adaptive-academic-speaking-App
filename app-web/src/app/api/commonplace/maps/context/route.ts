import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  getCommonplaceSubMapDiscussionContext,
  type CommonplaceMindMapType,
} from "../../../../lib/storage/supabase-commonplace-mindmap-adapter";

export const runtime = "nodejs";

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

function cleanRequiredText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanMapType(value: unknown): CommonplaceMindMapType | null {
  return value === "sub" ? value : null;
}

function responseForStorageError(error: string) {
  if (error === "commonplace_not_found") {
    return NextResponse.json({ error: "map_not_found" }, { status: 404 });
  }
  if (error === "commonplace_validation_failed") {
    return NextResponse.json(
      { error: "invalid_map_context_fields" },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { error: "map_context_fetch_failed" },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const mapId = cleanRequiredText(url.searchParams.get("mapId"));
  const mapType = cleanMapType(url.searchParams.get("mapType"));
  if (!mapId || !mapType) {
    return NextResponse.json(
      { error: "invalid_map_context_fields" },
      { status: 400 },
    );
  }

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return NextResponse.json(
      { error: "map_context_fetch_failed" },
      { status: 500 },
    );
  }

  const result = await getCommonplaceSubMapDiscussionContext(
    ownerId,
    mapId,
    supabaseClient,
  );
  if (!result.ok) {
    return responseForStorageError(result.error);
  }

  return NextResponse.json({ context: result.context });
}
