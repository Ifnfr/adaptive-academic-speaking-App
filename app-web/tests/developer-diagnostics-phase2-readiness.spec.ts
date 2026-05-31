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
import { buildDeveloperDiagnosticSnapshot } from "../src/app/lib/developer-diagnostics/snapshot";
import {
  evaluatePhase2Readiness,
  getPhase2ReadinessStatus,
  buildPhase2ReadinessChecklist,
  getPhase2ReadinessBlockers,
  getPhase2ReadinessRecommendations
} from "../src/app/lib/developer-diagnostics/phase2-readiness";
import * as fs from "fs";
import * as path from "path";

function createReadyFoundation(
  area: FoundationDiagnosticArea,
  status: FoundationReadinessStatus = "ready"
): FoundationReadinessResult {
  return {
    status,
    readinessScore: status === "ready" ? 100 : status === "partially_ready" ? 60 : 0,
    passedChecks: [`Passed for ${area}`],
    failedChecks: status === "blocked" ? [`Blocked for ${area}`] : [],
    warnings: status === "partially_ready" ? [`Warning for ${area}`] : [],
    safeSummary: `Foundation ${area} is ${status}`,
    availableSignals: [],
    missingSignals: []
  };
}

function createBaselineFoundations(
  customStates: Partial<Record<FoundationDiagnosticArea, FoundationReadinessStatus>> = {}
): Record<FoundationDiagnosticArea, FoundationReadinessResult> {
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
    const status = customStates[area] || "ready";
    foundations[area] = createReadyFoundation(area, status);
  }
  return foundations;
}

function createMockSnapshot(
  foundationStatus: Partial<Record<FoundationDiagnosticArea, FoundationReadinessStatus>> = {},
  risks: DiagnosticRisk[] = [],
  checklist: DiagnosticChecklistItem[] = [],
  recommendations: DiagnosticRecommendation[] = []
): DeveloperDiagnosticSnapshot {
  const foundations = createBaselineFoundations(foundationStatus);
  const dummyPhase2: Phase2ReadinessResult = {
    status: "needs_review",
    blockers: [],
    safeSummary: "",
    requiredBeforeImplementation: []
  };
  return buildDeveloperDiagnosticSnapshot(
    "2026-05-31T12:00:00Z",
    foundations,
    risks,
    recommendations,
    dummyPhase2,
    checklist,
    "Mock Top Summary"
  );
}

test.describe("Phase 2 Readiness Evaluator", () => {
  // Test 1: evaluatePhase2Readiness returns blocked_by_privacy_risk for blocked privacy foundation
  test("1. evaluatePhase2Readiness returns blocked_by_privacy_risk for blocked privacy foundation", () => {
    const snapshot = createMockSnapshot({ privacy: "blocked" });
    const result = evaluatePhase2Readiness(snapshot);
    expect(result.status).toBe("blocked_by_privacy_risk");
    expect(result.blockers.some(b => b.description === "Privacy foundation is blocked.")).toBe(true);
  });

  // Test 2: Returns blocked_by_privacy_risk for critical privacy risk
  test("2. Returns blocked_by_privacy_risk for critical privacy risk", () => {
    const criticalRisk: DiagnosticRisk = {
      area: "privacy",
      severity: "critical",
      description: "PII leak risk identified in prompt template",
      mitigation: "Strictly sanitise the template variables"
    };
    const snapshot = createMockSnapshot({}, [criticalRisk]);
    const result = evaluatePhase2Readiness(snapshot);
    expect(result.status).toBe("blocked_by_privacy_risk");
    expect(result.blockers.some(b => b.description === "PII leak risk identified in prompt template")).toBe(true);
  });

  // Test 2b: Returns blocked_by_privacy_risk for failed privacy checklist item
  test("2b. Returns blocked_by_privacy_risk for failed privacy checklist item", () => {
    const failedChecklist: DiagnosticChecklistItem = {
      id: "privacy-audit-01",
      description: "Ensure zero user transcripts are sent to third parties",
      status: "fail" as unknown as "pending", // Cast to match custom fail status
      mandatory: true
    };
    const snapshot = createMockSnapshot({}, [], [failedChecklist]);
    const result = evaluatePhase2Readiness(snapshot);
    expect(result.status).toBe("blocked_by_privacy_risk");
    expect(
      result.blockers.some(b => b.description.includes("Ensure zero user transcripts are sent to third parties"))
    ).toBe(true);
  });

  // Test 3: Returns blocked_by_missing_tests for blocked tests foundation
  test("3. Returns blocked_by_missing_tests for blocked tests foundation", () => {
    const snapshot = createMockSnapshot({ tests: "blocked" });
    const result = evaluatePhase2Readiness(snapshot);
    expect(result.status).toBe("blocked_by_missing_tests");
    expect(result.blockers.some(b => b.description === "Tests foundation is blocked.")).toBe(true);
  });

  // Test 4: Returns blocked_by_missing_tests for failed test checklist
  test("4. Returns blocked_by_missing_tests for failed test checklist", () => {
    const failedChecklist: DiagnosticChecklistItem = {
      id: "test-coverage-01",
      description: "E2E testing coverage for core user scenarios",
      status: "fail" as unknown as "pending",
      mandatory: true
    };
    const snapshot = createMockSnapshot({}, [], [failedChecklist]);
    const result = evaluatePhase2Readiness(snapshot);
    expect(result.status).toBe("blocked_by_missing_tests");
    expect(
      result.blockers.some(b => b.description.includes("E2E testing coverage for core user scenarios"))
    ).toBe(true);
  });

  // Test 4b: Returns blocked_by_missing_tests for critical test risk
  test("4b. Returns blocked_by_missing_tests for critical test risk", () => {
    const criticalRisk: DiagnosticRisk = {
      area: "tests",
      severity: "critical",
      description: "Test environment is down or unconfigured",
      mitigation: "Check testing pipeline credentials"
    };
    const snapshot = createMockSnapshot({}, [criticalRisk]);
    const result = evaluatePhase2Readiness(snapshot);
    expect(result.status).toBe("blocked_by_missing_tests");
    expect(result.blockers.some(b => b.description === "Test environment is down or unconfigured")).toBe(true);
  });

  // Test 5: Returns ready_for_research when foundations are partially ready but no blockers exist
  test("5. Returns ready_for_research when foundations are partially ready but no blockers exist", () => {
    const snapshot = createMockSnapshot({
      learning_path: "partially_ready",
      micro_practice: "partially_ready",
      feedback_normalization: "partially_ready",
      tutor_memory: "partially_ready",
      improvement_loop: "partially_ready",
      docs: "partially_ready",
      tests: "partially_ready",
      privacy: "partially_ready"
    });
    const result = evaluatePhase2Readiness(snapshot);
    expect(result.status).toBe("ready_for_research");
    expect(result.blockers.length).toBe(0);
  });

  // Test 6: Returns ready_for_curriculum_design when learning_path, micro_practice, docs, and privacy are ready or partially ready
  test("6. Returns ready_for_curriculum_design when learning_path, micro_practice, docs, and privacy are ready or partially ready", () => {
    const snapshot = createMockSnapshot({
      learning_path: "partially_ready",
      micro_practice: "partially_ready",
      docs: "partially_ready",
      privacy: "partially_ready",
      tests: "ready", // Need ready or partially_ready tests to avoid needs_review
      feedback_normalization: "not_started",
      tutor_memory: "not_started",
      improvement_loop: "not_started"
    });
    const result = evaluatePhase2Readiness(snapshot);
    expect(result.status).toBe("ready_for_curriculum_design");
    expect(result.blockers.length).toBe(0);
  });

  // Test 7: Returns ready_for_static_implementation when required foundations are ready and no high/critical risks exist
  test("7. Returns ready_for_static_implementation when required foundations are ready and no high/critical risks exist", () => {
    const snapshot = createMockSnapshot({
      learning_path: "ready",
      micro_practice: "ready",
      tests: "ready",
      privacy: "ready",
      feedback_normalization: "ready",
      tutor_memory: "ready",
      improvement_loop: "ready"
    });
    const result = evaluatePhase2Readiness(snapshot);
    expect(result.status).toBe("ready_for_static_implementation");
    expect(result.blockers.length).toBe(0);
  });

  // Test 8: Returns not_ready_for_adaptive_integration when static implementation is safe but adaptive foundations still need review
  test("8. Returns not_ready_for_adaptive_integration when static implementation is safe but adaptive foundations still need review", () => {
    const snapshot = createMockSnapshot({
      learning_path: "ready",
      micro_practice: "ready",
      tests: "ready",
      privacy: "ready",
      feedback_normalization: "needs_review",
      tutor_memory: "ready",
      improvement_loop: "ready"
    });
    const result = evaluatePhase2Readiness(snapshot);
    expect(result.status).toBe("not_ready_for_adaptive_integration");
    expect(result.blockers.length).toBe(0);
  });

  // Test 9: Returns needs_review for mixed non-blocking states
  test("9. Returns needs_review for mixed non-blocking states", () => {
    const snapshot = createMockSnapshot({
      learning_path: "not_started",
      micro_practice: "not_started",
      docs: "not_started",
      tests: "not_started",
      privacy: "ready"
    });
    const result = evaluatePhase2Readiness(snapshot);
    expect(result.status).toBe("needs_review");
    expect(result.blockers.length).toBe(0);
  });

  // Test 10: Output is advisory only and does not contain auto-implementation language
  test("10. Output is advisory only and does not contain auto-implementation language", () => {
    const snapshot = createMockSnapshot();
    const result = evaluatePhase2Readiness(snapshot);
    expect(result.safeSummary).toContain("ready");
    expect(result.safeSummary).not.toContain("auto-implement");
    expect(result.safeSummary).not.toContain("executing");
    expect(result.safeSummary).not.toContain("activating");
  });

  // Test 11: Output uses only Phase2ReadinessResult safe fields
  test("11. Output uses only Phase2ReadinessResult safe fields", () => {
    const snapshot = createMockSnapshot();
    const result = evaluatePhase2Readiness(snapshot);
    const keys = Object.keys(result);
    const allowed = ["status", "blockers", "safeSummary", "requiredBeforeImplementation"];
    for (const key of keys) {
      expect(allowed).toContain(key);
    }
  });

  // Test 12: Helpers do not mutate input snapshot
  test("12. Helpers do not mutate input snapshot", () => {
    const snapshot = createMockSnapshot({ privacy: "blocked" });
    const originalJson = JSON.stringify(snapshot);
    evaluatePhase2Readiness(snapshot);
    getPhase2ReadinessStatus(snapshot);
    getPhase2ReadinessBlockers(snapshot);
    getPhase2ReadinessRecommendations(snapshot);
    buildPhase2ReadinessChecklist(snapshot);
    expect(JSON.stringify(snapshot)).toBe(originalJson);
  });

  // Test 13: Same input produces identical output
  test("13. Same input produces identical output", () => {
    const snapshot = createMockSnapshot();
    const result1 = evaluatePhase2Readiness(snapshot);
    const result2 = evaluatePhase2Readiness(snapshot);
    expect(result1).toEqual(result2);
  });

  // Test 14: Serialized output contains no forbidden private fields
  test("14. Serialized output contains no forbidden private fields", () => {
    const snapshot = createMockSnapshot();
    const result = evaluatePhase2Readiness(snapshot);
    const serialized = JSON.stringify(result);

    const forbiddenPatterns = [
      /owner_id|source_id|ownerId|sourceId/,
      /transcript|retryTranscript|userSentence/,
      /betterPhrase|correctedSentence|rawResponse/,
      /articleUrl|articleBody|sourceText/,
      /csvRow|csvData|sessionCsv/,
      /email|@.*\..*/,
      /struggling|failing|weak learner|deficient|disorder/
    ];

    for (const pattern of forbiddenPatterns) {
      expect(serialized).not.toMatch(pattern);
    }
  });

  // Test 15: Source file does not contain storage, fetch, Supabase, route, UI, AI, fs, shell, git, Date.now, Math.random, or randomUUID calls
  test("15. Source file does not contain prohibited calls/APIs", () => {
    const sourcePath = path.resolve(__dirname, "../src/app/lib/developer-diagnostics/phase2-readiness.ts");
    const content = fs.readFileSync(sourcePath, "utf8");

    // Check prohibited terms
    expect(content).not.toContain("localStorage");
    expect(content).not.toContain("sessionStorage");
    expect(content).not.toContain("indexedDB");
    expect(content).not.toContain("fetch");
    expect(content).not.toContain("supabase");
    expect(content).not.toContain("next/router");
    expect(content).not.toContain("next/navigation");
    expect(content).not.toContain("useRouter");
    expect(content).not.toContain("usePathname");
    expect(content).not.toContain("React");
    expect(content).not.toContain("JSX");
    expect(content).not.toContain("Date.now");
    expect(content).not.toContain("Math.random");
    expect(content).not.toContain("randomUUID");
    expect(content).not.toContain("fs.");
    expect(content).not.toContain("child_process");
    expect(content).not.toContain("shell");
  });
});
