import { expect, test } from "@playwright/test";
import type {
  DeveloperDiagnosticSnapshot,
  FoundationDiagnosticArea,
  FoundationReadinessStatus,
  FoundationReadinessResult,
  DiagnosticRisk,
  DiagnosticChecklistItem,
  DiagnosticRecommendation,
  Phase2ReadinessResult
} from "../src/app/lib/developer-diagnostics/types";
import {
  buildDeveloperDiagnosticSnapshot
} from "../src/app/lib/developer-diagnostics/snapshot";
import {
  buildDeveloperDiagnosticReport,
  renderDeveloperDiagnosticReportMarkdown
} from "../src/app/lib/developer-diagnostics/report";
import { evaluatePhase2Readiness } from "../src/app/lib/developer-diagnostics/phase2-readiness";
import { buildImprovementProposalsFromDiagnostics } from "../src/app/lib/developer-diagnostics/improvement-connector";
import * as fs from "fs";
import * as path from "path";

const SOURCE_FILES = [
  "types.ts",
  "snapshot.ts",
  "report.ts",
  "phase2-readiness.ts",
  "improvement-connector.ts"
].map(f => path.resolve(__dirname, "../src/app/lib/developer-diagnostics", f));

function createReadyFoundation(
  area: FoundationDiagnosticArea,
  status: FoundationReadinessStatus = "ready"
): FoundationReadinessResult {
  return {
    status,
    readinessScore: status === "ready" ? 100 : 0,
    passedChecks: [`Passed for ${area}`],
    failedChecks: [],
    warnings: [],
    safeSummary: `Foundation ${area} is ${status}`,
    availableSignals: [],
    missingSignals: []
  };
}

function createBaselineFoundations(): Record<FoundationDiagnosticArea, FoundationReadinessResult> {
  const areas: FoundationDiagnosticArea[] = [
    "learning_path",
    "micro_practice",
    "feedback_normalization",
    "tutor_memory",
    "improvement_loop",
    "docs",
    "tests",
    "privacy"
  ];
  const foundations = {} as Record<FoundationDiagnosticArea, FoundationReadinessResult>;
  for (const area of areas) {
    foundations[area] = createReadyFoundation(area);
  }
  return foundations;
}

function createMockSnapshot(
  risks: DiagnosticRisk[] = [],
  checklist: DiagnosticChecklistItem[] = [],
  recommendations: DiagnosticRecommendation[] = []
): DeveloperDiagnosticSnapshot {
  const dummyPhase2: Phase2ReadinessResult = {
    status: "needs_review",
    blockers: [],
    safeSummary: "",
    requiredBeforeImplementation: []
  };
  return buildDeveloperDiagnosticSnapshot(
    "2026-05-31T12:00:00Z",
    createBaselineFoundations(),
    risks,
    recommendations,
    dummyPhase2,
    checklist,
    "Mock Top Summary"
  );
}

test.describe("Developer Diagnostics Privacy QA and Boundary Audit", () => {
  // Test 1: Forbidden data scan on serialized outputs
  test("1. serialized outputs contain no forbidden private fields", () => {
    const risk: DiagnosticRisk = {
      area: "privacy",
      severity: "high",
      description: "Generic risk summary",
      mitigation: "Generic mitigation recommendation"
    };

    const rec: DiagnosticRecommendation = {
      recommendationId: "rec-LP-01",
      area: "learning_path",
      priority: "high",
      safeSummary: "Safe baseline recommendation",
      suggestedNextStep: "Verify sequential constraints",
      humanReviewRequired: true
    };

    const snapshot = createMockSnapshot([risk], [], [rec]);
    const report = buildDeveloperDiagnosticReport(snapshot);
    const mdReport = renderDeveloperDiagnosticReportMarkdown(report);
    const readiness = evaluatePhase2Readiness(snapshot);
    const proposals = buildImprovementProposalsFromDiagnostics(snapshot, "2026-05-31T12:00:00Z");

    const serializedOutputs = [
      JSON.stringify(snapshot),
      JSON.stringify(report),
      mdReport,
      JSON.stringify(readiness),
      JSON.stringify(proposals)
    ];

    const forbiddenPatterns = [
      /owner_id|source_id|ownerId|sourceId/,
      /transcript|retryTranscript|userSentence/,
      /betterPhrase|correctedSentence|rawResponse/,
      /articleUrl|articleBody|sourceText/,
      /csvRow|csvData|sessionCsv/,
      /email|@.*\..*/,
      /struggling|failing|weak learner|deficient|disorder/
    ];

    for (const out of serializedOutputs) {
      for (const pattern of forbiddenPatterns) {
        expect(out).not.toMatch(pattern);
      }
    }
  });

  // Test 2-8: Static analysis checks on source files
  test("2. source files do not contain forbidden persistence/storage calls", () => {
    for (const filePath of SOURCE_FILES) {
      const content = fs.readFileSync(filePath, "utf8");
      expect(content).not.toContain("localStorage");
      expect(content).not.toContain("sessionStorage");
      expect(content).not.toContain("indexedDB");
      expect(content).not.toContain("document.cookie");
      expect(content).not.toContain("caches.open");
    }
  });

  test("3. source files do not contain network or database APIs", () => {
    for (const filePath of SOURCE_FILES) {
      const content = fs.readFileSync(filePath, "utf8");
      expect(content).not.toContain("fetch(");
      expect(content).not.toContain("XMLHttpRequest");
      expect(content).not.toContain("WebSocket");
      expect(content).not.toContain("EventSource");
      expect(content).not.toContain("supabase");
      expect(content).not.toContain("createClient(");
      expect(content).not.toContain("prisma");
      // Check for SQL statements (using boundary anchors to avoid false positives like "documentation_update")
      expect(content).not.toMatch(/\b(SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i);
    }
  });

  test("4. source files do not contain AI SDK or LLM endpoint invocations", () => {
    for (const filePath of SOURCE_FILES) {
      const content = fs.readFileSync(filePath, "utf8");
      expect(content).not.toContain("openai");
      expect(content).not.toContain("anthropic");
      expect(content).not.toContain("gemini");
      expect(content).not.toContain("chat.completions");
      expect(content).not.toContain("generateText");
      expect(content).not.toContain("generateObject");
    }
  });

  test("5. source files are decoupled from Next.js routing and React components", () => {
    for (const filePath of SOURCE_FILES) {
      const content = fs.readFileSync(filePath, "utf8");
      expect(content).not.toContain("react");
      expect(content).not.toContain("next/router");
      expect(content).not.toContain("next/navigation");
      expect(content).not.toContain("Sidebar");
      expect(content).not.toContain("Clerk");
      expect(content).not.toContain("useRouter");
      expect(content).not.toContain("usePathname");
    }
  });

  test("6. source files do not access local filesystem, shell, or run git commands", () => {
    for (const filePath of SOURCE_FILES) {
      const content = fs.readFileSync(filePath, "utf8");
      // Prevent imports/calls of fs or child_process
      expect(content).not.toMatch(/require\(['"]fs['"]\)|import.*from ['"]fs['"]/);
      expect(content).not.toContain("writeFile");
      expect(content).not.toContain("appendFile");
      expect(content).not.toContain("child_process");
      expect(content).not.toContain("exec(");
      expect(content).not.toContain("spawn(");
      expect(content).not.toContain("process.env");
    }
  });

  test("7. source files do not execute nondeterministic time, randomizer, or UUID calls", () => {
    for (const filePath of SOURCE_FILES) {
      const content = fs.readFileSync(filePath, "utf8");
      expect(content).not.toContain("Date.now");
      expect(content).not.toContain("new Date()");
      expect(content).not.toContain("Math.random");
      expect(content).not.toContain("randomUUID");
      expect(content).not.toContain("crypto.randomUUID");
    }
  });

  test("8. source files do not use unsafe object clone or pass-through patterns", () => {
    for (const filePath of SOURCE_FILES) {
      const content = fs.readFileSync(filePath, "utf8");
      expect(content).not.toContain("Object.assign");
      expect(content).not.toContain("JSON.parse(JSON.stringify");
    }
  });

  // Test 9: Advisory-only keywords check
  test("9. report outputs do not include auto-execution keywords", () => {
    const snapshot = createMockSnapshot();
    const report = buildDeveloperDiagnosticReport(snapshot);
    const md = renderDeveloperDiagnosticReportMarkdown(report);
    const result = evaluatePhase2Readiness(snapshot);
    const proposals = buildImprovementProposalsFromDiagnostics(snapshot, "2026-05-31T12:00:00Z");

    const outputs = [md, JSON.stringify(result), JSON.stringify(proposals)];
    const executionKeywords = [
      /\bforce\b/i,
      /\block\b/i,
      /\bblockUser\b/i,
      /\boverride\b/i,
      /\bmandatoryExecution\b/i,
      /\bautoApply\b/i,
      /\bautoFix\b/i,
      /\bautoCommit\b/i,
      /\bdeploy\b/i,
      /\bmigrate\b/i
    ];

    for (const out of outputs) {
      for (const pattern of executionKeywords) {
        expect(out).not.toMatch(pattern);
      }
    }
  });

  // Test 10: Human review validation
  test("10. diagnostic recommendations and connector proposals require human review", () => {
    const rec: DiagnosticRecommendation = {
      recommendationId: "rec-LP-01",
      area: "learning_path",
      priority: "high",
      safeSummary: "Safe baseline recommendation",
      suggestedNextStep: "Verify sequential constraints",
      humanReviewRequired: true
    };
    const snapshot = createMockSnapshot([], [], [rec]);
    const report = buildDeveloperDiagnosticReport(snapshot);
    const md = renderDeveloperDiagnosticReportMarkdown(report);
    expect(md).toContain("Human review is required");
    
    const proposals = buildImprovementProposalsFromDiagnostics(snapshot, "2026-05-31T12:00:00Z");
    for (const p of proposals.proposals) {
      expect(p.requiresHumanApproval).toBe(true);
    }
  });

  // Test 11: Determinism
  test("11. helper outputs are deterministic", () => {
    const snapshot = createMockSnapshot();
    const result1 = evaluatePhase2Readiness(snapshot);
    const result2 = evaluatePhase2Readiness(snapshot);
    expect(result1).toEqual(result2);

    const report1 = buildDeveloperDiagnosticReport(snapshot);
    const report2 = buildDeveloperDiagnosticReport(snapshot);
    expect(report1).toEqual(report2);

    const proposals1 = buildImprovementProposalsFromDiagnostics(snapshot, "2026-05-31T12:00:00Z");
    const proposals2 = buildImprovementProposalsFromDiagnostics(snapshot, "2026-05-31T12:00:00Z");
    expect(proposals1).toEqual(proposals2);
  });

  // Test 12: Immutability
  test("12. representative helpers do not mutate inputs", () => {
    const snapshot = createMockSnapshot();
    const originalJson = JSON.stringify(snapshot);

    evaluatePhase2Readiness(snapshot);
    buildDeveloperDiagnosticReport(snapshot);
    buildImprovementProposalsFromDiagnostics(snapshot, "2026-05-31T12:00:00Z");

    expect(JSON.stringify(snapshot)).toBe(originalJson);
  });
});
