import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  callListeningAI,
  buildNextSectionSystemPrompt,
  buildNextSectionUserPrompt,
  extractJsonObject
} from "../../_lib/providers";
import { waitUntil } from "@vercel/functions";
import { generateNextSectionContent } from "../../_lib/generate-section";
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

  const sectionId = newSectionData.id;

  // Register background AI execution (best-effort). The status route also
  // triggers generation inline if this background job is killed by the platform.
  waitUntil(
    generateNextSectionContent(supabase, {
      ownerId,
      sessionId,
      sectionId,
      sectionIndex: nextIndex,
      isPlacement: sessionData.is_placement === true,
    }),
  );

  // Immediately respond HTTP 202 Accepted
  return NextResponse.json(
    { message: "Generation started.", section_index: nextIndex },
    { status: 202 }
  );
}
