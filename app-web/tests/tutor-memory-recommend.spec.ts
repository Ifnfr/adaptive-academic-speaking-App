import { expect, test } from "@playwright/test";
import { getTutorMemoryRecommendation } from "../src/app/lib/tutor-memory/recommend";
import { TutorMemoryProfile } from "../src/app/lib/tutor-memory/types";

// Explicit Whitelist for check
const RECOMMENDATION_ALLOWED_KEYS = new Set([
  "suggestedCardType",
  "priority",
  "safeReason",
  "safeInstruction",
  "basedOn",
  "category",
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

function createBaseProfile(): TutorMemoryProfile {
  return {
    version: 1,
    learnerLevel: "Foundation",
    signals: [],
    learningPath: {
      completedUnitIds: [],
      completedCardCount: 0,
      cardTypeCompletionCounts: {},
      currentCardId: null,
      isPhaseComplete: false,
    },
    recentFocusCategories: [],
    repeatedFocusCategories: [],
    lastSummaryWindow: "latest",
    lastUpdatedAt: "2026-05-30T15:00:00.000Z",
  };
}

test.describe("Tutor Memory Recommendation Helpers", () => {
  test("1. grammar repeated category recommends sentence-builder with high priority", () => {
    const profile = createBaseProfile();
    profile.repeatedFocusCategories = ["grammar"];

    const rec = getTutorMemoryRecommendation(profile);
    expect(rec.suggestedCardType).toBe("sentence-builder");
    expect(rec.priority).toBe("high");
    expect(rec.category).toBe("grammar");
    expect(rec.safeReason).toBe("Grammar patterns appeared frequently in recent practice");
  });

  test("2. vocabulary repeated category recommends guided-word with high priority", () => {
    const profile = createBaseProfile();
    profile.repeatedFocusCategories = ["vocabulary"];

    const rec = getTutorMemoryRecommendation(profile);
    expect(rec.suggestedCardType).toBe("guided-word");
    expect(rec.priority).toBe("high");
    expect(rec.category).toBe("vocabulary");
    expect(rec.safeReason).toBe("Vocabulary focus appeared frequently in recent practice");
  });

  test("3. fluency repeated category recommends micro-speaking with high priority", () => {
    const profile = createBaseProfile();
    profile.repeatedFocusCategories = ["fluency"];

    const rec = getTutorMemoryRecommendation(profile);
    expect(rec.suggestedCardType).toBe("micro-speaking");
    expect(rec.priority).toBe("high");
    expect(rec.category).toBe("fluency");
  });

  test("4. clarity repeated category recommends micro-speaking with high priority", () => {
    const profile = createBaseProfile();
    profile.repeatedFocusCategories = ["clarity"];

    const rec = getTutorMemoryRecommendation(profile);
    expect(rec.suggestedCardType).toBe("micro-speaking");
    expect(rec.priority).toBe("high");
    expect(rec.category).toBe("clarity");
  });

  test("5. structure/coherence/support/academicTone recommend phrase-pattern", () => {
    const categories = ["structure", "coherence", "support", "academicTone"] as const;
    for (const cat of categories) {
      const profile = createBaseProfile();
      profile.repeatedFocusCategories = [cat];

      const rec = getTutorMemoryRecommendation(profile);
      expect(rec.suggestedCardType).toBe("phrase-pattern");
      expect(rec.priority).toBe("high");
      expect(rec.category).toBe(cat);
      expect(rec.safeReason).toBe("Structured response focus appeared frequently in recent practice");
    }
  });

  test("6. confidenceHabit recommends guided-word with medium priority", () => {
    const profile = createBaseProfile();
    profile.repeatedFocusCategories = ["confidenceHabit"];

    const rec = getTutorMemoryRecommendation(profile);
    expect(rec.suggestedCardType).toBe("guided-word");
    expect(rec.priority).toBe("medium");
    expect(rec.category).toBe("confidenceHabit");
  });

  test("7. taskCompletion recommends phrase-pattern with medium priority", () => {
    const profile = createBaseProfile();
    profile.repeatedFocusCategories = ["taskCompletion"];

    const rec = getTutorMemoryRecommendation(profile);
    expect(rec.suggestedCardType).toBe("phrase-pattern");
    expect(rec.priority).toBe("medium");
    expect(rec.category).toBe("taskCompletion");
  });

  test("8. phase complete recommends weekly-checkpoint", () => {
    const profile = createBaseProfile();
    profile.learningPath.isPhaseComplete = true;

    const rec = getTutorMemoryRecommendation(profile);
    expect(rec.suggestedCardType).toBe("weekly-checkpoint");
    expect(rec.priority).toBe("low");
    expect(rec.category).toBeNull();
    expect(rec.basedOn).toEqual(["learning-path-progress"]);
  });

  test("9. current card fallback recommends continuation", () => {
    const profile = createBaseProfile();
    profile.learningPath.currentCardId = "card-d4-c1"; // Day 4 is sentence-builder

    const rec = getTutorMemoryRecommendation(profile);
    expect(rec.suggestedCardType).toBe("sentence-builder");
    expect(rec.priority).toBe("medium");
    expect(rec.category).toBeNull();
    expect(rec.basedOn).toEqual(["learning-path-progress"]);
  });

  test("10. empty memory recommends guided-word", () => {
    const profile = createBaseProfile();

    const rec = getTutorMemoryRecommendation(profile);
    expect(rec.suggestedCardType).toBe("guided-word");
    expect(rec.priority).toBe("low");
    expect(rec.category).toBeNull();
    expect(rec.basedOn).toEqual(["learning-path-progress"]);
  });

  test("11. output is advisory only and does not include hard-lock fields", () => {
    const profile = createBaseProfile();
    profile.repeatedFocusCategories = ["grammar"];

    const rec = getTutorMemoryRecommendation(profile);
    const keys = Object.keys(rec);
    for (const key of keys) {
      expect(RECOMMENDATION_ALLOWED_KEYS.has(key)).toBe(true);
    }

    // No hard lock keys like "lock", "force", "required", "restrict"
    expect(keys).not.toContain("lock");
    expect(keys).not.toContain("force");
    expect(keys).not.toContain("required");
  });

  test("12. safeReason and safeInstruction use supportive wording & 13. no harsh/clinical labels appear", () => {
    const profile = createBaseProfile();
    profile.repeatedFocusCategories = ["grammar"];

    const rec = getTutorMemoryRecommendation(profile);
    expect(rec.safeReason).toMatch(/frequently|practice|support|steps/);
    expect(rec.safeInstruction).toMatch(/Arrange|Practice|express|Use|Momentum|Begin/);

    const serialized = JSON.stringify(rec);
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(serialized).not.toMatch(pattern);
    }
  });

  test("14. helper does not mutate input profile", () => {
    const profile = createBaseProfile();
    profile.repeatedFocusCategories = ["grammar"];
    const profileCopy = JSON.stringify(profile);

    getTutorMemoryRecommendation(profile);
    expect(JSON.stringify(profile)).toBe(profileCopy);
  });

  test("15. same input produces deterministic output", () => {
    const profile = createBaseProfile();
    profile.repeatedFocusCategories = ["grammar"];

    const rec1 = getTutorMemoryRecommendation(profile);
    const rec2 = getTutorMemoryRecommendation(profile);
    expect(JSON.stringify(rec1)).toBe(JSON.stringify(rec2));
  });

  test("16. serialized output contains no forbidden private fields & 17. no transcripts, emails, owner, or CSV content", () => {
    const profile = createBaseProfile();
    profile.repeatedFocusCategories = ["vocabulary"];

    const rec = getTutorMemoryRecommendation(profile);
    const serialized = JSON.stringify(rec);

    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(serialized).not.toMatch(pattern);
    }
  });
});
