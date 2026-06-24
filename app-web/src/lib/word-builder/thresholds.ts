// =============================================================================
// app-web/src/lib/word-builder/thresholds.ts
// Threshold engine: evaluates UserMetrics and returns ThresholdDecisions
// that affect prompt selection for the next session.
// Does NOT call any AI API or database. Pure computation over UserMetrics.
// =============================================================================

import type { UserMetrics, ErrorCategory } from "./metrics";

export interface ThresholdDecisions {
  // Categories that need more prompts (error rate > 40%)
  boostCategories: ErrorCategory[];

  // Categories that need a Rule Card before session (hint dependency > 1.5)
  ruleCardCategories: ErrorCategory[];

  // Whether semi-free prompts are unlocked
  semiFreeModeUnlocked: boolean;

  // Whether transfer test prompts are unlocked
  transferTestModeUnlocked: boolean;

  // Categories that are deteriorating
  deterioratingCategories: ErrorCategory[];

  // Overall session boost multiplier for deteriorating categories
  deteriorationBoostActive: boolean;
}

export function evaluateThresholds(metrics: UserMetrics): ThresholdDecisions {
  const { categories, dataInsufficient } = metrics;

  // -------------------------------------------------------------------------
  // boostCategories — errorRate > 0.40
  // -------------------------------------------------------------------------
  const boostCategories: ErrorCategory[] = dataInsufficient
    ? []
    : categories
        .filter((c) => c.errorRate > 0.40)
        .map((c) => c.category);

  // -------------------------------------------------------------------------
  // ruleCardCategories — hintDependencyScore > 1.5
  // -------------------------------------------------------------------------
  const ruleCardCategories: ErrorCategory[] = dataInsufficient
    ? []
    : categories
        .filter((c) => c.hintDependencyScore > 1.5)
        .map((c) => c.category);

  // -------------------------------------------------------------------------
  // semiFreeModeUnlocked
  // Requires: data sufficient, echoTransferRate > 0.70 for ALL 7 categories,
  // and at least 1 category has occurrences > 0
  // -------------------------------------------------------------------------
  const hasOccurrences = categories.some((c) => c.occurrences > 0);
  const allEchoAbove70 = categories.every((c) => c.echoTransferRate > 0.70);

  const semiFreeModeUnlocked =
    !dataInsufficient && allEchoAbove70 && hasOccurrences;

  // -------------------------------------------------------------------------
  // transferTestModeUnlocked
  // Requires: data sufficient, semiFreeModeUnlocked, echoTransferRate > 0.85
  // for ALL 7 categories, and autonomousCorrectionRate > 0.60 for ALL 7
  // -------------------------------------------------------------------------
  const allEchoAbove85 = categories.every((c) => c.echoTransferRate > 0.85);
  const allAutonomousAbove60 = categories.every(
    (c) => c.autonomousCorrectionRate > 0.60
  );

  const transferTestModeUnlocked =
    !dataInsufficient &&
    semiFreeModeUnlocked &&
    allEchoAbove85 &&
    allAutonomousAbove60;

  // -------------------------------------------------------------------------
  // deterioratingCategories — trend === "deteriorating"
  // -------------------------------------------------------------------------
  const deterioratingCategories: ErrorCategory[] = dataInsufficient
    ? []
    : categories
        .filter((c) => c.trend === "deteriorating")
        .map((c) => c.category);

  // -------------------------------------------------------------------------
  // deteriorationBoostActive
  // -------------------------------------------------------------------------
  const deteriorationBoostActive = deterioratingCategories.length > 0;

  return {
    boostCategories,
    ruleCardCategories,
    semiFreeModeUnlocked,
    transferTestModeUnlocked,
    deterioratingCategories,
    deteriorationBoostActive,
  };
}
