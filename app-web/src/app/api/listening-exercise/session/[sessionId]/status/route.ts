import { NextResponse } from "next/server";
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

  const activeSection = sections[0];
  const dbStatus = activeSection.generation_status;

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
