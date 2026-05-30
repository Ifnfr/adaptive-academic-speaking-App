import { test, expect } from "@playwright/test";
import {
  getDefaultProgress,
  loadProgress,
  saveProgress,
  updateCardProgress,
  incrementCardAttempt,
  resetProgress
} from "../src/app/lib/learning-path/progress";
import {
  getRecommendation,
  getFlatCurriculumCards
} from "../src/app/lib/learning-path/recommendation";
import { StoredLearningPathProgress } from "../src/app/lib/learning-path/types";

// Simple in-memory localStorage mock for Node.js test runtime
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k in store) delete store[k]; }
};

test.beforeAll(() => {
  globalThis.window = {
    localStorage: localStorageMock
  } as unknown as typeof globalThis & Window;

  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    writable: true,
    configurable: true
  });
});

test.beforeEach(() => {
  localStorageMock.clear();
});

test.describe("Learning Path Progress and Recommendation Engine Tests", () => {

  test("1. Empty progress initializes safely", () => {
    const progress = loadProgress();
    expect(progress).toBeDefined();
    expect(progress.pathId).toBe("beginner-confidence-ladder");
    expect(progress.phaseId).toBe("confidence-foundation");
    expect(progress.cards).toEqual({});
    expect(progress.lastRecommendedCardId).toBeNull();
  });

  test("2. Corrupted localStorage falls back safely", () => {
    localStorageMock.setItem("fonetik:learning-path-progress:v1", "corrupted-json-payload-{{{");
    const progress = loadProgress();
    expect(progress).toBeDefined();
    expect(progress.cards).toEqual({});
  });

  test("3. Progress saves under only fonetik:learning-path-progress:v1", () => {
    const progress = getDefaultProgress();
    progress.cards["card-1"] = {
      cardId: "card-1",
      status: "viewed",
      attemptCount: 1,
      lastUpdatedAt: new Date().toISOString()
    };
    saveProgress(progress);

    const val = localStorageMock.getItem("fonetik:learning-path-progress:v1");
    expect(val).toBeTruthy();
    const parsed = JSON.parse(val!);
    expect(parsed.cards["card-1"].status).toBe("viewed");
  });

  test("4. Saved progress contains only safe fields", () => {
    const progress = {
      pathId: "beginner-confidence-ladder",
      phaseId: "confidence-foundation",
      cards: {
        "card-1": {
          cardId: "card-1",
          status: "attempted" as const,
          attemptCount: 2,
          lastUpdatedAt: new Date().toISOString(),
          extraUnsafeField: "secret transcript data"
        }
      },
      lastRecommendedCardId: "card-1",
      lastUpdatedAt: new Date().toISOString(),
      unsafeRootField: "user@example.com"
    };

    saveProgress(progress as unknown as StoredLearningPathProgress);

    const val = localStorageMock.getItem("fonetik:learning-path-progress:v1")!;
    const parsed = JSON.parse(val);

    expect(parsed.pathId).toBe("beginner-confidence-ladder");
    expect(parsed.phaseId).toBe("confidence-foundation");
    expect(parsed.cards["card-1"].cardId).toBe("card-1");
    expect(parsed.cards["card-1"].status).toBe("attempted");
    expect(parsed.cards["card-1"].attemptCount).toBe(2);
    expect(parsed.cards["card-1"].lastUpdatedAt).toBeDefined();
    expect(parsed.cards["card-1"].extraUnsafeField).toBeUndefined();
    expect(parsed.unsafeRootField).toBeUndefined();
  });

  test("5. Mark viewed/attempted/recorded/continued/completed works", () => {
    let progress = updateCardProgress("card-d1-c1", "viewed");
    expect(progress.cards["card-d1-c1"].status).toBe("viewed");

    progress = updateCardProgress("card-d1-c1", "attempted");
    expect(progress.cards["card-d1-c1"].status).toBe("attempted");

    progress = updateCardProgress("card-d1-c1", "recorded");
    expect(progress.cards["card-d1-c1"].status).toBe("recorded");

    progress = updateCardProgress("card-d1-c1", "continued");
    expect(progress.cards["card-d1-c1"].status).toBe("continued");

    progress = updateCardProgress("card-d1-c1", "completed");
    expect(progress.cards["card-d1-c1"].status).toBe("completed");
  });

  test("6. Attempt count increments safely", () => {
    let progress = updateCardProgress("card-d1-c1", "viewed");
    expect(progress.cards["card-d1-c1"].attemptCount).toBe(0);

    progress = updateCardProgress("card-d1-c1", "attempted");
    expect(progress.cards["card-d1-c1"].attemptCount).toBe(1);

    progress = incrementCardAttempt("card-d1-c1");
    expect(progress.cards["card-d1-c1"].attemptCount).toBe(2);

    progress = resetProgress();
    expect(progress.cards).toEqual({});
  });

  test("7. Day 1 Card 1 is recommended by default", () => {
    const progress = loadProgress();
    const recommendation = getRecommendation(progress);
    expect(recommendation.isPhaseComplete).toBe(false);
    expect(recommendation.recommendedCard).toBeDefined();
    expect(recommendation.recommendedCard?.id).toBe("card-d1-c1");
    expect(recommendation.cardStatuses["card-d1-c1"]).toBe("recommended");
  });

  test("8. Completing a card recommends the next card", () => {
    let progress = loadProgress();
    progress = updateCardProgress("card-d1-c1", "completed");
    const recommendation = getRecommendation(progress);
    expect(recommendation.recommendedCard?.id).toBe("card-d2-c1");
    expect(recommendation.cardStatuses["card-d1-c1"]).toBe("completed");
    expect(recommendation.cardStatuses["card-d2-c1"]).toBe("recommended");
  });

  test("9. Completing a day recommends the next day", () => {
    let progress = loadProgress();
    progress = updateCardProgress("card-d1-c1", "completed");
    const recommendation = getRecommendation(progress);
    expect(recommendation.recommendedCard?.dayNumber).toBe(2);
    expect(recommendation.recommendedCard?.id).toBe("card-d2-c1");
  });

  test("10. Completing all Phase 1 cards returns phase complete", () => {
    let progress = loadProgress();
    const flatCards = getFlatCurriculumCards();

    flatCards.forEach(card => {
      progress = updateCardProgress(card.id, "completed");
    });

    const recommendation = getRecommendation(progress);
    expect(recommendation.isPhaseComplete).toBe(true);
    expect(recommendation.recommendedCard).toBeNull();

    flatCards.forEach(card => {
      expect(recommendation.cardStatuses[card.id]).toBe("completed");
    });
  });

  test("11. Card statuses are computed correctly", () => {
    let progress = loadProgress();
    progress = updateCardProgress("card-d1-c1", "viewed");

    const recommendation = getRecommendation(progress);
    expect(recommendation.cardStatuses["card-d1-c1"]).toBe("current");
    expect(recommendation.cardStatuses["card-d2-c1"]).toBe("upcoming");

    progress = updateCardProgress("card-d1-c1", "completed");
    const rec2 = getRecommendation(progress);
    expect(rec2.cardStatuses["card-d1-c1"]).toBe("completed");
    expect(rec2.cardStatuses["card-d2-c1"]).toBe("recommended");
  });

  test("12. Forbidden private fields are never stored", () => {
    const progress = loadProgress();
    const serialized = JSON.stringify(progress).toLowerCase();

    const forbidden = [
      "transcript",
      "weakness",
      "owner_id",
      "ownerid",
      "source_id",
      "sourceid",
      "email"
    ];

    forbidden.forEach(field => {
      expect(serialized).not.toContain(field);
    });
    expect(serialized).not.toContain("@");
  });

  test("13. No transcript/email/owner/source/raw payload appears in serialized progress", () => {
    let progress = loadProgress();
    progress = updateCardProgress("card-d1-c1", "completed");
    const serialized = JSON.stringify(progress).toLowerCase();

    const forbidden = [
      "transcript",
      "email",
      "owner",
      "source"
    ];
    forbidden.forEach(field => {
      expect(serialized).not.toContain(field);
    });
  });
});
