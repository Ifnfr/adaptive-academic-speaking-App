import {
  FeedbackSignalCategory,
  FeedbackSignalLearnerLevel,
} from "../feedback-normalization/types";

export type TutorMemoryVersion = 1;

export type TutorMemorySource =
  | "feedback-summary"
  | "learning-path-progress"
  | "micro-practice-event";

export type TutorMemoryWindow = "latest" | "7-day" | "all-local";

export type TutorMemoryCardType =
  | "guided-word"
  | "phrase-pattern"
  | "sentence-builder"
  | "micro-speaking"
  | "weekly-checkpoint";

export type TutorMemoryRecommendationPriority = "low" | "medium" | "high";

export interface TutorMemorySignal {
  source: TutorMemorySource;
  category: FeedbackSignalCategory;
  count: number;
  window: TutorMemoryWindow;
  lastSeenAt: string; // ISO timestamp
}

export interface TutorMemoryLearningPathSnapshot {
  completedUnitIds: string[];
  completedCardCount: number;
  cardTypeCompletionCounts: Partial<Record<TutorMemoryCardType, number>>;
  currentCardId: string | null;
  isPhaseComplete: boolean;
}

export interface TutorMemoryProfile {
  version: TutorMemoryVersion;
  learnerLevel: FeedbackSignalLearnerLevel;
  signals: TutorMemorySignal[];
  // Learning Path snapshot is optional: null when no Learning Path progress exists.
  learningPath: TutorMemoryLearningPathSnapshot | null;
  recentFocusCategories: FeedbackSignalCategory[]; // top 3
  repeatedFocusCategories: FeedbackSignalCategory[]; // count >= 3
  lastSummaryWindow: TutorMemoryWindow;
  lastUpdatedAt: string;
}

export interface TutorMemoryRecommendation {
  suggestedCardType: TutorMemoryCardType;
  priority: TutorMemoryRecommendationPriority;
  safeReason: string;
  safeInstruction: string;
  basedOn: TutorMemorySource[];
  category: FeedbackSignalCategory | null;
}

export interface TutorMemorySummary {
  version: TutorMemoryVersion;
  totalSignalCount: number;
  topCategory: FeedbackSignalCategory | null;
  repeatedCategories: FeedbackSignalCategory[];
  // 0-100 integer; 0 when no Learning Path snapshot is present.
  learningPathCompletionPercent: number;
  recommendedCardType: TutorMemoryCardType | null;
  lastUpdatedAt: string;
}
