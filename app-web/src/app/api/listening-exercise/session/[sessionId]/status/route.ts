import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildNextSectionSystemPrompt, buildNextSectionUserPrompt } from "../../../_lib/providers";
import { buildPlanOnlySystemPrompt, buildPlanOnlyUserPrompt } from "../../../_lib/plan-prompts";
import { selectSessionDomains } from "../../../_lib/topic-domains";
import { getWeakestEligibleSubSkill } from "../../../../../lib/listening-exercise/metrics";
import { fireEdgeJob, fetchHistorySummary } from "../../../_lib/orchestrator";

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json(
      { error: "sessionId is required." },
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

  // Query the database for the active section (most recently created section index)
  const { data: sections, error: sectionsError } = await supabase
    .from("listening_exercise_sections")
    .select("id, generation_status, section_index, topic, questions, audio_script, pre_listening_prompt")
    .eq("session_id", sessionId)
    .eq("owner_id", ownerId)
    .order("section_index", { ascending: false })
    .limit(1);

  if (sectionsError) {
    console.error("Failed to query section generation status:", sectionsError);
    return NextResponse.json(
      { error: "Database operation failed. Please try again." },
      { status: 500 }
    );
  }

  if (!sections || sections.length === 0) {
    return NextResponse.json(
      { error: "No active sections found for this session." },
      { status: 404 }
    );
  }

  let activeSection = sections[0];
  let dbStatus = activeSection.generation_status;

  // Stale-claim recovery: if a generation process claimed the section but died
  // (platform kill), it stays 'generating' forever. Reset it so we can retry.
  if (dbStatus === "generating") {
    let updatedAt = 0;
    try {
      const { data: tsRow } = await supabase
        .from("listening_exercise_sections")
        .select("updated_at")
        .eq("id", activeSection.id)
        .maybeSingle();
      if (tsRow && typeof tsRow.updated_at === "string") {
        const t = new Date(tsRow.updated_at).getTime();
        if (!Number.isNaN(t)) updatedAt = t;
      }
    } catch {
      // updated_at column missing — skip stale recovery (no crash)
    }
    const isStale = updatedAt === 0 || Date.now() - updatedAt > 75000;
    if (isStale) {
      await supabase
        .from("listening_exercise_sections")
        .update({ generation_status: "pending" })
        .eq("id", activeSection.id)
        .eq("generation_status", "generating");
      dbStatus = "pending";
    }
  }

  // If the section is pending, fire the appropriate edge job.
  // The client's polling IS the orchestrator: poll #1 fires the plan job,
  // the next polls fire content jobs, and pre-generation of sections 1-2
  // happens while the user is still working on section 0.
  if (dbStatus === "pending") {
    const { data: sessionRow } = await supabase
      .from("listening_exercise_sessions")
      .select("cefr_level, section_count, is_placement, generation_plan")
      .eq("id", sessionId)
      .eq("owner_id", ownerId)
      .single();

    const cefrLevel = sessionRow?.cefr_level || "B2";
    const sectionCount = sessionRow?.section_count || 3;
    const isPlacement = sessionRow?.is_placement === true;
    const plan = (sessionRow?.generation_plan ?? null) as {
      difficulty?: string;
      sections?: Array<{
        section_index?: number;
        cefr_level?: string;
        topic?: string;
        question_types?: string[];
      }>;
    } | null;

    const difficulty: "easy" | "medium" | "hard" =
      plan?.difficulty === "easy" || plan?.difficulty === "hard"
        ? plan.difficulty
        : "medium";

    const sectionIndex = activeSection.section_index;

    // STEP 1: no plan yet -> fire the fast PLAN job
    if (sectionIndex === 0 && !plan) {
      const { historySummary, recentSessions } = await fetchHistorySummary(
        supabase,
        ownerId,
        isPlacement
      );
      const assignedTopics = selectSessionDomains(recentSessions, 3);
      let weakSubSkill: string | null = null;
      if (!isPlacement) {
        weakSubSkill = await getWeakestEligibleSubSkill(supabase, ownerId);
      }

      await fireEdgeJob({
        kind: "plan",
        ownerId,
        sessionId,
        sectionId: activeSection.id,
        systemPrompt: buildPlanOnlySystemPrompt(),
        userPrompt: buildPlanOnlyUserPrompt(
          cefrLevel,
          sectionCount,
          isPlacement,
          historySummary,
          weakSubSkill,
          assignedTopics
        ),
        assignedTopics,
        difficulty,
      });
    } else {
      // STEP 2: plan exists -> fire the CONTENT job for the pending section
      const planSection = plan?.sections?.find((s) => s.section_index === sectionIndex);
      const targetLevel = planSection?.cefr_level || cefrLevel;
      const targetTopic = planSection?.topic || `Section ${sectionIndex + 1}`;
      const targetQuestionTypes = planSection?.question_types || ["fill_blank"];
      const questionType = targetQuestionTypes[0] || "fill_blank";

      let weakSubSkill: string | null = null;
      if (!isPlacement) {
        weakSubSkill = await getWeakestEligibleSubSkill(supabase, ownerId);
      }

      await fireEdgeJob({
        kind: "content",
        sessionId,
        sectionId: activeSection.id,
        sectionIndex,
        systemPrompt: buildNextSectionSystemPrompt(questionType, difficulty),
        userPrompt: buildNextSectionUserPrompt(
          sectionIndex,
          targetLevel,
          targetTopic,
          targetQuestionTypes,
          weakSubSkill
        ),
        sectionTopicOverride: sectionIndex === 0 ? targetTopic : undefined,
      });

      // STEP 3: while the user works on section 0, PRE-GENERATE sections 1-2
      // in the background so there is zero wait when moving between sections.
      if (sectionIndex === 0 && plan?.sections) {
        for (const ps of plan.sections) {
          const idx = typeof ps.section_index === "number" ? ps.section_index : -1;
          if (idx <= 0) continue;
          const qTypes = ps.question_types || ["fill_blank"];
          const qType = qTypes[0] || "fill_blank";

          // Check if the row already exists (avoid duplicates)
          const { data: existing } = await supabase
            .from("listening_exercise_sections")
            .select("id")
            .eq("session_id", sessionId)
            .eq("section_index", idx)
            .maybeSingle();

          if (existing) continue;

          const { data: newRow, error: newRowError } = await supabase
            .from("listening_exercise_sections")
            .insert({
              session_id: sessionId,
              owner_id: ownerId,
              section_index: idx,
              cefr_level: ps.cefr_level || cefrLevel,
              topic: ps.topic || `Section ${idx + 1}`,
              generation_status: "pending",
            })
            .select("id")
            .single();

          if (newRowError || !newRow) {
            console.error(`Failed to pre-create section ${idx}:`, newRowError);
            continue;
          }

          await fireEdgeJob({
            kind: "content",
            sessionId,
            sectionId: newRow.id,
            sectionIndex: idx,
            systemPrompt: buildNextSectionSystemPrompt(qType, difficulty),
            userPrompt: buildNextSectionUserPrompt(
              idx,
              ps.cefr_level || cefrLevel,
              ps.topic || `Section ${idx + 1}`,
              qTypes,
              weakSubSkill
            ),
          });
        }
      }
    }

    // Re-read the section to get the latest status after any job fired
    const { data: refreshed } = await supabase
      .from("listening_exercise_sections")
      .select("id, generation_status, section_index, topic, questions, audio_script, pre_listening_prompt")
      .eq("id", activeSection.id)
      .eq("owner_id", ownerId)
      .single();

    if (refreshed) {
      activeSection = refreshed;
      dbStatus = refreshed.generation_status;
    }
  }

  // Map db status 'error' to response status 'failed'
  const generationStatus = dbStatus === "error" ? "failed" : dbStatus;

  const response: Record<string, unknown> = {
    generation_status: generationStatus,
    section_index: activeSection.section_index,
  };

  if (dbStatus === "ready") {
    response.section = {
      id: activeSection.id,
      topic: activeSection.topic,
      questions: activeSection.questions,
      audio_script: activeSection.audio_script,
      pre_listening_prompt: activeSection.pre_listening_prompt,
    };
  }

  return NextResponse.json(response);
}
