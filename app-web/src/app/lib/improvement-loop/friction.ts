import { buildImprovementProposal } from "./build";
import type { ImprovementProposal } from "./types";

/**
 * Triggers curriculum_adjustment proposals when units show low completion rates
 * combined with a significant attempt count.
 */
export function detectLearningPathFriction(
  progressSummaries: Array<{ unitId: string; completionRate: number; attemptCount: number }>
): Array<ImprovementProposal> {
  const proposals: Array<ImprovementProposal> = [];

  for (const summary of progressSummaries) {
    if (summary.completionRate < 60 && summary.attemptCount >= 5) {
      proposals.push(
        buildImprovementProposal(
          "curriculum_adjustment",
          summary.unitId,
          "completion_rate",
          {
            unitId: summary.unitId,
            completionRate: summary.completionRate,
            attemptCount: summary.attemptCount,
          },
          {
            title: `Improve curriculum pacing in ${summary.unitId}`,
            safeSummary: `Unit ${summary.unitId} completion rate is ${summary.completionRate}% over ${summary.attemptCount} attempts.`,
            proposedChange: "Review curriculum sequence and reduce complexity of transition tasks.",
            expectedBenefit: "Ensure higher learner completion rates and decrease friction.",
            priority: "high",
            riskLevel: "medium",
          }
        )
      );
    }
  }

  return proposals;
}

/**
 * Triggers micro_practice_adjustment proposals when specific cards show disproportionately
 * high retries vs attempts.
 */
export function detectMicroPracticeFriction(
  stats: Array<{ cardId: string; attemptCount: number; retryCount: number }>
): Array<ImprovementProposal> {
  const proposals: Array<ImprovementProposal> = [];

  for (const stat of stats) {
    if (stat.attemptCount >= 3 && stat.retryCount / stat.attemptCount >= 0.6) {
      proposals.push(
        buildImprovementProposal(
          "micro_practice_adjustment",
          stat.cardId,
          "retry_rate",
          {
            cardId: stat.cardId,
            attemptCount: stat.attemptCount,
            retryCount: stat.retryCount,
          },
          {
            title: `Reduce practice complexity for card ${stat.cardId}`,
            safeSummary: `Card ${stat.cardId} has a retry rate of ${(
              (stat.retryCount / stat.attemptCount) *
              100
            ).toFixed(0)}% (${stat.retryCount}/${stat.attemptCount} attempts).`,
            proposedChange: "Provide simplified target vocabulary and pattern sentences for this exercise card.",
            expectedBenefit: "Lower repetitive failure loops for novice users.",
            priority: "medium",
            riskLevel: "low",
          }
        )
      );
    }
  }

  return proposals;
}

/**
 * Triggers recommendation_rule_adjustment when specific categories repeatedly
 * appear as friction points.
 */
export function detectFeedbackPatternFriction(
  feedbackSummaries: Array<{ category: string; count: number }>
): Array<ImprovementProposal> {
  const proposals: Array<ImprovementProposal> = [];

  for (const summary of feedbackSummaries) {
    if (summary.count >= 3) {
      proposals.push(
        buildImprovementProposal(
          "recommendation_rule_adjustment",
          summary.category,
          "repeated_categories",
          {
            repeatedCategoryCounts: { [summary.category]: summary.count },
          },
          {
            title: `Optimize advisory rules for category: ${summary.category}`,
            safeSummary: `Feedback category '${summary.category}' was triggered ${summary.count} times in recent evaluations.`,
            proposedChange: `Adjust the Learning Path advisory mapping to prioritize ${summary.category} lessons earlier.`,
            expectedBenefit: "Align tutor recommendations closer to verified learner output patterns.",
            priority: "medium",
            riskLevel: "low",
          }
        )
      );
    }
  }

  return proposals;
}

/**
 * Triggers documentation_update proposals when a validated component is missing docs.
 */
export function detectDocumentationGap(
  qaSummary: Array<{ featureName: string; missingDocs: boolean }>
): Array<ImprovementProposal> {
  const proposals: Array<ImprovementProposal> = [];

  for (const item of qaSummary) {
    if (item.missingDocs) {
      proposals.push(
        buildImprovementProposal(
          "documentation_update",
          item.featureName,
          "missing_docs",
          {
            missingDocsChecklist: true,
          },
          {
            title: `Add context documentation for ${item.featureName}`,
            safeSummary: `Feature ${item.featureName} was fully completed, but lacks context setup and checklist files.`,
            proposedChange: `Create docs/${item.featureName.toUpperCase().replace(/-/g, "_")}.md.`,
            expectedBenefit: "Keep setup rules and context fully synchronized for future development tasks.",
            priority: "low",
            riskLevel: "low",
          }
        )
      );
    }
  }

  return proposals;
}
