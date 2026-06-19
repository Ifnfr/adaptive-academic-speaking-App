import type { DrillSessionState } from "./types";
import type { EvaluateSessionInput } from "./session-completer";

export function mapSessionToEvaluateInput(session: DrillSessionState): EvaluateSessionInput {
  if (!session.briefContent) {
    throw new Error("Missing briefContent in session state");
  }

  const brief = session.briefContent;

  // quickCheckStatus
  let quickCheckStatus: "detected" | "not_detected_or_partial" | "skipped" = "skipped";
  if (session.entryPhase === 3) {
    quickCheckStatus = "detected";
  } else if (session.entryPhase === 1) {
    quickCheckStatus = "not_detected_or_partial";
  }

  // phase1CompletedPromptCount
  const phase1CompletedPromptCount = session.phase1Results.length;

  // phase2Attempts
  const phase2Attempts = session.phase2Results.map((r) => {
    return {
      topic: r.topic || brief.focus || "topic",
      credit: r.credit || "none",
      missingSteps: r.missingSteps || [],
      usedSteps: r.usedSteps || [],
      attemptNumber: r.attemptNumber || 1,
      simplifiedTopicUsed: r.simplifiedTopicUsed || false,
    };
  });

  // phase3
  let phase3: EvaluateSessionInput["phase3"] = undefined;
  if (session.phase3Results.length > 0) {
    // Recompute phase3 summary stats from individual results
    const completedRoundCount = session.phase3Results.length;
    const timeoutCount = session.phase3Results.filter((r) => {
      if (r.pressurePassed !== undefined) {
        return !r.pressurePassed;
      }
      return !!r.timedOut;
    }).length;

    const detectedCount = session.phase3Results.filter((r) => {
      const isTimeout = r.pressurePassed !== undefined ? !r.pressurePassed : !!r.timedOut;
      return !isTimeout && !!r.patternDetected;
    }).length;

    const missedCount = completedRoundCount - detectedCount - timeoutCount;

    const pressureAccuracy = Math.round((detectedCount / completedRoundCount) * 100);
    const pressureFailRate = Math.round(((missedCount + timeoutCount) / completedRoundCount) * 100);

    phase3 = {
      completedRoundCount,
      detectedCount,
      missedCount,
      timeoutCount,
      pressureAccuracy,
      pressureFailRate,
    };
  }

  return {
    briefId: brief.briefId,
    targetPattern: brief.responsePattern.name,
    targetSteps: brief.responsePattern.steps,
    commonMistakes: brief.commonMistakes,
    quickCheckStatus,
    phase1CompletedPromptCount,
    phase2Attempts,
    phase3,
    weaknessLabel: brief.weaknessLabel,
    weaknessDescription: brief.weaknessDescription,
  };
}
