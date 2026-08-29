import type {
  DeveloperDiagnosticSnapshot,
  Phase2ReadinessResult,
  Phase2ReadinessStatus,
  DiagnosticChecklistItem,
  FoundationDiagnosticArea,
  DiagnosticRisk
} from "./types";

/**
 * Deterministically evaluates Phase 2 implementation readiness status from a safe snapshot.
 */
export function getPhase2ReadinessStatus(snapshot: DeveloperDiagnosticSnapshot): Phase2ReadinessStatus {
  // 1. Check privacy blockers
  const privacyBlocked = snapshot.foundations.privacy.status === "blocked";
  const privacyCriticalRisk = snapshot.risks.some(r => r.area === "privacy" && r.severity === "critical");
  const privacyChecklistFailed = snapshot.checklist.some(c => {
    const desc = c.description.toLowerCase();
    const id = c.id.toLowerCase();
    const isPrivacy = id.includes("privacy") || desc.includes("privacy");
    return isPrivacy && (c.status as string) === "fail";
  });

  if (privacyBlocked || privacyCriticalRisk || privacyChecklistFailed) {
    return "blocked_by_privacy_risk";
  }

  // 2. Check test blockers
  const testsBlocked = snapshot.foundations.tests.status === "blocked";
  const testsCriticalRisk = snapshot.risks.some(r => r.area === "tests" && r.severity === "critical");
  const testsChecklistFailed = snapshot.checklist.some(c => {
    const desc = c.description.toLowerCase();
    const id = c.id.toLowerCase();
    const isTest = id.includes("test") || desc.includes("test");
    return c.mandatory && isTest && (c.status as string) === "fail";
  });

  if (testsBlocked || testsCriticalRisk || testsChecklistFailed) {
    return "blocked_by_missing_tests";
  }

  // 3. Evaluate static implementation safety
  const lpReady = snapshot.foundations.learning_path.status === "ready";
  const microPracticeReady = snapshot.foundations.micro_practice.status === "ready";
  const testsReady = snapshot.foundations.tests.status === "ready";
  const privacyReady = snapshot.foundations.privacy.status === "ready";
  const noHighOrCriticalRisks = !snapshot.risks.some(r => r.severity === "high" || r.severity === "critical");

  const staticImplementationSafe =
    lpReady &&
    microPracticeReady &&
    testsReady &&
    privacyReady &&
    noHighOrCriticalRisks;

  if (staticImplementationSafe) {
    const feedbackStatus = snapshot.foundations.feedback_normalization.status;
    const tutorStatus = snapshot.foundations.tutor_memory.status;
    const improvementStatus = snapshot.foundations.improvement_loop.status;

    // adaptive foundations still need review or are not started/ready
    const adaptiveNeedsReview =
      feedbackStatus === "needs_review" ||
      tutorStatus === "needs_review" ||
      improvementStatus === "needs_review";

    const adaptiveNotReady =
      feedbackStatus === "not_started" ||
      tutorStatus === "not_started" ||
      improvementStatus === "not_started";

    const feedbackOk = feedbackStatus === "ready" || feedbackStatus === "partially_ready";
    const tutorOk = tutorStatus === "ready" || tutorStatus === "partially_ready";
    const improvementOk = improvementStatus === "ready" || improvementStatus === "partially_ready";

    if (adaptiveNeedsReview || adaptiveNotReady) {
      return "not_ready_for_adaptive_integration";
    }

    if (feedbackOk && tutorOk && improvementOk) {
      return "ready_for_static_implementation";
    }
  }

  // 4. Evaluate ready for research
  const allFoundationsReadyOrPartial = Object.values(snapshot.foundations).every(
    f => f.status === "ready" || f.status === "partially_ready"
  );
  const docsReadyOrPartial =
    snapshot.foundations.docs.status === "ready" ||
    snapshot.foundations.docs.status === "partially_ready";

  if (allFoundationsReadyOrPartial && docsReadyOrPartial) {
    return "ready_for_research";
  }

  // 5. Evaluate curriculum design readiness
  const lpReadyOrPartial =
    snapshot.foundations.learning_path.status === "ready" ||
    snapshot.foundations.learning_path.status === "partially_ready";
  const microPracticeReadyOrPartial =
    snapshot.foundations.micro_practice.status === "ready" ||
    snapshot.foundations.micro_practice.status === "partially_ready";
  const privacyReadyOrPartial =
    snapshot.foundations.privacy.status === "ready" ||
    snapshot.foundations.privacy.status === "partially_ready";
  const noHighOrCriticalPrivacyRisks = !snapshot.risks.some(
    r => r.area === "privacy" && (r.severity === "high" || r.severity === "critical")
  );

  if (
    lpReadyOrPartial &&
    microPracticeReadyOrPartial &&
    docsReadyOrPartial &&
    privacyReadyOrPartial &&
    noHighOrCriticalPrivacyRisks
  ) {
    return "ready_for_curriculum_design";
  }

  // 6. Mixed state default
  return "needs_review";
}

/**
 * Returns a list of specific blockers preventing Phase 2 implementation.
 */
export function getPhase2ReadinessBlockers(snapshot: DeveloperDiagnosticSnapshot): DiagnosticRisk[] {
  const blockers: DiagnosticRisk[] = [];

  // Privacy foundation blocked
  if (snapshot.foundations.privacy.status === "blocked") {
    blockers.push({
      area: "privacy",
      severity: "critical",
      description: "Privacy foundation is blocked.",
      mitigation: "Investigate privacy module integration blockers."
    });
  }

  // Critical privacy risk
  for (const risk of snapshot.risks) {
    if (risk.area === "privacy" && risk.severity === "critical") {
      blockers.push({
        area: risk.area,
        severity: risk.severity,
        description: risk.description,
        mitigation: risk.mitigation
      });
    }
  }

  // Privacy checklist failed
  for (const item of snapshot.checklist) {
    const desc = item.description.toLowerCase();
    const id = item.id.toLowerCase();
    const isPrivacy = id.includes("privacy") || desc.includes("privacy");
    if (isPrivacy && (item.status as string) === "fail") {
      blockers.push({
        area: "privacy",
        severity: "critical",
        description: `Privacy checklist item failed: ${item.description}`,
        mitigation: "Fix checklist requirement before implementation."
      });
    }
  }

  // Tests foundation blocked
  if (snapshot.foundations.tests.status === "blocked") {
    blockers.push({
      area: "tests",
      severity: "critical",
      description: "Tests foundation is blocked.",
      mitigation: "Verify tests execution environments."
    });
  }

  // Critical test risk
  for (const risk of snapshot.risks) {
    if (risk.area === "tests" && risk.severity === "critical") {
      blockers.push({
        area: risk.area,
        severity: risk.severity,
        description: risk.description,
        mitigation: risk.mitigation
      });
    }
  }

  // Mandatory test checklist failed
  for (const item of snapshot.checklist) {
    const desc = item.description.toLowerCase();
    const id = item.id.toLowerCase();
    const isTest = id.includes("test") || desc.includes("test");
    if (item.mandatory && isTest && (item.status as string) === "fail") {
      blockers.push({
        area: "tests",
        severity: "critical",
        description: `Mandatory test checklist item failed: ${item.description}`,
        mitigation: "Address test coverage and verify all E2E specifications."
      });
    }
  }

  // General other foundations blocked
  const checkAreas: FoundationDiagnosticArea[] = [
    "learning_path",
    "micro_practice",
    "feedback_normalization",
    "tutor_memory",
    "improvement_loop",
    "docs"
  ];
  for (const area of checkAreas) {
    if (snapshot.foundations[area]?.status === "blocked") {
      blockers.push({
        area,
        severity: "critical",
        description: `Foundation ${area} is blocked.`,
        mitigation: `Resolve blocker in ${area} foundation.`
      });
    }
  }

  return blockers;
}

/**
 * Evaluates Phase 2 readiness and generates a type-safe Phase2ReadinessResult.
 */
export function evaluatePhase2Readiness(snapshot: DeveloperDiagnosticSnapshot): Phase2ReadinessResult {
  const status = getPhase2ReadinessStatus(snapshot);
  const blockers = getPhase2ReadinessBlockers(snapshot);

  // Determine required steps before implementation
  const requiredBeforeImplementation: DiagnosticChecklistItem[] = [];

  // Add mandatory checklist items that are pending or failed
  for (const item of snapshot.checklist) {
    const isFailed = (item.status as string) === "fail";
    const isPending = item.status === "pending";
    if ((item.mandatory && isPending) || isFailed) {
      requiredBeforeImplementation.push({
        id: item.id,
        description: item.description,
        status: item.status,
        mandatory: item.mandatory
      });
    }
  }

  // Generate safe summary
  let safeSummary = "";
  if (status === "blocked_by_privacy_risk") {
    safeSummary = "Phase 2 implementation is blocked due to unresolved privacy risk signals. Review privacy boundaries before proceeding.";
  } else if (status === "blocked_by_missing_tests") {
    safeSummary = "Phase 2 implementation is blocked due to missing or failing test coverage. Implement mandatory test suites before proceeding.";
  } else if (status === "ready_for_research") {
    safeSummary = "System is ready for Phase 2 curriculum research. Core foundations are partially ready, and there are no critical blockers.";
  } else if (status === "ready_for_curriculum_design") {
    safeSummary = "System is ready for Phase 2 curriculum design. Learning path, micro-practice, and docs are available with no critical risks.";
  } else if (status === "ready_for_static_implementation") {
    safeSummary = "System is ready for Phase 2 static implementation. Required foundations are fully ready and stable.";
  } else if (status === "not_ready_for_adaptive_integration") {
    safeSummary = "Static implementation components are safe, but adaptive integration components require further review or development.";
  } else {
    safeSummary = "Developer review required. Foundation signals are mixed or incomplete.";
  }

  return {
    status,
    safeSummary,
    blockers,
    requiredBeforeImplementation
  };
}

/**
 * Returns advisory recommendations for next steps.
 */
export function getPhase2ReadinessRecommendations(snapshot: DeveloperDiagnosticSnapshot): string[] {
  const recommendations: string[] = [];

  for (const rec of snapshot.recommendations) {
    recommendations.push(
      `[${rec.priority.toUpperCase()}] ${rec.safeSummary} - Suggested Next Step: ${rec.suggestedNextStep}`
    );
  }

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
      for (const warning of f.warnings) {
        recommendations.push(`Warning for ${area}: ${warning}`);
      }
    }
  }

  for (const risk of snapshot.risks) {
    if (risk.severity === "low" || risk.severity === "medium") {
      recommendations.push(`Risk mitigation for ${risk.area}: ${risk.mitigation}`);
    }
  }

  return recommendations;
}

/**
 * Builds a clean, non-mutated copy of the diagnostic checklist.
 */
export function buildPhase2ReadinessChecklist(snapshot: DeveloperDiagnosticSnapshot): DiagnosticChecklistItem[] {
  return snapshot.checklist.map(item => ({
    id: item.id,
    description: item.description,
    status: item.status,
    mandatory: item.mandatory
  }));
}
