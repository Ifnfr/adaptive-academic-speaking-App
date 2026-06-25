import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Helper function to resolve Clerk authentication
async function resolveCurrentUserId(): Promise<string | null> {
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    return session?.userId || null;
  } catch {
    return null;
  }
}

// Helper to initialize Supabase service client
function getSupabaseClient() {
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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const userId = await resolveCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;
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
      .select("id, started_at, completed_at, prompts_attempted, prompts_correct_first_try")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found or forbidden" }, { status: 403 });
    }

    // Query word_builder_attempts where session_id = sessionId order by created_at asc, select all columns
    const { data: attempts, error: attemptsError } = await supabase
      .from("word_builder_attempts")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (attemptsError || !attempts) {
      console.error("Failed to fetch attempts from DB:", attemptsError);
      return NextResponse.json({ error: "Failed to fetch attempts" }, { status: 500 });
    }

    // For each attempt query word_builder_errors where attempt_id = attempt.id, select all columns
    const attemptIds = attempts.map((a: any) => a.id);
    let errors: any[] = [];
    if (attemptIds.length > 0) {
      const { data: errorsData, error: errorsError } = await supabase
        .from("word_builder_errors")
        .select("*")
        .in("attempt_id", attemptIds);

      if (errorsError) {
        console.error("Failed to fetch errors from DB:", errorsError);
        return NextResponse.json({ error: "Failed to fetch errors" }, { status: 500 });
      }
      errors = errorsData ?? [];
    }

    // Map errors to their attempts
    const attemptsWithErrors = attempts.map((attempt: any) => ({
      ...attempt,
      errors: errors.filter((e: any) => e.attempt_id === attempt.id),
    }));

    // Query word_builder_notes where session_id = sessionId AND user_id = userId order by created_at asc
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

    return NextResponse.json({
      session,
      attempts: attemptsWithErrors,
      notes: notes ?? [],
    });
  } catch (error: any) {
    console.error("Word Builder Session Detail GET Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
