import { expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";
import { buildTutorMemoryFromSources, getSafeTutorMemorySnapshot } from "../src/app/lib/tutor-memory/build";
import { buildTutorAwareRecommendation } from "../src/app/lib/tutor-memory/learning-path-bridge";
import { StoredLearningPathProgress } from "../src/app/lib/learning-path/types";
import { FeedbackSignalSummary } from "../src/app/lib/feedback-normalization/types";
import { RecommendationResult } from "../src/app/lib/learning-path/recommendation";

const SOURCE_FILES = [
  "src/app/lib/tutor-memory/types.ts",
  "src/app/lib/tutor-memory/build.ts",
  "src/app/lib/tutor-memory/recommend.ts",
  "src/app/lib/tutor-memory/learning-path-bridge.ts",
];

// Target patterns for static source analysis
const STORAGE_KEYWORDS = [
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "document.cookie",
  "supabase.auth",
  "supabase.from",
  "XMLHttpRequest",
];

const AI_KEYWORDS = [
  "openai",
  "anthropic",
  "openaiClient",
  "chat.completions",
  "generateText",
];

const COUPLING_KEYWORDS = [
  "app/api",
  "components/learning-path/",
  "page.tsx",
  "Sidebar",
];

const UNSAFE_KEYWORDS = [
  "Object.assign",
  "JSON.parse(JSON.stringify",
];

// Serialized patterns blocklist
const FORBIDDEN_SERIALIZED_PATTERNS = [
  /owner_id|source_id|ownerId|sourceId/,
  /transcript|retryTranscript|userSentence/,
  /betterPhrase|correctedSentence|rawResponse/,
  /articleUrl|articleBody|sourceText/,
  /csvRow|csvData|sessionCsv/,
  /email|@.*\..*/,
  /struggling|failing|weak learner|deficient|disorder/,
];

test.describe("Tutor Memory Privacy QA", () => {
  const fixedTimestamp = "2026-05-30T15:00:00.000Z";

  test("1. Forbidden data scan across all helpers serialized output", () => {
    const feedbackSummary: FeedbackSignalSummary = {
      version: 1,
      window: "7-day",
      topCategories: ["grammar"],
      countsByCategory: { grammar: 4 },
      recommendedNextActionId: "foundation-grammar-sentence-match",
      lastUpdatedAt: fixedTimestamp,
    };

    const progress: StoredLearningPathProgress = {
      pathId: "bcl",
      phaseId: "cf",
      cards: {
        "card-d1-c1": { cardId: "card-d1-c1", status: "completed", attemptCount: 1, lastUpdatedAt: fixedTimestamp },
      },
      lastRecommendedCardId: "card-d2-c1",
      lastUpdatedAt: fixedTimestamp,
    };

    const lpRecommendation: RecommendationResult = {
      recommendedCard: {
        id: "card-d2-c1",
        dayNumber: 2,
        unitId: "introduce-yourself",
        type: "guided-word",
        title: "Greeting Someone",
        targetPhrases: ["Hello"],
        learnerInstruction: "Speak",
        indonesianExplanation: "Speak",
        scaffold: "Hello",
        cta: "Start",
        estimatedMinutes: 2,
        completionRule: "recorded",
        linkedEngine: "guided-word",
        mobileLayoutHint: "compact",
      },
      isPhaseComplete: false,
      cardStatuses: {},
    };

    const profile = buildTutorMemoryFromSources({
      feedbackSummary,
      learningPathProgress: progress,
      microPracticeEvents: [],
      nowParam: fixedTimestamp,
    });

    const snapshot = getSafeTutorMemorySnapshot(profile);
    const bridge = buildTutorAwareRecommendation(lpRecommendation, profile, fixedTimestamp);

    const serializedPayloads = [
      JSON.stringify(profile),
      JSON.stringify(snapshot),
      JSON.stringify(bridge),
    ];

    for (const payload of serializedPayloads) {
      for (const pattern of FORBIDDEN_SERIALIZED_PATTERNS) {
        expect(payload).not.toMatch(pattern);
      }
    }
  });

  test("2. Source files contain no localStorage, sessionStorage, cookies, or Supabase client writes/reads", () => {
    for (const fileRelPath of SOURCE_FILES) {
      const filePath = path.resolve(process.cwd(), fileRelPath);
      const content = fs.readFileSync(filePath, "utf-8");

      for (const keyword of STORAGE_KEYWORDS) {
        expect(content).not.toContain(keyword);
      }
    }
  });

  test("3. Source files contain no AI model, completion or generation dependencies", () => {
    for (const fileRelPath of SOURCE_FILES) {
      const filePath = path.resolve(process.cwd(), fileRelPath);
      const content = fs.readFileSync(filePath, "utf-8");

      for (const keyword of AI_KEYWORDS) {
        expect(content).not.toContain(keyword);
      }
    }
  });

  test("4. Source files have no UI component, API route, or Page routing coupling", () => {
    for (const fileRelPath of SOURCE_FILES) {
      const filePath = path.resolve(process.cwd(), fileRelPath);
      const content = fs.readFileSync(filePath, "utf-8");

      for (const keyword of COUPLING_KEYWORDS) {
        expect(content).not.toContain(keyword);
      }
    }
  });

  test("5. Source files do not use unsafe pass-through patterns", () => {
    for (const fileRelPath of SOURCE_FILES) {
      const filePath = path.resolve(process.cwd(), fileRelPath);
      const content = fs.readFileSync(filePath, "utf-8");

      for (const keyword of UNSAFE_KEYWORDS) {
        expect(content).not.toContain(keyword);
      }
    }
  });

  test("6. Helper outputs are fully deterministic and free of system timestamp/random calls", () => {
    const feedbackSummary: FeedbackSignalSummary = {
      version: 1,
      window: "7-day",
      topCategories: ["grammar"],
      countsByCategory: { grammar: 4 },
      recommendedNextActionId: null,
      lastUpdatedAt: fixedTimestamp,
    };

    const out1 = buildTutorMemoryFromSources({
      feedbackSummary,
      learningPathProgress: null,
      microPracticeEvents: [],
      nowParam: fixedTimestamp,
    });

    const out2 = buildTutorMemoryFromSources({
      feedbackSummary,
      learningPathProgress: null,
      microPracticeEvents: [],
      nowParam: fixedTimestamp,
    });

    expect(JSON.stringify(out1)).toBe(JSON.stringify(out2));
    
    // Check files statically for Date.now or Math.random
    for (const fileRelPath of SOURCE_FILES) {
      const filePath = path.resolve(process.cwd(), fileRelPath);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).not.toContain("Date.now");
      expect(content).not.toContain("Math.random");
      expect(content).not.toContain("crypto.randomUUID");
    }
  });

  test("7. Advisory bridge output contains no hard-lock properties", () => {
    const lpRec: RecommendationResult = {
      recommendedCard: null,
      isPhaseComplete: true,
      cardStatuses: {},
    };

    const bridge = buildTutorAwareRecommendation(lpRec, null, fixedTimestamp);

    const keys = Object.keys(bridge);
    expect(keys).not.toContain("lock");
    expect(keys).not.toContain("force");
    expect(keys).not.toContain("required");
    expect(keys).not.toContain("block");
    expect(keys).not.toContain("override");
    expect(keys).not.toContain("mandatory");
  });
});
