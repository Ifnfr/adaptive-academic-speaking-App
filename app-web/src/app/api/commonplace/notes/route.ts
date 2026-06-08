import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  createCommonplaceNote,
  deleteCommonplaceNote,
  listCommonplaceNotes,
  updateCommonplaceNote,
  type CreateCommonplaceNoteInput,
  type UpdateCommonplaceNoteInput,
} from "../../../lib/storage/supabase-commonplace-adapter";

export const runtime = "nodejs";

type CreateCommonplaceNoteRequest = {
  clientId?: string | null;
  sourceBook?: string | null;
  sourcePage?: string | null;
  title?: string | null;
  quote?: string | null;
  insight?: string;
  tags?: string[] | null;
  connections?: string[] | null;
  relevance?: string | null;
};

type UpdateCommonplaceNoteRequest = CreateCommonplaceNoteRequest & {
  noteId?: string | null;
};

type DeleteCommonplaceNoteRequest = {
  noteId?: string | null;
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

function buildCreateInput(
  ownerId: string,
  body: CreateCommonplaceNoteRequest,
): CreateCommonplaceNoteInput {
  return {
    ownerId,
    clientId: body.clientId,
    sourceBook: body.sourceBook,
    sourcePage: body.sourcePage,
    title: body.title,
    quote: body.quote,
    insight: body.insight ?? "",
    tags: body.tags,
    connections: body.connections,
    relevance: body.relevance,
  };
}

function buildUpdateInput(
  ownerId: string,
  body: UpdateCommonplaceNoteRequest,
): UpdateCommonplaceNoteInput {
  return {
    ownerId,
    noteId: body.noteId ?? "",
    sourceBook: body.sourceBook,
    sourcePage: body.sourcePage,
    title: body.title,
    quote: body.quote,
    insight: body.insight,
    tags: body.tags,
    connections: body.connections,
    relevance: body.relevance,
  };
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

export async function GET() {
  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return NextResponse.json({ error: "note_save_failed" }, { status: 500 });
  }

  const result = await listCommonplaceNotes(ownerId, supabaseClient);

  if (!result.ok) {
    const status =
      result.error === "commonplace_validation_failed" ? 400 : 500;
    const error =
      result.error === "commonplace_validation_failed"
        ? "invalid_note_fields"
        : "note_save_failed";
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ notes: result.notes }, { status: 200 });
}

export async function POST(request: Request) {
  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const parsed = await parseObjectBody(request);
  if (!parsed) {
    return NextResponse.json({ error: "invalid_note_fields" }, { status: 400 });
  }

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return NextResponse.json({ error: "note_save_failed" }, { status: 500 });
  }

  const result = await createCommonplaceNote(
    buildCreateInput(ownerId, parsed),
    supabaseClient,
  );

  if (!result.ok) {
    const status =
      result.error === "commonplace_validation_failed" ? 400 : 500;
    const error =
      result.error === "commonplace_validation_failed"
        ? "invalid_note_fields"
        : "note_save_failed";
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ note: result.note }, { status: 201 });
}

export async function PATCH(request: Request) {
  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const parsed = await parseObjectBody(request);
  if (!parsed) {
    return NextResponse.json({ error: "invalid_note_fields" }, { status: 400 });
  }

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return NextResponse.json({ error: "note_save_failed" }, { status: 500 });
  }

  const result = await updateCommonplaceNote(
    buildUpdateInput(ownerId, parsed),
    supabaseClient,
  );

  if (!result.ok) {
    const status =
      result.error === "commonplace_validation_failed" ? 400 : 500;
    const error =
      result.error === "commonplace_validation_failed"
        ? "invalid_note_fields"
        : "note_save_failed";
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ note: result.note }, { status: 200 });
}

export async function DELETE(request: Request) {
  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const parsed = (await parseObjectBody(request)) as
    | DeleteCommonplaceNoteRequest
    | null;
  if (!parsed || typeof parsed.noteId !== "string" || !parsed.noteId.trim()) {
    return NextResponse.json({ error: "invalid_note_fields" }, { status: 400 });
  }

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return NextResponse.json({ error: "note_save_failed" }, { status: 500 });
  }

  const result = await deleteCommonplaceNote(
    ownerId,
    parsed.noteId,
    supabaseClient,
  );

  if (!result.ok) {
    const status =
      result.error === "commonplace_validation_failed" ? 400 : 500;
    const error =
      result.error === "commonplace_validation_failed"
        ? "invalid_note_fields"
        : "note_save_failed";
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
