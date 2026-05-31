import { expect, test } from "@playwright/test";
import { buildTutorAwareRecommendation } from "../src/app/lib/tutor-memory/learning-path-bridge";
import { RecommendationResult } from "../src/app/lib/learning-path/recommendation";
import { TutorMemoryProfile } from "../src/app/lib/tutor-memory/types";
import { LearningPathCard } from "../src/app/lib/learning-path/types";

// Explicit Whitelist for check
const BRIDGE_ALLOWED_KEYS = new Set([
  "version",
  "sequential",
  "recommendedCardId",
  "isPhaseComplete",
  "tutorMemory",
  "suggestedCardType",
  "priority",
  "safeReason",
  "safeInstruction",
  "basedOn",
  "category",
  "advisoryOnly",
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

function createSampleCard(): LearningPathCard {
  return {
    id: "card-d3-c1",
    dayNumber: 3,
    unitId: "introduce-yourself",
    type: "phrase-pattern",
    title: "Saying where you are from",
    targetPhrases: ["I am from Indonesia"],
    learnerInstruction: "Listen and repeat.",
    indonesianExplanation: "Dengarkan dan ulangi.",
    scaffold: "I am from [Place]",
    cta: "Start",
    estimatedMinutes: 3,
    completionRule: "recorded",
    linkedEngine: "phrase-pattern",
    mobileLayoutHint: "compact",
  };
}

function createSampleLpRecommendation(card: LearningPathCard | null = createSampleCard(), complete = false): RecommendationResult {
  return {
    recommendedCard: card,
    isPhaseComplete: complete,
    cardStatuses: {},
  };
}

function createSampleProfile(): TutorMemoryProfile {
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
    repeatedFocusCategories: ["grammar"], // Suggests sentence-builder
    lastSummaryWindow: "latest",
    lastUpdatedAt: "2026-05-30T15:00:00.000Z",
  };
}

test.describe("Tutor Memory Learning Path Advisory Bridge", () => {
  const fixedTimestamp = "2026-05-30T15:00:00.000Z";

  test("1. Bridge returns sequential and tutor memory side by side, 2. recommendedCardId preserved, 3. tutor memory does not override sequential card", () => {
    const lpRec = createSampleLpRecommendation();
    const profile = createSampleProfile();

    const bridge = buildTutorAwareRecommendation(lpRec, profile, fixedTimestamp);

    expect(bridge.version).toBe(1);
    expect(bridge.sequential.recommendedCardId).toBe("card-d3-c1");
    expect(bridge.sequential.isPhaseComplete).toBe(false);
    expect(bridge.tutorMemory).toBeDefined();
    expect(bridge.tutorMemory?.suggestedCardType).toBe("sentence-builder"); // From grammar repeatedFocusCategories
    expect(bridge.tutorMemory?.category).toBe("grammar");
    expect(bridge.advisoryOnly).toBe(true);
    expect(bridge.lastUpdatedAt).toBe(fixedTimestamp);
  });

  test("4. advisoryOnly is always true", () => {
    const lpRec = createSampleLpRecommendation();
    const profile = createSampleProfile();

    const bridge = buildTutorAwareRecommendation(lpRec, profile, fixedTimestamp);
    expect(bridge.advisoryOnly).toBe(true);
  });

  test("5. tutorMemory is null when no TutorMemoryProfile is provided", () => {
    const lpRec = createSampleLpRecommendation();

    const bridge = buildTutorAwareRecommendation(lpRec, null, fixedTimestamp);
    expect(bridge.tutorMemory).toBeNull();
    expect(bridge.sequential.recommendedCardId).toBe("card-d3-c1");
  });

  test("6. phase complete state is preserved", () => {
    const lpRec = createSampleLpRecommendation(null, true);
    const profile = createSampleProfile();

    const bridge = buildTutorAwareRecommendation(lpRec, profile, fixedTimestamp);
    expect(bridge.sequential.recommendedCardId).toBeNull();
    expect(bridge.sequential.isPhaseComplete).toBe(true);
  });

  test("7. output is deterministic with same inputs", () => {
    const lpRec = createSampleLpRecommendation();
    const profile = createSampleProfile();

    const out1 = buildTutorAwareRecommendation(lpRec, profile, fixedTimestamp);
    const out2 = buildTutorAwareRecommendation(lpRec, profile, fixedTimestamp);

    expect(JSON.stringify(out1)).toBe(JSON.stringify(out2));
  });

  test("8. helper does not mutate input objects", () => {
    const lpRec = createSampleLpRecommendation();
    const profile = createSampleProfile();

    const lpRecCopy = JSON.stringify(lpRec);
    const profileCopy = JSON.stringify(profile);

    buildTutorAwareRecommendation(lpRec, profile, fixedTimestamp);

    expect(JSON.stringify(lpRec)).toBe(lpRecCopy);
    expect(JSON.stringify(profile)).toBe(profileCopy);
  });

  test("9. output contains no hard-lock fields such as force, lock, required, block, override", () => {
    const lpRec = createSampleLpRecommendation();
    const profile = createSampleProfile();

    const bridge = buildTutorAwareRecommendation(lpRec, profile, fixedTimestamp);
    const keys = Object.keys(bridge);

    expect(keys).not.toContain("lock");
    expect(keys).not.toContain("force");
    expect(keys).not.toContain("required");
    expect(keys).not.toContain("block");
    expect(keys).not.toContain("override");

    // Recursively check all keys are whitelisted
    const checkKeys = (obj: unknown) => {
      if (obj === null || typeof obj !== "object") return;
      if (Array.isArray(obj)) {
        for (const item of obj) {
          checkKeys(item);
        }
        return;
      }
      const record = obj as Record<string, unknown>;
      for (const k of Object.keys(record)) {
        expect(BRIDGE_ALLOWED_KEYS.has(k)).toBe(true);
        checkKeys(record[k]);
      }
    };
    checkKeys(bridge);
  });

  test("10. serialized output contains no forbidden private fields & 11. no transcripts, emails, owner or CSV content & 12. no harsh/clinical labels", () => {
    const lpRec = createSampleLpRecommendation();
    const profile = createSampleProfile();

    const bridge = buildTutorAwareRecommendation(lpRec, profile, fixedTimestamp);
    const serialized = JSON.stringify(bridge);

    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(serialized).not.toMatch(pattern);
    }
  });
});
