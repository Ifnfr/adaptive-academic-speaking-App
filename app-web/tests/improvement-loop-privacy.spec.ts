import { expect, test } from "@playwright/test";
import { buildImprovementProposal } from "../src/app/lib/improvement-loop/build";
import {
  detectLearningPathFriction,
  detectMicroPracticeFriction,
  detectFeedbackPatternFriction,
  detectDocumentationGap,
} from "../src/app/lib/improvement-loop/friction";
import fs from "fs";
import path from "path";

// Forbidden patterns matching PII, user transcripts, URLs, credentials, or clinical terms
const FORBIDDEN_PATTERNS = [
  /owner_id|source_id|ownerId|sourceId/,
  /transcript|retryTranscript|userSentence/,
  /betterPhrase|correctedSentence|rawResponse/,
  /articleUrl|articleBody|sourceText/,
  /csvRow|csvData|sessionCsv/,
  /email|@.*\..*/,
  /struggling|failing|weak learner|deficient|disorder/,
];

test.describe("Improvement Loop Privacy and Scope QA Audits", () => {
  test("1. Forbidden data scan across all helpers serialized outputs", () => {
    // Generate a set of proposals
    const p1 = detectLearningPathFriction([
      { unitId: "unit-1", completionRate: 30, attemptCount: 5 },
    ]);
    const p2 = detectMicroPracticeFriction([
      { cardId: "card-1", attemptCount: 4, retryCount: 3 },
    ]);
    const p3 = detectFeedbackPatternFriction([
      { category: "fluency", count: 4 },
    ]);
    const p4 = detectDocumentationGap([
      { featureName: "test-feature", missingDocs: true },
    ]);

    const allProposals = [...p1, ...p2, ...p3, ...p4];

    for (const proposal of allProposals) {
      const serialized = JSON.stringify(proposal);

      // Verify no forbidden strings are present in serialized JSON
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(serialized).not.toMatch(pattern);
      }

      // Verify deterministic proposal IDs
      expect(proposal.proposalId).toContain("improvement-");
      expect(proposal.proposalId).not.toMatch(/[A-Z]/); // Should be lowercased clean strings

      // Verify requiresHumanApproval is always true
      expect(proposal.requiresHumanApproval).toBe(true);

      // Verify status is always 'draft' by default
      expect(proposal.status).toBe("draft");
    }
  });

  test("2. Source files contain no localStorage, Supabase, or cloud persistence reads/writes", () => {
    const files = ["build.ts", "friction.ts", "checklist.ts", "types.ts"];
    const baseDir = path.resolve(__dirname, "../src/app/lib/improvement-loop");

    for (const file of files) {
      const content = fs.readFileSync(path.join(baseDir, file), "utf-8");

      expect(content).not.toContain("localStorage");
      expect(content).not.toContain("sessionStorage");
      expect(content).not.toContain("supabase");
      expect(content).not.toContain("IndexedDB");
      expect(content).not.toContain("cookie");
      expect(content).not.toContain("fetch(");
    }
  });

  test("3. Source files contain no AI model calls, completions, or prompt deployment hooks", () => {
    const files = ["build.ts", "friction.ts", "checklist.ts", "types.ts"];
    const baseDir = path.resolve(__dirname, "../src/app/lib/improvement-loop");

    for (const file of files) {
      const content = fs.readFileSync(path.join(baseDir, file), "utf-8");

      expect(content).not.toContain("openai");
      expect(content).not.toContain("claude");
      expect(content).not.toContain("gemini");
      expect(content).not.toContain("anthropic");
      expect(content).not.toContain("deepseek");
      expect(content).not.toContain("chatCompletion");
      expect(content).not.toContain("generateText");
    }
  });

  test("4. Source files contain no auto-execution or self-modification code", () => {
    const files = ["build.ts", "friction.ts", "checklist.ts", "types.ts"];
    const baseDir = path.resolve(__dirname, "../src/app/lib/improvement-loop");

    for (const file of files) {
      const content = fs.readFileSync(path.join(baseDir, file), "utf-8");

      expect(content).not.toContain("child_process");
      expect(content).not.toContain("exec(");
      expect(content).not.toContain("spawn(");
      expect(content).not.toContain("fs.writeFileSync");
      expect(content).not.toContain("fs.writeFile");
      expect(content).not.toContain("git ");
    }
  });

  test("5. Outputs are fully deterministic and free of system timestamp or math random calls", () => {
    const mockEvidence = { attemptCount: 5, retryCount: 3 };

    const p1 = buildImprovementProposal(
      "curriculum_adjustment",
      "test-area",
      "test-scope",
      mockEvidence
    );
    const p2 = buildImprovementProposal(
      "curriculum_adjustment",
      "test-area",
      "test-scope",
      mockEvidence
    );

    // Verify exactly same properties and values
    expect(JSON.stringify(p1)).toBe(JSON.stringify(p2));
  });
});
