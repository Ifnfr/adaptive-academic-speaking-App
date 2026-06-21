import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateSessionScore } from "../../../../../lib/listening-exercise/evaluation/scoreAccumulator";
import { mapScoreToBand } from "../../../../../lib/listening-exercise/evaluation/bandMapper";
import {
  createXpEvent,
  awardXpEvent,
  getLocalDateString,
} from "../../../../../lib/gamification";
import {
  loadSupabaseXpProfile,
  loadSupabaseXpEvents,
  upsertXpProfileRow,
  upsertXpEventRows,
} from "../../../../../lib/storage/supabase-gamification-adapter";

export const runtime = "nodejs";

async function resolveCurrentUserId(): Promise<string | null> {
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    return session?.userId || null;
  } catch {
    return null;
  }
}

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json(
      { error: "Unauthorized: Missing valid session credentials." },
      { status: 401 }
    );
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Internal Server Error: Database client configuration missing." },
      { status: 500 }
    );
  }

  // Fetch session parameters to determine target CEFR level and total section count
  const { data: session, error: sessionError } = await supabase
    .from("listening_exercise_sessions")
    .select("cefr_level, section_count")
    .eq("id", sessionId)
    .eq("owner_id", ownerId)
    .single();

  if (sessionError || !session) {
    console.error("Failed to query session data:", sessionError);
    return NextResponse.json(
      { error: "Session not found or unauthorized access." },
      { status: 404 }
    );
  }

  // Fetch all sections belonging to this session and their scores
  const { data: sections, error: sectionsError } = await supabase
    .from("listening_exercise_sections")
    .select("id, section_score")
    .eq("session_id", sessionId)
    .eq("owner_id", ownerId);

  if (sectionsError || !sections) {
    console.error("Failed to query sections:", sectionsError);
    return NextResponse.json(
      { error: "Database operation failed when fetching sections." },
      { status: 500 }
    );
  }

  // Count how many sections have been submitted (section_score is non-null)
  const submittedSectionsCount = sections.filter((s) => s.section_score !== null).length;

  // Verify that all expected sections were submitted
  if (submittedSectionsCount < session.section_count) {
    return NextResponse.json(
      {
        error: `Not all sections have been submitted. Expected ${session.section_count}, found ${submittedSectionsCount} submitted.`,
      },
      { status: 400 }
    );
  }

  const sectionIds = sections.map((s) => s.id);

  // Fetch all graded question attempts to aggregate scores
  const { data: attempts, error: attemptsError } = await supabase
    .from("listening_exercise_question_attempts")
    .select("is_correct")
    .in("section_id", sectionIds);

  if (attemptsError) {
    console.error("Failed to query question attempts:", attemptsError);
    return NextResponse.json(
      { error: "Database operation failed. Please try again." },
      { status: 500 }
    );
  }

  const totalQuestions = attempts?.length || 0;
  const totalCorrect = attempts?.filter((a) => a.is_correct).length || 0;

  // Use core session scoring logic
  const overallScore = calculateSessionScore([
    { correctCount: totalCorrect, totalCount: totalQuestions },
  ]);

  // Use core band mapping matrix
  const estimatedBand = mapScoreToBand(session.cefr_level, overallScore);

  // Update session state to completed
  const { error: updateError } = await supabase
    .from("listening_exercise_sessions")
    .update({
      overall_score: overallScore,
      estimated_band: estimatedBand,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (updateError) {
    console.error("Failed to update session results:", updateError);
    return NextResponse.json(
      { error: "Database operation failed. Please try again." },
      { status: 500 }
    );
  }

  // Award XP for completing the listening session
  try {
    const today = getLocalDateString(new Date());
    const profile = await loadSupabaseXpProfile(ownerId, supabase);
    const events = await loadSupabaseXpEvents(ownerId, supabase);
    const candidate = createXpEvent({
      type: "listening_exercise_completed",
      sourceId: `listening-session-${sessionId}`,
      sourceKind: "listening-exercise",
      reason: "Completed a Listening Exercise session.",
      localDate: today,
    });
    const awarded = awardXpEvent(profile, events, candidate);
    if (awarded.result.allowed && awarded.result.xpToAward > 0) {
      await upsertXpProfileRow(ownerId, awarded.profile, supabase);
      await upsertXpEventRows(ownerId, [awarded.events[awarded.events.length - 1]], supabase);
    }
  } catch (xpError) {
    console.error("Failed to award listening exercise completion XP:", xpError);
  }

  return NextResponse.json({
    success: true,
    overall_score: overallScore,
    estimated_band: estimatedBand,
    total_correct: totalCorrect,
    total_questions: totalQuestions,
  });
}
