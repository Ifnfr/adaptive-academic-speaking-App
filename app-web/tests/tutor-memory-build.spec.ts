import { expect, test } from "@playwright/test";
import {
  buildTutorMemoryFromSources,
  updateTutorMemoryFromFeedbackSummary,
  updateTutorMemoryFromLearningPathProgress,
  getSafeTutorMemorySnapshot,
} from "../src/app/lib/tutor-memory/build";
import { FeedbackSignalSummary } from "../src/app/lib/feedback-normalization/types";
import { StoredLearningPathProgress, StoredCardProgress } from "../src/app/lib/learning-path/types";

// Explicit Whitelist for check
const SUMMARY_ALLOWED_KEYS = new Set([
  "version",
  "totalSignalCount",
  "topCategory",
  "repeatedCategories",
  "learningPathCompletionPercent",
  "recommendedCardType",
  "lastUpdatedAt",
]);

// Forbidden patterns
const FORBIDDEN_PATTERNS = [
  /owner_id|source_id|ownerId|sourceId/,
  /transcript|retryTranscript|userSentence/,
  /betterPhrase|correctedSentence|rawResponse/,
  /articleUrl|articleBody|sourceText/,
  /csvRow|csvData|sessionCsv/,
  /email|@.*\..*/,
  /struggling|failing|weak learner|deficient|disorder/,
];

test.describe("Tutor Memory Builder Helpers", () => {
  const fixedTimestamp = "2026-05-30T15:00:00.000Z";

  test("1. buildTutorMemoryFromSources returns safe default memory with null/empty sources", () => {
    const profile = buildTutorMemoryFromSources({
      feedbackSummary: null,
      learningPathProgress: null,
      microPracticeEvents: [],
      nowParam: fixedTimestamp,
    });

    expect(profile.version).toBe(1);
    expect(profile.learnerLevel).toBe("Foundation");
    expect(profile.signals).toEqual([]);
    expect(profile.learningPath.completedUnitIds).toEqual([]);
    expect(profile.learningPath.completedCardCount).toBe(0);
    expect(profile.learningPath.cardTypeCompletionCounts).toEqual({});
    expect(profile.learningPath.currentCardId).toBe("card-d1-c1"); // First card of curriculum
    expect(profile.learningPath.isPhaseComplete).toBe(false);
    expect(profile.recentFocusCategories).toEqual([]);
    expect(profile.repeatedFocusCategories).toEqual([]);
    expect(profile.lastSummaryWindow).toBe("latest");
    expect(profile.lastUpdatedAt).toBe(fixedTimestamp);
  });

  test("2. feedback summary maps to TutorMemorySignal[] safely & 3. category counts preserved without raw text", () => {
    const feedbackSummary: FeedbackSignalSummary = {
      version: 1,
      window: "7-day",
      topCategories: ["grammar", "fluency"],
      countsByCategory: {
        grammar: 4,
        fluency: 2,
        clarity: 0,
      },
      recommendedNextActionId: "foundation-grammar-sentence-match",
      lastUpdatedAt: fixedTimestamp,
    };

    const profile = buildTutorMemoryFromSources({
      feedbackSummary,
      learningPathProgress: null,
      microPracticeEvents: [],
      nowParam: fixedTimestamp,
    });

    expect(profile.signals.length).toBe(2);
    const grammarSignal = profile.signals.find(s => s.category === "grammar");
    const fluencySignal = profile.signals.find(s => s.category === "fluency");

    expect(grammarSignal).toBeDefined();
    expect(grammarSignal?.count).toBe(4);
    expect(grammarSignal?.window).toBe("7-day");
    expect(grammarSignal?.lastSeenAt).toBe(fixedTimestamp);
    expect(grammarSignal?.source).toBe("feedback-summary");

    expect(fluencySignal).toBeDefined();
    expect(fluencySignal?.count).toBe(2);

    // Verify raw text fields like transcript, userSentence, email are completely absent
    const serialized = JSON.stringify(profile);
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(serialized).not.toMatch(pattern);
    }
  });

  test("4. recentFocusCategories returns top 3 & 5. repeatedFocusCategories returns categories with count >= 3", () => {
    const feedbackSummary: FeedbackSignalSummary = {
      version: 1,
      window: "all-local",
      topCategories: ["grammar", "fluency", "vocabulary", "structure"],
      countsByCategory: {
        grammar: 5,
        fluency: 4,
        vocabulary: 2,
        structure: 1,
      },
      recommendedNextActionId: null,
      lastUpdatedAt: fixedTimestamp,
    };

    const profile = buildTutorMemoryFromSources({
      feedbackSummary,
      learningPathProgress: null,
      microPracticeEvents: [],
      nowParam: fixedTimestamp,
    });

    // top 3 sorted by count descending (grammar: 5, fluency: 4, vocabulary: 2)
    expect(profile.recentFocusCategories).toEqual(["grammar", "fluency", "vocabulary"]);
    // count >= 3 (grammar: 5, fluency: 4)
    expect(profile.repeatedFocusCategories).toEqual(["grammar", "fluency"]);
  });

  test("6. learning path progress maps to completedCardCount & 7. completedUnitIds computed safely & 8. cardTypeCompletionCounts", () => {
    const learningPathProgress: StoredLearningPathProgress = {
      pathId: "beginner-confidence-ladder",
      phaseId: "confidence-foundation",
      cards: {
        "card-d1-c1": { cardId: "card-d1-c1", status: "completed", attemptCount: 1, lastUpdatedAt: fixedTimestamp },
        "card-d2-c1": { cardId: "card-d2-c1", status: "completed", attemptCount: 2, lastUpdatedAt: fixedTimestamp },
        "card-d3-c1": { cardId: "card-d3-c1", status: "attempted", attemptCount: 1, lastUpdatedAt: fixedTimestamp },
      },
      lastRecommendedCardId: "card-d3-c1",
      lastUpdatedAt: fixedTimestamp,
    };

    const profile = buildTutorMemoryFromSources({
      feedbackSummary: null,
      learningPathProgress,
      microPracticeEvents: [],
      nowParam: fixedTimestamp,
    });

    expect(profile.learningPath.completedCardCount).toBe(2);
    // Unit 1 (Introduce Yourself) has cards d1 to d7. Since d3 is incomplete, Unit 1 is not completed yet.
    expect(profile.learningPath.completedUnitIds).toEqual([]);
    expect(profile.learningPath.cardTypeCompletionCounts).toEqual({
      "guided-word": 2,
    });
    expect(profile.learningPath.currentCardId).toBe("card-d3-c1");
    expect(profile.learningPath.isPhaseComplete).toBe(false);
  });

  test("9. phase completion is detected when all Phase 1 cards are completed & completedUnitIds includes unit-1 and unit-2", () => {
    const cardsProgress: Record<string, StoredCardProgress> = {};
    const cardIds = [
      "card-d1-c1",
      "card-d2-c1",
      "card-d3-c1",
      "card-d4-c1",
      "card-d5-c1",
      "card-d6-c1",
      "card-d7-c1",
      "card-d8-c1",
      "card-d9-c1",
      "card-d10-c1",
      "card-d11-c1",
      "card-d12-c1",
      "card-d13-c1",
      "card-d14-c1",
    ];
    for (const id of cardIds) {
      cardsProgress[id] = { cardId: id, status: "completed", attemptCount: 1, lastUpdatedAt: fixedTimestamp };
    }

    const learningPathProgress: StoredLearningPathProgress = {
      pathId: "beginner-confidence-ladder",
      phaseId: "confidence-foundation",
      cards: cardsProgress,
      lastRecommendedCardId: null,
      lastUpdatedAt: fixedTimestamp,
    };

    const profile = buildTutorMemoryFromSources({
      feedbackSummary: null,
      learningPathProgress,
      microPracticeEvents: [],
      nowParam: fixedTimestamp,
    });

    expect(profile.learningPath.completedCardCount).toBe(14);
    expect(profile.learningPath.completedUnitIds).toEqual(["introduce-yourself", "my-daily-life"]);
    expect(profile.learningPath.isPhaseComplete).toBe(true);
    expect(profile.learningPath.currentCardId).toBeNull();
  });

  test("10. updateTutorMemoryFromFeedbackSummary merges counts immutably", () => {
    const initialProfile = buildTutorMemoryFromSources({
      feedbackSummary: {
        version: 1,
        window: "7-day",
        topCategories: ["grammar"],
        countsByCategory: { grammar: 2 },
        recommendedNextActionId: null,
        lastUpdatedAt: fixedTimestamp,
      },
      learningPathProgress: null,
      microPracticeEvents: [],
      nowParam: fixedTimestamp,
    });

    const newSummary: FeedbackSignalSummary = {
      version: 1,
      window: "7-day",
      topCategories: ["grammar", "fluency"],
      countsByCategory: {
        grammar: 2,
        fluency: 3,
      },
      recommendedNextActionId: null,
      lastUpdatedAt: fixedTimestamp,
    };

    const updatedProfile = updateTutorMemoryFromFeedbackSummary(initialProfile, newSummary, fixedTimestamp);

    // Initial profile must not be mutated
    expect(initialProfile.signals.length).toBe(1);
    expect(initialProfile.signals.find(s => s.category === "grammar")?.count).toBe(2);

    // Updated profile merges counts
    expect(updatedProfile.signals.length).toBe(2);
    expect(updatedProfile.signals.find(s => s.category === "grammar")?.count).toBe(4); // 2 + 2
    expect(updatedProfile.signals.find(s => s.category === "fluency")?.count).toBe(3); // 3
    expect(updatedProfile.repeatedFocusCategories).toEqual(["grammar", "fluency"]);
  });

  test("11. updateTutorMemoryFromLearningPathProgress updates snapshot immutably", () => {
    const initialProfile = buildTutorMemoryFromSources({
      feedbackSummary: null,
      learningPathProgress: {
        pathId: "bcl",
        phaseId: "cf",
        cards: {
          "card-d1-c1": { cardId: "card-d1-c1", status: "completed", attemptCount: 1, lastUpdatedAt: fixedTimestamp },
        },
        lastRecommendedCardId: "card-d2-c1",
        lastUpdatedAt: fixedTimestamp,
      },
      microPracticeEvents: [],
      nowParam: fixedTimestamp,
    });

    const newProgress: StoredLearningPathProgress = {
      pathId: "bcl",
      phaseId: "cf",
      cards: {
        "card-d1-c1": { cardId: "card-d1-c1", status: "completed", attemptCount: 1, lastUpdatedAt: fixedTimestamp },
        "card-d2-c1": { cardId: "card-d2-c1", status: "completed", attemptCount: 1, lastUpdatedAt: fixedTimestamp },
      },
      lastRecommendedCardId: "card-d3-c1",
      lastUpdatedAt: fixedTimestamp,
    };

    const updatedProfile = updateTutorMemoryFromLearningPathProgress(initialProfile, newProgress, fixedTimestamp);

    expect(initialProfile.learningPath.completedCardCount).toBe(1);
    expect(updatedProfile.learningPath.completedCardCount).toBe(2);
  });

  test("12. getSafeTutorMemorySnapshot returns only whitelisted fields & 13. learningPathCompletionPercent is deterministic", () => {
    const profile = buildTutorMemoryFromSources({
      feedbackSummary: {
        version: 1,
        window: "7-day",
        topCategories: ["grammar"],
        countsByCategory: { grammar: 5 },
        recommendedNextActionId: null,
        lastUpdatedAt: fixedTimestamp,
      },
      learningPathProgress: {
        pathId: "bcl",
        phaseId: "cf",
        cards: {
          "card-d1-c1": { cardId: "card-d1-c1", status: "completed", attemptCount: 1, lastUpdatedAt: fixedTimestamp },
          "card-d2-c1": { cardId: "card-d2-c1", status: "completed", attemptCount: 1, lastUpdatedAt: fixedTimestamp },
          "card-d3-c1": { cardId: "card-d3-c1", status: "completed", attemptCount: 1, lastUpdatedAt: fixedTimestamp },
          "card-d4-c1": { cardId: "card-d4-c1", status: "completed", attemptCount: 1, lastUpdatedAt: fixedTimestamp },
          "card-d5-c1": { cardId: "card-d5-c1", status: "completed", attemptCount: 1, lastUpdatedAt: fixedTimestamp },
          "card-d6-c1": { cardId: "card-d6-c1", status: "completed", attemptCount: 1, lastUpdatedAt: fixedTimestamp },
          "card-d7-c1": { cardId: "card-d7-c1", status: "completed", attemptCount: 1, lastUpdatedAt: fixedTimestamp },
        },
        lastRecommendedCardId: "card-d8-c1",
        lastUpdatedAt: fixedTimestamp,
      },
      microPracticeEvents: [],
      nowParam: fixedTimestamp,
    });

    const snapshot = getSafeTutorMemorySnapshot(profile);

    // Whitelist check
    const keys = Object.keys(snapshot);
    for (const key of keys) {
      expect(SUMMARY_ALLOWED_KEYS.has(key)).toBe(true);
    }

    expect(snapshot.version).toBe(1);
    expect(snapshot.totalSignalCount).toBe(5);
    expect(snapshot.topCategory).toBe("grammar");
    expect(snapshot.repeatedCategories).toEqual(["grammar"]);
    // Completed 7 out of 14 cards = 50%
    expect(snapshot.learningPathCompletionPercent).toBe(50);
    // Since grammar is in repeatedCategories, it maps to sentence-builder
    expect(snapshot.recommendedCardType).toBe("sentence-builder");
  });

  test("14. helpers do not mutate input arrays or objects", () => {
    const feedbackSummary: FeedbackSignalSummary = {
      version: 1,
      window: "latest",
      topCategories: ["grammar"],
      countsByCategory: { grammar: 2 },
      recommendedNextActionId: null,
      lastUpdatedAt: fixedTimestamp,
    };
    const summaryCopy = JSON.stringify(feedbackSummary);

    const learningPathProgress: StoredLearningPathProgress = {
      pathId: "bcl",
      phaseId: "cf",
      cards: {
        "card-d1-c1": { cardId: "card-d1-c1", status: "completed", attemptCount: 1, lastUpdatedAt: fixedTimestamp },
      },
      lastRecommendedCardId: null,
      lastUpdatedAt: fixedTimestamp,
    };
    const progressCopy = JSON.stringify(learningPathProgress);

    buildTutorMemoryFromSources({
      feedbackSummary,
      learningPathProgress,
      microPracticeEvents: [],
      nowParam: fixedTimestamp,
    });

    expect(JSON.stringify(feedbackSummary)).toBe(summaryCopy);
    expect(JSON.stringify(learningPathProgress)).toBe(progressCopy);
  });

  test("15. same inputs produce deterministic outputs", () => {
    const params: {
      feedbackSummary: FeedbackSignalSummary;
      learningPathProgress: StoredLearningPathProgress;
      microPracticeEvents: unknown[];
      nowParam: string;
    } = {
      feedbackSummary: {
        version: 1,
        window: "7-day" as const,
        topCategories: ["grammar" as const],
        countsByCategory: { grammar: 2 },
        recommendedNextActionId: null,
        lastUpdatedAt: fixedTimestamp,
      },
      learningPathProgress: {
        pathId: "bcl",
        phaseId: "cf",
        cards: {
          "card-d1-c1": { cardId: "card-d1-c1", status: "completed" as const, attemptCount: 1, lastUpdatedAt: fixedTimestamp },
        },
        lastRecommendedCardId: null,
        lastUpdatedAt: fixedTimestamp,
      },
      microPracticeEvents: [],
      nowParam: fixedTimestamp,
    };

    const out1 = buildTutorMemoryFromSources(params);
    const out2 = buildTutorMemoryFromSources(params);

    expect(JSON.stringify(out1)).toBe(JSON.stringify(out2));
  });

  test("16. serialized outputs contain no forbidden private fields & 17. no transcripts, emails, owner, or CSV content & 18. no harsh/clinical labels", () => {
    const profile = buildTutorMemoryFromSources({
      feedbackSummary: {
        version: 1,
        window: "7-day",
        topCategories: ["grammar"],
        countsByCategory: { grammar: 5 },
        recommendedNextActionId: null,
        lastUpdatedAt: fixedTimestamp,
      },
      learningPathProgress: null,
      microPracticeEvents: [],
      nowParam: fixedTimestamp,
    });

    const snapshot = getSafeTutorMemorySnapshot(profile);

    const serializedProfile = JSON.stringify(profile);
    const serializedSnapshot = JSON.stringify(snapshot);

    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(serializedProfile).not.toMatch(pattern);
      expect(serializedSnapshot).not.toMatch(pattern);
    }
  });
});
