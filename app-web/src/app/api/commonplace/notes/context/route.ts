import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  getCommonplaceNoteById,
  type CommonplaceNote,
} from "../../../../lib/storage/supabase-commonplace-adapter";

export const runtime = "nodejs";

const MAX_INSIGHT_CONTEXT_LENGTH = 1200;
const MAX_CONTEXT_TAGS = 8;

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

function boundedText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

function buildNoteContext(note: CommonplaceNote) {
  return {
    source: "commonplace" as const,
    noteId: note.id,
    shortcode: note.shortcode,
    title: note.title || undefined,
    sourceBook: note.sourceBook || undefined,
    insight: boundedText(note.insight, MAX_INSIGHT_CONTEXT_LENGTH),
    tags: note.tags.slice(0, MAX_CONTEXT_TAGS),
  };
}

function responseForStorageError(error: string) {
  if (error === "commonplace_not_found") {
    return NextResponse.json({ error: "note_not_found" }, { status: 404 });
  }
  if (error === "commonplace_validation_failed") {
    return NextResponse.json(
      { error: "invalid_note_context_fields" },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { error: "note_context_fetch_failed" },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const noteId = cleanRequiredText(url.searchParams.get("noteId"));
  if (!noteId) {
    return NextResponse.json(
      { error: "invalid_note_context_fields" },
      { status: 400 },
    );
  }

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return NextResponse.json(
      { error: "note_context_fetch_failed" },
      { status: 500 },
    );
  }

  const result = await getCommonplaceNoteById(ownerId, noteId, supabaseClient);
  if (!result.ok) {
    return responseForStorageError(result.error);
  }

  return NextResponse.json({ context: buildNoteContext(result.note) });
}
