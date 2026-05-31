import { expect, test } from "@playwright/test";
import {
  buildDeveloperDiagnosticReport,
  renderDeveloperDiagnosticReportMarkdown,
  getOverallDiagnosticStatus,
  buildFoundationReadinessSection,
  buildRiskSection,
  buildRecommendationSection,
  buildChecklistSection
} from "../src/app/lib/developer-diagnostics/report";
import { getDefaultFoundationReadiness } from "../src/app/lib/developer-diagnostics/snapshot";
import type {
  DeveloperDiagnosticSnapshot,
  DiagnosticRisk,
  DiagnosticRecommendation,
  DiagnosticChecklistItem
} from "../src/app/lib/developer-diagnostics/types";
import * as fs from "fs";
import * as path from "path";

const FORBIDDEN_PATTERNS = [
  /owner_id|source_id|ownerId|sourceId/,
  /transcript|retryTranscript|userSentence/,
  /betterPhrase|correctedSentence|rawResponse/,
  /articleUrl|articleBody|sourceText/,
  /csvRow|csvData|sessionCsv/,
  /email|@.*\..*/,
  /struggling|failing|weak learner|deficient|disorder/,
];

test.describe("Developer Diagnostics Report Builder Tests", () => {
  const getMockSnapshot = (): DeveloperDiagnosticSnapshot => ({
    version: "1",
    generatedAt: "2026-05-31T11:00:00Z",
    foundations: {
      learning_path: getDefaultFoundationReadiness("learning_path"),
      micro_practice: getDefaultFoundationReadiness("micro_practice"),
      feedback_normalization: getDefaultFoundationReadiness("feedback_normalization"),
      tutor_memory: getDefaultFoundationReadiness("tutor_memory"),
      improvement_loop: getDefaultFoundationReadiness("improvement_loop"),
      docs: getDefaultFoundationReadiness("docs"),
      tests: getDefaultFoundationReadiness("tests"),
      privacy: getDefaultFoundationReadiness("privacy")
    },
    availableSignals: [],
    missingSignals: [],
    risks: [],
    recommendations: [],
    phase2Readiness: {
      status: "ready_for_research",
      blockers: [],
      safeSummary: "Ready to design",
      requiredBeforeImplementation: []
    },
    improvementProposalRefs: [],
    checklist: [],
    safeSummary: "Base test snapshot"
  });

  test("1. buildDeveloperDiagnosticReport returns version 1 report", () => {
    const snapshot = getMockSnapshot();
    const report = buildDeveloperDiagnosticReport(snapshot);
    expect(report.version).toBe(1);
    expect(report.title).toBe("Developer Diagnostics System Report");
  });

  test("2. generatedAt is copied from snapshot", () => {
    const snapshot = getMockSnapshot();
    const report = buildDeveloperDiagnosticReport(snapshot);
    expect(report.generatedAt).toBe(snapshot.generatedAt);
  });

  test("3. overallStatus returns blocked when critical risk exists", () => {
    const snapshot = getMockSnapshot();
    const criticalRisk = {
      area: "tutor_memory" as const,
      severity: "critical" as unknown as DiagnosticRisk["severity"],
      description: "Critical risk",
      mitigation: "Fix it"
    };
    snapshot.risks.push(criticalRisk);
    const status = getOverallDiagnosticStatus(snapshot);
    expect(status).toBe("blocked");
  });

  test("4. overallStatus returns blocked when foundation status is blocked", () => {
    const snapshot = getMockSnapshot();
    snapshot.foundations.learning_path.status = "blocked";
    const status = getOverallDiagnosticStatus(snapshot);
    expect(status).toBe("blocked");
  });

  test("5. overallStatus returns needs_review for high/medium risks", () => {
    const snapshotHigh = getMockSnapshot();
    snapshotHigh.risks.push({
      area: "learning_path",
      severity: "high",
      description: "High risk",
      mitigation: "Mitigate"
    });
    expect(getOverallDiagnosticStatus(snapshotHigh)).toBe("needs_review");

    const snapshotMed = getMockSnapshot();
    snapshotMed.risks.push({
      area: "micro_practice",
      severity: "medium",
      description: "Medium risk",
      mitigation: "Mitigate"
    });
    expect(getOverallDiagnosticStatus(snapshotMed)).toBe("needs_review");
  });

  test("6. overallStatus returns needs_review for partially_ready or needs_review foundations", () => {
    const snapshotPartially = getMockSnapshot();
    snapshotPartially.foundations.tutor_memory.status = "partially_ready";
    expect(getOverallDiagnosticStatus(snapshotPartially)).toBe("needs_review");

    const snapshotNeedsReview = getMockSnapshot();
    snapshotNeedsReview.foundations.improvement_loop.status = "needs_review";
    expect(getOverallDiagnosticStatus(snapshotNeedsReview)).toBe("needs_review");
  });

  test("7. overallStatus returns ready only when all foundations are ready and no medium/high/critical risks exist", () => {
    const snapshot = getMockSnapshot();
    const areas = Object.keys(snapshot.foundations) as (keyof typeof snapshot.foundations)[];
    for (const a of areas) {
      snapshot.foundations[a].status = "ready";
    }
    expect(getOverallDiagnosticStatus(snapshot)).toBe("ready");
  });

  test("8. foundation readiness section contains safe readiness summaries", () => {
    const snapshot = getMockSnapshot();
    const section = buildFoundationReadinessSection(snapshot.foundations);
    expect(section.sectionId).toBe("foundation_readiness");
    expect(section.items[0]).toContain("learning_path");
    expect(section.items[0]).toContain("not_started");
  });

  test("9. risk section contains only safe risk fields", () => {
    const risks: DiagnosticRisk[] = [
      {
        area: "tutor_memory",
        severity: "medium",
        description: "Test description",
        mitigation: "Mitigation step"
      }
    ];
    const section = buildRiskSection(risks);
    expect(section.items[0]).toContain("risk-tutor_memory-medium");
    expect(section.items[0]).toContain("Mitigation step");
  });

  test("10. recommendation section preserves humanReviewRequired", () => {
    const recs: DiagnosticRecommendation[] = [
      {
        recommendationId: "rec-1",
        area: "docs",
        priority: "medium",
        safeSummary: "Verify documentation is up to date",
        suggestedNextStep: "Read guide",
        humanReviewRequired: true
      }
    ];
    const section = buildRecommendationSection(recs);
    expect(section.items[0]).toContain("Human Review Required: true");
  });

  test("11. checklist section contains only safe checklist fields", () => {
    const checklist: DiagnosticChecklistItem[] = [
      {
        id: "check-1",
        description: "Perform E2E validation run",
        status: "pending",
        mandatory: true
      }
    ];
    const section = buildChecklistSection(checklist);
    expect(section.items[0]).toContain("check-1");
    expect(section.items[0]).toContain("pending");
  });

  test("12. markdown renderer returns advisory developer-facing text", () => {
    const snapshot = getMockSnapshot();
    const report = buildDeveloperDiagnosticReport(snapshot);
    const md = renderDeveloperDiagnosticReportMarkdown(report);
    expect(md).toContain("# Developer Diagnostics System Report");
    expect(md).toContain("NEEDS_REVIEW");
  });

  test("13. markdown includes advisory statement", () => {
    const snapshot = getMockSnapshot();
    const report = buildDeveloperDiagnosticReport(snapshot);
    const md = renderDeveloperDiagnosticReportMarkdown(report);
    expect(md).toContain("This report is advisory only and does not modify app behavior.");
  });

  test("14. markdown includes human review statement", () => {
    const snapshot = getMockSnapshot();
    const report = buildDeveloperDiagnosticReport(snapshot);
    const md = renderDeveloperDiagnosticReportMarkdown(report);
    expect(md).toContain("Human review is required before implementation.");
  });

  test("15. markdown does not include automatic execution language", () => {
    const snapshot = getMockSnapshot();
    const report = buildDeveloperDiagnosticReport(snapshot);
    const md = renderDeveloperDiagnosticReportMarkdown(report);
    expect(md).not.toContain("auto-execute");
    expect(md).not.toContain("self-modify");
  });

  test("16. helpers do not mutate input snapshot", () => {
    const snapshot = getMockSnapshot();
    const originalJson = JSON.stringify(snapshot);
    buildDeveloperDiagnosticReport(snapshot);
    expect(JSON.stringify(snapshot)).toBe(originalJson);
  });

  test("17. same input produces identical JSON/markdown output", () => {
    const snapshot = getMockSnapshot();
    const r1 = buildDeveloperDiagnosticReport(snapshot);
    const r2 = buildDeveloperDiagnosticReport(snapshot);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));

    const md1 = renderDeveloperDiagnosticReportMarkdown(r1);
    const md2 = renderDeveloperDiagnosticReportMarkdown(r2);
    expect(md1).toBe(md2);
  });

  test("18. serialized report and markdown contain no forbidden private fields", () => {
    const snapshot = getMockSnapshot();
    const report = buildDeveloperDiagnosticReport(snapshot);
    const serializedReport = JSON.stringify(report);
    const md = renderDeveloperDiagnosticReportMarkdown(report);

    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(serializedReport).not.toMatch(pattern);
      expect(md).not.toMatch(pattern);
    }
  });

  test("19. source file does not contain prohibited calls", () => {
    const sourcePath = path.resolve(__dirname, "../src/app/lib/developer-diagnostics/report.ts");
    const content = fs.readFileSync(sourcePath, "utf8");

    expect(content).not.toContain("localStorage");
    expect(content).not.toContain("fetch(");
    expect(content).not.toContain("SupabaseClient");
    expect(content).not.toContain("createClient(");
    expect(content).not.toContain("Date.now(");
    expect(content).not.toContain("Math.random(");
    expect(content).not.toContain("randomUUID(");
    expect(content).not.toContain("fs.write");
    expect(content).not.toContain("child_process");
  });
});
