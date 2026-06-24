import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Helper function to resolve Clerk authentication
async function resolveCurrentUserId(): Promise<string | null> {
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    return session?.userId || null;
  } catch {
    return null;
  }
}

// Helper to initialize Supabase service client
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

    // Fetch and select 8 prompts
    const { data: prompts, error: promptsError } = await supabase
      .from("word_builder_prompts")
      .select("id, prompt_text, mode, implied_structures")
      .eq("mode", "guided");

    if (promptsError || !prompts) {
      console.error("Failed to fetch prompts from DB:", promptsError);
      return NextResponse.json({ error: "Failed to fetch prompts" }, { status: 500 });
    }

    // Shuffle and limit to 8
    const shuffled = [...prompts].sort(() => 0.5 - Math.random());
    const selectedPrompts = shuffled.slice(0, 8);

    return NextResponse.json({
      sessionId: sessionData.id,
      prompts: selectedPrompts,
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
