import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildNextSectionSystemPrompt, buildNextSectionUserPrompt } from "../../_lib/providers";
import { getWeakestEligibleSubSkill } from "../../../../lib/listening-exercise/metrics";
import { fireEdgeJob } from "../../_lib/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 60;

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

export async function POST(request: Request) {
  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (!parsedBody || typeof parsedBody !== "object") {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const b = parsedBody as Record<string, unknown>;
  const sessionId = b.session_id as string;
  // Optional: index of the section the client just COMPLETED. With
  // pre-generation the status route creates ALL sections up front, so
  // deriving the next index from max(existing)+1 always overflows and 400s
  // ("All sections ... already generated") the moment any section exists.
  // The app shell therefore sends the completed index explicitly; falling
  // back to the legacy highest+1 derivation keeps direct API callers working.
  const completedIndex =
    typeof b.section_index === "number" && Number.isInteger(b.section_index)
      ? b.section_index
      : null;

  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json(
      { error: "session_id is required." },
      { status: 400 }
    );
  }

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

  // Fetch session to check ownership and retrieve the plan
  const { data: sessionData, error: sessionError } = await supabase
    .from("listening_exercise_sessions")
    .select("generation_plan, section_count, cefr_level, status, is_placement")
    .eq("id", sessionId)
    .eq("owner_id", ownerId)
    .single();

  if (sessionError || !sessionData) {
    console.error("Failed to query session:", sessionError);
    return NextResponse.json(
      { error: "Session not found or unauthorized access." },
      { status: 404 }
    );
  }

  if (sessionData.status !== "in_progress") {
    return NextResponse.json(
      { error: "Session is not active." },
      { status: 400 }
    );
  }

  // Determine the next section index by fetching existing sections
  const { data: sectionsData, error: sectionsError } = await supabase
    .from("listening_exercise_sections")
    .select("section_index, id, generation_status, section_score")
    .eq("session_id", sessionId)
    .eq("owner_id", ownerId)
    .order("section_index", { ascending: false });

  if (sectionsError || !sectionsData) {
    console.error("Failed to query existing sections:", sectionsError);
    return NextResponse.json(
      { error: "Database query failed. Please try again." },
      { status: 500 }
    );
  }

  let nextIndex: number;
  if (completedIndex !== null) {
    nextIndex = completedIndex + 1;
  } else {
    // Stale-client fallback: with pre-generation, highest+1 always overflows
    // (the original bug). Instead, resume at the FIRST section that has no
    // score yet - i.e. the earliest section the user has not submitted.
    const unscored = sectionsData
      .filter((s) => s.section_score === null)
      .sort((a, b) => a.section_index - b.section_index);
    nextIndex = unscored.length > 0 ? unscored[0].section_index : 0;
    // Only sections after the completed one are legitimate "next" targets.
    if (unscored.length === 0 || nextIndex === 0) {
      return NextResponse.json(
        { error: "All sections for this session have already been generated." },
        { status: 400 }
      );
    }
  }

  // Validate against plan section limits
  if (nextIndex >= sessionData.section_count) {
    return NextResponse.json(
      { error: "All sections for this session have already been generated." },
      { status: 400 }
    );
  }

  // Parse planned details for this index
  const plan = sessionData.generation_plan as {
    difficulty?: "easy" | "medium" | "hard";
    sections?: Array<{
      section_index: number;
      cefr_level?: string;
      topic?: string;
      domain?: string;
      question_types?: string[];
    }>;
  };

  const planSection = plan?.sections?.find((s) => s.section_index === nextIndex);
  const targetLevel = planSection?.cefr_level || sessionData.cefr_level;
  const targetTopic = planSection?.topic || `Section ${nextIndex + 1}`;
  const targetQuestionTypes = planSection?.question_types || ["fill_blank"];
  const targetDifficulty = plan?.difficulty ?? "medium";

  let sectionId: string;
  let generationStatus: string;

  // The section may already exist (pre-generated by the status route while
  // the user was working on the previous section). Reuse it if so.
  const existing = sectionsData.find((s) => s.section_index === nextIndex);
  if (existing) {
    sectionId = existing.id;
    generationStatus = existing.generation_status;
  } else {
    const { data: newSectionData, error: newSectionError } = await supabase
      .from("listening_exercise_sections")
      .insert({
        session_id: sessionId,
        owner_id: ownerId,
        section_index: nextIndex,
        cefr_level: targetLevel,
        topic: targetTopic,
        generation_status: "pending",
      })
      .select("id")
      .single();

    if (newSectionError || !newSectionData) {
      console.error("Failed to insert next section row:", newSectionError);
      return NextResponse.json(
        { error: "Database operation failed. Please try again." },
        { status: 500 }
      );
    }
    sectionId = newSectionData.id;
    generationStatus = "pending";
  }

  // Fire the content generation job on the edge function (fire-and-forget).
  // The client polls the status route, which re-fires if this call failed.
  if (generationStatus === "pending") {
    let weakSubSkill: string | null = null;
    if (!sessionData.is_placement) {
      weakSubSkill = await getWeakestEligibleSubSkill(supabase, ownerId);
    }

    const questionType = targetQuestionTypes[0] || "fill_blank";
    await fireEdgeJob({
      kind: "content",
      sessionId,
      sectionId,
      sectionIndex: nextIndex,
      systemPrompt: buildNextSectionSystemPrompt(questionType, targetDifficulty),
      userPrompt: buildNextSectionUserPrompt(
        nextIndex,
        targetLevel,
        targetTopic,
        targetQuestionTypes,
        weakSubSkill
      ),
    });
  }

  return NextResponse.json({
    success: true,
    section_id: sectionId,
    section_index: nextIndex,
    generation_status: generationStatus,
  });
}
