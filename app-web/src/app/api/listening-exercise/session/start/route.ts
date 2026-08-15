import { NextResponse } from "next/server";
import { abandonStaleSessions } from "../../_lib/abandon-sessions";
import { createClient } from "@supabase/supabase-js";

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
  const difficultyInput = b.difficulty as string | undefined;

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
  const resolvedDifficulty: "easy" | "medium" | "hard" =
    difficultyInput === "easy" || difficultyInput === "hard" ? difficultyInput : "medium";

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

  // Lazy cleanup: mark this user's stale in-progress sessions as abandoned
  // (24h+ old) so they don't pile up and don't pollute the session list.
  await abandonStaleSessions(supabase, { ownerId });

  // Insert session
  const { data: sessionData, error: sessionError } = await supabase
    .from("listening_exercise_sessions")
    .insert({
      owner_id: ownerId,
      cefr_level: cefrLevel,
      section_count: sectionCount,
      is_placement: isPlacement,
      status: "in_progress",
      generation_plan: { difficulty: resolvedDifficulty },
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
      generation_status: "pending",
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

  // Register background AI execution (best-effort). The status route also
  // triggers generation inline if this background job is killed by the platform.
  // Generation is orchestrated by the status route + Supabase Edge Function:
  // the client's first status poll fires the plan job, subsequent polls fire
  // content jobs, and sections 1-2 are pre-generated while the user works.
  // No background job here — Vercel background execution is unreliable.

  // Immediately respond HTTP 202 Accepted
  return NextResponse.json({ session_id: sessionId }, { status: 202 });
}
