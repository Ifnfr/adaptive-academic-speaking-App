import { expect, test } from "@playwright/test";
import type {
  TutorMemoryProfile,
  TutorMemoryRecommendation,
  TutorMemorySummary,
  TutorMemorySignal,
  TutorMemoryLearningPathSnapshot,
} from "../src/app/lib/tutor-memory/types";

// Explicit Whitelist of all allowed keys in any TutorMemory object serialization
const ALLOWED_KEYS = new Set([
  // TutorMemoryProfile
  "version",
  "learnerLevel",
  "signals",
  "learningPath",
  "recentFocusCategories",
  "repeatedFocusCategories",
  "lastSummaryWindow",
  "lastUpdatedAt",

  // TutorMemorySignal
  "source",
  "category",
  "count",
  "window",
  "lastSeenAt",

  // TutorMemoryLearningPathSnapshot
  "completedUnitIds",
  "completedCardCount",
  "cardTypeCompletionCounts",
  "currentCardId",
  "isPhaseComplete",

  // Card types (as keys in cardTypeCompletionCounts)
  "guided-word",
  "phrase-pattern",
  "sentence-builder",
  "micro-speaking",
  "weekly-checkpoint",

  // TutorMemoryRecommendation
  "suggestedCardType",
  "priority",
  "safeReason",
  "safeInstruction",
  "basedOn",

  // TutorMemorySummary
  "totalSignalCount",
  "topCategory",
  "repeatedCategories",
  "learningPathCompletionPercent",
  "recommendedCardType",
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

// Helper to recursively collect all keys of an object
function getAllKeys(obj: unknown): string[] {
  if (obj === null || typeof obj !== "object") {
    return [];
  }
  const keys: string[] = [];
  if (Array.isArray(obj)) {
    for (const item of obj) {
      keys.push(...getAllKeys(item));
    }
  } else {
    const record = obj as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      keys.push(key);
      keys.push(...getAllKeys(record[key]));
    }
  }
  return keys;
}

test.describe("Tutor Memory Types and Safe Contract Validation", () => {
  test("all constructed TutorMemory objects compile and contain only whitelisted keys", () => {
    // 1. Construct valid TutorMemorySignal
    const sampleSignal: TutorMemorySignal = {
      source: "feedback-summary",
      category: "grammar",
      count: 5,
      window: "7-day",
      lastSeenAt: "2026-05-30T15:00:00Z",
    };

    // 2. Construct valid TutorMemoryLearningPathSnapshot
    const sampleSnapshot: TutorMemoryLearningPathSnapshot = {
      completedUnitIds: ["unit-1-intro", "unit-2-basics"],
      completedCardCount: 7,
      cardTypeCompletionCounts: {
        "guided-word": 3,
        "phrase-pattern": 2,
        "sentence-builder": 2,
      },
      currentCardId: "d3-sentence-builder",
      isPhaseComplete: false,
    };

    // 3. Construct valid TutorMemoryProfile
    const sampleProfile: TutorMemoryProfile = {
      version: 1,
      learnerLevel: "Beginner",
      signals: [sampleSignal],
      learningPath: sampleSnapshot,
      recentFocusCategories: ["grammar", "fluency"],
      repeatedFocusCategories: ["grammar"],
      lastSummaryWindow: "7-day",
      lastUpdatedAt: "2026-05-30T15:00:00Z",
    };

    // 4. Construct valid TutorMemoryRecommendation
    const sampleRecommendation: TutorMemoryRecommendation = {
      suggestedCardType: "sentence-builder",
      priority: "high",
      safeReason: "Grammar patterns appeared frequently in recent practice",
      safeInstruction: "Focus on ordering words correctly.",
      basedOn: ["feedback-summary", "learning-path-progress"],
      category: "grammar",
    };

    // 5. Construct valid TutorMemorySummary
    const sampleSummary: TutorMemorySummary = {
      version: 1,
      totalSignalCount: 5,
      topCategory: "grammar",
      repeatedCategories: ["grammar"],
      learningPathCompletionPercent: 42,
      recommendedCardType: "sentence-builder",
      lastUpdatedAt: "2026-05-30T15:00:00Z",
    };

    // Verify all keys recursively across all sample structures
    const allProfileKeys = getAllKeys(sampleProfile);
    const allRecKeys = getAllKeys(sampleRecommendation);
    const allSummaryKeys = getAllKeys(sampleSummary);
    const combinedKeys = [...allProfileKeys, ...allRecKeys, ...allSummaryKeys];

    for (const key of combinedKeys) {
      expect(ALLOWED_KEYS.has(key)).toBe(true);
    }

    // Verify serialized output does not contain forbidden patterns
    const serializedProfile = JSON.stringify(sampleProfile);
    const serializedRec = JSON.stringify(sampleRecommendation);
    const serializedSummary = JSON.stringify(sampleSummary);

    const serializedPayloads = [serializedProfile, serializedRec, serializedSummary];

    for (const payload of serializedPayloads) {
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(payload).not.toMatch(pattern);
      }
    }
  });

  test("forbidden patterns are actively rejected on arbitrary text to verify test safety", () => {
    const safeText = JSON.stringify({
      version: 1,
      learnerLevel: "Beginner",
      reason: "Practicing sentence building",
    });
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(safeText).not.toMatch(pattern);
    }

    // Construct various unsafe strings and verify the regexes catch them
    expect("user@domain.com").toMatch(FORBIDDEN_PATTERNS[5]); // email
    expect("owner_id").toMatch(FORBIDDEN_PATTERNS[0]); // owner_id
    expect("sourceId").toMatch(FORBIDDEN_PATTERNS[0]); // sourceId
    expect("transcript of user speech").toMatch(FORBIDDEN_PATTERNS[1]); // transcript
    expect("userSentence content").toMatch(FORBIDDEN_PATTERNS[1]); // userSentence
    expect("betterPhrase here").toMatch(FORBIDDEN_PATTERNS[2]); // betterPhrase
    expect("correctedSentence here").toMatch(FORBIDDEN_PATTERNS[2]); // correctedSentence
    expect("articleUrl").toMatch(FORBIDDEN_PATTERNS[3]); // articleUrl
    expect("csvRow").toMatch(FORBIDDEN_PATTERNS[4]); // csvRow
    expect("struggling").toMatch(FORBIDDEN_PATTERNS[6]); // struggling
    expect("failing").toMatch(FORBIDDEN_PATTERNS[6]); // failing
    expect("weak learner").toMatch(FORBIDDEN_PATTERNS[6]); // weak learner
    expect("deficient").toMatch(FORBIDDEN_PATTERNS[6]); // deficient
    expect("disorder").toMatch(FORBIDDEN_PATTERNS[6]); // disorder
  });
});
