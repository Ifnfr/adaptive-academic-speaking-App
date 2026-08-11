import { NextResponse } from "next/server";
import { resolveCurrentUserId, getSupabaseClient } from "../_lib/route-helpers";
import { checkRateLimit } from "@/lib/word-builder/rate-limit";
import { getAIProvider } from "../_lib/providers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const userId = await resolveCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate Limit Check
    const supabase = getSupabaseClient();
    const { allowed } = await checkRateLimit(supabase, userId);
    if (!allowed) {
      return NextResponse.json(
        { error: "rate_limit_exceeded" },
        { status: 429 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { userSentence, correctedSentence, userAnalysis, errors } = body;

    // Validate fields exist
    if (
      userSentence === undefined ||
      correctedSentence === undefined ||
      userAnalysis === undefined ||
      errors === undefined
    ) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    // Validate userAnalysis length
    if (typeof userAnalysis !== "string" || userAnalysis.trim().length < 10) {
      return NextResponse.json({ error: "analysis_too_short" }, { status: 400 });
    }

    // Call AI provider
    try {
      const provider = getAIProvider();
      const analysisData = await provider.analyze(userSentence, correctedSentence, userAnalysis, errors);
      return NextResponse.json(analysisData);
    } catch (error: any) {
      console.error("Word Builder Analyze AI Error:", error);
      if (error.message?.includes("not configured")) {
        return NextResponse.json(
          { error: "AI provider is currently unconfigured" },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: "Failed to analyze response" },
        { status: 502 }
      );
    }
  } catch (error: any) {
    console.error("Word Builder Analyze Route Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
