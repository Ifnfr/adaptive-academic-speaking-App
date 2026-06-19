import { NextResponse } from "next/server";
import { executeQuickCheck } from "../../../lib/drill-session/quick-checker";
import { executeDrillTurn } from "../../../lib/drill-session/drill-turner";
import { executePressureTurn } from "../../../lib/drill-session/pressure-turner";
import { applyTurnResult } from "../../../lib/drill-session/state";
import {
  containsOwnerOrInternalFields,
  validateSessionInputKeys,
  isValidDrillSessionState,
} from "../../../lib/drill-session/validation";
import { testHooks } from "./route-test-hooks";
import type { DrillSessionState, TurnResult } from "../../../lib/drill-session/types";

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

  // Reject owner or internal fields
  if (containsOwnerOrInternalFields(body)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  // Allowed keys: session, phase, transcript, topic, promptTopic, attemptNumber, previousCredit, roundSeconds, roundIndex, simplifiedTopicUsed, startLatencyMs
  const allowedKeys = [
    "session",
    "phase",
    "transcript",
    "topic",
    "promptTopic",
    "attemptNumber",
    "previousCredit",
    "roundSeconds",
    "roundIndex",
    "simplifiedTopicUsed",
    "startLatencyMs",
  ];
  if (!validateSessionInputKeys(body, allowedKeys)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  const {
    session,
    phase,
    transcript,
    topic,
    promptTopic,
    attemptNumber,
    previousCredit,
    roundSeconds,
    roundIndex,
    simplifiedTopicUsed,
    startLatencyMs,
  } = body as {
    session?: unknown;
    phase?: unknown;
    transcript?: unknown;
    topic?: unknown;
    promptTopic?: unknown;
    attemptNumber?: unknown;
    previousCredit?: unknown;
    roundSeconds?: unknown;
    roundIndex?: unknown;
    simplifiedTopicUsed?: unknown;
    startLatencyMs?: unknown;
  };

  // Validate session state
  if (!isValidDrillSessionState(session)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  // Validate phase
  if (
    phase !== "quick_check" &&
    phase !== 1 &&
    phase !== 2 &&
    phase !== 3
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  // Validate startLatencyMs if provided
  if (startLatencyMs !== undefined && startLatencyMs !== null) {
    if (phase !== 3) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
    }
    if (
      typeof startLatencyMs !== "number" ||
      !Number.isFinite(startLatencyMs) ||
      !Number.isInteger(startLatencyMs) ||
      startLatencyMs < 0 ||
      startLatencyMs > 60000
    ) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
    }
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

  if (!session.briefContent) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  const brief = session.briefContent;

  try {
    if (phase === "quick_check") {
      const qCheckResult = await executeQuickCheck(
        brief.responsePattern,
        brief.commonMistakes,
        trimmedTranscript,
        { callClaude: testHooks.callClaude || undefined }
      );

      const updatedSession: DrillSessionState = {
        ...session,
        entryPhase: qCheckResult.entryPhase,
        currentPhase: qCheckResult.entryPhase,
      };

      return NextResponse.json(
        {
          session: updatedSession,
          turnResult: {
            phase: "quick_check",
            result: qCheckResult.result,
            entryPhase: qCheckResult.entryPhase,
          },
        },
        { headers }
      );
    }

    if (phase === 1) {
      // Validate Phase 1 specific fields
      const activeTopic = topic || promptTopic;
      if (typeof activeTopic !== "string" || activeTopic.trim().length === 0) {
        return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
      }

      const turnResult: TurnResult = {
        phase: 1,
        detected: true,
        topic: activeTopic,
      };

      const updatedSession = applyTurnResult(session, 1, turnResult);
      if (updatedSession.phase1Results.length >= 2) {
        updatedSession.currentPhase = 2;
      }

      return NextResponse.json(
        {
          session: updatedSession,
          turnResult,
        },
        { headers }
      );
    }

    if (phase === 2) {
      // Validate Phase 2 specific fields
      const activeTopic = topic || promptTopic;
      if (typeof activeTopic !== "string" || activeTopic.trim().length === 0) {
        return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
      }
      if (typeof attemptNumber !== "number" || ![1, 2, 3].includes(attemptNumber)) {
        return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
      }
      if (
        previousCredit !== undefined &&
        previousCredit !== null &&
        previousCredit !== "partial" &&
        previousCredit !== "none"
      ) {
        return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
      }

      const evalResult = await executeDrillTurn(
        {
          targetPattern: brief.responsePattern.name,
          targetSteps: brief.responsePattern.steps,
          commonMistakes: brief.commonMistakes,
          promptTopic: activeTopic,
          transcript: trimmedTranscript,
          attemptNumber,
          previousCredit: previousCredit as "partial" | "none" | null | undefined,
        },
        { callDeepSeek: testHooks.callDeepSeek || undefined }
      );

      const turnResult: TurnResult = {
        phase: 2,
        credit: evalResult.credit,
        missingSteps: evalResult.missingSteps,
        usedSteps: evalResult.usedSteps,
        shortFeedback: evalResult.shortFeedback,
        topic: activeTopic,
        attemptNumber: attemptNumber as 1 | 2 | 3,
        simplifiedTopicUsed: !!simplifiedTopicUsed,
      };

      const updatedSession = applyTurnResult(session, 2, turnResult);

      return NextResponse.json(
        {
          session: updatedSession,
          turnResult: {
            phase: 2,
            credit: evalResult.credit,
            missingSteps: evalResult.missingSteps,
            usedSteps: evalResult.usedSteps,
            shortFeedback: evalResult.shortFeedback,
          },
        },
        { headers }
      );
    }

    if (phase === 3) {
      // Validate Phase 3 specific fields
      if (typeof roundSeconds !== "number" || ![10, 7, 5, 3].includes(roundSeconds)) {
        return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
      }
      if (typeof roundIndex !== "number" || ![0, 1, 2, 3].includes(roundIndex)) {
        return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
      }

      const activeTopic = (topic as string) || (promptTopic as string) || brief.focus;

      const evalResult = await executePressureTurn(
        {
          targetPattern: brief.responsePattern.name,
          targetSteps: brief.responsePattern.steps,
          commonMistakes: brief.commonMistakes,
          promptTopic: activeTopic,
          transcript: trimmedTranscript,
          roundSeconds,
          roundIndex,
        },
        { callClaude: testHooks.callClaude || undefined }
      );

      let pressurePassed: boolean | undefined = undefined;
      if (typeof startLatencyMs === "number") {
        pressurePassed = startLatencyMs <= roundSeconds * 1000;
      }

      const turnResult: TurnResult = {
        phase: 3,
        patternDetected: evalResult.patternDetected,
        usedSteps: evalResult.usedSteps,
        missingSteps: evalResult.missingSteps,
        timedOut: evalResult.timedOut,
        shortFeedback: evalResult.shortFeedback,
        roundSeconds,
        roundIndex,
        startLatencyMs: typeof startLatencyMs === "number" ? startLatencyMs : undefined,
        pressurePassed,
      };

      const updatedSession = applyTurnResult(session, 3, turnResult);
      if (updatedSession.phase3Results.length >= 4) {
        updatedSession.currentPhase = "complete";
      }

      return NextResponse.json(
        {
          session: updatedSession,
          turnResult: {
            phase: 3,
            patternDetected: evalResult.patternDetected,
            usedSteps: evalResult.usedSteps,
            missingSteps: evalResult.missingSteps,
            timedOut: evalResult.timedOut,
            shortFeedback: evalResult.shortFeedback,
            startLatencyMs: typeof startLatencyMs === "number" ? startLatencyMs : undefined,
            pressurePassed,
          },
        },
        { headers }
      );
    }

    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "provider_not_configured") {
      return NextResponse.json({ error: msg }, { status: 503, headers });
    }
    if (
      msg === "invalid_provider_response" ||
      msg === "provider_unavailable" ||
      msg === "provider_evaluation_failed"
    ) {
      return NextResponse.json({ error: "provider_unavailable" }, { status: 502, headers });
    }
    console.error("Drill Turn handler error:", err);
    return NextResponse.json({ error: "provider_unavailable" }, { status: 502, headers });
  }
}
