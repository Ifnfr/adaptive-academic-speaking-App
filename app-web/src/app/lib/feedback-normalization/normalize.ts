// src/app/lib/feedback-normalization/normalize.ts
// Pure helper functions to turn loose AI feedback objects into safe FeedbackSignal objects.
// No side‑effects, no storage, no UI, no route integration.

import type {
  FeedbackSignal,
  FeedbackSignalCategory,
  FeedbackSignalConfidence,
  FeedbackSignalSeverity,
  FeedbackSignalLearnerLevel,
  FeedbackSignalSourceSurface,
} from "./types";

/**
 * Convert a raw numeric score (0‑1 or 0‑100) to a 0‑1 range.
 * Returns NaN for non‑numeric or out‑of‑range values.
 */
export function normalizeScoreValue(value: unknown): number {
  if (typeof value === "number") {
    // 0‑100 range
    if (value > 1) return value / 100;
    // Already 0‑1
    if (value >= 0 && value <= 1) return value;
  }
  return NaN;
}

/**
 * Map a normalized score (0‑1) to severity and confidence.
 * Invalid (NaN) scores result in light severity and low confidence.
 */
export function mapScoreToSeverity(
  score: number
): { severity: FeedbackSignalSeverity; confidence: FeedbackSignalConfidence } {
  if (Number.isNaN(score)) {
    return { severity: "light", confidence: "low" };
  }
  if (score >= 0.75) return { severity: "light", confidence: "high" };
  if (score >= 0.45) return { severity: "medium", confidence: "high" };
  return { severity: "strong", confidence: "high" };
}

/**
 * Very small deterministic keyword‑based classifier.
 * Returns a category and confidence level.
 */
export function classifyFeedbackText(
  text: unknown
): { category: FeedbackSignalCategory; confidence: FeedbackSignalConfidence } {
  if (!text || typeof text !== "string") {
    return { category: "clarity", confidence: "low" };
  }
  const lowered = text.toLowerCase();
  const keywordMap: Record<FeedbackSignalCategory, string[]> = {
    fluency: ["pause", "slow", "stop", "hesitate", "flow"],
    clarity: ["unclear", "hard to understand"],
    structure: ["order", "organize", "opening", "conclusion"],
    grammar: ["tense", "verb", "grammar", "sentence complete"],
    vocabulary: ["word choice", "repeated word", "vocabulary"],
    coherence: ["transition", "connect ideas", "flow"],
    support: ["reason", "example", "evidence", "explain"],
    academicTone: ["formal", "academic", "concise"],
    taskCompletion: ["answer prompt", "task", "instruction"],
    confidenceHabit: ["start speaking", "continue", "confidence", "short attempt"],
  };
  for (const [cat, keys] of Object.entries(keywordMap) as [FeedbackSignalCategory, string[]][]) {
    for (const kw of keys) {
      if (lowered.includes(kw)) {
        return { category: cat, confidence: "high" };
      }
    }
  }
  // Fallback – ambiguous or unknown text
  return { category: "clarity", confidence: "low" };
}

/**
 * Build a safe FeedbackSignal object using ONLY whitelisted fields.
 * Anything missing is filled with sensible defaults.
 */
export function buildSafeFeedbackSignal(params: {
  category: FeedbackSignalCategory;
  severity: FeedbackSignalSeverity;
  confidence: FeedbackSignalConfidence;
  learnerLevel?: FeedbackSignalLearnerLevel;
  sourceSurface: FeedbackSignalSourceSurface;
  safeLabel: string;
  safeSummary: string;
  recommendedActionId?: string;
}): FeedbackSignal {
  const {
    category,
    severity,
    confidence,
    learnerLevel = "Foundation",
    sourceSurface,
    safeLabel,
    safeSummary,
    recommendedActionId = `practice-${category}-${learnerLevel}`,
  } = params;

  return {
    version: 1,
    category,
    severity,
    confidence,
    learnerLevel,
    sourceSurface,
    safeLabel,
    safeSummary,
    recommendedActionId,
    createdAt: new Date().toISOString(),
  };
}

// Helper to safely extract learnerLevel without any
function getLearnerLevel(obj: Record<string, unknown>): FeedbackSignalLearnerLevel | undefined {
  const lvl = obj["learnerLevel"];
  if (typeof lvl === "string" && ["Foundation", "Beginner", "Intermediate", "Advanced", "Expert"].includes(lvl)) {
    return lvl as FeedbackSignalLearnerLevel;
  }
  return undefined;
}

/**
 * Normalize a generic scores object into a single FeedbackSignal.
 * The raw object may contain any of the supported score keys.
 */
export function normalizeFeedbackScores(
  raw: unknown,
  sourceSurface: FeedbackSignalSourceSurface,
  learnerLevel?: FeedbackSignalLearnerLevel
): FeedbackSignal {
  const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const scoreKeyMap: Record<string, FeedbackSignalCategory> = {
    fluency: "fluency",
    grammar: "grammar",
    vocabulary: "vocabulary",
    coherence: "coherence",
    argument: "support",
    academicTone: "academicTone",
  };

  // Find first present score key (deterministic order via Object.keys)
  for (const [key, category] of Object.entries(scoreKeyMap)) {
    if (key in obj) {
      const rawScore = normalizeScoreValue(obj[key]);
      const { severity, confidence } = mapScoreToSeverity(rawScore);
      const safeLabel = `${category.charAt(0).toUpperCase() + category.slice(1)} focus`;
      const safeSummary = `Focus on improving ${category} based on recent practice.`;
      return buildSafeFeedbackSignal({
        category,
        severity,
        confidence,
        learnerLevel,
        sourceSurface,
        safeLabel,
        safeSummary,
      });
    }
  }
  // No recognizable score – fallback
  return buildSafeFeedbackSignal({
    category: "clarity",
    severity: "light",
    confidence: "low",
    learnerLevel,
    sourceSurface,
    safeLabel: "General speaking focus",
    safeSummary: "Review one small speaking focus from your latest practice.",
  });
}

/**
 * Helper that extracts a deterministic recommendedActionId.
 */
function deterministicActionId(
  category: FeedbackSignalCategory,
  learnerLevel?: FeedbackSignalLearnerLevel
): string {
  const level = learnerLevel ?? "Foundation";
  return `practice-${category}-${level}`;
}

/**
 * Normalizers for each source surface. They all follow the same pattern:
 *   1. Pull scores (if present) via normalizeFeedbackScores.
 *   2. Optionally classify free‑form text fields (mainWeakness, etc.) using classifyFeedbackText.
 *   3. Build a safe FeedbackSignal using only whitelisted fields.
 */
export function normalizeActiveFeedbackSignal(
  raw: unknown
): FeedbackSignal {
  const source: FeedbackSignalSourceSurface = "active-feedback";
  const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  // Prefer explicit scores, otherwise fall back to text classification.
  if (obj.scores && typeof obj.scores === "object") {
    return normalizeFeedbackScores(obj.scores, source, getLearnerLevel(obj as Record<string, unknown>));
  }
  const text = (typeof (obj as Record<string, unknown>)['mainWeakness'] === "string" ? (obj as Record<string, unknown>)['mainWeakness'] as string : "");
  const { category, confidence } = classifyFeedbackText(text);
  const { severity } = mapScoreToSeverity(NaN); // No score – use fallback severity (light)
  return buildSafeFeedbackSignal({
    category,
    severity,
    confidence,
    learnerLevel: getLearnerLevel(obj as Record<string, unknown>),
    sourceSurface: source,
    safeLabel: `${category.charAt(0).toUpperCase() + category.slice(1)} focus`,
    safeSummary: `Focus on improving ${category} based on recent practice.`,
    recommendedActionId: deterministicActionId(category, getLearnerLevel(obj as Record<string, unknown>) ?? "Foundation"),
  });
}

export function normalizeDiagnosticSignal(raw: unknown): FeedbackSignal {
  const source: FeedbackSignalSourceSurface = "diagnostic";
  const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  if (obj.scores && typeof obj.scores === "object") {
    return normalizeFeedbackScores(obj.scores, source, getLearnerLevel(obj as Record<string, unknown>));
  }
  // Diagnostic may contain a "summary" field with free text.
  const text = (typeof (obj as Record<string, unknown>)['summary'] === "string" ? (obj as Record<string, unknown>)['summary'] as string : "");
  const { category, confidence } = classifyFeedbackText(text);
  const { severity } = mapScoreToSeverity(NaN);
  return buildSafeFeedbackSignal({
    category,
    severity,
    confidence,
    learnerLevel: getLearnerLevel(obj as Record<string, unknown>),
    sourceSurface: source,
    safeLabel: `${category.charAt(0).toUpperCase() + category.slice(1)} focus`,
    safeSummary: `Diagnostic suggests working on ${category}.`,
    recommendedActionId: deterministicActionId(category, getLearnerLevel(obj as Record<string, unknown>) ?? "Foundation"),
  });
}

export function normalizeWeeklyReviewSignal(raw: unknown): FeedbackSignal {
  const source: FeedbackSignalSourceSurface = "weekly-review";
  const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  if (obj.scores && typeof obj.scores === "object") {
    return normalizeFeedbackScores(obj.scores, source, getLearnerLevel(obj as Record<string, unknown>));
  }
  const text = (typeof (obj as Record<string, unknown>)['nextWeekFocus'] === "string" ? (obj as Record<string, unknown>)['nextWeekFocus'] as string : "");
  const { category, confidence } = classifyFeedbackText(text);
  const { severity } = mapScoreToSeverity(NaN);
  return buildSafeFeedbackSignal({
    category,
    severity,
    confidence,
    learnerLevel: getLearnerLevel(obj as Record<string, unknown>),
    sourceSurface: source,
    safeLabel: `${category.charAt(0).toUpperCase() + category.slice(1)} focus`,
    safeSummary: `Weekly review suggests practicing ${category}.`,
    recommendedActionId: deterministicActionId(category, getLearnerLevel(obj as Record<string, unknown>) ?? "Foundation"),
  });
}

export function normalizeVocabularyCorrectionSignal(raw: unknown): FeedbackSignal {
  const source: FeedbackSignalSourceSurface = "vocabulary-correction";
  const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  // Vocabulary corrections usually provide a score object similar to other surfaces.
  if (obj.scores && typeof obj.scores === "object") {
    return normalizeFeedbackScores(obj.scores, source, getLearnerLevel(obj as Record<string, unknown>));
  }
  // Fall back to any free‑form feedback text.
  const text = (typeof (obj as Record<string, unknown>)['feedback'] === "string" ? (obj as Record<string, unknown>)['feedback'] as string : "");
  const { category, confidence } = classifyFeedbackText(text);
  const { severity } = mapScoreToSeverity(NaN);
  return buildSafeFeedbackSignal({
    category,
    severity,
    confidence,
    learnerLevel: getLearnerLevel(obj as Record<string, unknown>),
    sourceSurface: source,
    safeLabel: `${category.charAt(0).toUpperCase() + category.slice(1)} focus`,
    safeSummary: `Vocabulary correction highlights ${category}.`,
    recommendedActionId: deterministicActionId(category, getLearnerLevel(obj as Record<string, unknown>) ?? "Foundation"),
  });
}
