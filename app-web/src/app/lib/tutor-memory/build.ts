import {
  FeedbackSignalCategory,
  FeedbackSignalLearnerLevel,
  FeedbackSignalSummary,
} from "../feedback-normalization/types";
import {
  TutorMemoryProfile,
  TutorMemorySignal,
  TutorMemorySummary,
  TutorMemoryCardType,
} from "./types";

// Deterministic sorting of categories for recent/top focus
function sortCategories(
  categoriesWithCounts: { category: FeedbackSignalCategory; count: number }[]
): FeedbackSignalCategory[] {
  return [...categoriesWithCounts]
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.category.localeCompare(b.category);
    })
    .map((item) => item.category);
}

export function buildTutorMemoryFromSources(params: {
  feedbackSummary: FeedbackSignalSummary | null;
  microPracticeEvents: unknown[]; // Not used for snapshot details in MVP
  learnerLevel?: FeedbackSignalLearnerLevel;
  nowParam?: string;
}): TutorMemoryProfile {
  const { feedbackSummary, learnerLevel, nowParam } = params;

  // 1. Build signals from feedbackSummary
  const signals: TutorMemorySignal[] = [];
  if (feedbackSummary && feedbackSummary.countsByCategory) {
    for (const [catStr, countVal] of Object.entries(feedbackSummary.countsByCategory)) {
      const category = catStr as FeedbackSignalCategory;
      const count = typeof countVal === "number" ? countVal : 0;
      if (count > 0) {
        signals.push({
          source: "feedback-summary",
          category,
          count: Math.min(50, count), // Cap at 50 signals
          window: feedbackSummary.window,
          lastSeenAt: feedbackSummary.lastUpdatedAt,
        });
      }
    }
  }

  // 2. Compute recent and repeated focus categories
  const categoriesWithCounts = signals.map((s) => ({ category: s.category, count: s.count }));
  const sortedCats = sortCategories(categoriesWithCounts);
  const recentFocusCategories = sortedCats.slice(0, 3);
  const repeatedFocusCategories = sortedCats.filter((cat) => {
    const sig = signals.find((s) => s.category === cat);
    return sig && sig.count >= 3;
  });

  const finalUpdatedAt =
    nowParam || feedbackSummary?.lastUpdatedAt || new Date().toISOString();

  // Learning Path snapshot is no longer built from curriculum progress; it is null
  // when no Learning Path progress exists.
  const profile: TutorMemoryProfile = {
    version: 1,
    learnerLevel: learnerLevel || "Foundation",
    signals,
    learningPath: null,
    recentFocusCategories,
    repeatedFocusCategories,
    lastSummaryWindow: feedbackSummary?.window || "latest",
    lastUpdatedAt: finalUpdatedAt,
  };

  return profile;
}

export function updateTutorMemoryFromFeedbackSummary(
  existing: TutorMemoryProfile,
  newSummary: FeedbackSignalSummary,
  nowParam?: string
): TutorMemoryProfile {
  // Merge signals safely without mutating existing
  const signalMap = new Map<FeedbackSignalCategory, TutorMemorySignal>();
  for (const sig of existing.signals) {
    signalMap.set(sig.category, { ...sig });
  }

  if (newSummary.countsByCategory) {
    for (const [catStr, countVal] of Object.entries(newSummary.countsByCategory)) {
      const category = catStr as FeedbackSignalCategory;
      const count = typeof countVal === "number" ? countVal : 0;
      if (count > 0) {
        const existingSig = signalMap.get(category);
        if (existingSig) {
          existingSig.count = Math.min(50, existingSig.count + count);
          existingSig.lastSeenAt = newSummary.lastUpdatedAt;
          existingSig.window = newSummary.window;
        } else {
          signalMap.set(category, {
            source: "feedback-summary",
            category,
            count: Math.min(50, count),
            window: newSummary.window,
            lastSeenAt: newSummary.lastUpdatedAt,
          });
        }
      }
    }
  }

  const signals = Array.from(signalMap.values());

  // Recompute recent and repeated focus categories
  const categoriesWithCounts = signals.map((s) => ({ category: s.category, count: s.count }));
  const sortedCats = sortCategories(categoriesWithCounts);
  const recentFocusCategories = sortedCats.slice(0, 3);
  const repeatedFocusCategories = sortedCats.filter((cat) => {
    const sig = signals.find((s) => s.category === cat);
    return sig && sig.count >= 3;
  });

  const finalUpdatedAt = nowParam || newSummary.lastUpdatedAt || new Date().toISOString();

  // Preserve the existing (nullable) Learning Path snapshot
  const updatedProfile: TutorMemoryProfile = {
    version: 1,
    learnerLevel: existing.learnerLevel,
    signals,
    learningPath: existing.learningPath,
    recentFocusCategories,
    repeatedFocusCategories,
    lastSummaryWindow: newSummary.window,
    lastUpdatedAt: finalUpdatedAt,
  };

  return updatedProfile;
}

export function getSafeTutorMemorySnapshot(
  profile: TutorMemoryProfile
): TutorMemorySummary {
  let totalSignalCount = 0;
  let topCategoryCandidate: FeedbackSignalCategory | null = null;

  const categoriesWithCounts = profile.signals.map((s) => {
    totalSignalCount += s.count;
    return { category: s.category, count: s.count };
  });

  if (categoriesWithCounts.length > 0) {
    const sortedCats = sortCategories(categoriesWithCounts);
    const top = sortedCats[0];
    if (top) {
      const topSig = profile.signals.find((s) => s.category === top);
      if (topSig && topSig.count > 0) {
        topCategoryCandidate = top;
      }
    }
  }

  // Learning Path progress is no longer tracked; report 0 completion.
  const learningPathCompletionPercent = 0;

  // Compute recommended card type based on repeated focus categories
  let recommendedCardType: TutorMemoryCardType | null = null;
  if (profile.repeatedFocusCategories.includes("grammar")) {
    recommendedCardType = "sentence-builder";
  } else if (profile.repeatedFocusCategories.includes("vocabulary")) {
    recommendedCardType = "guided-word";
  } else if (
    profile.repeatedFocusCategories.includes("fluency") ||
    profile.repeatedFocusCategories.includes("clarity")
  ) {
    recommendedCardType = "micro-speaking";
  } else if (
    profile.repeatedFocusCategories.includes("structure") ||
    profile.repeatedFocusCategories.includes("coherence") ||
    profile.repeatedFocusCategories.includes("support") ||
    profile.repeatedFocusCategories.includes("academicTone")
  ) {
    recommendedCardType = "phrase-pattern";
  } else {
    // Default fallback
    recommendedCardType = "guided-word";
  }

  // Whitelist-only output
  const summary: TutorMemorySummary = {
    version: 1,
    totalSignalCount,
    topCategory: topCategoryCandidate,
    repeatedCategories: [...profile.repeatedFocusCategories],
    learningPathCompletionPercent,
    recommendedCardType,
    lastUpdatedAt: profile.lastUpdatedAt,
  };

  return summary;
}
