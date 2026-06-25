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

export async function GET(req: Request) {
  try {
    const userId = await resolveCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unconfigured" }, { status: 500 });
    }

    // Select recent sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from("word_builder_sessions")
      .select("id, started_at, completed_at, prompts_attempted, prompts_correct_first_try")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(50);

    if (sessionsError) {
      console.error("Failed to fetch sessions from DB:", sessionsError);
      return NextResponse.json({ error: "Failed to fetch session history" }, { status: 500 });
    }

    return NextResponse.json({ sessions: sessions ?? [] });
  } catch (error: any) {
    console.error("Word Builder History GET Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
