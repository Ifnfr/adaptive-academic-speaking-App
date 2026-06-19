import { NextResponse } from "next/server";
import { executePressureTurn } from "../../../lib/drill-session/pressure-turner";
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

  try {
    const result = await executePressureTurn(
      {
        targetPattern,
        targetSteps: targetSteps as string[],
        commonMistakes: commonMistakes as string[],
        promptTopic,
        transcript: trimmedTranscript,
        roundSeconds,
        roundIndex,
      },
      { callClaude: testHooks.callClaude || undefined }
    );
    return NextResponse.json(result, { headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "provider_not_configured") {
      return NextResponse.json({ error: msg }, { status: 503, headers });
    }
    if (msg === "provider_evaluation_failed" || msg === "provider_unavailable") {
      return NextResponse.json({ error: msg }, { status: 502, headers });
    }
    return NextResponse.json({ error: "provider_unavailable" }, { status: 502, headers });
  }
}
