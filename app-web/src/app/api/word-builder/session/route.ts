import { NextResponse } from "next/server";
import { resolveCurrentUserId, getSupabaseClient } from "../_lib/route-helpers";
import { calculateUserMetrics } from "@/lib/word-builder/metrics";
import { evaluateThresholds } from "@/lib/word-builder/thresholds";
import { selectPromptsForSession } from "@/lib/word-builder/prompt-selector";

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

    const { action } = body;
    if (action !== "create") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unconfigured" }, { status: 500 });
    }

    // Insert new session
    const { data: sessionData, error: sessionError } = await supabase
      .from("word_builder_sessions")
      .insert({ user_id: userId })
      .select("id")
      .single();

    if (sessionError || !sessionData) {
      console.error("Failed to create session in DB:", sessionError);
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    // Get recent prompt IDs (last 3 sessions) for deduplication
    const { data: recentSessions } = await supabase
      .from("word_builder_sessions")
      .select("id")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(3);

    const recentSessionIds = (recentSessions ?? []).map((s: any) => s.id);

    let recentPromptIds: string[] = [];
    if (recentSessionIds.length > 0) {
      const { data: recentAttempts } = await supabase
        .from("word_builder_attempts")
        .select("prompt_id")
        .in("session_id", recentSessionIds);
      recentPromptIds = [...new Set(
        (recentAttempts ?? []).map((a: any) => a.prompt_id).filter(Boolean)
      )];
    }

    // Calculate user metrics and evaluate thresholds
    const metrics = await calculateUserMetrics(supabase, userId);
    const decisions = evaluateThresholds(metrics);

    // Select prompts adaptively
    const selectionResult = await selectPromptsForSession(
      supabase,
      userId,
      decisions,
      recentPromptIds
    );

    const selectedPrompts = selectionResult.prompts;

    if (selectedPrompts.length === 0) {
      return NextResponse.json({ error: "Failed to fetch prompts" }, { status: 500 });
    }

    return NextResponse.json({
      sessionId: sessionData.id,
      prompts: selectedPrompts,
      decisions: {
        ruleCardCategories: decisions.ruleCardCategories,
        deteriorationBoostActive: decisions.deteriorationBoostActive,
        semiFreeModeUnlocked: decisions.semiFreeModeUnlocked,
        transferTestModeUnlocked: decisions.transferTestModeUnlocked,
      },
    });
  } catch (error: any) {
    console.error("Word Builder Session POST Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
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

    const { action, sessionId, promptsAttempted, promptsCorrectFirstTry } = body;
    if (action !== "complete") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (
      !sessionId ||
      typeof promptsAttempted !== "number" ||
      typeof promptsCorrectFirstTry !== "number"
    ) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unconfigured" }, { status: 500 });
    }

    // Update session to complete
    const { error: updateError } = await supabase
      .from("word_builder_sessions")
      .update({
        completed_at: new Date().toISOString(),
        prompts_attempted: promptsAttempted,
        prompts_correct_first_try: promptsCorrectFirstTry,
      })
      .eq("id", sessionId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Failed to complete session in DB:", updateError);
      return NextResponse.json({ error: "Failed to complete session" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Word Builder Session PATCH Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
