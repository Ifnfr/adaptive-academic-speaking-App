import type {
  FoundationDiagnosticArea,
  FoundationReadinessStatus,
  FoundationReadinessResult,
  DiagnosticSignalAvailability,
  DiagnosticRisk,
  DiagnosticRecommendation,
  DiagnosticChecklistItem,
  Phase2ReadinessResult,
  DeveloperDiagnosticSnapshot
} from "./types";

/**
 * Builds a DiagnosticSignalAvailability object using explicit whitelist initialization.
 */
export function buildSignalAvailability(
  area: FoundationDiagnosticArea,
  signalName: string,
  status: boolean,
  safeDescription: string
): DiagnosticSignalAvailability {
  return {
    foundation: area,
    signalName,
    isAvailable: status,
    reason: safeDescription
  };
}

/**
 * Builds a FoundationReadinessResult using explicit whitelist copying and clamping.
 */
export function buildFoundationReadinessResult(
  area: FoundationDiagnosticArea,
  status: FoundationReadinessStatus,
  score: number,
  safeSummary: string,
  availableSignals: DiagnosticSignalAvailability[],
  missingSignals: DiagnosticSignalAvailability[]
): FoundationReadinessResult {
  // Clamp score to integer 0-100 without using random elements
  let clampedScore = Math.floor(score);
  if (clampedScore < 0) clampedScore = 0;
  if (clampedScore > 100) clampedScore = 100;

  // Safe mapping of signal arrays without mutating original inputs
  const copiedAvailable = availableSignals.map(sig => ({
    foundation: sig.foundation,
    signalName: sig.signalName,
    isAvailable: sig.isAvailable,
    reason: sig.reason
  }));

  const copiedMissing = missingSignals.map(sig => ({
    foundation: sig.foundation,
    signalName: sig.signalName,
    isAvailable: sig.isAvailable,
    reason: sig.reason
  }));

  // Populate pass/fail checks lists
  const passedChecks = copiedAvailable.map(sig => `Available signal: ${sig.signalName}`);
  const failedChecks = copiedMissing.map(sig => `Missing signal: ${sig.signalName}`);
  const warnings: string[] = [];
  if (status === "partially_ready") {
    warnings.push(`Foundation ${area} is partially ready.`);
  } else if (status === "blocked") {
    warnings.push(`Foundation ${area} is blocked.`);
  }

  return {
    status,
    readinessScore: clampedScore,
    passedChecks,
    failedChecks,
    warnings,
    safeSummary,
    availableSignals: copiedAvailable,
    missingSignals: copiedMissing
  };
}

/**
 * Returns a neutral, default not_started FoundationReadinessResult.
 */
export function getDefaultFoundationReadiness(area: FoundationDiagnosticArea): FoundationReadinessResult {
  return {
    status: "not_started",
    readinessScore: 0,
    passedChecks: [],
    failedChecks: [],
    warnings: [],
    safeSummary: `Foundation ${area} has not been started.`,
    availableSignals: [],
    missingSignals: []
  };
}

/**
 * Compiles a full DeveloperDiagnosticSnapshot, aggregating signals and sanitizing structures.
 */
export function buildDeveloperDiagnosticSnapshot(
  generatedAt: string,
  foundations: Record<FoundationDiagnosticArea, FoundationReadinessResult>,
  risks: DiagnosticRisk[],
  recommendations: DiagnosticRecommendation[],
  phase2Readiness: Phase2ReadinessResult,
  checklist: DiagnosticChecklistItem[],
  safeSummary: string
): DeveloperDiagnosticSnapshot {
  const copiedFoundations = {} as Record<FoundationDiagnosticArea, FoundationReadinessResult>;
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

  const aggregatedAvailable: DiagnosticSignalAvailability[] = [];
  const aggregatedMissing: DiagnosticSignalAvailability[] = [];

  for (const area of areas) {
    const f = foundations[area];
    if (f) {
      copiedFoundations[area] = {
        status: f.status,
        readinessScore: f.readinessScore,
        passedChecks: [...f.passedChecks],
        failedChecks: [...f.failedChecks],
        warnings: [...f.warnings],
        safeSummary: f.safeSummary,
        availableSignals: f.availableSignals.map(sig => ({
          foundation: sig.foundation,
          signalName: sig.signalName,
          isAvailable: sig.isAvailable,
          reason: sig.reason
        })),
        missingSignals: f.missingSignals.map(sig => ({
          foundation: sig.foundation,
          signalName: sig.signalName,
          isAvailable: sig.isAvailable,
          reason: sig.reason
        }))
      };
      aggregatedAvailable.push(...copiedFoundations[area].availableSignals);
      aggregatedMissing.push(...copiedFoundations[area].missingSignals);
    } else {
      copiedFoundations[area] = getDefaultFoundationReadiness(area);
    }
  }

  const copiedRisks = risks.map(r => ({
    area: r.area,
    severity: r.severity,
    description: r.description,
    mitigation: r.mitigation
  }));

  const copiedRecommendations = recommendations.map(rec => ({
    recommendationId: rec.recommendationId,
    area: rec.area,
    priority: rec.priority,
    safeSummary: rec.safeSummary,
    suggestedNextStep: rec.suggestedNextStep,
    humanReviewRequired: rec.humanReviewRequired
  }));

  const copiedPhase2Readiness = {
    status: phase2Readiness.status,
    safeSummary: phase2Readiness.safeSummary,
    blockers: phase2Readiness.blockers.map(r => ({
      area: r.area,
      severity: r.severity,
      description: r.description,
      mitigation: r.mitigation
    })),
    requiredBeforeImplementation: phase2Readiness.requiredBeforeImplementation.map(c => ({
      id: c.id,
      description: c.description,
      status: c.status,
      mandatory: c.mandatory
    }))
  };

  const copiedChecklist = checklist.map(c => ({
    id: c.id,
    description: c.description,
    status: c.status,
    mandatory: c.mandatory
  }));

  return {
    version: "1",
    generatedAt,
    foundations: copiedFoundations,
    availableSignals: aggregatedAvailable,
    missingSignals: aggregatedMissing,
    risks: copiedRisks,
    recommendations: copiedRecommendations,
    phase2Readiness: copiedPhase2Readiness,
    improvementProposalRefs: [],
    checklist: copiedChecklist,
    safeSummary
  };
}

/**
 * Deep-copies a snapshot, stripping extra properties to enforce whitelisted properties only.
 */
export function getSafeDeveloperDiagnosticSnapshot(
  snapshot: DeveloperDiagnosticSnapshot
): DeveloperDiagnosticSnapshot {
  const foundations = {} as Record<FoundationDiagnosticArea, FoundationReadinessResult>;
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

  for (const area of areas) {
    const f = snapshot.foundations[area];
    if (f) {
      foundations[area] = {
        status: f.status,
        readinessScore: f.readinessScore,
        passedChecks: [...f.passedChecks],
        failedChecks: [...f.failedChecks],
        warnings: [...f.warnings],
        safeSummary: f.safeSummary,
        availableSignals: f.availableSignals.map(sig => ({
          foundation: sig.foundation,
          signalName: sig.signalName,
          isAvailable: sig.isAvailable,
          reason: sig.reason
        })),
        missingSignals: f.missingSignals.map(sig => ({
          foundation: sig.foundation,
          signalName: sig.signalName,
          isAvailable: sig.isAvailable,
          reason: sig.reason
        }))
      };
    } else {
      foundations[area] = getDefaultFoundationReadiness(area);
    }
  }

  const availableSignals = snapshot.availableSignals.map(sig => ({
    foundation: sig.foundation,
    signalName: sig.signalName,
    isAvailable: sig.isAvailable,
    reason: sig.reason
  }));

  const missingSignals = snapshot.missingSignals.map(sig => ({
    foundation: sig.foundation,
    signalName: sig.signalName,
    isAvailable: sig.isAvailable,
    reason: sig.reason
  }));

  const risks = snapshot.risks.map(r => ({
    area: r.area,
    severity: r.severity,
    description: r.description,
    mitigation: r.mitigation
  }));

  const recommendations = snapshot.recommendations.map(rec => ({
    recommendationId: rec.recommendationId,
    area: rec.area,
    priority: rec.priority,
    safeSummary: rec.safeSummary,
    suggestedNextStep: rec.suggestedNextStep,
    humanReviewRequired: rec.humanReviewRequired
  }));

  const phase2Readiness = {
    status: snapshot.phase2Readiness.status,
    safeSummary: snapshot.phase2Readiness.safeSummary,
    blockers: snapshot.phase2Readiness.blockers.map(r => ({
      area: r.area,
      severity: r.severity,
      description: r.description,
      mitigation: r.mitigation
    })),
    requiredBeforeImplementation: snapshot.phase2Readiness.requiredBeforeImplementation.map(c => ({
      id: c.id,
      description: c.description,
      status: c.status,
      mandatory: c.mandatory
    }))
  };

  const checklist = snapshot.checklist.map(c => ({
    id: c.id,
    description: c.description,
    status: c.status,
    mandatory: c.mandatory
  }));

  return {
    version: snapshot.version,
    generatedAt: snapshot.generatedAt,
    foundations,
    availableSignals,
    missingSignals,
    risks,
    recommendations,
    phase2Readiness,
    improvementProposalRefs: [...snapshot.improvementProposalRefs],
    checklist,
    safeSummary: snapshot.safeSummary
  };
}
