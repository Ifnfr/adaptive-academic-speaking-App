import { expect, test } from "@playwright/test";
import type {
  ImprovementProposal,
  ImprovementProposalEvidence,
} from "../src/app/lib/improvement-loop/types";

// Whitelist of allowed keys in ImprovementProposal object serialization
const ALLOWED_KEYS = new Set([
  "version",
  "proposalId",
  "type",
  "title",
  "safeSummary",
  "evidence",
  "affectedArea",
  "proposedChange",
  "expectedBenefit",
  "riskLevel",
  "priority",
  "status",
  "requiresHumanApproval",
  "createdAt",
  "updatedAt",

  // Evidence keys
  "repeatedCategoryCounts",
  "completionRate",
  "attemptCount",
  "retryCount",
  "cardId",
  "unitId",
  "testName",
  "missingDocsChecklist",
]);

// Forbidden patterns to block raw private/personal learning content
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

test.describe("Improvement Loop Types and Safe Contract Validation", () => {
  test("mock proposal compiles and adheres to key whitelist and privacy constraints", () => {
    const sampleEvidence: ImprovementProposalEvidence = {
      repeatedCategoryCounts: { grammar: 3, fluency: 1 },
      completionRate: 45,
      attemptCount: 10,
      retryCount: 6,
      cardId: "d3-sentence-builder",
      unitId: "unit-1-intro",
      testName: "privacy-qa-test",
      missingDocsChecklist: true,
    };

    const sampleProposal: ImprovementProposal = {
      version: "1.0",
      proposalId: "improvement-curriculum_adjustment-unit-1-intro-grammar",
      type: "curriculum_adjustment",
      title: "Optimize Grammar Patterns in Unit 1",
      safeSummary: "System detected high retry rates on card d3-sentence-builder under unit-1-intro.",
      evidence: sampleEvidence,
      affectedArea: "unit-1-intro",
      proposedChange: "Provide simpler sentence structures in Guided Word exercises.",
      expectedBenefit: "Reduce repeat retries and ease early learner cognitive load.",
      riskLevel: "low",
      priority: "high",
      status: "draft",
      requiresHumanApproval: true,
      createdAt: "2026-05-31T09:00:00Z",
      updatedAt: "2026-05-31T09:00:00Z",
    };

    // Verify type fields strictly map to allowed keys only
    const collectedKeys = getAllKeys(sampleProposal);
    for (const key of collectedKeys) {
      // Allow individual index key strings inside Record<string, number>
      if (key === "grammar" || key === "fluency") continue;
      expect(ALLOWED_KEYS.has(key)).toBe(true);
    }

    // Verify serialization contains zero forbidden terms
    const serialized = JSON.stringify(sampleProposal);
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(serialized).not.toMatch(pattern);
    }
  });
});
