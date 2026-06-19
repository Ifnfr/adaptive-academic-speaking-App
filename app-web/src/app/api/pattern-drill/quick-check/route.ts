import { NextResponse } from "next/server";
import { testHooks } from "./route-test-hooks";
import { executeQuickCheck } from "../../../lib/drill-session/quick-checker";

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

  try {
    const result = await executeQuickCheck(
      rp as { name: string; steps: string[] },
      commonMistakes as string[],
      trimmedTranscript,
      { callClaude: testHooks.callClaude || undefined }
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
    console.error("Quick Check error:", err);
    return NextResponse.json({ error: "provider_unavailable" }, { status: 502, headers });
  }
}
