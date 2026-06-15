import type { FonetikSupabaseClient } from "../supabase";

export type SavePatternDrillSessionInput = {
  ownerId: string;
  briefId: string;
  targetPattern: string;
  targetSteps: string[];
  commonMistakes: string[];
  quickCheckStatus: "detected" | "not_detected_or_partial" | "skipped";
  entryPhase: 1 | 3;
  phase1BaselineCompleteness: "complete" | "partial" | "missing";
  phase1CompletedPromptCount: number;
  phase2Accuracy: number;
  fullCreditCount: number;
  partialCreditCount: number;
  noCreditCount: number;
  evaluatedAttemptCount: number;
  finalFullCreditStreak: number;
  mostMissedSteps: string[];
  simplifiedTopicUsed: boolean;
  improvementSignal: "strong" | "emerging" | "needs_more_repetition";
  nextSessionRecommendation: string;
  weaknessUpdate: {
    category: "pattern_drill";
    label: string;
    practiceFocus: string;
  } | null;
  phase3PressureAccuracy: number | null;
  pressureFailRate: number | null;
};

export async function savePatternDrillSession(
  input: SavePatternDrillSessionInput,
  supabaseClient: FonetikSupabaseClient,
): Promise<{ ok: boolean; sessionId?: string; error?: string }> {
  // 1. Validate input defensively
  if (!input.ownerId || typeof input.ownerId !== "string" || input.ownerId.trim().length === 0) {
    return { ok: false, error: "invalid_input" };
  }
  if (!input.briefId || typeof input.briefId !== "string" || input.briefId.trim().length === 0) {
    return { ok: false, error: "invalid_input" };
  }
  if (!input.targetPattern || typeof input.targetPattern !== "string" || input.targetPattern.trim().length === 0) {
    return { ok: false, error: "invalid_input" };
  }
  if (
    !Array.isArray(input.targetSteps) ||
    input.targetSteps.length < 2 ||
    input.targetSteps.length > 5 ||
    input.targetSteps.some((s) => typeof s !== "string" || s.trim().length === 0)
  ) {
    return { ok: false, error: "invalid_input" };
  }
  if (
    !Array.isArray(input.commonMistakes) ||
    input.commonMistakes.length > 3 ||
    input.commonMistakes.some((m) => typeof m !== "string")
  ) {
    return { ok: false, error: "invalid_input" };
  }
  if (!["detected", "not_detected_or_partial", "skipped"].includes(input.quickCheckStatus)) {
    return { ok: false, error: "invalid_input" };
  }
  if (input.entryPhase !== 1 && input.entryPhase !== 3) {
    return { ok: false, error: "invalid_input" };
  }
  if (!["complete", "partial", "missing"].includes(input.phase1BaselineCompleteness)) {
    return { ok: false, error: "invalid_input" };
  }
  if (typeof input.phase1CompletedPromptCount !== "number" || input.phase1CompletedPromptCount < 0) {
    return { ok: false, error: "invalid_input" };
  }
  if (
    typeof input.phase2Accuracy !== "number" ||
    input.phase2Accuracy < 0 ||
    input.phase2Accuracy > 100
  ) {
    return { ok: false, error: "invalid_input" };
  }
  if (
    typeof input.fullCreditCount !== "number" ||
    input.fullCreditCount < 0 ||
    typeof input.partialCreditCount !== "number" ||
    input.partialCreditCount < 0 ||
    typeof input.noCreditCount !== "number" ||
    input.noCreditCount < 0 ||
    typeof input.evaluatedAttemptCount !== "number" ||
    input.evaluatedAttemptCount < 0 ||
    typeof input.finalFullCreditStreak !== "number" ||
    input.finalFullCreditStreak < 0
  ) {
    return { ok: false, error: "invalid_input" };
  }
  if (!Array.isArray(input.mostMissedSteps) || input.mostMissedSteps.some((s) => typeof s !== "string")) {
    return { ok: false, error: "invalid_input" };
  }
  if (typeof input.simplifiedTopicUsed !== "boolean") {
    return { ok: false, error: "invalid_input" };
  }
  if (!["strong", "emerging", "needs_more_repetition"].includes(input.improvementSignal)) {
    return { ok: false, error: "invalid_input" };
  }
  if (typeof input.nextSessionRecommendation !== "string") {
    return { ok: false, error: "invalid_input" };
  }
  if (input.weaknessUpdate !== null) {
    if (
      typeof input.weaknessUpdate !== "object" ||
      input.weaknessUpdate.category !== "pattern_drill" ||
      typeof input.weaknessUpdate.label !== "string" ||
      typeof input.weaknessUpdate.practiceFocus !== "string"
    ) {
      return { ok: false, error: "invalid_input" };
    }
  }
  if (input.phase3PressureAccuracy !== null) {
    if (
      typeof input.phase3PressureAccuracy !== "number" ||
      input.phase3PressureAccuracy < 0 ||
      input.phase3PressureAccuracy > 100
    ) {
      return { ok: false, error: "invalid_input" };
    }
  }
  if (input.pressureFailRate !== null) {
    if (
      typeof input.pressureFailRate !== "number" ||
      input.pressureFailRate < 0 ||
      input.pressureFailRate > 100
    ) {
      return { ok: false, error: "invalid_input" };
    }
  }

  // Construct a bounded summary object containing only summary metrics
  const savedSummary = {
    phase1BaselineCompleteness: input.phase1BaselineCompleteness,
    phase2Accuracy: input.phase2Accuracy,
    fullCreditCount: input.fullCreditCount,
    partialCreditCount: input.partialCreditCount,
    noCreditCount: input.noCreditCount,
    evaluatedAttemptCount: input.evaluatedAttemptCount,
    finalFullCreditStreak: input.finalFullCreditStreak,
    mostMissedSteps: input.mostMissedSteps,
    simplifiedTopicUsed: input.simplifiedTopicUsed,
    improvementSignal: input.improvementSignal,
    nextSessionRecommendation: input.nextSessionRecommendation,
    weaknessUpdate: input.weaknessUpdate,
    phase3PressureAccuracy: input.phase3PressureAccuracy,
    pressureFailRate: input.pressureFailRate,
  };

  try {
    const { data, error } = await supabaseClient
      .from("pattern_drill_sessions")
      .insert({
        owner_id: input.ownerId,
        brief_id: input.briefId,
        target_pattern: input.targetPattern,
        target_steps: input.targetSteps,
        common_mistakes: input.commonMistakes,
        quick_check_status: input.quickCheckStatus,
        entry_phase: input.entryPhase,
        phase1_baseline_completeness: input.phase1BaselineCompleteness,
        phase1_completed_prompt_count: input.phase1CompletedPromptCount,
        phase2_accuracy: input.phase2Accuracy,
        full_credit_count: input.fullCreditCount,
        partial_credit_count: input.partialCreditCount,
        no_credit_count: input.noCreditCount,
        evaluated_attempt_count: input.evaluatedAttemptCount,
        final_full_credit_streak: input.finalFullCreditStreak,
        most_missed_steps: input.mostMissedSteps,
        simplified_topic_used: input.simplifiedTopicUsed,
        improvement_signal: input.improvementSignal,
        next_session_recommendation: input.nextSessionRecommendation,
        weakness_update: input.weaknessUpdate,
        phase3_pressure_accuracy: input.phase3PressureAccuracy,
        pressure_fail_rate: input.pressureFailRate,
        saved_summary: savedSummary,
      })
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message || "database_insert_failed" };
    }

    return { ok: true, sessionId: data.id };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message || "unknown_error" };
  }
}
