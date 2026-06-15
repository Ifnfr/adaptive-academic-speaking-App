import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLatestWeaknessForUser } from "../../../lib/pattern-drill/latestWeaknessServer";
import { resolveProvider, callRoleProvider, ProviderConfigError } from "../../pattern-drill/_lib/roleProviders";

export const runtime = "nodejs";

export const testHooks = {
  resolveCurrentUserId: null as (() => Promise<string | null>) | null,
  getSupabaseClient: null as (() => unknown) | null,
  callClaude: null as ((apiKey: string, systemPrompt: string, userPrompt: string) => Promise<string>) | null,
};

async function resolveCurrentUserId(): Promise<string | null> {
  if (testHooks.resolveCurrentUserId) {
    return testHooks.resolveCurrentUserId();
  }

  try {
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    return session?.userId || null;
  } catch {
    return null;
  }
}

function getSupabaseClient() {
  if (testHooks.getSupabaseClient) {
    return testHooks.getSupabaseClient() as ReturnType<typeof createClient> | null;
  }

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



function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };

  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401, headers });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  // Reject unexpected fields
  const allowedKeys = ["level", "mode", "focus", "source", "sourceId"];
  const bodyKeys = Object.keys(body as Record<string, unknown>);
  if (bodyKeys.some((k) => !allowedKeys.includes(k))) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  const { level, mode, source, focus, sourceId } = body as {
    level?: string;
    mode?: string;
    source?: string;
    focus?: string;
    sourceId?: string;
  };

  if (typeof level !== "string" || typeof mode !== "string" || typeof source !== "string") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  if (level === "expert") {
    return NextResponse.json({ error: "unsupported_level" }, { status: 400, headers });
  }

  if (!["beginner", "intermediate", "advanced"].includes(level)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  if (!["fluency_sprint", "structured_response"].includes(mode)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  if (!["manual", "latest_weakness"].includes(source)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  let validatedFocus = "";
  if (source === "manual") {
    if (typeof focus !== "string" || focus.trim().length === 0) {
      return NextResponse.json({ error: "focus_required" }, { status: 400, headers });
    }
    const trimmedFocus = focus.trim();
    if (trimmedFocus.length > 200) {
      return NextResponse.json({ error: "focus_too_long" }, { status: 400, headers });
    }
    validatedFocus = trimmedFocus;
  } else {
    // source === "latest_weakness"
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      return NextResponse.json({ error: "latest_weakness_unavailable" }, { status: 503, headers });
    }

    try {
      const selectorResult = await getLatestWeaknessForUser(ownerId, supabaseClient, { sourceId });
      if (selectorResult.status === "empty") {
        return NextResponse.json({ error: "latest_weakness_not_found" }, { status: 404, headers });
      }
      if (selectorResult.status === "insufficient") {
        return NextResponse.json({ error: "latest_weakness_insufficient" }, { status: 409, headers });
      }
      if (selectorResult.status === "error" || !selectorResult.weakness) {
        return NextResponse.json({ error: "pattern_brief_failed" }, { status: 500, headers });
      }
      validatedFocus = selectorResult.weakness.description;
    } catch (dbErr) {
      console.error("DB Fetch Error in generate route:", dbErr);
      return NextResponse.json({ error: "latest_weakness_fetch_failed" }, { status: 502, headers });
    }
  }

  let apiKey: string;
  try {
    const providerConfig = resolveProvider("planning");
    apiKey = providerConfig.apiKey;
  } catch (err) {
    if (err instanceof ProviderConfigError) {
      return NextResponse.json({ error: "provider_not_configured" }, { status: 503, headers });
    }
    throw err;
  }

  const systemPrompt = `You are an AI language learning assistant specializing in pre-drill speech instruction for academic English. Your task is to generate a pre-drill briefing ("Pattern Brief") in JSON format based on the user's level, mode, and target speaking focus/weakness.

The generated JSON must match the following schema exactly:
{
  "title": "A short, engaging pattern title",
  "focus": "Brief restatement of the practice focus",
  "qualityCriteria": ["Criterion 1", "Criterion 2"], // 1 to 3 short criteria
  "responsePattern": {
    "name": "Name of response structure",
    "steps": ["Step 1", "Step 2"] // 2 to 5 steps using slot notation, e.g. "[claim]"
  },
  "miniExample": "Example sentence. Illustration only — do not memorize or copy.", // 1 to 2 sentences max, MUST include the exact warning: "Illustration only — do not memorize or copy."
  "commonMistakes": ["Mistake 1", "Mistake 2"], // 1 to 3 short strings
  "drillEntryConfig": {
    "targetPattern": "Name of response structure", // Must match responsePattern.name
    "targetSteps": ["Step 1", "Step 2"], // Must match responsePattern.steps exactly
    "commonMistakes": ["Mistake 1", "Mistake 2"], // Must match commonMistakes exactly
    "suggestedEntryPhase": 1 // Must be 1 or 3
  }
}

Do not include any wrapper, markdown fences, or notes. Return only raw JSON.`;

  const userPrompt = `Generate a Pattern Brief for:
Level: ${level}
Mode: ${mode}
Focus: ${validatedFocus}`;

  try {
    let text: string;
    if (testHooks.callClaude) {
      text = await testHooks.callClaude(apiKey, systemPrompt, userPrompt);
    } else {
      text = await callRoleProvider("planning", systemPrompt, userPrompt);
    }
    const cleanedText = cleanJsonResponse(text);
    interface PatternBriefParsed {
      title: string;
      focus: string;
      qualityCriteria: string[];
      responsePattern: {
        name: string;
        steps: string[];
      };
      miniExample: string;
      commonMistakes: string[];
      drillEntryConfig: {
        targetPattern: string;
        targetSteps: string[];
        commonMistakes: string[];
        suggestedEntryPhase: number;
      };
    }

    let parsed: PatternBriefParsed;
    try {
      parsed = JSON.parse(cleanedText) as PatternBriefParsed;
    } catch (parseErr) {
      console.error("JSON Parse Error in generate route:", parseErr);
      return NextResponse.json({ error: "invalid_provider_response" }, { status: 502, headers });
    }

    // Strict validation rules
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.title !== "string" ||
      typeof parsed.focus !== "string" ||
      !Array.isArray(parsed.qualityCriteria) ||
      parsed.qualityCriteria.length < 1 ||
      parsed.qualityCriteria.length > 3 ||
      parsed.qualityCriteria.some((c: unknown) => typeof c !== "string")
    ) {
      console.error("Validation failed: basic fields", parsed);
      return NextResponse.json({ error: "invalid_provider_response" }, { status: 502, headers });
    }

    if (
      typeof parsed.responsePattern !== "object" ||
      parsed.responsePattern === null ||
      typeof parsed.responsePattern.name !== "string" ||
      !Array.isArray(parsed.responsePattern.steps) ||
      parsed.responsePattern.steps.length < 2 ||
      parsed.responsePattern.steps.length > 5 ||
      parsed.responsePattern.steps.some((s: unknown) => typeof s !== "string")
    ) {
      console.error("Validation failed: responsePattern", parsed);
      return NextResponse.json({ error: "invalid_provider_response" }, { status: 502, headers });
    }

    // Check slot notation in steps: at least one step must contain a slot placeholder like [claim], and all steps must be short (not full sentences)
    const slotRegex = /\[[a-zA-Z0-9_\s-]+\]/;
    const hasAtLeastOneSlot = parsed.responsePattern.steps.some((step: string) => slotRegex.test(step));
    const allStepsAreShort = parsed.responsePattern.steps.every((step: string) => step.split(/\s+/).length <= 10);
    const stepsOk = hasAtLeastOneSlot && allStepsAreShort;
    if (!stepsOk) {
      console.error("Validation failed: slot steps", parsed.responsePattern.steps);
      return NextResponse.json({ error: "invalid_provider_response" }, { status: 502, headers });
    }

    // Check miniExample: 1-2 sentences and includes warning
    if (typeof parsed.miniExample !== "string") {
      console.error("Validation failed: miniExample type", parsed);
      return NextResponse.json({ error: "invalid_provider_response" }, { status: 502, headers });
    }
    const sentences = parsed.miniExample.split(/[.!?]/).filter((s: string) => s.trim().length > 0);
    const hasExactWarning = parsed.miniExample.includes("Illustration only — do not memorize or copy.");
    if (sentences.length < 1 || sentences.length > 2 || !hasExactWarning) {
      console.error("Validation failed: miniExample checks", parsed.miniExample, sentences.length);
      return NextResponse.json({ error: "invalid_provider_response" }, { status: 502, headers });
    }

    // Check commonMistakes
    if (
      !Array.isArray(parsed.commonMistakes) ||
      parsed.commonMistakes.length < 1 ||
      parsed.commonMistakes.length > 3 ||
      parsed.commonMistakes.some((m: unknown) => typeof m !== "string")
    ) {
      console.error("Validation failed: commonMistakes", parsed);
      return NextResponse.json({ error: "invalid_provider_response" }, { status: 502, headers });
    }

    // Check drillEntryConfig
    if (
      typeof parsed.drillEntryConfig !== "object" ||
      parsed.drillEntryConfig === null ||
      parsed.drillEntryConfig.targetPattern !== parsed.responsePattern.name ||
      !Array.isArray(parsed.drillEntryConfig.targetSteps) ||
      parsed.drillEntryConfig.targetSteps.length !== parsed.responsePattern.steps.length ||
      parsed.drillEntryConfig.targetSteps.some((s: unknown, idx: number) => s !== parsed.responsePattern.steps[idx]) ||
      !Array.isArray(parsed.drillEntryConfig.commonMistakes) ||
      parsed.drillEntryConfig.commonMistakes.length !== parsed.commonMistakes.length ||
      parsed.drillEntryConfig.commonMistakes.some((m: unknown, idx: number) => m !== parsed.commonMistakes[idx]) ||
      ![1, 3].includes(parsed.drillEntryConfig.suggestedEntryPhase)
    ) {
      console.error("Validation failed: drillEntryConfig", parsed.drillEntryConfig);
      return NextResponse.json({ error: "invalid_provider_response" }, { status: 502, headers });
    }

    const finalResponse = {
      briefId: crypto.randomUUID(),
      title: parsed.title,
      focus: parsed.focus,
      qualityCriteria: parsed.qualityCriteria,
      responsePattern: parsed.responsePattern,
      miniExample: parsed.miniExample,
      commonMistakes: parsed.commonMistakes,
      drillEntryConfig: parsed.drillEntryConfig,
    };

    return NextResponse.json(finalResponse, { headers });
  } catch (err: unknown) {
    console.error("Claude call Error in generate route:", err);
    return NextResponse.json({ error: "provider_unavailable" }, { status: 502, headers });
  }
}
