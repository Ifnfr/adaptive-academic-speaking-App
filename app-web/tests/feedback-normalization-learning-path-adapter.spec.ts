// tests/feedback-normalization-learning-path-adapter.spec.ts
import { test, expect } from "@playwright/test";
import {
  mapFeedbackCategoryToCardType,
  getPriorityFromCount,
  getLearningPathHintForCategory,
  getLearningPathHintsFromSummary,
  getPrimaryLearningPathHint,
} from "../src/app/lib/feedback-normalization/learning-path-adapter";
import type {
  FeedbackSignalCategory,
  FeedbackSignalSummary,
} from "../src/app/lib/feedback-normalization/types";

test.describe("Learning Path Recommendation Adapter", () => {
  const categories: FeedbackSignalCategory[] = [
    "fluency",
    "clarity",
    "structure",
    "grammar",
    "vocabulary",
    "coherence",
    "support",
    "academicTone",
    "taskCompletion",
    "confidenceHabit",
  ];

  test("each feedback category maps to an approved card type", () => {
    const approvedCardTypes = [
      "guided-word",
      "phrase-pattern",
      "sentence-builder",
      "micro-speaking",
      "weekly-checkpoint",
    ];

    for (const cat of categories) {
      const cardType = mapFeedbackCategoryToCardType(cat);
      expect(approvedCardTypes).toContain(cardType);
    }
  });

  test("priority derives deterministically from counts", () => {
    expect(getPriorityFromCount(0)).toBe("low");
    expect(getPriorityFromCount(1)).toBe("low");
    expect(getPriorityFromCount(2)).toBe("medium");
    expect(getPriorityFromCount(3)).toBe("high");
    expect(getPriorityFromCount(10)).toBe("high");
  });

  test("empty summary returns no hints / null primary hint", () => {
    const emptySummary: FeedbackSignalSummary = {
      version: 1,
      window: "all-local",
      topCategories: [],
      countsByCategory: {},
      recommendedNextActionId: null,
      lastUpdatedAt: "2026-05-30T12:00:00.000Z",
    };

    const hints = getLearningPathHintsFromSummary(emptySummary);
    expect(hints).toEqual([]);

    const primary = getPrimaryLearningPathHint(emptySummary);
    expect(primary).toBeNull();
  });

  test("topCategories produce ordered hints based on topCategories list order", () => {
    const summary: FeedbackSignalSummary = {
      version: 1,
      window: "all-local",
      topCategories: ["grammar", "fluency", "coherence"],
      countsByCategory: {
        grammar: 3,
        fluency: 2,
        coherence: 1,
      },
      recommendedNextActionId: "practice-grammar-Intermediate",
      lastUpdatedAt: "2026-05-30T12:00:00.000Z",
    };

    const hints = getLearningPathHintsFromSummary(summary);
    expect(hints.length).toBe(3);
    expect(hints[0].category).toBe("grammar");
    expect(hints[0].priority).toBe("high");
    expect(hints[1].category).toBe("fluency");
    expect(hints[1].priority).toBe("medium");
    expect(hints[2].category).toBe("coherence");
    expect(hints[2].priority).toBe("low");

    const primary = getPrimaryLearningPathHint(summary);
    expect(primary).not.toBeNull();
    expect(primary?.category).toBe("grammar");
    expect(primary?.priority).toBe("high");
  });

  test("safeReason and safeInstruction are supportive and lack harsh/clinical terminology", () => {
    const harshWords = [
      "weakness",
      "failure",
      "bad speaker",
      "poor",
      "clinical",
      "psychological",
      "error",
      "mistake",
      "wrong",
      "patient",
      "disorder",
    ];

    for (const cat of categories) {
      const hint = getLearningPathHintForCategory(cat, 1);
      expect(hint.safeReason.length).toBeGreaterThan(0);
      expect(hint.safeInstruction.length).toBeGreaterThan(0);

      for (const word of harshWords) {
        expect(hint.safeReason.toLowerCase()).not.toContain(word);
        expect(hint.safeInstruction.toLowerCase()).not.toContain(word);
      }
    }
  });

  test("adapter does not mutate input summary", () => {
    const summary: FeedbackSignalSummary = {
      version: 1,
      window: "all-local",
      topCategories: ["grammar"],
      countsByCategory: { grammar: 1 },
      recommendedNextActionId: "practice-grammar-Intermediate",
      lastUpdatedAt: "2026-05-30T12:00:00.000Z",
    };

    const frozenSummary = Object.freeze({
      ...summary,
      topCategories: Object.freeze([...summary.topCategories]),
      countsByCategory: Object.freeze({ ...summary.countsByCategory }),
    });

    expect(() => {
      getLearningPathHintsFromSummary(frozenSummary as FeedbackSignalSummary);
      getPrimaryLearningPathHint(frozenSummary as FeedbackSignalSummary);
    }).not.toThrow();
  });

  test("serialized output has no forbidden private fields", () => {
    const allowedHintKeys = [
      "category",
      "suggestedCardType",
      "priority",
      "safeReason",
      "safeInstruction",
    ];

    const hint = getLearningPathHintForCategory("grammar", 3);

    // Verify allowed fields only
    const keys = Object.keys(hint);
    for (const key of keys) {
      expect(allowedHintKeys).toContain(key);
    }

    // Verify serialization contains zero forbidden terms
    const serialized = JSON.stringify(hint);
    const forbiddenPatterns = [
      "transcript",
      "email",
      "owner",
      "source",
      "@",
      "CSV",
      "provider",
      "prompt",
    ];
    for (const pat of forbiddenPatterns) {
      expect(serialized).not.toContain(pat);
    }
  });
});
