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
  buildImprovementProposalsFromDiagnostics,
  mapDiagnosticRiskToImprovementProposal,
  mapDiagnosticRecommendationToImprovementProposal,
  mapPhase2ReadinessBlockerToImprovementProposal,
  mapChecklistFailureToImprovementProposal,
  getImprovementProposalTypeForDiagnosticArea
} from "../src/app/lib/developer-diagnostics/improvement-connector";
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
  recommendations: DiagnosticRecommendation[] = [],
  phase2Readiness?: Phase2ReadinessResult
): DeveloperDiagnosticSnapshot {
  const foundations = createBaselineFoundations(foundationStatus);
  const dummyPhase2: Phase2ReadinessResult = phase2Readiness || {
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

test.describe("Developer Diagnostics Improvement Loop Connector", () => {
  const testNow = "2026-05-31T13:00:00Z";

  // Test 1: diagnostic risk maps to an ImprovementProposal
  test("1. diagnostic risk maps to an ImprovementProposal", () => {
    const risk: DiagnosticRisk = {
      area: "learning_path",
      severity: "high",
      description: "Learning path lacks strict sequence constraints",
      mitigation: "Add sequence index lock check"
    };
    const proposal = mapDiagnosticRiskToImprovementProposal(risk, testNow);
    expect(proposal.proposalId).toContain("curriculum_adjustment");
    expect(proposal.title).toBe("Resolve Diagnostic Risk in learning_path");
    expect(proposal.safeSummary).toBe("Learning path lacks strict sequence constraints");
    expect(proposal.priority).toBe("high");
    expect(proposal.requiresHumanApproval).toBe(true);
  });

  // Test 2: diagnostic recommendation maps to an ImprovementProposal
  test("2. diagnostic recommendation maps to an ImprovementProposal", () => {
    const rec: DiagnosticRecommendation = {
      recommendationId: "rec-MP-01",
      area: "micro_practice",
      priority: "medium",
      safeSummary: "Verify practice loop status tracking",
      suggestedNextStep: "Add status logging parameters",
      humanReviewRequired: true
    };
    const proposal = mapDiagnosticRecommendationToImprovementProposal(rec, testNow);
    expect(proposal.proposalId).toContain("micro_practice_adjustment");
    expect(proposal.title).toBe("Implement Recommendation rec-MP-01");
    expect(proposal.safeSummary).toBe("Verify practice loop status tracking");
    expect(proposal.priority).toBe("medium");
    expect(proposal.requiresHumanApproval).toBe(true);
  });

  // Test 3: Phase 2 readiness blocker maps to an ImprovementProposal
  test("3. Phase 2 readiness blocker maps to an ImprovementProposal", () => {
    const blocker: DiagnosticRisk = {
      area: "privacy",
      severity: "critical",
      description: "PII leak risk in system diagnostics logger",
      mitigation: "Implement strict sanitisation whitelist"
    };
    const proposal = mapPhase2ReadinessBlockerToImprovementProposal(blocker, testNow);
    expect(proposal.proposalId).toContain("test_coverage_improvement");
    expect(proposal.title).toBe("Resolve Phase 2 Readiness Blocker in privacy");
    expect(proposal.priority).toBe("critical");
    expect(proposal.requiresHumanApproval).toBe(true);
  });

  // Test 4: docs area maps to documentation_update
  test("4. docs area maps to documentation_update", () => {
    const type = getImprovementProposalTypeForDiagnosticArea("docs");
    expect(type).toBe("documentation_update");
  });

  // Test 5: tests area maps to test_coverage_improvement
  test("5. tests area maps to test_coverage_improvement", () => {
    const type = getImprovementProposalTypeForDiagnosticArea("tests");
    expect(type).toBe("test_coverage_improvement");
  });

  // Test 6: privacy area maps to critical test_coverage_improvement when failed
  test("6. privacy area maps to critical test_coverage_improvement when failed", () => {
    const item: DiagnosticChecklistItem = {
      id: "privacy-boundary-check",
      description: "Privacy boundary check has failed.",
      status: "fail" as unknown as "pending",
      mandatory: true
    };
    const proposal = mapChecklistFailureToImprovementProposal(item, testNow);
    expect(proposal.type).toBe("test_coverage_improvement");
    expect(proposal.priority).toBe("critical");
  });

  // Test 7: micro_practice area maps to micro_practice_adjustment
  test("7. micro_practice area maps to micro_practice_adjustment", () => {
    const type = getImprovementProposalTypeForDiagnosticArea("micro_practice");
    expect(type).toBe("micro_practice_adjustment");
  });

  // Test 8: learning_path area maps to curriculum_adjustment
  test("8. learning_path area maps to curriculum_adjustment", () => {
    const type = getImprovementProposalTypeForDiagnosticArea("learning_path");
    expect(type).toBe("curriculum_adjustment");
  });

  // Test 9: all generated proposals requireHumanApproval: true
  test("9. all generated proposals requireHumanApproval: true", () => {
    const snapshot = createMockSnapshot();
    const result = buildImprovementProposalsFromDiagnostics(snapshot, testNow);
    for (const proposal of result.proposals) {
      expect(proposal.requiresHumanApproval).toBe(true);
    }
  });

  // Test 10: proposal IDs are deterministic
  test("10. proposal IDs are deterministic", () => {
    const risk: DiagnosticRisk = {
      area: "learning_path",
      severity: "high",
      description: "Diagnostic risk check",
      mitigation: "Fix it"
    };
    const p1 = mapDiagnosticRiskToImprovementProposal(risk, testNow);
    const p2 = mapDiagnosticRiskToImprovementProposal(risk, testNow);
    expect(p1.proposalId).toBe(p2.proposalId);
  });

  // Test 11: generatedAt uses injected nowParam
  test("11. generatedAt uses injected nowParam", () => {
    const snapshot = createMockSnapshot();
    const result = buildImprovementProposalsFromDiagnostics(snapshot, testNow);
    expect(result.generatedAt).toBe(testNow);
  });

  // Test 12: connector result is advisoryOnly: true
  test("12. connector result is advisoryOnly: true", () => {
    const snapshot = createMockSnapshot();
    const result = buildImprovementProposalsFromDiagnostics(snapshot, testNow);
    expect(result.advisoryOnly).toBe(true);
  });

  // Test 13: helpers do not mutate input snapshot/readiness objects
  test("13. helpers do not mutate input snapshot/readiness objects", () => {
    const snapshot = createMockSnapshot({ privacy: "blocked" });
    const originalJson = JSON.stringify(snapshot);
    buildImprovementProposalsFromDiagnostics(snapshot, testNow);
    expect(JSON.stringify(snapshot)).toBe(originalJson);
  });

  // Test 14: same input produces identical output
  test("14. same input produces identical output", () => {
    const snapshot = createMockSnapshot();
    const res1 = buildImprovementProposalsFromDiagnostics(snapshot, testNow);
    const res2 = buildImprovementProposalsFromDiagnostics(snapshot, testNow);
    expect(res1).toEqual(res2);
  });

  // Test 15: serialized output contains no forbidden private fields
  test("15. serialized output contains no forbidden private fields", () => {
    const snapshot = createMockSnapshot();
    const result = buildImprovementProposalsFromDiagnostics(snapshot, testNow);
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

  // Test 16: source file does not contain prohibited calls/APIs
  test("16. source file does not contain prohibited calls/APIs", () => {
    const sourcePath = path.resolve(__dirname, "../src/app/lib/developer-diagnostics/improvement-connector.ts");
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
