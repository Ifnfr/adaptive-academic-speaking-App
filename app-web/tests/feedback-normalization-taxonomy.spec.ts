import { expect, test } from "@playwright/test";
import {
  FEEDBACK_SIGNAL_CATEGORIES,
  FEEDBACK_TAXONOMY,
  getFeedbackTaxonomyEntry,
} from "../src/app/lib/feedback-normalization/taxonomy";
import type {
  FeedbackRecommendedAction,
  FeedbackSignal,
  FeedbackSignalSummary,
} from "../src/app/lib/feedback-normalization/types";

const APPROVED_CATEGORIES = [
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
] as const;

const HARSH_OR_CLINICAL_WORDS = [
  "weakness",
  "failure",
  "bad speaker",
  "diagnosis",
  "disorder",
  "clinical",
  "pathology",
  "deficit",
  "impaired",
  "abnormal",
];

const FORBIDDEN_PRIVATE_PATTERNS = [
  "transcript",
  "retryTranscript",
  "retry_transcript",
  "email",
  "ownerId",
  "owner_id",
  "sourceId",
  "source_id",
  "articleUrl",
  "article_url",
  "https://",
  "csv",
  "providerResponse",
  "provider_raw_response",
  "promptText",
  "localStorage",
  "privateNote",
  "private_note",
];

test.describe("Feedback normalization taxonomy", () => {
  test("all approved categories exist", () => {
    expect(FEEDBACK_SIGNAL_CATEGORIES).toEqual(APPROVED_CATEGORIES);
    expect(Object.keys(FEEDBACK_TAXONOMY).sort()).toEqual(
      [...APPROVED_CATEGORIES].sort(),
    );
  });

  test("no unapproved categories exist", () => {
    for (const entry of Object.values(FEEDBACK_TAXONOMY)) {
      expect(APPROVED_CATEGORIES).toContain(entry.category);
    }
  });

  test("safe labels are supportive and practice-oriented", () => {
    for (const category of FEEDBACK_SIGNAL_CATEGORIES) {
      const entry = getFeedbackTaxonomyEntry(category);
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.shortDescription.length).toBeGreaterThan(0);
      expect(entry.practiceTarget.toLowerCase()).toMatch(
        /practice|build|use|make|choose|add|answer|start/,
      );
    }
  });

  test("safe labels do not contain harsh or clinical wording", () => {
    const taxonomyText = JSON.stringify(FEEDBACK_TAXONOMY).toLowerCase();
    for (const word of HARSH_OR_CLINICAL_WORDS) {
      expect(taxonomyText).not.toContain(word.toLowerCase());
    }
  });

  test("type fixtures serialize without forbidden private fields", () => {
    const signal: FeedbackSignal = {
      version: 1,
      category: "fluency",
      severity: "medium",
      confidence: "high",
      learnerLevel: "Foundation",
      sourceSurface: "active-feedback",
      safeLabel: "Speaking flow",
      safeSummary: "The next practice focus is keeping a short answer moving.",
      recommendedActionId: "foundation-fluency-steady-start",
      createdAt: "2026-05-30T00:00:00.000Z",
    };

    const summary: FeedbackSignalSummary = {
      version: 1,
      window: "7-day",
      topCategories: ["fluency", "structure"],
      countsByCategory: {
        fluency: 2,
        structure: 1,
      },
      recommendedNextActionId: "foundation-fluency-steady-start",
      lastUpdatedAt: "2026-05-30T00:00:00.000Z",
    };

    const action: FeedbackRecommendedAction = {
      id: "foundation-fluency-steady-start",
      category: "fluency",
      learnerLevel: "Foundation",
      title: "Steady start",
      instruction: "Say one short sentence, pause, then add one more sentence.",
      estimatedMinutes: 3,
    };

    const serialized = JSON.stringify({ signal, summary, action });
    for (const pattern of FORBIDDEN_PRIVATE_PATTERNS) {
      expect(serialized).not.toContain(pattern);
    }
  });

  test("type fixtures avoid transcript, article, CSV, provider, and prompt content", () => {
    const fixture: FeedbackSignal = {
      version: 1,
      category: "taskCompletion",
      severity: "light",
      confidence: "medium",
      learnerLevel: "Beginner",
      sourceSurface: "weekly-review",
      safeLabel: "Task focus",
      safeSummary: "The practice target is answering the prompt directly.",
      recommendedActionId: "beginner-task-focus-direct-answer",
      createdAt: "2026-05-30T00:00:00.000Z",
    };

    const serialized = JSON.stringify(fixture).toLowerCase();
    for (const pattern of FORBIDDEN_PRIVATE_PATTERNS) {
      expect(serialized).not.toContain(pattern.toLowerCase());
    }
  });
});
