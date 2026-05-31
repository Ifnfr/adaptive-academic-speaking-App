import type {
  DeveloperDiagnosticSnapshot,
  DiagnosticRisk,
  DiagnosticRecommendation,
  DiagnosticChecklistItem,
  FoundationDiagnosticArea
} from "./types";
import type {
  ImprovementProposal,
  ImprovementProposalType
} from "../improvement-loop/types";
import { buildImprovementProposal } from "../improvement-loop/build";

export interface ConnectorResult {
  version: 1;
  proposals: ImprovementProposal[];
  source: "developer-diagnostics";
  advisoryOnly: true;
  generatedAt: string;
}

function sanitizeScope(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .substring(0, 30);
}

/**
 * Maps a diagnostic area to the correct improvement proposal type based on context.
 */
export function getImprovementProposalTypeForDiagnosticArea(
  area: FoundationDiagnosticArea,
  context?: string
): ImprovementProposalType {
  const ctx = (context || "").toLowerCase();
  switch (area) {
    case "learning_path":
      return "curriculum_adjustment";
    case "micro_practice":
      return "micro_practice_adjustment";
    case "feedback_normalization":
      if (ctx.includes("rule") || ctx.includes("recommendation")) {
        return "recommendation_rule_adjustment";
      }
      return "feedback_copy_adjustment";
    case "tutor_memory":
      return "recommendation_rule_adjustment";
    case "improvement_loop":
      if (ctx.includes("test") || ctx.includes("coverage")) {
        return "test_coverage_improvement";
      }
      return "recommendation_rule_adjustment";
    case "docs":
      return "documentation_update";
    case "tests":
    case "privacy":
      return "test_coverage_improvement";
    default:
      return "recommendation_rule_adjustment";
  }
}

/**
 * Maps a diagnostic area to the default affected scope/area.
 */
export function getImprovementProposalScopeForDiagnosticArea(
  area: FoundationDiagnosticArea,
  context?: string
): string {
  const ctx = (context || "").toLowerCase();
  switch (area) {
    case "learning_path":
      if (ctx.includes("recommendation") || ctx.includes("lock")) {
        return "recommendation_logic";
      }
      return "phase_1_curriculum";
    case "micro_practice":
      return "micro_lesson_flow";
    case "feedback_normalization":
      return "feedback_signal_quality";
    case "tutor_memory":
      return "recommendation_logic";
    case "improvement_loop":
      return "developer_workflow";
    case "docs":
      return "documentation_consistency";
    case "tests":
      return "regression_coverage";
    case "privacy":
      return "privacy_boundary";
    default:
      return "system_integration";
  }
}

/**
 * Deduce foundation area from a checklist item's ID or description.
 */
export function deduceAreaFromChecklist(id: string, description: string): FoundationDiagnosticArea {
  const combined = `${id} ${description}`.toLowerCase();
  if (combined.includes("privacy")) return "privacy";
  if (combined.includes("test")) return "tests";
  if (combined.includes("learning") || combined.includes("path")) return "learning_path";
  if (combined.includes("micro") || combined.includes("practice")) return "micro_practice";
  if (combined.includes("feedback") || combined.includes("normalize")) return "feedback_normalization";
  if (combined.includes("tutor") || combined.includes("memory")) return "tutor_memory";
  if (combined.includes("loop") || combined.includes("improvement")) return "improvement_loop";
  if (combined.includes("docs") || combined.includes("documentation")) return "docs";
  return "improvement_loop";
}

/**
 * Maps a DiagnosticRisk to an ImprovementProposal.
 */
export function mapDiagnosticRiskToImprovementProposal(
  risk: DiagnosticRisk,
  nowParam: string
): ImprovementProposal {
  const type = getImprovementProposalTypeForDiagnosticArea(risk.area, risk.description);
  const uniqueScope = `risk-${sanitizeScope(risk.description)}`;

  return buildImprovementProposal(
    type,
    risk.area,
    uniqueScope,
    {},
    {
      title: `Resolve Diagnostic Risk in ${risk.area}`,
      safeSummary: risk.description,
      proposedChange: risk.mitigation,
      expectedBenefit: `Mitigates identified risk in ${risk.area} foundation.`,
      riskLevel: risk.severity === "critical" || risk.severity === "high" ? "medium" : "low",
      priority: risk.severity,
      status: "draft",
      timestamp: nowParam
    }
  );
}

/**
 * Maps a DiagnosticRecommendation to an ImprovementProposal.
 */
export function mapDiagnosticRecommendationToImprovementProposal(
  rec: DiagnosticRecommendation,
  nowParam: string
): ImprovementProposal {
  const type = getImprovementProposalTypeForDiagnosticArea(rec.area, rec.safeSummary);
  const uniqueScope = `rec-${sanitizeScope(rec.recommendationId)}`;

  return buildImprovementProposal(
    type,
    rec.area,
    uniqueScope,
    {},
    {
      title: `Implement Recommendation ${rec.recommendationId}`,
      safeSummary: rec.safeSummary,
      proposedChange: rec.suggestedNextStep,
      expectedBenefit: `Improves stability and readiness of ${rec.area} foundation.`,
      riskLevel: "low",
      priority: rec.priority,
      status: "draft",
      timestamp: nowParam
    }
  );
}

/**
 * Maps a Phase 2 Readiness Blocker to an ImprovementProposal.
 */
export function mapPhase2ReadinessBlockerToImprovementProposal(
  blocker: DiagnosticRisk,
  nowParam: string
): ImprovementProposal {
  const type = getImprovementProposalTypeForDiagnosticArea(blocker.area, blocker.description);
  const uniqueScope = `blocker-${sanitizeScope(blocker.description)}`;
  const priority = blocker.area === "privacy" || blocker.area === "tests" ? "critical" : "high";

  return buildImprovementProposal(
    type,
    blocker.area,
    uniqueScope,
    {},
    {
      title: `Resolve Phase 2 Readiness Blocker in ${blocker.area}`,
      safeSummary: blocker.description,
      proposedChange: blocker.mitigation,
      expectedBenefit: `Clears blocker for Phase 2 implementation readiness.`,
      riskLevel: blocker.area === "privacy" ? "high" : "medium",
      priority,
      status: "draft",
      timestamp: nowParam
    }
  );
}

/**
 * Maps a failed checklist item to an ImprovementProposal.
 */
export function mapChecklistFailureToImprovementProposal(
  item: DiagnosticChecklistItem,
  nowParam: string
): ImprovementProposal {
  const area = deduceAreaFromChecklist(item.id, item.description);
  const type = getImprovementProposalTypeForDiagnosticArea(area, item.description);
  const uniqueScope = `checklist-${sanitizeScope(item.id)}`;
  const priority = area === "privacy" || area === "tests" ? "critical" : "high";

  return buildImprovementProposal(
    type,
    area,
    uniqueScope,
    area === "docs" ? { missingDocsChecklist: true } : {},
    {
      title: `Resolve Checklist Failure: ${item.id}`,
      safeSummary: item.description,
      proposedChange: `Verify checklist requirements and address verification checks for ${area}.`,
      expectedBenefit: `Restores compliance with mandatory checklist criteria.`,
      riskLevel: area === "privacy" ? "high" : "medium",
      priority,
      status: "draft",
      timestamp: nowParam
    }
  );
}

/**
 * Compiles all diagnostic items into clean, safe Improvement Proposals.
 */
export function buildImprovementProposalsFromDiagnostics(
  snapshot: DeveloperDiagnosticSnapshot,
  nowParam: string
): ConnectorResult {
  const proposals: ImprovementProposal[] = [];

  // 1. Map Diagnostic Risks
  for (const risk of snapshot.risks) {
    proposals.push(mapDiagnosticRiskToImprovementProposal(risk, nowParam));
  }

  // 2. Map Diagnostic Recommendations
  for (const rec of snapshot.recommendations) {
    proposals.push(mapDiagnosticRecommendationToImprovementProposal(rec, nowParam));
  }

  // 3. Map Phase 2 Blockers
  for (const blocker of snapshot.phase2Readiness.blockers) {
    proposals.push(mapPhase2ReadinessBlockerToImprovementProposal(blocker, nowParam));
  }

  // 4. Map Checklist Failures
  for (const item of snapshot.checklist) {
    if ((item.status as string) === "fail") {
      proposals.push(mapChecklistFailureToImprovementProposal(item, nowParam));
    }
  }

  return {
    version: 1,
    proposals,
    source: "developer-diagnostics",
    advisoryOnly: true,
    generatedAt: nowParam
  };
}
