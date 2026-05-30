// src/app/lib/feedback-normalization/summary.ts
// Pure helper functions that aggregate safe FeedbackSignal objects into safe FeedbackSignalSummary objects.
// No side-effects, no storage, no UI.

import type {
  FeedbackSignal,
  FeedbackSignalCategory,
  FeedbackSignalLearnerLevel,
  FeedbackSignalSummary,
} from "./types";
import { FEEDBACK_SIGNAL_CATEGORIES } from "./taxonomy";

/**
 * Filter signals by the specified window.
 * Returns a new array. Does not mutate the input array.
 */
export function filterSignalsByWindow(
  signals: readonly FeedbackSignal[],
  window: "latest" | "7-day" | "all-local",
  nowParam?: Date | string
): FeedbackSignal[] {
  if (signals.length === 0) return [];

  // Sort signals by createdAt descending to ensure we have a chronological view.
  // We make a shallow copy first to avoid mutating the input array.
  const sortedSignals = [...signals].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (window === "latest") {
    // Return only the most recent signal
    return [sortedSignals[0]];
  }

  if (window === "7-day") {
    const now = nowParam ? new Date(nowParam) : new Date();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    return sortedSignals.filter((sig) => {
      const ts = new Date(sig.createdAt).getTime();
      return ts >= sevenDaysAgo && ts <= now.getTime();
    });
  }

  // all-local
  return sortedSignals;
}

/**
 * Counts the signals by category.
 */
export function countSignalsByCategory(
  signals: readonly FeedbackSignal[]
): Record<FeedbackSignalCategory, number> {
  const counts: Record<FeedbackSignalCategory, number> = {
    fluency: 0,
    clarity: 0,
    structure: 0,
    grammar: 0,
    vocabulary: 0,
    coherence: 0,
    support: 0,
    academicTone: 0,
    taskCompletion: 0,
    confidenceHabit: 0,
  };

  for (const sig of signals) {
    if (sig.category in counts) {
      counts[sig.category]++;
    }
  }

  return counts;
}

/**
 * Get top feedback categories sorted by count descending.
 * Tie-breaker resolved deterministically by taxonomy order.
 * Only includes categories with count > 0.
 */
export function getTopFeedbackCategories(
  signals: readonly FeedbackSignal[]
): FeedbackSignalCategory[] {
  const counts = countSignalsByCategory(signals);
  
  // Only consider categories with count > 0
  const activeCategories = FEEDBACK_SIGNAL_CATEGORIES.filter(
    (cat) => counts[cat] > 0
  );

  // Sort by count descending. If counts are equal, keep the taxonomy order
  return [...activeCategories].sort((a, b) => {
    const countA = counts[a];
    const countB = counts[b];
    if (countB !== countA) {
      return countB - countA;
    }
    // Tie-breaker: taxonomy order (index inside FEEDBACK_SIGNAL_CATEGORIES)
    const indexA = FEEDBACK_SIGNAL_CATEGORIES.indexOf(a);
    const indexB = FEEDBACK_SIGNAL_CATEGORIES.indexOf(b);
    return indexA - indexB;
  });
}

/**
 * Returns a recommended action ID for the top category, based on learner level.
 */
export function getRecommendedNextActionId(
  topCategories: readonly FeedbackSignalCategory[],
  signals: readonly FeedbackSignal[]
): string | null {
  if (topCategories.length === 0) return null;

  const topCategory = topCategories[0];

  // Try to find the learner level from the most recent signal of this category,
  // otherwise fallback to the most recent signal's learner level,
  // and finally fallback to "Foundation".
  let learnerLevel: FeedbackSignalLearnerLevel = "Foundation";
  
  const categorySignal = signals.find((sig) => sig.category === topCategory);
  if (categorySignal && categorySignal.learnerLevel) {
    learnerLevel = categorySignal.learnerLevel;
  } else if (signals.length > 0 && signals[0].learnerLevel) {
    learnerLevel = signals[0].learnerLevel;
  }

  return `practice-${topCategory}-${learnerLevel}`;
}

/**
 * Aggregates a list of safe FeedbackSignal objects into a FeedbackSignalSummary object.
 * Pure and deterministic.
 */
export function buildFeedbackSignalSummary(
  signals: readonly FeedbackSignal[],
  window: "latest" | "7-day" | "all-local",
  nowParam?: Date | string
): FeedbackSignalSummary {
  const filtered = filterSignalsByWindow(signals, window, nowParam);
  const counts = countSignalsByCategory(filtered);
  const topCategories = getTopFeedbackCategories(filtered);
  const recommendedNextActionId = getRecommendedNextActionId(topCategories, filtered);

  // Determine lastUpdatedAt
  let lastUpdatedAt = nowParam
    ? new Date(nowParam).toISOString()
    : new Date().toISOString();

  if (filtered.length > 0) {
    // Since filtered is sorted descending, the first one is the latest signal in this window
    lastUpdatedAt = filtered[0].createdAt;
  }

  return {
    version: 1,
    window,
    topCategories,
    countsByCategory: counts,
    recommendedNextActionId,
    lastUpdatedAt,
  };
}
