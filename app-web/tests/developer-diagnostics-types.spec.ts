import { expect, test } from "@playwright/test";
import type {
  DeveloperDiagnosticSnapshot,
  FoundationReadinessResult,
  Phase2ReadinessResult,
  DiagnosticRecommendation,
} from "../src/app/lib/developer-diagnostics/types";
import * as fs from "fs";
import * as path from "path";

const ALLOWED_KEYS = new Set([
  "version",
  "generatedAt",
  "foundations",
  "availableSignals",
  "missingSignals",
  "risks",
  "recommendations",
  "phase2Readiness",
  "improvementProposalRefs",
  "checklist",

  // nested/item keys
  "learning_path",
  "micro_practice",
  "feedback_normalization",
  "tutor_memory",
  "improvement_loop",
  "docs",
  "tests",
  "privacy",
  "status",
  "readinessScore",
  "passedChecks",
  "failedChecks",
  "warnings",
  "foundation",
  "signalName",
  "isAvailable",
  "reason",
  "area",
  "severity",
  "description",
  "mitigation",
  "recommendationId",
  "priority",
  "safeSummary",
  "suggestedNextStep",
  "humanReviewRequired",
  "id",
  "mandatory",
  "score",
  "isReady",
  "blockers"
]);

const FORBIDDEN_PATTERNS = [
  /owner_id|source_id|ownerId|sourceId/,
  /transcript|retryTranscript|userSentence/,
  /betterPhrase|correctedSentence|rawResponse/,
  /articleUrl|articleBody|sourceText/,
  /csvRow|csvData|sessionCsv/,
  /email|@.*\..*/,
  /struggling|failing|weak learner|deficient|disorder/,
];

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

test.describe("Developer Diagnostics Type Contract and Serialization Tests", () => {
  test("construct sample objects and check fields", () => {
    // 1. Construct sample FoundationReadinessResult
    const sampleFoundationResult: FoundationReadinessResult = {
      status: "ready",
      readinessScore: 95,
      passedChecks: ["test_check_1", "test_check_2"],
      failedChecks: [],
      warnings: ["warning_1"],
    };
    expect(sampleFoundationResult.status).toBe("ready");
    expect(sampleFoundationResult.readinessScore).toBe(95);

    // 2. Construct sample Phase2ReadinessResult
    const samplePhase2Result: Phase2ReadinessResult = {
      status: "ready_for_research",
      score: 80,
      isReady: true,
      blockers: [],
    };
    expect(samplePhase2Result.status).toBe("ready_for_research");
    expect(samplePhase2Result.score).toBe(80);

    // 3. Construct sample DiagnosticRecommendation (must match DiagnosticRecommendation contract)
    const sampleRecommendation: DiagnosticRecommendation = {
      recommendationId: "rec-LP-01",
      area: "learning_path",
      priority: "critical",
      safeSummary: "Verify sequential path locking",
      suggestedNextStep: "Audit advisory bridge recommendations",
      humanReviewRequired: true,
    };
    expect(sampleRecommendation.recommendationId).toBe("rec-LP-01");
    expect(sampleRecommendation.area).toBe("learning_path");
    expect(sampleRecommendation.priority).toBe("critical");
    expect(sampleRecommendation.safeSummary).toBe("Verify sequential path locking");
    expect(sampleRecommendation.suggestedNextStep).toBe("Audit advisory bridge recommendations");
    expect(sampleRecommendation.humanReviewRequired).toBe(true);

    // 4. Construct complete DeveloperDiagnosticSnapshot
    const sampleSnapshot: DeveloperDiagnosticSnapshot = {
      version: "1.0",
      generatedAt: "2026-05-31T10:00:00Z",
      foundations: {
        learning_path: sampleFoundationResult,
        micro_practice: {
          status: "ready",
          readinessScore: 100,
          passedChecks: [],
          failedChecks: [],
          warnings: [],
        },
        feedback_normalization: {
          status: "ready",
          readinessScore: 100,
          passedChecks: [],
          failedChecks: [],
          warnings: [],
        },
        tutor_memory: {
          status: "ready",
          readinessScore: 100,
          passedChecks: [],
          failedChecks: [],
          warnings: [],
        },
        improvement_loop: {
          status: "ready",
          readinessScore: 100,
          passedChecks: [],
          failedChecks: [],
          warnings: [],
        },
        docs: {
          status: "ready",
          readinessScore: 100,
          passedChecks: [],
          failedChecks: [],
          warnings: [],
        },
        tests: {
          status: "ready",
          readinessScore: 100,
          passedChecks: [],
          failedChecks: [],
          warnings: [],
        },
        privacy: {
          status: "ready",
          readinessScore: 100,
          passedChecks: [],
          failedChecks: [],
          warnings: [],
        },
      },
      availableSignals: [
        {
          foundation: "learning_path",
          signalName: "cards_completed",
          isAvailable: true,
          reason: "Tests verified",
        },
      ],
      missingSignals: [],
      risks: [],
      recommendations: [sampleRecommendation],
      phase2Readiness: samplePhase2Result,
      improvementProposalRefs: [],
      checklist: [],
    };

    // Verify allowed keys whitelist
    const keys = getAllKeys(sampleSnapshot);
    for (const key of keys) {
      if (
        key === "test_check_1" ||
        key === "test_check_2" ||
        key === "warning_1" ||
        key === "cards_completed" ||
        key === "Tests verified"
      ) {
        continue;
      }
      expect(ALLOWED_KEYS.has(key)).toBe(true);
    }

    // Verify privacy boundaries in serialized content
    const serialized = JSON.stringify(sampleSnapshot);
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(serialized).not.toMatch(pattern);
    }
  });

  test("types file has no prohibited imports and no logic", () => {
    const typesFilePath = path.resolve(__dirname, "../src/app/lib/developer-diagnostics/types.ts");
    const content = fs.readFileSync(typesFilePath, "utf8");

    // Types file must not have imports
    expect(content).not.toContain("import ");
    // Verify no function implementation (helper/builders/validators/evaluators) exists
    expect(content).not.toContain("function ");
    expect(content).not.toContain("=>");
  });
});
