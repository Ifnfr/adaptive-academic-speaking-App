export type FoundationDiagnosticArea =
  | 'learning_path'
  | 'micro_practice'
  | 'feedback_normalization'
  | 'tutor_memory'
  | 'improvement_loop'
  | 'docs'
  | 'tests'
  | 'privacy';

export type FoundationReadinessStatus =
  | 'ready'
  | 'partially_ready'
  | 'blocked'
  | 'not_started'
  | 'needs_review';

export type Phase2ReadinessStatus =
  | 'ready_for_research'
  | 'ready_for_curriculum_design'
  | 'ready_for_static_implementation'
  | 'not_ready_for_adaptive_integration'
  | 'blocked_by_privacy_risk'
  | 'blocked_by_missing_tests'
  | 'needs_review';

export interface FoundationReadinessResult {
  status: FoundationReadinessStatus;
  readinessScore: number; // 0 to 100
  passedChecks: string[];
  failedChecks: string[];
  warnings: string[];
  safeSummary: string;
  availableSignals: DiagnosticSignalAvailability[];
  missingSignals: DiagnosticSignalAvailability[];
}

export interface DiagnosticSignalAvailability {
  foundation: FoundationDiagnosticArea;
  signalName: string;
  isAvailable: boolean;
  reason: string;
}

export type DiagnosticRiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface DiagnosticRisk {
  area: FoundationDiagnosticArea;
  severity: DiagnosticRiskSeverity;
  description: string;
  mitigation: string;
}

export type DiagnosticRecommendationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface DiagnosticRecommendation {
  recommendationId: string;
  area: FoundationDiagnosticArea;
  priority: DiagnosticRecommendationPriority;
  safeSummary: string;
  suggestedNextStep: string;
  humanReviewRequired: true;
}

export interface DiagnosticChecklistItem {
  id: string;
  description: string;
  status: 'pending' | 'completed' | 'skipped';
  mandatory: boolean;
}

export interface Phase2ReadinessResult {
  status: Phase2ReadinessStatus;
  safeSummary: string;
  blockers: DiagnosticRisk[];
  requiredBeforeImplementation: DiagnosticChecklistItem[];
}

export interface DeveloperDiagnosticSnapshot {
  version: string;
  generatedAt: string; // ISO placeholder or injectable
  foundations: Record<FoundationDiagnosticArea, FoundationReadinessResult>;
  availableSignals: DiagnosticSignalAvailability[];
  missingSignals: DiagnosticSignalAvailability[];
  risks: DiagnosticRisk[];
  recommendations: DiagnosticRecommendation[];
  phase2Readiness: Phase2ReadinessResult;
  improvementProposalRefs: string[]; // Reference deterministic Proposal IDs
  checklist: DiagnosticChecklistItem[];
  safeSummary: string;
}
