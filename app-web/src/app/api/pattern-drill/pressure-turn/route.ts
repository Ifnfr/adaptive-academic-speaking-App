import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const testHooks = {
  resolveCurrentUserId: null as (() => Promise<string | null>) | null,
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

async function callClaude(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  if (testHooks.callClaude) {
    return testHooks.callClaude(apiKey, systemPrompt, userPrompt);
  }

  const model = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Claude API error ${res.status}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return data.content?.find((c) => c.type === "text")?.text ?? "";
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
  const allowedKeys = [
    "briefId",
    "targetPattern",
    "targetSteps",
    "commonMistakes",
    "promptTopic",
    "transcript",
    "roundSeconds",
    "roundIndex"
  ];
  const bodyKeys = Object.keys(body as Record<string, unknown>);
  if (bodyKeys.some((k) => !allowedKeys.includes(k))) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  const {
    briefId,
    targetPattern,
    targetSteps,
    commonMistakes,
    promptTopic,
    transcript,
    roundSeconds,
    roundIndex
  } = body as {
    briefId?: unknown;
    targetPattern?: unknown;
    targetSteps?: unknown;
    commonMistakes?: unknown;
    promptTopic?: unknown;
    transcript?: unknown;
    roundSeconds?: unknown;
    roundIndex?: unknown;
  };

  // Validate fields
  if (
    typeof briefId !== "string" ||
    briefId.trim().length === 0 ||
    typeof targetPattern !== "string" ||
    targetPattern.trim().length === 0 ||
    typeof promptTopic !== "string" ||
    promptTopic.trim().length === 0
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  if (
    !Array.isArray(targetSteps) ||
    targetSteps.length < 2 ||
    targetSteps.length > 5 ||
    targetSteps.some((s) => typeof s !== "string" || s.trim().length === 0)
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  if (
    !Array.isArray(commonMistakes) ||
    commonMistakes.length > 3 ||
    commonMistakes.some((m) => typeof m !== "string")
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  if (
    typeof roundSeconds !== "number" ||
    ![10, 7, 5, 3].includes(roundSeconds) ||
    typeof roundIndex !== "number" ||
    ![0, 1, 2, 3].includes(roundIndex)
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  if (transcript === undefined || transcript === null || typeof transcript !== "string") {
    return NextResponse.json({ error: "transcript_required" }, { status: 400, headers });
  }

  const trimmedTranscript = transcript.trim();
  if (trimmedTranscript.length === 0) {
    return NextResponse.json({ error: "transcript_required" }, { status: 400, headers });
  }

  if (trimmedTranscript.length > 500) {
    return NextResponse.json({ error: "transcript_too_long" }, { status: 400, headers });
  }

  const apiKey = process.env.CLAUDE_API_KEY || (testHooks.callClaude ? "__test__" : "");
  if (!apiKey) {
    return NextResponse.json({ error: "provider_not_configured" }, { status: 503, headers });
  }

  const systemPrompt = `You are a strict language learning assistant evaluating spoken turns in a text-based Pressure Test drill.
Evaluate whether the learner's transcript correctly uses the target response pattern for the given topic.
Compare the target steps of the response pattern with the learner's transcript.

You must return ONLY a JSON object matching this schema:
{
  "patternDetected": boolean,
  "usedSteps": string[], // steps from the pattern that the learner used
  "missingSteps": string[], // steps from the pattern that the learner missed
  "timedOut": false,
  "shortFeedback": string // a brief feedback message complying with the rules below
}

Feedback rules:
1. Keep the shortFeedback extremely concise.
2. If patternDetected is true, the shortFeedback MUST be EXACTLY one of: "Good.", "Yes.", or "Exactly.". No additional text or punctuation.
3. If patternDetected is false, list only the missing steps or what is incorrect concisely.

Return only raw JSON. Do not include markdown fences, comments, or any other wrapper text.`;

  const userPrompt = `Target Pattern Name: ${targetPattern}
Target Steps: ${targetSteps.join(", ")}
Common Mistakes: ${commonMistakes.join("; ")}
Topic: ${promptTopic}
Learner Transcript: "${trimmedTranscript}"
Round Index: ${roundIndex} (Seconds: ${roundSeconds})

Evaluate the learner transcript against the pattern and topic.`;

  try {
    const text = await callClaude(apiKey, systemPrompt, userPrompt);
    const cleanedText = cleanJsonResponse(text);

    interface ClaudeResponseParsed {
      patternDetected?: unknown;
      usedSteps?: unknown;
      missingSteps?: unknown;
      timedOut?: unknown;
      shortFeedback?: unknown;
    }

    let parsed: ClaudeResponseParsed;
    try {
      parsed = JSON.parse(cleanedText) as ClaudeResponseParsed;
    } catch (parseErr) {
      console.error("JSON Parse Error in pressure-turn route:", parseErr, "Raw response:", text);
      return NextResponse.json({ error: "provider_evaluation_failed" }, { status: 502, headers });
    }

    if (
      typeof parsed.patternDetected !== "boolean" ||
      !Array.isArray(parsed.usedSteps) ||
      parsed.usedSteps.some((s) => typeof s !== "string") ||
      !Array.isArray(parsed.missingSteps) ||
      parsed.missingSteps.some((s) => typeof s !== "string") ||
      typeof parsed.shortFeedback !== "string"
    ) {
      console.error("Validation failed: pressure-turn response format invalid:", parsed);
      return NextResponse.json({ error: "provider_evaluation_failed" }, { status: 502, headers });
    }

    // Enforce exact feedback rule for patternDetected = true
    const shortFeedback = parsed.shortFeedback.trim();
    if (parsed.patternDetected) {
      if (!["Good.", "Yes.", "Exactly."].includes(shortFeedback)) {
        console.error("Pressure turn detected pattern but feedback was not one of allowed values:", shortFeedback);
        return NextResponse.json({ error: "provider_evaluation_failed" }, { status: 502, headers });
      }
    }

    if (shortFeedback.length > 150) {
      console.error("Pressure turn feedback exceeded character limit:", shortFeedback.length);
      return NextResponse.json({ error: "provider_evaluation_failed" }, { status: 502, headers });
    }

    return NextResponse.json(
      {
        patternDetected: parsed.patternDetected,
        usedSteps: parsed.usedSteps,
        missingSteps: parsed.missingSteps,
        timedOut: false,
        shortFeedback,
      },
      { headers }
    );
  } catch (providerErr) {
    console.error("Pressure turn Claude call error:", providerErr);
    return NextResponse.json({ error: "provider_unavailable" }, { status: 502, headers });
  }
}
