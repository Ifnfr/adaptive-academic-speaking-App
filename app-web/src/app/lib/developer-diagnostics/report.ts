import type {
  FoundationDiagnosticArea,
  FoundationReadinessResult,
  DiagnosticRisk,
  DiagnosticRecommendation,
  DiagnosticChecklistItem,
  DeveloperDiagnosticSnapshot
} from "./types";

export type DeveloperDiagnosticReportFormat = "markdown" | "json" | "structured";

export interface DeveloperDiagnosticReportSection {
  sectionId: string;
  title: string;
  status: "pass" | "warning" | "fail" | "info";
  safeSummary: string;
  items: string[];
}

export interface DeveloperDiagnosticReport {
  version: number;
  title: string;
  generatedAt: string;
  overallStatus: "ready" | "needs_review" | "blocked";
  summary: string;
  sections: DeveloperDiagnosticReportSection[];
  checklist: string[];
  privacyNotice: string;
}

/**
 * Deterministically computes the overall status of the diagnostic run.
 */
export function getOverallDiagnosticStatus(
  snapshot: DeveloperDiagnosticSnapshot
): "ready" | "needs_review" | "blocked" {
  const foundationsList = Object.values(snapshot.foundations);

  // Blocked conditions: any blocked foundation status or critical risks/recommendations
  const hasBlockedFoundation = foundationsList.some(f => f.status === "blocked");
  const hasCriticalRisk = snapshot.risks.some(r => r.severity === "critical");
  const hasCriticalRecommendation = snapshot.recommendations.some(rec => rec.priority === "critical");

  if (hasBlockedFoundation || hasCriticalRisk || hasCriticalRecommendation) {
    return "blocked";
  }

  // Needs review conditions: any partially_ready/needs_review foundation or high/medium risks/recommendations
  const hasNeedsReviewFoundation = foundationsList.some(
    f => f.status === "needs_review" || f.status === "partially_ready"
  );
  const hasNeedsReviewRisk = snapshot.risks.some(r => r.severity === "high" || r.severity === "medium");
  const hasNeedsReviewRecommendation = snapshot.recommendations.some(
    rec => rec.priority === "high" || rec.priority === "medium"
  );

  if (hasNeedsReviewFoundation || hasNeedsReviewRisk || hasNeedsReviewRecommendation) {
    return "needs_review";
  }

  // Ready: all foundations ready and no warning/blocked metrics
  const allFoundationsReady = foundationsList.every(f => f.status === "ready");
  if (allFoundationsReady) {
    return "ready";
  }

  return "needs_review";
}

/**
 * Builds the foundation readiness section cleanly without exposing raw signals.
 */
export function buildFoundationReadinessSection(
  foundations: Record<FoundationDiagnosticArea, FoundationReadinessResult>
): DeveloperDiagnosticReportSection {
  const items: string[] = [];
  let hasWarning = false;
  let hasFail = false;

  const areas = Object.keys(foundations) as FoundationDiagnosticArea[];
  for (const area of areas) {
    const f = foundations[area];
    const availCount = f.availableSignals.length;
    const missCount = f.missingSignals.length;

    items.push(
      `Area: ${area} | Status: ${f.status} | Score: ${f.readinessScore}% | Available Signals: ${availCount} | Missing Signals: ${missCount} | Summary: ${f.safeSummary}`
    );

    if (f.status === "blocked") {
      hasFail = true;
    } else if (f.status === "needs_review" || f.status === "partially_ready") {
      hasWarning = true;
    }
  }

  const status = hasFail ? "fail" : hasWarning ? "warning" : "pass";

  return {
    sectionId: "foundation_readiness",
    title: "Foundation Readiness Summary",
    status,
    safeSummary: `Diagnostics run for ${areas.length} foundations.`,
    items
  };
}

/**
 * Builds the integration risk section cleanly without raw evidence details.
 */
export function buildRiskSection(risks: DiagnosticRisk[]): DeveloperDiagnosticReportSection {
  const items = risks.map((r, index) => {
    const riskId = `risk-${r.area}-${r.severity}-${index}`;
    return `Risk ID: ${riskId} | Area: ${r.area} | Level: ${r.severity} | Summary: ${r.description} | Mitigation: ${r.mitigation}`;
  });

  const hasCriticalOrHigh = risks.some(r => r.severity === "high" || r.severity === "critical");
  const hasMedium = risks.some(r => r.severity === "medium");
  const status = hasCriticalOrHigh ? "fail" : hasMedium ? "warning" : "pass";

  return {
    sectionId: "risks",
    title: "Identified Integration Risks",
    status,
    safeSummary: `Found ${risks.length} integration risks.`,
    items
  };
}

/**
 * Builds the advisory recommendation section, strictly preserving the humanReviewRequired check.
 */
export function buildRecommendationSection(
  recommendations: DiagnosticRecommendation[]
): DeveloperDiagnosticReportSection {
  const items = recommendations.map(rec => {
    return `Rec ID: ${rec.recommendationId} | Area: ${rec.area} | Priority: ${rec.priority} | Summary: ${rec.safeSummary} | Suggested Next Step: ${rec.suggestedNextStep} | Human Review Required: ${rec.humanReviewRequired}`;
  });

  const hasCritical = recommendations.some(rec => rec.priority === "critical");
  const hasHighOrMedium = recommendations.some(rec => rec.priority === "high" || rec.priority === "medium");
  const status = hasCritical ? "fail" : hasHighOrMedium ? "warning" : "pass";

  return {
    sectionId: "recommendations",
    title: "Advisory Recommendations",
    status,
    safeSummary: `Generated ${recommendations.length} advisory recommendations.`,
    items
  };
}

/**
 * Builds the developer integration checklist section cleanly.
 */
export function buildChecklistSection(checklist: DiagnosticChecklistItem[]): DeveloperDiagnosticReportSection {
  const items = checklist.map(c => {
    const mandatoryText = c.mandatory ? "Mandatory" : "Optional";
    return `Item ID: ${c.id} | Status: ${c.status} | Label: ${mandatoryText} | Description: ${c.description}`;
  });

  const hasPendingMandatory = checklist.some(c => c.status === "pending" && c.mandatory);
  const status = hasPendingMandatory ? "warning" : "pass";

  return {
    sectionId: "checklist",
    title: "Integration Readiness Checklist",
    status,
    safeSummary: `Total checklist items: ${checklist.length}`,
    items
  };
}

/**
 * Compiles a structured DeveloperDiagnosticReport from a snapshot.
 */
export function buildDeveloperDiagnosticReport(
  snapshot: DeveloperDiagnosticSnapshot
): DeveloperDiagnosticReport {
  const overallStatus = getOverallDiagnosticStatus(snapshot);
  const sections: DeveloperDiagnosticReportSection[] = [
    buildFoundationReadinessSection(snapshot.foundations),
    buildRiskSection(snapshot.risks),
    buildRecommendationSection(snapshot.recommendations),
    buildChecklistSection(snapshot.checklist)
  ];

  const checklistSummary = snapshot.checklist.map(
    c => `[${c.status === "completed" ? "x" : " "}] ${c.id}: ${c.description} (${c.mandatory ? "Mandatory" : "Optional"})`
  );

  return {
    version: 1,
    title: "Developer Diagnostics System Report",
    generatedAt: snapshot.generatedAt,
    overallStatus,
    summary: `Diagnostic snapshot version ${snapshot.version} completed with status: ${overallStatus}.`,
    sections,
    checklist: checklistSummary,
    privacyNotice: "Privacy Boundary Checked: Zero raw user speech-to-text outputs, text, PII, or credentials are serialized or displayed."
  };
}

/**
 * Renders the report into developer-facing markdown with validation guidance.
 */
export function renderDeveloperDiagnosticReportMarkdown(report: DeveloperDiagnosticReport): string {
  let md = `# ${report.title}\n\n`;
  md += `**Generated At:** ${report.generatedAt}\n`;
  md += `**Overall Status:** ${report.overallStatus.toUpperCase()}\n\n`;
  md += `## Summary\n${report.summary}\n\n`;

  md += `## Sections\n\n`;
  for (const sec of report.sections) {
    md += `### ${sec.title} [${sec.status.toUpperCase()}]\n`;
    md += `${sec.safeSummary}\n`;
    for (const item of sec.items) {
      md += `- ${item}\n`;
    }
    md += `\n`;
  }

  md += `## Manual Developer Checklists\n`;
  for (const c of report.checklist) {
    md += `- ${c}\n`;
  }
  md += `\n`;

  md += `## Safety & Validation Protocols\n`;
  md += `Verify local changes manually by running these validation commands:\n`;
  md += `\`\`\`bash\n`;
  md += `npm.cmd run lint\n`;
  md += `npx.cmd tsc --noEmit\n`;
  md += `npm.cmd run test:e2e\n`;
  md += `\`\`\`\n\n`;

  md += `> [!IMPORTANT]\n`;
  md += `> This report is advisory only and does not modify app behavior.\n`;
  md += `> Human review is required before implementation.\n\n`;

  md += `**Privacy Notice:** ${report.privacyNotice}\n`;

  return md;
}
