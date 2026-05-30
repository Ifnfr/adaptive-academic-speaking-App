export type FeedbackSignalCategory =
  | "fluency"
  | "clarity"
  | "structure"
  | "grammar"
  | "vocabulary"
  | "coherence"
  | "support"
  | "academicTone"
  | "taskCompletion"
  | "confidenceHabit";

export type FeedbackSignalSeverity = "light" | "medium" | "strong";

export type FeedbackSignalConfidence = "low" | "medium" | "high";

export type FeedbackSignalLearnerLevel =
  | "Foundation"
  | "Beginner"
  | "Intermediate"
  | "Advanced"
  | "Expert";

export type FeedbackSignalSourceSurface =
  | "active-feedback"
  | "diagnostic"
  | "weekly-review"
  | "mental-model"
  | "article-practice"
  | "vocabulary-correction";

export type FeedbackSignalVersion = 1;

export type FeedbackSignal = {
  version: FeedbackSignalVersion;
  category: FeedbackSignalCategory;
  severity: FeedbackSignalSeverity;
  confidence: FeedbackSignalConfidence;
  learnerLevel: FeedbackSignalLearnerLevel;
  sourceSurface: FeedbackSignalSourceSurface;
  safeLabel: string;
  safeSummary: string;
  recommendedActionId: string;
  createdAt: string;
};

export type FeedbackSignalSummary = {
  version: FeedbackSignalVersion;
  window: "latest" | "7-day" | "all-local";
  topCategories: FeedbackSignalCategory[];
  countsByCategory: Partial<Record<FeedbackSignalCategory, number>>;
  recommendedNextActionId: string | null;
  lastUpdatedAt: string;
};

export type FeedbackRecommendedAction = {
  id: string;
  category: FeedbackSignalCategory;
  learnerLevel: FeedbackSignalLearnerLevel;
  title: string;
  instruction: string;
  estimatedMinutes: number;
};

export type FeedbackTaxonomyEntry = {
  category: FeedbackSignalCategory;
  label: string;
  shortDescription: string;
  practiceTarget: string;
};
