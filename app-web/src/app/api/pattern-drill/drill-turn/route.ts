import { NextResponse } from "next/server";
import { executeDrillTurn } from "../../../lib/drill-session/drill-turner";
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

  try {
    const result = await executeDrillTurn(
      {
        targetPattern,
        targetSteps: targetSteps as string[],
        commonMistakes: commonMistakes as string[],
        promptTopic,
        transcript: trimmedTranscript,
        attemptNumber,
        previousCredit: previousCredit as "partial" | "none" | null,
      },
      { callDeepSeek: testHooks.callDeepSeek || undefined }
    );
    return NextResponse.json(result, { headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "provider_not_configured") {
      return NextResponse.json({ error: msg }, { status: 503, headers });
    }
    if (msg === "invalid_provider_response" || msg === "provider_unavailable") {
      return NextResponse.json({ error: msg }, { status: 502, headers });
    }
    console.error("Drill Turn helper error:", err);
    return NextResponse.json({ error: "provider_unavailable" }, { status: 502, headers });
  }
}
