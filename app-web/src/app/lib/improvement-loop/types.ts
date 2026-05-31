export type ImprovementProposalType =
  | 'curriculum_adjustment'
  | 'micro_practice_adjustment'
  | 'feedback_copy_adjustment'
  | 'recommendation_rule_adjustment'
  | 'ui_friction_adjustment'
  | 'test_coverage_improvement'
  | 'documentation_update';

export type ImprovementProposalStatus =
  | 'draft'
  | 'needs_review'
  | 'approved'
  | 'rejected'
  | 'implemented'
  | 'archived';

export type ImprovementProposalPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ImprovementProposalEvidence {
  repeatedCategoryCounts?: Record<string, number>;
  completionRate?: number;
  attemptCount?: number;
  retryCount?: number;
  cardId?: string;
  unitId?: string;
  testName?: string;
  missingDocsChecklist?: boolean;
}

export interface ImprovementProposal {
  version: string;
  proposalId: string; // Deterministic format: `improvement-${type}-${affectedArea}-${categoryOrScope}`
  type: ImprovementProposalType;
  title: string;
  safeSummary: string;
  evidence: ImprovementProposalEvidence;
  affectedArea: string;
  proposedChange: string;
  expectedBenefit: string;
  riskLevel: 'low' | 'medium' | 'high';
  priority: ImprovementProposalPriority;
  status: ImprovementProposalStatus;
  requiresHumanApproval: boolean; // Always true
  createdAt: string;
  updatedAt: string;
}
