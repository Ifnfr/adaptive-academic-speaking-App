import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  callListeningAI,
  buildNextSectionSystemPrompt,
  buildNextSectionUserPrompt,
  extractJsonObject
} from "../../_lib/providers";
import { waitUntil } from "@vercel/functions";
import { getWeakestEligibleSubSkill } from "../../../../lib/listening-exercise/metrics";

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
    .select("section_index")
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

  const nextIndex = sectionsData.length > 0 ? sectionsData[0].section_index + 1 : 0;

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

  // Insert next section in generating state
  const { data: newSectionData, error: newSectionError } = await supabase
    .from("listening_exercise_sections")
    .insert({
      session_id: sessionId,
      owner_id: ownerId,
      section_index: nextIndex,
      cefr_level: targetLevel,
      topic: targetTopic,
      generation_status: "generating",
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

  const sectionId = newSectionData.id;

  // Register background AI execution with the runtime lifecycle manager
  waitUntil((async () => {
    let aiResponseText: string | undefined;
    try {
      let weakSubSkill: string | null = null;
      if (!sessionData.is_placement) {
        weakSubSkill = await getWeakestEligibleSubSkill(supabase, ownerId);
      }

      const questionType = targetQuestionTypes[0] || "fill_blank";
      const systemPrompt = buildNextSectionSystemPrompt(questionType, targetDifficulty);
      const userPrompt = buildNextSectionUserPrompt(
        nextIndex,
        targetLevel,
        targetTopic,
        targetQuestionTypes,
        weakSubSkill
      );

      let payload: {
        section?: {
          topic?: string;
          audio_script?: string;
          fact_units?: unknown[];
          questions?: unknown[];
          pre_listening_prompt?: string;
        };
      } | undefined;

      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          aiResponseText = await callListeningAI(systemPrompt, userPrompt);
          const jsonText = extractJsonObject(aiResponseText);

          if (!jsonText) {
            throw new Error("AI provider returned invalid JSON formatting.");
          }

          const parsedPayload = JSON.parse(jsonText) as {
            section?: {
              topic?: string;
              audio_script?: string;
              fact_units?: unknown[];
              questions?: unknown[];
              pre_listening_prompt?: string;
            };
          };

          if (!parsedPayload.section) {
            throw new Error("AI provider JSON missing 'section' field.");
          }

          const qs = parsedPayload.section.questions;
          const fu = parsedPayload.section.fact_units;
          if (!Array.isArray(qs) || qs.length === 0) {
            throw new Error("AI provider JSON missing or empty 'questions' array.");
          }
          if (!Array.isArray(fu) || fu.length === 0) {
            throw new Error("AI provider JSON missing or empty 'fact_units' array.");
          }

          payload = parsedPayload;
          break;
        } catch (err) {
          console.warn(`AI generation attempt ${attempt}/${maxAttempts} failed:`, err);
          if (attempt === maxAttempts) {
            throw err;
          }
        }
      }

      if (!payload || !payload.section) {
        throw new Error("AI provider JSON missing 'section' field.");
      }

      // Update next section row
      const { error: sectionUpdateError } = await supabase
        .from("listening_exercise_sections")
        .update({
          topic: payload.section.topic || targetTopic,
          audio_script: payload.section.audio_script,
          fact_units: payload.section.fact_units,
          questions: payload.section.questions,
          pre_listening_prompt: payload.section.pre_listening_prompt,
          generation_status: "ready",
        })
        .eq("id", sectionId);

      if (sectionUpdateError) {
        throw sectionUpdateError;
      }
    } catch (err: unknown) {
      console.error(`Listening session next section background job failed:`, err);
      // Mark section status as 'error'
      await supabase
        .from("listening_exercise_sections")
        .update({
          generation_status: "error",
          generation_error: err instanceof Error ? err.message : String(err),
          generation_error_raw_response: aiResponseText ?? null,
        })
        .eq("id", sectionId);
    }
  })());

  // Immediately respond HTTP 202 Accepted
  return NextResponse.json(
    { message: "Generation started.", section_index: nextIndex },
    { status: 202 }
  );
}
