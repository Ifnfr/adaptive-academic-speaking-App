import { NextResponse } from "next/server";
import { resolveCurrentUserId, getSupabaseClient } from "../../_lib/route-helpers";

export const runtime = "nodejs";

export async function GET(_req: Request) {
  try {
    const userId = await resolveCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unconfigured" }, { status: 500 });
    }

    // Find most recent unfinished session
    const { data: session, error: sessionError } = await supabase
      .from("word_builder_sessions")
      .select("id, started_at, prompts_attempted, prompts_correct_first_try")
      .eq("user_id", userId)
      .is("completed_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    if (sessionError || !session) {
      // No active session
      return NextResponse.json({ activeSession: null });
    }

    // Get attempts for this session
    const { data: attempts, error: attemptsError } = await supabase
      .from("word_builder_attempts")
      .select("id, prompt_id, prompt_text, prompt_mode, attempt_text, is_correct, attempt_number, corrected_sentence, user_analysis, analysis_feedback")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    if (attemptsError) {
      console.error("Failed to fetch attempts:", attemptsError);
      return NextResponse.json({ activeSession: null });
    }

    // Get errors for these attempts
    const attemptIds = (attempts ?? []).map((a: any) => a.id);
    let errors: any[] = [];
    if (attemptIds.length > 0) {
      const { data: errorRows } = await supabase
        .from("word_builder_errors")
        .select("id, attempt_id, category, severity, resolved, hints_used_for_error")
        .in("attempt_id", attemptIds);
      errors = errorRows ?? [];
    }

    // Group errors by attempt_id
    const errorsByAttempt = new Map<string, any[]>();
    for (const e of errors) {
      if (!errorsByAttempt.has(e.attempt_id)) {
        errorsByAttempt.set(e.attempt_id, []);
      }
      errorsByAttempt.get(e.attempt_id)!.push(e);
    }

    // Group attempts by prompt_id to reconstruct state
    const promptIds = [...new Set((attempts ?? []).map((a: any) => a.prompt_id))];

    // Get the prompts themselves
    const { data: prompts } = await supabase
      .from("word_builder_prompts")
      .select("id, prompt_text, mode")
      .in("id", promptIds);

    const promptMap = new Map<string, any>();
    for (const p of (prompts ?? [])) {
      promptMap.set(p.id, p);
    }

    // Map attempts to their prompt
    const attemptsByPrompt = new Map<string, any[]>();
    for (const a of (attempts ?? [])) {
      if (!attemptsByPrompt.has(a.prompt_id)) {
        attemptsByPrompt.set(a.prompt_id, []);
      }
      attemptsByPrompt.get(a.prompt_id)!.push(a);
    }

    return NextResponse.json({
      activeSession: {
        sessionId: session.id,
        startedAt: session.started_at,
        promptAttempts: Array.from(attemptsByPrompt.entries()).map(([promptId, promptAttempts]) => {
          const prompt = promptMap.get(promptId);
          return {
            promptId,
            promptText: prompt?.prompt_text ?? "",
            promptMode: prompt?.mode ?? "guided",
            attempts: promptAttempts.map((a: any) => ({
              attemptId: a.id,
              attemptNumber: a.attempt_number,
              attemptText: a.attempt_text,
              isCorrect: a.is_correct,
              correctedSentence: a.corrected_sentence,
              userAnalysis: a.user_analysis,
              analysisFeedback: a.analysis_feedback,
              errors: (errorsByAttempt.get(a.id) ?? []).map((e: any) => ({
                category: e.category,
                severity: e.severity,
                resolved: e.resolved,
                hintsUsedForError: e.hints_used_for_error,
              })),
            })),
          };
        }),
      },
    });
  } catch (error: any) {
    console.error("Word Builder Active Session GET Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
