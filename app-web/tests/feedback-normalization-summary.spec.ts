// tests/feedback-normalization-summary.spec.ts
import { test, expect } from "@playwright/test";
import {
  buildFeedbackSignalSummary,
  countSignalsByCategory,
  getTopFeedbackCategories,
  getRecommendedNextActionId,
  filterSignalsByWindow,
} from "../src/app/lib/feedback-normalization/summary";
import type {
  FeedbackSignal,
  FeedbackSignalCategory,
  FeedbackSignalLearnerLevel,
} from "../src/app/lib/feedback-normalization/types";

test.describe("Feedback Signal Summary Aggregator", () => {
  // A helper function to create mock FeedbackSignal objects cleanly
  const createMockSignal = (
    category: string,
    createdAt: string,
    learnerLevel: string = "Intermediate"
  ): FeedbackSignal => {
    return {
      version: 1,
      category: category as unknown as FeedbackSignalCategory,
      severity: "light",
      confidence: "high",
      learnerLevel: learnerLevel as unknown as FeedbackSignalLearnerLevel,
      sourceSurface: "active-feedback",
      safeLabel: `${category} focus`,
      safeSummary: `Review ${category}`,
      recommendedActionId: `practice-${category}-${learnerLevel}`,
      createdAt,
    };
  };

  test("empty signal list returns safe zero-count summary", () => {
    const summary = buildFeedbackSignalSummary([], "all-local", "2026-05-30T12:00:00Z");

    expect(summary.version).toBe(1);
    expect(summary.window).toBe("all-local");
    expect(summary.topCategories).toEqual([]);
    expect(summary.recommendedNextActionId).toBeNull();
    expect(summary.lastUpdatedAt).toBe("2026-05-30T12:00:00.000Z");

    const categories = Object.keys(summary.countsByCategory);
    expect(categories.length).toBe(10);
    for (const val of Object.values(summary.countsByCategory)) {
      expect(val).toBe(0);
    }
  });

  test("countsByCategory includes all approved categories with zero counts when not present", () => {
    const signals = [
      createMockSignal("grammar", "2026-05-30T10:00:00Z"),
      createMockSignal("grammar", "2026-05-30T11:00:00Z"),
      createMockSignal("fluency", "2026-05-30T09:00:00Z"),
    ];

    const counts = countSignalsByCategory(signals);
    expect(counts.grammar).toBe(2);
    expect(counts.fluency).toBe(1);
    expect(counts.clarity).toBe(0);
    expect(counts.structure).toBe(0);
    expect(counts.vocabulary).toBe(0);
    expect(counts.coherence).toBe(0);
    expect(counts.support).toBe(0);
    expect(counts.academicTone).toBe(0);
    expect(counts.taskCompletion).toBe(0);
    expect(counts.confidenceHabit).toBe(0);
  });

  test("topCategories are sorted by count descending", () => {
    const signals = [
      createMockSignal("grammar", "2026-05-30T10:00:00Z"),
      createMockSignal("grammar", "2026-05-30T11:00:00Z"),
      createMockSignal("fluency", "2026-05-30T09:00:00Z"),
      createMockSignal("coherence", "2026-05-30T08:00:00Z"),
      createMockSignal("coherence", "2026-05-30T07:00:00Z"),
      createMockSignal("coherence", "2026-05-30T06:00:00Z"),
    ];

    const top = getTopFeedbackCategories(signals);
    // coherence (3) -> grammar (2) -> fluency (1)
    expect(top).toEqual(["coherence", "grammar", "fluency"]);
  });

  test("tie-breakers are deterministic by taxonomy order", () => {
    // Both grammar and fluency have count = 2
    // Taxonomy order: fluency is before grammar in FEEDBACK_SIGNAL_CATEGORIES
    const signals = [
      createMockSignal("grammar", "2026-05-30T10:00:00Z"),
      createMockSignal("grammar", "2026-05-30T11:00:00Z"),
      createMockSignal("fluency", "2026-05-30T09:00:00Z"),
      createMockSignal("fluency", "2026-05-30T08:00:00Z"),
    ];

    const top = getTopFeedbackCategories(signals);
    expect(top).toEqual(["fluency", "grammar"]);
  });

  test("latest window summarizes only the newest signal", () => {
    const signals = [
      createMockSignal("grammar", "2026-05-30T09:00:00Z"),
      createMockSignal("fluency", "2026-05-30T10:00:00Z"), // Newest
      createMockSignal("coherence", "2026-05-30T08:00:00Z"),
    ];

    const summary = buildFeedbackSignalSummary(signals, "latest");
    expect(summary.topCategories).toEqual(["fluency"]);
    expect(summary.countsByCategory.fluency).toBe(1);
    expect(summary.countsByCategory.grammar).toBe(0);
    expect(summary.lastUpdatedAt).toBe("2026-05-30T10:00:00Z");
  });

  test("7-day window excludes old signals", () => {
    const now = "2026-05-30T12:00:00Z";
    const signals = [
      createMockSignal("grammar", "2026-05-29T12:00:00Z"), // 1 day ago (included)
      createMockSignal("fluency", "2026-05-23T12:00:00Z"), // 7 days ago (included)
      createMockSignal("coherence", "2026-05-22T12:00:00Z"), // 8 days ago (excluded)
    ];

    const summary = buildFeedbackSignalSummary(signals, "7-day", now);
    expect(summary.topCategories).toEqual(["fluency", "grammar"]);
    expect(summary.countsByCategory.grammar).toBe(1);
    expect(summary.countsByCategory.fluency).toBe(1);
    expect(summary.countsByCategory.coherence).toBe(0);
    expect(summary.lastUpdatedAt).toBe("2026-05-29T12:00:00Z"); // Latest of the included signals
  });

  test("all-local window summarizes all signals", () => {
    const signals = [
      createMockSignal("grammar", "2026-05-29T12:00:00Z"),
      createMockSignal("fluency", "2026-05-23T12:00:00Z"),
      createMockSignal("coherence", "2026-05-01T12:00:00Z"), // very old
    ];

    const summary = buildFeedbackSignalSummary(signals, "all-local");
    expect(summary.topCategories).toEqual(["fluency", "grammar", "coherence"]);
    expect(summary.countsByCategory.coherence).toBe(1);
  });

  test("recommendedNextActionId is deterministic and matches top category and learner level", () => {
    const signals = [
      createMockSignal("grammar", "2026-05-30T10:00:00Z", "Advanced"),
      createMockSignal("grammar", "2026-05-30T09:00:00Z", "Beginner"),
    ];

    const summary = buildFeedbackSignalSummary(signals, "all-local");
    // Newest grammar signal is "Advanced", so output ID should be practice-grammar-Advanced
    expect(summary.recommendedNextActionId).toBe("practice-grammar-Advanced");
  });

  test("recommendedNextActionId returns null when no signals exist", () => {
    const id = getRecommendedNextActionId([], []);
    expect(id).toBeNull();
  });

  test("lastUpdatedAt uses latest included signal timestamp", () => {
    const signals = [
      createMockSignal("grammar", "2026-05-30T09:00:00Z"),
      createMockSignal("coherence", "2026-05-30T11:00:00Z"), // Latest
      createMockSignal("fluency", "2026-05-30T10:00:00Z"),
    ];

    const summary = buildFeedbackSignalSummary(signals, "all-local");
    expect(summary.lastUpdatedAt).toBe("2026-05-30T11:00:00Z");
  });

  test("helpers do not mutate input arrays or signals", () => {
    const signals = [
      createMockSignal("grammar", "2026-05-30T09:00:00Z"),
      createMockSignal("coherence", "2026-05-30T11:00:00Z"),
    ];
    const signalsFreeze = Object.freeze([...signals].map(s => Object.freeze(s)));

    expect(() => {
      filterSignalsByWindow(signalsFreeze as FeedbackSignal[], "all-local");
      countSignalsByCategory(signalsFreeze as FeedbackSignal[]);
      getTopFeedbackCategories(signalsFreeze as FeedbackSignal[]);
      buildFeedbackSignalSummary(signalsFreeze as FeedbackSignal[], "all-local");
    }).not.toThrow();
  });

  test("serialized summary contains no forbidden private fields", () => {
    // Ensure that even if a signal had mock unwhitelisted fields, the summary only has safe fields
    const allowedSummaryKeys = [
      "version",
      "window",
      "topCategories",
      "countsByCategory",
      "recommendedNextActionId",
      "lastUpdatedAt",
    ];

    const signals = [
      createMockSignal("grammar", "2026-05-30T09:00:00Z"),
    ];

    // Add extra forbidden properties to one of the signals via unknown cast
    const dirtySignal = {
      ...signals[0],
      userEmail: "learner@example.com",
      ownerId: "user_123",
      transcript: "User spoken transcript",
      privateNotes: "clinical observations",
    };

    const summary = buildFeedbackSignalSummary([dirtySignal], "all-local");
    
    // Check summary keys
    const summaryKeys = Object.keys(summary);
    for (const key of summaryKeys) {
      expect(allowedSummaryKeys).toContain(key);
    }

    // String check
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain("learner@example.com");
    expect(serialized).not.toContain("user_123");
    expect(serialized).not.toContain("transcript");
    expect(serialized).not.toContain("clinical");
  });
});
