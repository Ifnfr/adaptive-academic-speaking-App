import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  callListeningAI,
  buildSection1SystemPrompt,
  buildSection1UserPrompt,
  extractJsonObject
} from "../../_lib/providers";
import { waitUntil } from "@vercel/functions";

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
  const cefrLevelInput = b.cefr_level as string;
  const sectionCountInput = b.section_count;
  const isPlacementInput = b.is_placement;

  if (!cefrLevelInput || typeof cefrLevelInput !== "string") {
    return NextResponse.json(
      { error: "cefr_level must be a valid non-empty string." },
      { status: 400 }
    );
  }

  const cefrLevel = cefrLevelInput.trim().toUpperCase();
  const validCefrLevels = ["A1", "A2", "B1", "B2", "C1", "C2"];
  if (!validCefrLevels.includes(cefrLevel)) {
    return NextResponse.json(
      { error: `Invalid cefr_level: must be one of ${validCefrLevels.join(", ")}` },
      { status: 400 }
    );
  }

  // Always enforce exactly 3 sections representing the three phases (Fill-in-the-Blank, Multiple Choice, True/False)
  const sectionCount = 3;

  const isPlacement = typeof isPlacementInput === "boolean" ? isPlacementInput : false;

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

  // Insert session
  const { data: sessionData, error: sessionError } = await supabase
    .from("listening_exercise_sessions")
    .insert({
      owner_id: ownerId,
      cefr_level: cefrLevel,
      section_count: sectionCount,
      is_placement: isPlacement,
      status: "in_progress",
    })
    .select("id")
    .single();

  if (sessionError || !sessionData) {
    console.error("Failed to insert session row:", sessionError);
    return NextResponse.json(
      { error: "Database operation failed. Please try again." },
      { status: 500 }
    );
  }

  const sessionId = sessionData.id;

  // Insert section 0 (First section starts automatically as 'generating')
  const { data: sectionData, error: sectionError } = await supabase
    .from("listening_exercise_sections")
    .insert({
      session_id: sessionId,
      owner_id: ownerId,
      section_index: 0,
      cefr_level: cefrLevel,
      topic: "Initializing...",
      generation_status: "generating",
    })
    .select("id")
    .single();

  if (sectionError || !sectionData) {
    console.error("Failed to insert initial section row:", sectionError);
    // Cleanup created session
    await supabase.from("listening_exercise_sessions").delete().eq("id", sessionId);
    return NextResponse.json(
      { error: "Database operation failed. Please try again." },
      { status: 500 }
    );
  }

  const sectionId = sectionData.id;

  // Register background AI execution with the runtime lifecycle manager
  waitUntil((async () => {
    let aiResponseText: string | undefined;
    try {
      let historySummary = "";
      if (!isPlacement) {
        // Fetch up to 3 previous completed sessions
        const { data: history } = await supabase
          .from("listening_exercise_sessions")
          .select("cefr_level, overall_score, estimated_band")
          .eq("owner_id", ownerId)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(3);

        if (history && history.length > 0) {
          historySummary = history
            .map(
              (h, i) =>
                `Attempt ${i + 1}: CEFR Level = ${h.cefr_level}, Overall Score = ${h.overall_score}%, Estimated Band = ${h.estimated_band}`
            )
            .join("\n");
        }
      }

      const systemPrompt = buildSection1SystemPrompt();
      const userPrompt = buildSection1UserPrompt(
        cefrLevel,
        sectionCount,
        isPlacement,
        historySummary
      );

      aiResponseText = await callListeningAI(systemPrompt, userPrompt);
      const jsonText = extractJsonObject(aiResponseText);

      if (!jsonText) {
        throw new Error("AI provider returned invalid JSON formatting.");
      }

      const payload = JSON.parse(jsonText) as {
        plan?: Record<string, unknown>;
        section?: {
          topic?: string;
          audio_script?: string;
          fact_units?: unknown[];
          questions?: unknown[];
          pre_listening_prompt?: string;
        };
      };

      if (!payload.plan || !payload.section) {
        throw new Error("AI provider JSON missing 'plan' or 'section' fields.");
      }

      // Update session with approved plan
      const { error: sessionUpdateError } = await supabase
        .from("listening_exercise_sessions")
        .update({
          generation_plan: payload.plan,
        })
        .eq("id", sessionId);

      if (sessionUpdateError) {
        throw sessionUpdateError;
      }

      // Update section details
      const { error: sectionUpdateError } = await supabase
        .from("listening_exercise_sections")
        .update({
          topic: payload.section.topic || "Section 1",
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
      console.error("Listening session start background job failed:", err);
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
  return NextResponse.json({ session_id: sessionId }, { status: 202 });
}
