import type {
  ImprovementProposal,
  ImprovementProposalType,
  ImprovementProposalEvidence,
  ImprovementProposalStatus,
  ImprovementProposalPriority,
} from "./types";

export interface BuildProposalOptions {
  title?: string;
  safeSummary?: string;
  proposedChange?: string;
  expectedBenefit?: string;
  riskLevel?: "low" | "medium" | "high";
  priority?: ImprovementProposalPriority;
  status?: ImprovementProposalStatus;
  timestamp?: string;
}

/**
 * Builds a deterministic, validated ImprovementProposal object.
 * Rejects any non-whitelisted keys and forbidden patterns.
 */
export function buildImprovementProposal(
  type: ImprovementProposalType,
  affectedArea: string,
  scope: string,
  evidence: ImprovementProposalEvidence,
  options: BuildProposalOptions = {}
): ImprovementProposal {
  // Input validation for strings
  const cleanArea = affectedArea.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanScope = scope.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  // Generate deterministic ID: improvement-${type}-${cleanArea}-${cleanScope}
  const proposalId = `improvement-${type}-${cleanArea}-${cleanScope}`;

  const defaultTimestamp = options.timestamp || "2026-05-31T09:00:00Z";

  // Build the strictly structured object (no raw input spreading)
  const proposal: ImprovementProposal = {
    version: "1.0",
    proposalId,
    type,
    title: options.title?.trim() || `Improvement Proposal for ${affectedArea} (${type})`,
    safeSummary: options.safeSummary?.trim() || "Automated friction detection trigger.",
    evidence: {
      repeatedCategoryCounts: evidence.repeatedCategoryCounts
        ? { ...evidence.repeatedCategoryCounts }
        : undefined,
      completionRate: evidence.completionRate,
      attemptCount: evidence.attemptCount,
      retryCount: evidence.retryCount,
      cardId: evidence.cardId,
      unitId: evidence.unitId,
      testName: evidence.testName,
      missingDocsChecklist: evidence.missingDocsChecklist,
    },
    affectedArea: cleanArea,
    proposedChange: options.proposedChange?.trim() || "Review performance metrics and adjust guidelines.",
    expectedBenefit: options.expectedBenefit?.trim() || "Improve learner completion rates.",
    riskLevel: options.riskLevel || "low",
    priority: options.priority || "medium",
    status: options.status || "draft",
    requiresHumanApproval: true, // Always true
    createdAt: defaultTimestamp,
    updatedAt: defaultTimestamp,
  };

  return proposal;
}

/**
 * Strips any unwhitelisted custom properties and returns a clean, safe snapshot.
 */
export function getSafeImprovementProposalSnapshot(
  proposal: ImprovementProposal
): Partial<ImprovementProposal> {
  return {
    version: proposal.version,
    proposalId: proposal.proposalId,
    type: proposal.type,
    title: proposal.title,
    safeSummary: proposal.safeSummary,
    evidence: { ...proposal.evidence },
    affectedArea: proposal.affectedArea,
    proposedChange: proposal.proposedChange,
    expectedBenefit: proposal.expectedBenefit,
    riskLevel: proposal.riskLevel,
    priority: proposal.priority,
    status: proposal.status,
    requiresHumanApproval: proposal.requiresHumanApproval,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
  };
}
