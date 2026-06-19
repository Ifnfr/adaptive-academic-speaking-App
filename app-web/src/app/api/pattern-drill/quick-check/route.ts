import { NextResponse } from "next/server";
import { resolveProvider, callRoleProvider, ProviderConfigError } from "../_lib/roleProviders";
import { testHooks } from "./route-test-hooks";

export const runtime = "nodejs";

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
  const allowedKeys = ["briefId", "responsePattern", "commonMistakes", "transcript"];
  const bodyKeys = Object.keys(body as Record<string, unknown>);
  if (bodyKeys.some((k) => !allowedKeys.includes(k))) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  const { briefId, responsePattern, commonMistakes, transcript } = body as {
    briefId?: unknown;
    responsePattern?: unknown;
    commonMistakes?: unknown;
    transcript?: unknown;
  };

  // Validate briefId
  if (typeof briefId !== "string" || briefId.trim().length === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  // Validate responsePattern
  if (
    typeof responsePattern !== "object" ||
    responsePattern === null ||
    typeof (responsePattern as Record<string, unknown>).name !== "string" ||
    ((responsePattern as Record<string, unknown>).name as string).trim().length === 0 ||
    !Array.isArray((responsePattern as Record<string, unknown>).steps)
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  const rp = responsePattern as { name: string; steps: unknown[] };
  if (rp.steps.length < 2 || rp.steps.length > 5 || rp.steps.some((s) => typeof s !== "string" || (s as string).trim().length === 0)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  // Validate commonMistakes
  if (!Array.isArray(commonMistakes) || commonMistakes.length > 3 || commonMistakes.some((m) => typeof m !== "string")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  // Validate transcript
  if (transcript === undefined || transcript === null || transcript === "") {
    return NextResponse.json({ error: "transcript_required" }, { status: 400, headers });
  }
  if (typeof transcript !== "string") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }
  const trimmedTranscript = transcript.trim();
  if (trimmedTranscript.length === 0) {
    return NextResponse.json({ error: "transcript_required" }, { status: 400, headers });
  }
  if (trimmedTranscript.length > 500) {
    return NextResponse.json({ error: "transcript_too_long" }, { status: 400, headers });
  }

  let apiKey: string;
  if (testHooks.callClaude) {
    apiKey = "__test__";
  } else {
    try {
      const providerConfig = resolveProvider("execution");
      apiKey = providerConfig.apiKey;
    } catch (err) {
      if (err instanceof ProviderConfigError) {
        return NextResponse.json({ error: "provider_not_configured" }, { status: 503, headers });
      }
      throw err;
    }
  }

  const patternName = rp.name;
  const patternSteps = (rp.steps as string[]).join(", ");
  const mistakesList = (commonMistakes as string[]).length > 0
    ? (commonMistakes as string[]).join("; ")
    : "none specified";

  const systemPrompt = `You are an expert language learning evaluator. Your task is to determine whether a learner's spoken sentence demonstrates a specific response pattern. Return ONLY a JSON object with a single field "result" that is either "detected" or "not_detected_or_partial". No explanation, no score, no grammar correction — just the JSON.

Rules:
- "detected": the sentence clearly follows the pattern structure, using the key slot types in roughly the correct order
- "not_detected_or_partial": the sentence is missing key slots, uses the pattern incorrectly, or does not attempt the pattern

Return format (strict): {"result":"detected"} or {"result":"not_detected_or_partial"}`;

  const userPrompt = `Pattern name: ${patternName}
Pattern steps: ${patternSteps}
Common mistakes to watch for: ${mistakesList}

Learner sentence: "${trimmedTranscript}"

Does this sentence demonstrate the pattern? Return only JSON.`;

  try {
    let text: string;
    if (testHooks.callClaude) {
      text = await testHooks.callClaude(apiKey, systemPrompt, userPrompt);
    } else {
      text = await callRoleProvider("execution", systemPrompt, userPrompt);
    }
    const cleanedText = cleanJsonResponse(text);

    let parsed: { result?: unknown };
    try {
      parsed = JSON.parse(cleanedText) as { result?: unknown };
    } catch {
      console.error("Quick check JSON parse error");
      return NextResponse.json({ error: "invalid_provider_response" }, { status: 502, headers });
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed.result !== "detected" && parsed.result !== "not_detected_or_partial")
    ) {
      console.error("Quick check invalid provider result:", parsed);
      return NextResponse.json({ error: "invalid_provider_response" }, { status: 502, headers });
    }

    const result = parsed.result as "detected" | "not_detected_or_partial";
    const entryPhase: 1 | 3 = result === "detected" ? 3 : 1;

    return NextResponse.json({ result, entryPhase }, { headers });
  } catch (err: unknown) {
    console.error("Quick check Claude call error:", err);
    return NextResponse.json({ error: "provider_unavailable" }, { status: 502, headers });
  }
}
