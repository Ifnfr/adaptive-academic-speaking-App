import { savePatternDrillSession } from "../storage/supabase-pattern-drill-adapter";
import { calculateReinforcementScores } from "./reinforcement/reinforcementScoring";

export type EvaluateSessionInput = {
  briefId: string;
  targetPattern: string;
  targetSteps: string[];
  commonMistakes: string[];
  quickCheckStatus: "detected" | "not_detected_or_partial" | "skipped";
  phase1CompletedPromptCount: number;
  phase2Attempts: {
    topic: string;
    credit: "full" | "partial" | "none";
    missingSteps: string[];
    usedSteps: string[];
    attemptNumber: 1 | 2 | 3;
    simplifiedTopicUsed?: boolean;
  }[];
  phase3?: {
    completedRoundCount: number;
    detectedCount: number;
    missedCount: number;
    timeoutCount: number;
    pressureAccuracy: number;
    pressureFailRate: number;
  };
  weaknessLabel?: string;
  weaknessDescription?: string;
};

export async function executeEvaluateSession(
  ownerId: string,
  supabaseClient: Parameters<typeof savePatternDrillSession>[1] | null,
  input: EvaluateSessionInput
) {
  const {
    briefId,
    targetPattern,
    targetSteps,
    commonMistakes,
    quickCheckStatus,
    phase1CompletedPromptCount,
    phase2Attempts,
    phase3,
    weaknessLabel,
    weaknessDescription,
  } = input;

  // Validate basic strings & arrays
  if (
    typeof briefId !== "string" ||
    briefId.trim().length === 0 ||
    typeof targetPattern !== "string" ||
    targetPattern.trim().length === 0
  ) {
    throw new Error("invalid_request");
  }

  if (
    !Array.isArray(targetSteps) ||
    targetSteps.length < 2 ||
    targetSteps.length > 5 ||
    targetSteps.some((s) => typeof s !== "string" || s.trim().length === 0)
  ) {
    throw new Error("invalid_request");
  }

  if (
    !Array.isArray(commonMistakes) ||
    commonMistakes.length > 3 ||
    commonMistakes.some((m) => typeof m !== "string")
  ) {
    throw new Error("invalid_request");
  }

  // Validate quickCheck status
  if (!["detected", "not_detected_or_partial", "skipped"].includes(quickCheckStatus)) {
    throw new Error("invalid_request");
  }

  // Validate phase1 baseline Completeness
  if (typeof phase1CompletedPromptCount !== "number" || phase1CompletedPromptCount < 0) {
    throw new Error("invalid_request");
  }

  // Rejects incomplete Phase 1 if quick check is not "detected"
  if (quickCheckStatus !== "detected" && phase1CompletedPromptCount < 2) {
    throw new Error("incomplete_session");
  }

  // Validate phase2 attempts. A detected quick check can enter Phase 3 directly.
  if (!Array.isArray(phase2Attempts)) {
    throw new Error("invalid_request");
  }

  if (phase2Attempts.length === 0 && quickCheckStatus !== "detected") {
    throw new Error("invalid_request");
  }

  for (const att of phase2Attempts) {
    if (
      !att ||
      typeof att !== "object" ||
      typeof att.topic !== "string" ||
      att.topic.trim().length === 0 ||
      !["full", "partial", "none"].includes(att.credit) ||
      typeof att.attemptNumber !== "number" ||
      ![1, 2, 3].includes(att.attemptNumber) ||
      !Array.isArray(att.missingSteps) ||
      att.missingSteps.some((s) => typeof s !== "string") ||
      !Array.isArray(att.usedSteps) ||
      att.usedSteps.some((s) => typeof s !== "string")
    ) {
      throw new Error("invalid_request");
    }
  }

  // Validate phase3
  if (phase3 !== undefined && phase3 !== null) {
    if (
      typeof phase3 !== "object" ||
      typeof phase3.completedRoundCount !== "number" ||
      typeof phase3.detectedCount !== "number" ||
      typeof phase3.missedCount !== "number" ||
      typeof phase3.timeoutCount !== "number" ||
      typeof phase3.pressureAccuracy !== "number" ||
      typeof phase3.pressureFailRate !== "number"
    ) {
      throw new Error("invalid_request");
    }

    const p3Keys = Object.keys(phase3);
    const allowedP3Keys = [
      "completedRoundCount",
      "detectedCount",
      "missedCount",
      "timeoutCount",
      "pressureAccuracy",
      "pressureFailRate"
    ];
    if (p3Keys.some((k) => !allowedP3Keys.includes(k))) {
      throw new Error("invalid_request");
    }

    if (
      !Number.isInteger(phase3.completedRoundCount) ||
      !Number.isInteger(phase3.detectedCount) ||
      !Number.isInteger(phase3.missedCount) ||
      !Number.isInteger(phase3.timeoutCount) ||
      !Number.isInteger(phase3.pressureAccuracy) ||
      !Number.isInteger(phase3.pressureFailRate)
    ) {
      throw new Error("invalid_request");
    }

    if (
      phase3.completedRoundCount !== 4 ||
      phase3.detectedCount < 0 || phase3.detectedCount > 4 ||
      phase3.missedCount < 0 || phase3.missedCount > 4 ||
      phase3.timeoutCount < 0 || phase3.timeoutCount > 4
    ) {
      throw new Error("invalid_request");
    }

    if (
      phase3.pressureAccuracy < 0 || phase3.pressureAccuracy > 100 ||
      phase3.pressureFailRate < 0 || phase3.pressureFailRate > 100
    ) {
      throw new Error("invalid_request");
    }

    if (phase3.completedRoundCount !== phase3.detectedCount + phase3.missedCount + phase3.timeoutCount) {
      throw new Error("invalid_request");
    }

    const computedAccuracy = Math.round((phase3.detectedCount / phase3.completedRoundCount) * 100);
    const computedFailRate = Math.round(((phase3.missedCount + phase3.timeoutCount) / phase3.completedRoundCount) * 100);

    if (phase3.pressureAccuracy !== computedAccuracy || phase3.pressureFailRate !== computedFailRate) {
      throw new Error("invalid_request");
    }
  }

  // Compute metrics
  const fullCreditCount = phase2Attempts.filter((a) => a.credit === "full").length;
  const partialCreditCount = phase2Attempts.filter((a) => a.credit === "partial").length;
  const noCreditCount = phase2Attempts.filter((a) => a.credit === "none").length;
  const evaluatedAttemptCount = phase2Attempts.length;

  const phase2Accuracy = evaluatedAttemptCount > 0
    ? Math.round((fullCreditCount / evaluatedAttemptCount) * 100)
    : 0;

  // Streak of full credits at the end
  let finalFullCreditStreak = 0;
  for (let i = phase2Attempts.length - 1; i >= 0; i--) {
    if (phase2Attempts[i].credit === "full") {
      finalFullCreditStreak++;
    } else {
      break;
    }
  }

  // Most missed steps
  const stepCounts: Record<string, number> = {};
  phase2Attempts.forEach((a) => {
    a.missingSteps.forEach((step) => {
      stepCounts[step] = (stepCounts[step] || 0) + 1;
    });
  });
  const mostMissedSteps = Object.entries(stepCounts)
    .sort((a, b) => b[1] - a[1])
    .map((entry) => entry[0]);

  const simplifiedTopicUsed = phase2Attempts.some((a) => !!a.simplifiedTopicUsed);

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
    phase1CompletedPromptCount >= 2 ? "complete" : phase1CompletedPromptCount > 0 ? "partial" : "missing";

  let phase3PressureAccuracy: number | null = null;
  let pressureFailRate: number | null = null;
  if (phase3 !== undefined && phase3 !== null) {
    phase3PressureAccuracy = Math.round((phase3.detectedCount / phase3.completedRoundCount) * 100);
    pressureFailRate = Math.round(((phase3.missedCount + phase3.timeoutCount) / phase3.completedRoundCount) * 100);
  }

  // Try to save the session to the database
  let saved = false;
  let sessionId: string | undefined = undefined;

  if (supabaseClient) {
    try {
      const saveResult = await savePatternDrillSession(
        {
          ownerId,
          briefId,
          targetPattern,
          targetSteps,
          commonMistakes,
          quickCheckStatus,
          entryPhase: quickCheckStatus === "detected" ? 3 : 1,
          phase1BaselineCompleteness,
          phase1CompletedPromptCount,
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
          phase3PressureAccuracy,
          pressureFailRate,
          weaknessLabel,
          weaknessDescription,
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

  // Calculate reinforcement status
  let reinforcementStatus = "Still needs reinforcement.";
  if (supabaseClient) {
    try {
      const { data: dbSessions } = await supabaseClient
        .from("pattern_drill_sessions")
        .select("id, owner_id, target_pattern, phase2_accuracy, phase3_pressure_accuracy, pressure_fail_rate, saved_summary, created_at")
        .eq("owner_id", ownerId);

      if (dbSessions && dbSessions.length > 0) {
        const scores = calculateReinforcementScores(dbSessions);
        const practicedTitle = weaknessLabel || targetPattern;
        const scoreObj = scores.find(s => s.weaknessTitle === practicedTitle);
        if (scoreObj) {
          if (scoreObj.isResolved) {
            reinforcementStatus = "Reinforcement complete.";
          } else if (scoreObj.consecutiveSuccessCount === 1) {
            reinforcementStatus = "Improving.";
          } else {
            reinforcementStatus = "Still needs reinforcement.";
          }
        }
      }
    } catch (err) {
      console.error("Error calculating post-session reinforcement status:", err);
    }
  } else {
    // If no supabaseClient (e.g. offline testing), compute status based on the single session in-memory
    const isSuccess = phase2Accuracy >= 75 && (phase3PressureAccuracy === null || phase3PressureAccuracy <= 25);
    if (isSuccess) {
      reinforcementStatus = "Improving.";
    } else {
      reinforcementStatus = "Still needs reinforcement.";
    }
  }

  return {
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
    phase3PressureAccuracy,
    pressureFailRate,
    saved,
    reinforcementStatus,
    ...(sessionId ? { sessionId } : {}),
  };
}
