import {
  FeedbackSignalCategory,
  FeedbackSignalLearnerLevel,
  FeedbackSignalSummary,
} from "../feedback-normalization/types";
import { StoredLearningPathProgress } from "../learning-path/types";
import { phase1Curriculum } from "../learning-path/phase1-curriculum";
import {
  TutorMemoryProfile,
  TutorMemorySignal,
  TutorMemoryLearningPathSnapshot,
  TutorMemorySummary,
  TutorMemoryCardType,
} from "./types";

// Helper to get flat cards from curriculum safely
function getFlatCurriculumCards() {
  const phase = phase1Curriculum.phases[0];
  if (!phase) return [];
  const cards = [];
  for (const unit of phase.units) {
    for (const day of unit.days) {
      for (const card of day.cards) {
        cards.push({
          id: card.id,
          type: card.type,
          unitId: card.unitId,
        });
      }
    }
  }
  return cards;
}

// Deterministic sorting of categories for recent/top focus
function sortCategories(categoriesWithCounts: { category: FeedbackSignalCategory; count: number }[]): FeedbackSignalCategory[] {
  return [...categoriesWithCounts]
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.category.localeCompare(b.category);
    })
    .map(item => item.category);
}

export function buildTutorMemoryFromSources(params: {
  feedbackSummary: FeedbackSignalSummary | null;
  learningPathProgress: StoredLearningPathProgress | null;
  microPracticeEvents: unknown[]; // Not used for snapshot details in MVP
  learnerLevel?: FeedbackSignalLearnerLevel;
  nowParam?: string;
}): TutorMemoryProfile {
  const { feedbackSummary, learningPathProgress, learnerLevel, nowParam } = params;

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
  const categoriesWithCounts = signals.map(s => ({ category: s.category, count: s.count }));
  const sortedCats = sortCategories(categoriesWithCounts);
  const recentFocusCategories = sortedCats.slice(0, 3);
  const repeatedFocusCategories = sortedCats.filter(cat => {
    const sig = signals.find(s => s.category === cat);
    return sig && sig.count >= 3;
  });

  // 3. Build learning path snapshot
  const flatCards = getFlatCurriculumCards();
  let completedCardCount = 0;
  const completedCardIds = new Set<string>();
  const cardTypeCompletionCounts: Partial<Record<TutorMemoryCardType, number>> = {};

  if (learningPathProgress && learningPathProgress.cards) {
    for (const card of flatCards) {
      const progress = learningPathProgress.cards[card.id];
      if (progress && progress.status === "completed") {
        completedCardCount++;
        completedCardIds.add(card.id);
        const cardType = card.type as TutorMemoryCardType;
        cardTypeCompletionCounts[cardType] = (cardTypeCompletionCounts[cardType] || 0) + 1;
      }
    }
  }

  // Compute completed unit IDs
  const completedUnitIds: string[] = [];
  const phase = phase1Curriculum.phases[0];
  if (phase) {
    for (const unit of phase.units) {
      let allUnitCardsCompleted = true;
      let hasCards = false;
      for (const day of unit.days) {
        for (const card of day.cards) {
          hasCards = true;
          if (!completedCardIds.has(card.id)) {
            allUnitCardsCompleted = false;
            break;
          }
        }
        if (!allUnitCardsCompleted) break;
      }
      if (hasCards && allUnitCardsCompleted) {
        completedUnitIds.push(unit.id);
      }
    }
  }

  // Compute currentCardId
  let currentCardId: string | null = null;
  if (flatCards.length > 0) {
    const recommendedCard = flatCards.find(card => {
      const progress = learningPathProgress?.cards?.[card.id];
      return !progress || progress.status !== "completed";
    });
    currentCardId = recommendedCard ? recommendedCard.id : null;
  }

  const isPhaseComplete = flatCards.length > 0 && completedCardCount === flatCards.length;

  const learningPathSnapshot: TutorMemoryLearningPathSnapshot = {
    completedUnitIds,
    completedCardCount,
    cardTypeCompletionCounts,
    currentCardId,
    isPhaseComplete,
  };

  const finalUpdatedAt =
    nowParam ||
    feedbackSummary?.lastUpdatedAt ||
    learningPathProgress?.lastUpdatedAt ||
    new Date().toISOString();

  // Whitelist-only construction
  const profile: TutorMemoryProfile = {
    version: 1,
    learnerLevel: learnerLevel || "Foundation",
    signals,
    learningPath: learningPathSnapshot,
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
  const categoriesWithCounts = signals.map(s => ({ category: s.category, count: s.count }));
  const sortedCats = sortCategories(categoriesWithCounts);
  const recentFocusCategories = sortedCats.slice(0, 3);
  const repeatedFocusCategories = sortedCats.filter(cat => {
    const sig = signals.find(s => s.category === cat);
    return sig && sig.count >= 3;
  });

  const finalUpdatedAt = nowParam || newSummary.lastUpdatedAt || new Date().toISOString();

  // Whitelist-only copy of snapshot
  const learningPathSnapshot: TutorMemoryLearningPathSnapshot = {
    completedUnitIds: [...existing.learningPath.completedUnitIds],
    completedCardCount: existing.learningPath.completedCardCount,
    cardTypeCompletionCounts: { ...existing.learningPath.cardTypeCompletionCounts },
    currentCardId: existing.learningPath.currentCardId,
    isPhaseComplete: existing.learningPath.isPhaseComplete,
  };

  const updatedProfile: TutorMemoryProfile = {
    version: 1,
    learnerLevel: existing.learnerLevel,
    signals,
    learningPath: learningPathSnapshot,
    recentFocusCategories,
    repeatedFocusCategories,
    lastSummaryWindow: newSummary.window,
    lastUpdatedAt: finalUpdatedAt,
  };

  return updatedProfile;
}

export function updateTutorMemoryFromLearningPathProgress(
  existing: TutorMemoryProfile,
  progress: StoredLearningPathProgress,
  nowParam?: string
): TutorMemoryProfile {
  const flatCards = getFlatCurriculumCards();
  let completedCardCount = 0;
  const completedCardIds = new Set<string>();
  const cardTypeCompletionCounts: Partial<Record<TutorMemoryCardType, number>> = {};

  if (progress && progress.cards) {
    for (const card of flatCards) {
      const cardProgress = progress.cards[card.id];
      if (cardProgress && cardProgress.status === "completed") {
        completedCardCount++;
        completedCardIds.add(card.id);
        const cardType = card.type as TutorMemoryCardType;
        cardTypeCompletionCounts[cardType] = (cardTypeCompletionCounts[cardType] || 0) + 1;
      }
    }
  }

  const completedUnitIds: string[] = [];
  const phase = phase1Curriculum.phases[0];
  if (phase) {
    for (const unit of phase.units) {
      let allUnitCardsCompleted = true;
      let hasCards = false;
      for (const day of unit.days) {
        for (const card of day.cards) {
          hasCards = true;
          if (!completedCardIds.has(card.id)) {
            allUnitCardsCompleted = false;
            break;
          }
        }
        if (!allUnitCardsCompleted) break;
      }
      if (hasCards && allUnitCardsCompleted) {
        completedUnitIds.push(unit.id);
      }
    }
  }

  let currentCardId: string | null = null;
  if (flatCards.length > 0) {
    const recommendedCard = flatCards.find(card => {
      const cardProgress = progress?.cards?.[card.id];
      return !cardProgress || cardProgress.status !== "completed";
    });
    currentCardId = recommendedCard ? recommendedCard.id : null;
  }

  const isPhaseComplete = flatCards.length > 0 && completedCardCount === flatCards.length;

  const learningPathSnapshot: TutorMemoryLearningPathSnapshot = {
    completedUnitIds,
    completedCardCount,
    cardTypeCompletionCounts,
    currentCardId,
    isPhaseComplete,
  };

  const finalUpdatedAt = nowParam || progress.lastUpdatedAt || new Date().toISOString();

  // Deep copy signals list
  const signals = existing.signals.map(sig => ({ ...sig }));

  const updatedProfile: TutorMemoryProfile = {
    version: 1,
    learnerLevel: existing.learnerLevel,
    signals,
    learningPath: learningPathSnapshot,
    recentFocusCategories: [...existing.recentFocusCategories],
    repeatedFocusCategories: [...existing.repeatedFocusCategories],
    lastSummaryWindow: existing.lastSummaryWindow,
    lastUpdatedAt: finalUpdatedAt,
  };

  return updatedProfile;
}

export function getSafeTutorMemorySnapshot(
  profile: TutorMemoryProfile
): TutorMemorySummary {
  let totalSignalCount = 0;
  let topCategoryCandidate: FeedbackSignalCategory | null = null;

  const categoriesWithCounts = profile.signals.map(s => {
    totalSignalCount += s.count;
    return { category: s.category, count: s.count };
  });

  if (categoriesWithCounts.length > 0) {
    const sortedCats = sortCategories(categoriesWithCounts);
    const top = sortedCats[0];
    if (top) {
      const topSig = profile.signals.find(s => s.category === top);
      if (topSig && topSig.count > 0) {
        topCategoryCandidate = top;
      }
    }
  }

  const flatCards = getFlatCurriculumCards();
  const totalCards = flatCards.length;
  const completedCards = profile.learningPath.completedCardCount;
  const learningPathCompletionPercent = totalCards > 0 
    ? Math.round((completedCards / totalCards) * 100) 
    : 0;

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
    // Default fallback based on current card or default
    if (profile.learningPath.currentCardId) {
      const currentCard = flatCards.find(c => c.id === profile.learningPath.currentCardId);
      if (currentCard) {
        recommendedCardType = currentCard.type as TutorMemoryCardType;
      }
    }
    if (!recommendedCardType) {
      recommendedCardType = "guided-word";
    }
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
