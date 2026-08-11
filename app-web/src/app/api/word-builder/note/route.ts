import { NextResponse } from "next/server";
import { resolveCurrentUserId, getSupabaseClient } from "../_lib/route-helpers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const userId = await resolveCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { sessionId, attemptId, word, noteText } = body;
    if (!sessionId || !word || !noteText) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unconfigured" }, { status: 500 });
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from("word_builder_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found or forbidden" }, { status: 403 });
    }

    // Insert note
    const { data: noteData, error: noteError } = await supabase
      .from("word_builder_notes")
      .insert({
        session_id: sessionId,
        attempt_id: attemptId ?? null,
        user_id: userId,
        word: word,
        note_text: noteText,
        source: "word_builder",
      })
      .select("id")
      .single();

    if (noteError || !noteData) {
      console.error("Failed to insert note in DB:", noteError);
      return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
    }

    return NextResponse.json({ noteId: noteData.id });
  } catch (error: any) {
    console.error("Word Builder Note POST Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const userId = await resolveCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unconfigured" }, { status: 500 });
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from("word_builder_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found or forbidden" }, { status: 403 });
    }

    // Fetch notes
    const { data: notes, error: notesError } = await supabase
      .from("word_builder_notes")
      .select("*")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (notesError) {
      console.error("Failed to fetch notes from DB:", notesError);
      return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
    }

    return NextResponse.json({ notes: notes ?? [] });
  } catch (error: any) {
    console.error("Word Builder Note GET Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await resolveCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { noteId } = body;
    if (!noteId) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unconfigured" }, { status: 500 });
    }

    // Delete note where id = noteId and user_id = userId
    const { error: deleteError } = await supabase
      .from("word_builder_notes")
      .delete()
      .eq("id", noteId)
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Failed to delete note in DB:", deleteError);
      return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Word Builder Note DELETE Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
