// tests/feedback-normalization-retry-actions.spec.ts
import { test, expect } from "@playwright/test";
import {
  buildRecommendedActionId,
  getSafeRetryInstruction,
  getSafeRetryTitle,
  getEstimatedMinutes,
  getRetryActionForCategory,
  getRetryActionForSignal,
} from "../src/app/lib/feedback-normalization/retry-actions";
import type {
  FeedbackSignalCategory,
  FeedbackSignalLearnerLevel,
} from "../src/app/lib/feedback-normalization/types";

test.describe("Feedback Retry Action Mapper", () => {
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

  const levels: FeedbackSignalLearnerLevel[] = [
    "Foundation",
    "Beginner",
    "Intermediate",
    "Advanced",
    "Expert",
  ];

  test("action IDs are deterministic and format is practice-{category}-{level}", () => {
    for (const cat of categories) {
      for (const lvl of levels) {
        const id = buildRecommendedActionId(cat, lvl);
        expect(id).toBe(`practice-${cat}-${lvl}`);
        // Ensure no random generation
        const id2 = buildRecommendedActionId(cat, lvl);
        expect(id).toBe(id2);
      }
    }
  });

  test("each category maps to supportive title and instructions", () => {
    for (const cat of categories) {
      const title = getSafeRetryTitle(cat);
      const instruction = getSafeRetryInstruction(cat, "Foundation");

      // Verify title is non-empty and friendly
      expect(title.length).toBeGreaterThan(0);
      expect(instruction.length).toBeGreaterThan(0);

      // Avoid harsh terms
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
      ];
      for (const word of harshWords) {
        expect(title.toLowerCase()).not.toContain(word);
        expect(instruction.toLowerCase()).not.toContain(word);
      }
    }
  });

  test("each learner level works and has level-specific guidance or fallback", () => {
    for (const cat of categories) {
      const fndInstruction = getSafeRetryInstruction(cat, "Foundation");
      const advInstruction = getSafeRetryInstruction(cat, "Advanced");
      const expInstruction = getSafeRetryInstruction(cat, "Expert");

      // Verify level-specific guidance exists and differs
      expect(fndInstruction).toContain("one word or phrase");
      expect(advInstruction).toContain("academic precision");
      expect(expInstruction).toContain("academic precision");
    }
  });

  test("getEstimatedMinutes adjusts by category and level", () => {
    // Structure/support should be higher
    expect(getEstimatedMinutes("structure", "Foundation")).toBe(3);
    expect(getEstimatedMinutes("support", "Foundation")).toBe(3);
    expect(getEstimatedMinutes("confidenceHabit", "Foundation")).toBe(1);

    // Advanced levels should add 1 minute
    expect(getEstimatedMinutes("fluency", "Foundation")).toBe(2);
    expect(getEstimatedMinutes("fluency", "Advanced")).toBe(3);
    expect(getEstimatedMinutes("fluency", "Expert")).toBe(3);
  });

  test("getRetryActionForCategory builds a complete safe recommended action", () => {
    const action = getRetryActionForCategory("grammar", "Intermediate");
    expect(action).toEqual({
      id: "practice-grammar-Intermediate",
      category: "grammar",
      learnerLevel: "Intermediate",
      title: "Sentence builder practice",
      instruction: "Try a subject and verb sentence practice. Focus on building a reliable and clear sentence pattern. Focus on speaking clearly and connecting your ideas smoothly.",
      estimatedMinutes: 2,
    });
  });

  test("getRetryActionForSignal handles missing fields and uses safe fallbacks", () => {
    // Null/undefined signal input
    const action1 = getRetryActionForSignal(null);
    expect(action1.category).toBe("clarity");
    expect(action1.learnerLevel).toBe("Foundation");

    // Signal with invalid category and level
    const action2 = getRetryActionForSignal({ category: "invalid-cat", learnerLevel: "invalid-lvl" });
    expect(action2.category).toBe("clarity");
    expect(action2.learnerLevel).toBe("Foundation");
    expect(action2.id).toBe("practice-clarity-Foundation");
  });

  test("output has no forbidden private fields", () => {
    const allowedKeys = [
      "id",
      "category",
      "learnerLevel",
      "title",
      "instruction",
      "estimatedMinutes",
    ];

    const rawSignal = {
      category: "fluency" as FeedbackSignalCategory,
      learnerLevel: "Advanced" as FeedbackSignalLearnerLevel,
      // Forbidden fields that mock AI feedback might supply
      transcript: "This is some user transcript.",
      retryTranscript: "Another transcript attempt.",
      rawAiCorrection: "You should not pause so much.",
      userEmail: "learner@example.com",
      ownerId: "user_123",
      privateNotes: "clinical notes here",
    };

    const action = getRetryActionForSignal(rawSignal);

    // Verify all keys on output action are allowed
    const actionKeys = Object.keys(action);
    for (const key of actionKeys) {
      expect(allowedKeys).toContain(key);
    }

    // Verify values don't leak anything from rawSignal inputs
    const serialized = JSON.stringify(action);
    expect(serialized).not.toContain("learner@example.com");
    expect(serialized).not.toContain("user_123");
    expect(serialized).not.toContain("clinical notes");
    expect(serialized).not.toContain("transcript");
    expect(serialized).not.toContain("correction");
  });
});
