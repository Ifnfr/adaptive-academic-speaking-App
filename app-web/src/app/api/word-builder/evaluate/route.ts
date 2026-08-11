import { NextResponse } from "next/server";
import { resolveCurrentUserId, getSupabaseClient } from "../_lib/route-helpers";
import { checkRateLimit } from "@/lib/word-builder/rate-limit";
import { getAIProvider } from "../_lib/providers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // 1. Authentication
    const userId = await resolveCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate Limit Check — requires supabase client for persistence
    const supabase = getSupabaseClient();
    const { allowed } = await checkRateLimit(supabase, userId);
    if (!allowed) {
      return NextResponse.json(
        { error: "rate_limit_exceeded" },
        { status: 429 }
      );
    }

    // 2. Parse and validate body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { sentence, promptId, promptText } = body;
    if (!sentence || !promptId || !promptText) {
      return NextResponse.json(
        { error: "Missing required fields: sentence, promptId, or promptText" },
        { status: 400 }
      );
    }

    // Guard 1 — Sentence too short
    if (sentence.trim().split(/\s+/).filter(Boolean).length < 3) {
      return NextResponse.json({ error: "sentence_too_short" }, { status: 400 });
    }

    // 3. Fetch prompt metadata (implied structures) from Supabase
    let impliedStructures: string[] = [];
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("word_builder_prompts")
          .select("implied_structures")
          .eq("id", promptId)
          .single();

        if (!error && data) {
          if (Array.isArray(data.implied_structures)) {
            impliedStructures = data.implied_structures;
          } else if (typeof data.implied_structures === "string") {
            try {
              impliedStructures = JSON.parse(data.implied_structures);
            } catch {
              // Ignore parse errors
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch implied structures:", err);
      }
    }

    // 4. Call AI provider
    try {
      const provider = getAIProvider();
      const evaluationData = await provider.evaluate(sentence, promptText, impliedStructures);
      return NextResponse.json(evaluationData);
    } catch (error: any) {
      console.error("Word Builder Evaluate AI Error:", error);
      if (error.message?.includes("not configured")) {
        return NextResponse.json(
          { error: "AI provider is currently unconfigured" },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: "Failed to evaluate sentence" },
        { status: 502 }
      );
    }
  } catch (error: any) {
    console.error("Word Builder Evaluate Route Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
