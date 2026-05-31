import { test, expect } from "@playwright/test";
import { getRecommendation, getFlatCurriculumCards } from "../src/app/lib/learning-path/recommendation";
import { StoredLearningPathProgress } from "../src/app/lib/learning-path/types";

// Helper to initialize empty progress object
function createMockProgress(): StoredLearningPathProgress {
  return {
    pathId: "beginner-confidence-ladder",
    phaseId: "confidence-foundation",
    cards: {},
    lastRecommendedCardId: null,
    lastUpdatedAt: new Date().toISOString()
  };
}

test.describe("Learning Path - Phase 2 Recommendation & Flattening Compatibility (TASK-052D)", () => {

  test("1. Default recommendation behavior remains Phase 1 compatible", () => {
    const progress = createMockProgress();
    const result = getRecommendation(progress); // no options passed
    
    // Default should only load Phase 1 (14 days, e.g. Days 1-14)
    const flatCards = getFlatCurriculumCards();
    const days = new Set(flatCards.map(c => c.dayNumber));
    expect(days.size).toBe(14);
    expect(Math.min(...days)).toBe(1);
    expect(Math.max(...days)).toBe(14);

    expect(result.recommendedCard).toBeDefined();
    expect(result.recommendedCard?.dayNumber).toBe(1);
    expect(result.isPhaseComplete).toBe(false);
  });

  test("2. Combined mode loads cards from Days 1–28 in deterministic order", () => {
    const flatCards = getFlatCurriculumCards({ includePhase2: true });
    
    // Duration check
    const days = flatCards.map(c => c.dayNumber);
    const uniqueDays = new Set(days);
    expect(uniqueDays.size).toBe(28);
    expect(Math.min(...uniqueDays)).toBe(1);
    expect(Math.max(...uniqueDays)).toBe(28);

    // Order check (sorted asc by dayNumber)
    for (let i = 0; i < flatCards.length - 1; i++) {
      expect(flatCards[i].dayNumber).toBeLessThanOrEqual(flatCards[i + 1].dayNumber);
    }
  });

  test("3. Empty progress in combined mode recommends Day 1 Card 1", () => {
    const progress = createMockProgress();
    const result = getRecommendation(progress, { includePhase2: true });

    expect(result.recommendedCard).toBeDefined();
    expect(result.recommendedCard?.dayNumber).toBe(1);
    expect(result.recommendedCard?.id).toBe("card-d1-c1");
    expect(result.isPhaseComplete).toBe(false);
  });

  test("4. Completing all Phase 1 cards in combined mode recommends Day 15 first card", () => {
    const progress = createMockProgress();
    const phase1Cards = getFlatCurriculumCards(); // default is Phase 1-only
    
    // Complete all Phase 1 cards
    phase1Cards.forEach(card => {
      progress.cards[card.id] = {
        cardId: card.id,
        status: "completed",
        attemptCount: 1,
        lastUpdatedAt: new Date().toISOString()
      };
    });

    const result = getRecommendation(progress, { includePhase2: true });

    expect(result.recommendedCard).toBeDefined();
    expect(result.recommendedCard?.dayNumber).toBe(15);
    expect(result.recommendedCard?.id).toBe("card-d15-c1");
    expect(result.isPhaseComplete).toBe(false);
  });

  test("5. Completing all Phase 1 cards in default mode marks Phase 1 complete", () => {
    const progress = createMockProgress();
    const phase1Cards = getFlatCurriculumCards(); // default is Phase 1-only
    
    // Complete all Phase 1 cards
    phase1Cards.forEach(card => {
      progress.cards[card.id] = {
        cardId: card.id,
        status: "completed",
        attemptCount: 1,
        lastUpdatedAt: new Date().toISOString()
      };
    });

    const result = getRecommendation(progress); // default Mode

    expect(result.recommendedCard).toBeNull();
    expect(result.isPhaseComplete).toBe(true);
  });

  test("6. Partial Phase 2 progress in combined mode recommends the first incomplete Phase 2 card", () => {
    const progress = createMockProgress();
    const allCards = getFlatCurriculumCards({ includePhase2: true });

    // Mark all Phase 1 cards + first two Phase 2 cards completed
    // Days 15 cards are: card-d15-c1, card-d15-c2
    const cardsToComplete = allCards.filter(c => c.dayNumber < 15 || c.id === "card-d15-c1");
    cardsToComplete.forEach(card => {
      progress.cards[card.id] = {
        cardId: card.id,
        status: "completed",
        attemptCount: 1,
        lastUpdatedAt: new Date().toISOString()
      };
    });

    const result = getRecommendation(progress, { includePhase2: true });

    expect(result.recommendedCard).toBeDefined();
    expect(result.recommendedCard?.id).toBe("card-d15-c2");
    expect(result.recommendedCard?.dayNumber).toBe(15);
    expect(result.isPhaseComplete).toBe(false);
  });

  test("7. Completing all Phase 1 + Phase 2 cards in combined mode marks path complete", () => {
    const progress = createMockProgress();
    const allCards = getFlatCurriculumCards({ includePhase2: true });

    // Complete every single card across Days 1–28
    allCards.forEach(card => {
      progress.cards[card.id] = {
        cardId: card.id,
        status: "completed",
        attemptCount: 1,
        lastUpdatedAt: new Date().toISOString()
      };
    });

    const result = getRecommendation(progress, { includePhase2: true });

    expect(result.recommendedCard).toBeNull();
    expect(result.isPhaseComplete).toBe(true);
  });

  test("8. Phase 2-only card types do not crash recommendation logic", () => {
    const progress = createMockProgress();
    const allCards = getFlatCurriculumCards({ includePhase2: true });

    // Complete everything except Unit 4 capstone card (supported-conversation)
    const capstoneCardId = "card-d28-c1";
    allCards.forEach(card => {
      if (card.id !== capstoneCardId) {
        progress.cards[card.id] = {
          cardId: card.id,
          status: "completed",
          attemptCount: 1,
          lastUpdatedAt: new Date().toISOString()
        };
      }
    });

    const result = getRecommendation(progress, { includePhase2: true });

    expect(result.recommendedCard).toBeDefined();
    expect(result.recommendedCard?.id).toBe(capstoneCardId);
    expect(result.recommendedCard?.type).toBe("supported-conversation");
    expect(result.isPhaseComplete).toBe(false);
  });

  test("9. Output doesn't contain hard-lock, force, or override fields", () => {
    const progress = createMockProgress();
    const result = getRecommendation(progress, { includePhase2: true });
    const serialized = JSON.stringify(result).toLowerCase();

    const bannedKeywords = ["lock", "force", "required", "block", "override", "adaptive"];
    bannedKeywords.forEach(word => {
      expect(serialized).not.toContain(word);
    });
  });

  test("10. Output doesn't contain forbidden private, AI scoring, or transcript fields", () => {
    const progress = createMockProgress();
    const result = getRecommendation(progress, { includePhase2: true });
    const serialized = JSON.stringify(result).toLowerCase();

    const forbiddenPatterns = [
      "transcript",
      "retrytranscript",
      "speechtotext",
      "audioblob",
      "recordingurl",
      "rawlearnersentence",
      "exactlearnersentence",
      "email",
      "owner_id",
      "source_id",
      "userid",
      "sessionid",
      "rawpayload",
      "articleurl",
      "privatenote",
      "clinical",
      "psychological",
      "pronunciation score",
      "grammar score",
      "confidence score"
    ];

    forbiddenPatterns.forEach(pattern => {
      expect(serialized).not.toContain(pattern);
    });

    expect(serialized).not.toContain("@");
  });

});
