import { test, expect } from "@playwright/test";
import { evaluateThresholds } from "../../src/lib/word-builder/thresholds";
import type { UserMetrics, ErrorCategory } from "../../src/lib/word-builder/metrics";

/**
 * Word Builder — Metrics & Thresholds Unit Tests
 */

function makeMetrics(overrides: Partial<UserMetrics> = {}): UserMetrics {
  return {
    userId: "test-user",
    totalSessions: 10,
    totalSentencesProduced: 80,
    totalErrorsResolved: 45,
    categories: [
      { category: "auxiliary_verb", errorRate: 0.3, autonomousCorrectionRate: 0.5, echoTransferRate: 0.8, hintDependencyScore: 1.2, trend: "stable", occurrences: 10 },
      { category: "subject_verb_agreement", errorRate: 0.5, autonomousCorrectionRate: 0.3, echoTransferRate: 0.6, hintDependencyScore: 1.8, trend: "improving", occurrences: 15 },
      { category: "tense", errorRate: 0.1, autonomousCorrectionRate: 0.7, echoTransferRate: 0.9, hintDependencyScore: 0.5, trend: "stable", occurrences: 5 },
      { category: "article", errorRate: 0.05, autonomousCorrectionRate: 0.8, echoTransferRate: 0.95, hintDependencyScore: 0.3, trend: "stable", occurrences: 3 },
      { category: "preposition", errorRate: 0.03, autonomousCorrectionRate: 0.9, echoTransferRate: 0.9, hintDependencyScore: 0.2, trend: "stable", occurrences: 2 },
      { category: "word_order", errorRate: 0.01, autonomousCorrectionRate: 0.95, echoTransferRate: 1.0, hintDependencyScore: 0.1, trend: "stable", occurrences: 1 },
      { category: "verb_form", errorRate: 0.01, autonomousCorrectionRate: 0.9, echoTransferRate: 0.85, hintDependencyScore: 0.4, trend: "stable", occurrences: 1 },
    ],
    weakestCategory: "subject_verb_agreement",
    dataInsufficient: false,
    calculatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test.describe("evaluateThresholds", () => {
  test("returns boostCategories for categories with errorRate > 0.40", () => {
    const metrics = makeMetrics();
    const decisions = evaluateThresholds(metrics);
    expect(decisions.boostCategories).toContain("subject_verb_agreement");
    expect(decisions.boostCategories).not.toContain("auxiliary_verb");
  });

  test("returns ruleCardCategories for categories with hintDependencyScore > 1.5", () => {
    const metrics = makeMetrics();
    const decisions = evaluateThresholds(metrics);
    expect(decisions.ruleCardCategories).toContain("subject_verb_agreement");
    expect(decisions.ruleCardCategories).not.toContain("tense");
  });

  test("semiFreeModeUnlocked requires all echoTransferRate > 0.70", () => {
    const metrics = makeMetrics();
    const decisions = evaluateThresholds(metrics);
    // subject_verb_agreement has echoTransferRate 0.6 < 0.70
    expect(decisions.semiFreeModeUnlocked).toBe(false);

    // Fix the low one
    const fixed = makeMetrics();
    fixed.categories = fixed.categories.map((c) =>
      c.category === "subject_verb_agreement" ? { ...c, echoTransferRate: 0.75 } : c
    );
    expect(evaluateThresholds(fixed).semiFreeModeUnlocked).toBe(true);
  });

  test("transferTestModeUnlocked requires all echoTransferRate > 0.85 AND autonomousCorrectionRate > 0.60", () => {
    const highMetrics = makeMetrics({
      categories: [
        { category: "auxiliary_verb", errorRate: 0.1, autonomousCorrectionRate: 0.7, echoTransferRate: 0.9, hintDependencyScore: 0.5, trend: "stable", occurrences: 5 },
        { category: "subject_verb_agreement", errorRate: 0.1, autonomousCorrectionRate: 0.65, echoTransferRate: 0.9, hintDependencyScore: 0.5, trend: "stable", occurrences: 5 },
        { category: "tense", errorRate: 0.1, autonomousCorrectionRate: 0.7, echoTransferRate: 0.9, hintDependencyScore: 0.5, trend: "stable", occurrences: 5 },
        { category: "article", errorRate: 0.1, autonomousCorrectionRate: 0.7, echoTransferRate: 0.9, hintDependencyScore: 0.5, trend: "stable", occurrences: 5 },
        { category: "preposition", errorRate: 0.1, autonomousCorrectionRate: 0.7, echoTransferRate: 0.9, hintDependencyScore: 0.5, trend: "stable", occurrences: 5 },
        { category: "word_order", errorRate: 0.1, autonomousCorrectionRate: 0.7, echoTransferRate: 0.9, hintDependencyScore: 0.5, trend: "stable", occurrences: 5 },
        { category: "verb_form", errorRate: 0.1, autonomousCorrectionRate: 0.7, echoTransferRate: 0.9, hintDependencyScore: 0.5, trend: "stable", occurrences: 5 },
      ],
      weakestCategory: null,
    });
    expect(evaluateThresholds(highMetrics).transferTestModeUnlocked).toBe(true);
  });

  test("empty boost/ruleCards when dataInsufficient is true", () => {
    const metrics = makeMetrics({ dataInsufficient: true });
    const decisions = evaluateThresholds(metrics);
    expect(decisions.boostCategories).toEqual([]);
    expect(decisions.ruleCardCategories).toEqual([]);
    expect(decisions.semiFreeModeUnlocked).toBe(false);
    expect(decisions.transferTestModeUnlocked).toBe(false);
  });

  test("deteriorationBoostActive when deteriorating categories exist", () => {
    const metrics = makeMetrics();
    metrics.categories[0] = { ...metrics.categories[0], trend: "deteriorating" };
    expect(evaluateThresholds(metrics).deteriorationBoostActive).toBe(true);
  });
});
