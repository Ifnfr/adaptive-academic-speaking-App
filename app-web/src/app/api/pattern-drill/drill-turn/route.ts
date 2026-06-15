import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const testHooks = {
  resolveCurrentUserId: null as (() => Promise<string | null>) | null,
  callDeepSeek: null as ((apiKey: string, systemPrompt: string, userPrompt: string) => Promise<string>) | null,
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

async function callDeepSeek(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  if (testHooks.callDeepSeek) {
    return testHooks.callDeepSeek(apiKey, systemPrompt, userPrompt);
  }

  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek API error ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
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
    "phase",
    "briefId",
    "targetPattern",
    "targetSteps",
    "commonMistakes",
    "promptTopic",
    "transcript",
    "attemptNumber",
    "previousCredit",
  ];
  const bodyKeys = Object.keys(body as Record<string, unknown>);
  if (bodyKeys.some((k) => !allowedKeys.includes(k))) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  const {
    phase,
    briefId,
    targetPattern,
    targetSteps,
    commonMistakes,
    promptTopic,
    transcript,
    attemptNumber,
    previousCredit,
  } = body as {
    phase?: unknown;
    briefId?: unknown;
    targetPattern?: unknown;
    targetSteps?: unknown;
    commonMistakes?: unknown;
    promptTopic?: unknown;
    transcript?: unknown;
    attemptNumber?: unknown;
    previousCredit?: unknown;
  };

  // Assert phase is exactly 2
  if (phase !== 2) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  // Validate briefId, targetPattern, promptTopic
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

  // Validate targetSteps (array of non-empty strings, length 2 to 5)
  if (
    !Array.isArray(targetSteps) ||
    targetSteps.length < 2 ||
    targetSteps.length > 5 ||
    targetSteps.some((s) => typeof s !== "string" || s.trim().length === 0)
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  // Validate commonMistakes (array of strings, length <= 3)
  if (
    !Array.isArray(commonMistakes) ||
    commonMistakes.length > 3 ||
    commonMistakes.some((m) => typeof m !== "string")
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  // Validate attemptNumber
  if (
    typeof attemptNumber !== "number" ||
    ![1, 2, 3].includes(attemptNumber)
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  // Validate previousCredit
  if (
    previousCredit !== undefined &&
    previousCredit !== null &&
    previousCredit !== "partial" &&
    previousCredit !== "none"
  ) {
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

  const apiKey = process.env.DEEPSEEK_API_KEY || (testHooks.callDeepSeek ? "__test__" : "");
  if (!apiKey) {
    return NextResponse.json({ error: "provider_not_configured" }, { status: 503, headers });
  }

  const systemPrompt = `You are a strict language learning assistant evaluating spoken turns in a Contrastive Repetition drill.
Evaluate whether the learner's transcript correctly uses the target response pattern for the given topic.
Compare the target steps of the response pattern with the learner's transcript.

You must return ONLY a JSON object matching this schema:
{
  "credit": "full" | "partial" | "none",
  "missingSteps": string[], // steps from the pattern that the learner missed
  "usedSteps": string[], // steps from the pattern that the learner used
  "shortFeedback": string // a brief feedback message complying with the rules below
}

Feedback rules:
1. If credit is "full", the shortFeedback MUST be EXACTLY one of: "Good.", "Yes.", or "Exactly.". No additional text, commentary, or punctuation.
2. If credit is "partial", the shortFeedback must list only the missing steps or what is incorrect, with no coaching or conversational fluff (e.g. "Missing slot: [reason]."). Keep it very short.
3. If credit is "none", the shortFeedback must be a concise contrastive explanation (e.g. "You said X, but the pattern requires Y."). Keep it under 150 characters.

Return only raw JSON. Do not include markdown fences, comments, or any other wrapper text.`;

  const userPrompt = `Target Pattern Name: ${targetPattern}
Target Steps: ${targetSteps.join(", ")}
Common Mistakes: ${commonMistakes.join("; ")}
Topic: ${promptTopic}
Learner Transcript: "${trimmedTranscript}"
Attempt Number: ${attemptNumber}
Previous Credit: ${previousCredit || "none"}

Evaluate the learner transcript against the pattern and topic.`;

  try {
    const text = await callDeepSeek(apiKey, systemPrompt, userPrompt);
    const cleanedText = cleanJsonResponse(text);

    interface DeepSeekResponseParsed {
      credit?: unknown;
      missingSteps?: unknown;
      usedSteps?: unknown;
      shortFeedback?: unknown;
    }

    let parsed: DeepSeekResponseParsed;
    try {
      parsed = JSON.parse(cleanedText) as DeepSeekResponseParsed;
    } catch {
      console.error("Drill turn JSON parse error");
      return NextResponse.json({ error: "invalid_provider_response" }, { status: 502, headers });
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed.credit !== "full" && parsed.credit !== "partial" && parsed.credit !== "none") ||
      !Array.isArray(parsed.missingSteps) ||
      parsed.missingSteps.some((s) => typeof s !== "string") ||
      !Array.isArray(parsed.usedSteps) ||
      parsed.usedSteps.some((s) => typeof s !== "string") ||
      typeof parsed.shortFeedback !== "string"
    ) {
      console.error("Drill turn invalid provider result fields:", parsed);
      return NextResponse.json({ error: "invalid_provider_response" }, { status: 502, headers });
    }

    const feedback = parsed.shortFeedback.trim();

    // Limit feedback length to prevent verbose coaching/prompts leakage
    if (feedback.length > 150) {
      console.error("Drill turn feedback exceeded character limit:", feedback.length);
      return NextResponse.json({ error: "invalid_provider_response" }, { status: 502, headers });
    }

    if (parsed.credit === "full") {
      if (feedback !== "Good." && feedback !== "Yes." && feedback !== "Exactly.") {
        console.error("Drill turn full credit feedback was not one of 'Good.', 'Yes.', 'Exactly.':", feedback);
        return NextResponse.json({ error: "invalid_provider_response" }, { status: 502, headers });
      }
    }

    return NextResponse.json(
      {
        credit: parsed.credit,
        missingSteps: parsed.missingSteps,
        usedSteps: parsed.usedSteps,
        shortFeedback: feedback,
      },
      { headers }
    );
  } catch (err: unknown) {
    console.error("Drill turn DeepSeek call error:", err);
    return NextResponse.json({ error: "provider_unavailable" }, { status: 502, headers });
  }
}
