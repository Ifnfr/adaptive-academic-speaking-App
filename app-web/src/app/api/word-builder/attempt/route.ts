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

    const {
      sessionId,
      promptId,
      promptMode,
      attemptText,
      isCorrect,
      attemptNumber,
      hintsUsed,
      isEchoAttempt,
      errors,
      promptText,
      correctedSentence,
      userAnalysis,
      analysisFeedback,
    } = body;

    // Validate fields
    if (
      !sessionId ||
      !promptId ||
      !promptMode ||
      typeof attemptText !== "string" ||
      typeof isCorrect !== "boolean" ||
      typeof attemptNumber !== "number" ||
      typeof hintsUsed !== "number" ||
      typeof isEchoAttempt !== "boolean" ||
      !Array.isArray(errors)
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

    // Insert attempt
    const { data: attemptData, error: attemptError } = await supabase
      .from("word_builder_attempts")
      .insert({
        session_id: sessionId,
        prompt_id: promptId,
        prompt_mode: promptMode,
        attempt_text: attemptText,
        is_correct: isCorrect,
        attempt_number: attemptNumber,
        hints_used: hintsUsed,
        is_echo_attempt: isEchoAttempt,
        prompt_text: promptText ?? null,
        corrected_sentence: correctedSentence ?? null,
        user_analysis: userAnalysis ?? null,
        analysis_feedback: analysisFeedback ?? null,
      })
      .select("id")
      .single();

    if (attemptError || !attemptData) {
      console.error("Failed to insert attempt in DB:", attemptError);
      return NextResponse.json({ error: "Failed to log attempt" }, { status: 500 });
    }

    const attemptId = attemptData.id;

    // Insert errors if present
    if (errors.length > 0) {
      const errorsToInsert = errors.map((err: any) => ({
        attempt_id: attemptId,
        category: err.category,
        severity: err.severity,
        resolved: err.resolved ?? false,
        hints_used_for_error: err.hintsUsedForError ?? 0,
      }));

      const { error: errorsInsertError } = await supabase
        .from("word_builder_errors")
        .insert(errorsToInsert);

      if (errorsInsertError) {
        console.error("Failed to insert errors in DB:", errorsInsertError);
        return NextResponse.json({ error: "Failed to log attempt errors" }, { status: 500 });
      }
    }

    return NextResponse.json({ attemptId });
  } catch (error: any) {
    console.error("Word Builder Attempt Logging Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
