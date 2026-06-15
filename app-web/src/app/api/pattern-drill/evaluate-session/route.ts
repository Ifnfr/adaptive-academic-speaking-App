import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { savePatternDrillSession } from "../../../lib/storage/supabase-pattern-drill-adapter";

export const runtime = "nodejs";

export const testHooks = {
  resolveCurrentUserId: null as (() => Promise<string | null>) | null,
  getSupabaseClient: null as (() => unknown) | null,
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

  // Reject unexpected or client-provided owner fields explicitly before any DB write attempt
  if ("ownerId" in (body as object) || "owner_id" in (body as object)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  // Reject unexpected fields
  const allowedKeys = [
    "briefId",
    "targetPattern",
    "targetSteps",
    "commonMistakes",
    "quickCheck",
    "phase1",
    "phase2",
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
    quickCheck,
    phase1,
    phase2,
  } = body as {
    briefId?: unknown;
    targetPattern?: unknown;
    targetSteps?: unknown;
    commonMistakes?: unknown;
    quickCheck?: unknown;
    phase1?: unknown;
    phase2?: unknown;
  };

  // Validate basic strings & arrays
  if (
    typeof briefId !== "string" ||
    briefId.trim().length === 0 ||
    typeof targetPattern !== "string" ||
    targetPattern.trim().length === 0
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

  // Validate quickCheck
  if (
    !quickCheck ||
    typeof quickCheck !== "object" ||
    typeof (quickCheck as Record<string, unknown>).status !== "string" ||
    !["detected", "not_detected_or_partial", "skipped"].includes(
      (quickCheck as Record<string, string>).status
    )
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  const qcStatus = (quickCheck as { status: "detected" | "not_detected_or_partial" | "skipped" }).status;

  // Validate phase1
  if (
    !phase1 ||
    typeof phase1 !== "object" ||
    typeof (phase1 as Record<string, unknown>).baselineAnswerCount !== "number" ||
    typeof (phase1 as Record<string, unknown>).completedPromptCount !== "number"
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  const p1 = phase1 as { baselineAnswerCount: number; completedPromptCount: number };

  // Rejects incomplete Phase 1 if quick check is not "detected"
  if (qcStatus !== "detected" && p1.completedPromptCount < 2) {
    return NextResponse.json({ error: "incomplete_session" }, { status: 400, headers });
  }

  // Validate phase2
  if (
    !phase2 ||
    typeof phase2 !== "object" ||
    !Array.isArray((phase2 as Record<string, unknown>).attempts)
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  interface Attempt {
    topic: string;
    credit: "full" | "partial" | "none";
    missingSteps: string[];
    usedSteps: string[];
    attemptNumber: 1 | 2 | 3;
    simplifiedTopicUsed?: boolean;
  }

  const p2Attempts = (phase2 as { attempts: unknown[] }).attempts;

  if (p2Attempts.length === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  for (const att of p2Attempts) {
    if (
      !att ||
      typeof att !== "object" ||
      typeof (att as Record<string, unknown>).topic !== "string" ||
      (att as Record<string, string>).topic.trim().length === 0 ||
      !["full", "partial", "none"].includes((att as Record<string, string>).credit) ||
      typeof (att as Record<string, unknown>).attemptNumber !== "number" ||
      ![1, 2, 3].includes((att as Record<string, number>).attemptNumber) ||
      !Array.isArray((att as Record<string, unknown>).missingSteps) ||
      (att as { missingSteps: unknown[] }).missingSteps.some((s) => typeof s !== "string") ||
      !Array.isArray((att as Record<string, unknown>).usedSteps) ||
      (att as { usedSteps: unknown[] }).usedSteps.some((s) => typeof s !== "string")
    ) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
    }
  }

  const attempts = p2Attempts as Attempt[];

  // Compute metrics
  const fullCreditCount = attempts.filter((a) => a.credit === "full").length;
  const partialCreditCount = attempts.filter((a) => a.credit === "partial").length;
  const noCreditCount = attempts.filter((a) => a.credit === "none").length;
  const evaluatedAttemptCount = attempts.length;

  const phase2Accuracy = evaluatedAttemptCount > 0
    ? Math.round((fullCreditCount / evaluatedAttemptCount) * 100)
    : 0;

  // Streak of full credits at the end
  let finalFullCreditStreak = 0;
  for (let i = attempts.length - 1; i >= 0; i--) {
    if (attempts[i].credit === "full") {
      finalFullCreditStreak++;
    } else {
      break;
    }
  }

  // Most missed steps
  const stepCounts: Record<string, number> = {};
  attempts.forEach((a) => {
    a.missingSteps.forEach((step) => {
      stepCounts[step] = (stepCounts[step] || 0) + 1;
    });
  });
  const mostMissedSteps = Object.entries(stepCounts)
    .sort((a, b) => b[1] - a[1])
    .map((entry) => entry[0]);

  const simplifiedTopicUsed = attempts.some((a) => !!a.simplifiedTopicUsed);

  // Qualitative signal
  let improvementSignal: "strong" | "emerging" | "needs_more_repetition" = "needs_more_repetition";
  if (phase2Accuracy >= 75) {
    improvementSignal = "strong";
  } else if (phase2Accuracy >= 50) {
    improvementSignal = "emerging";
  }

  const nextSessionRecommendation = phase2Accuracy >= 75
    ? "Pattern mastered. Ready for faster pacing or full context speaking in next Podchat."
    : "Keep practicing. Focus on including all target slots in order.";

  const weaknessUpdate = {
    category: "pattern_drill" as const,
    label: targetPattern,
    practiceFocus: mostMissedSteps.length > 0
      ? `Ensure slots like ${mostMissedSteps.slice(0, 2).join(" and ")} are correct.`
      : "Maintain current accurate slot sequencing.",
  };

  const phase1BaselineCompleteness: "complete" | "partial" | "missing" =
    p1.completedPromptCount >= 2 ? "complete" : p1.completedPromptCount > 0 ? "partial" : "missing";

  // Try to save the session to the database
  let saved = false;
  let sessionId: string | undefined = undefined;

  const supabaseClient = getSupabaseClient();
  if (supabaseClient) {
    try {
      const saveResult = await savePatternDrillSession(
        {
          ownerId,
          briefId,
          targetPattern,
          targetSteps,
          commonMistakes,
          quickCheckStatus: qcStatus,
          entryPhase: qcStatus === "detected" ? 3 : 1,
          phase1BaselineCompleteness,
          phase1CompletedPromptCount: p1.completedPromptCount,
          phase2Accuracy,
          fullCreditCount,
          partialCreditCount,
          noCreditCount,
          evaluatedAttemptCount,
          finalFullCreditStreak,
          mostMissedSteps,
          simplifiedTopicUsed,
          improvementSignal,
          nextSessionRecommendation,
          weaknessUpdate,
          phase3PressureAccuracy: null,
          pressureFailRate: null,
        },
        supabaseClient
      );

      if (saveResult.ok && saveResult.sessionId) {
        saved = true;
        sessionId = saveResult.sessionId;
      } else {
        console.error("Pattern drill session persistence failed:", saveResult.error);
      }
    } catch (saveErr) {
      console.error("Unexpected error saving pattern drill session:", saveErr);
    }
  } else {
    console.error("Supabase client unavailable for pattern drill session persistence.");
  }

  return NextResponse.json(
    {
      phase1BaselineCompleteness,
      phase2Accuracy,
      fullCreditCount,
      partialCreditCount,
      noCreditCount,
      evaluatedAttemptCount,
      finalFullCreditStreak,
      mostMissedSteps,
      simplifiedTopicUsed,
      improvementSignal,
      nextSessionRecommendation,
      weaknessUpdate,
      phase3PressureAccuracy: null,
      pressureFailRate: null,
      saved,
      ...(sessionId ? { sessionId } : {}),
    },
    { headers }
  );
}
