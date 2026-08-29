export const WEEKLY_MISSION_METRIC_TYPES = [
  "speaking_minutes",
  "podchat_sessions",
  "vocabulary_collected",
  "vocabulary_reviewed",
  "vocab_sentence_submitted",
  "vocab_correction_saved",
  "article_practice_completed",
  "daily_practice_days",
  "weakness_resolution",
  "listening_exercise_sessions",
] as const;

export type WeeklyMissionMetricType = (typeof WEEKLY_MISSION_METRIC_TYPES)[number];

export const DEFERRED_WEEKLY_MISSION_METRIC_TYPES = [
  "pronunciation_focus",
  "academic_argument_focus",
  "commonplace_synthesis",
] as const;

export type DeferredWeeklyMissionMetricType =
  (typeof DEFERRED_WEEKLY_MISSION_METRIC_TYPES)[number];

export function isWeeklyMissionMetricType(value: unknown): value is WeeklyMissionMetricType {
  return (
    typeof value === "string" &&
    (WEEKLY_MISSION_METRIC_TYPES as readonly string[]).includes(value)
  );
}

export type WeeklyMissionStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "carried_over"
  | "expired";

export type WeeklyMissionSourceFeature =
  | "podchat"
  | "vocabulary"
  | "article_practice"
  | "commonplace";

export type WeeklyMissionRouteTarget =
  | "podchat"
  | "vocabulary"
  | "article_practice"
  | "commonplace";

export type WeeklyMission = {
  missionId: string;
  title: string;
  description: string;
  reason: string;
  weaknessTarget: {
    category: string;
    label: string;
    practiceFocus?: string;
  } | null;
  metricType: WeeklyMissionMetricType;
  targetValue: number;
  currentValue: number;
  unit: string;
  sourceFeatures: WeeklyMissionSourceFeature[];
  status: WeeklyMissionStatus;
  recommendedAction: {
    label: string;
    routeTarget: WeeklyMissionRouteTarget;
  };
  createdAt: string;
  weekStart: string;
  weekEnd: string;
};

export type WeeklyMissionDataSufficiency =
  | "starter"
  | "partial"
  | "strong";

export type WeeklyMissionReviewStatus =
  | "active"
  | "completed"
  | "expired";

export type WeeklyMissionReview = {
  reviewId: string;
  weekStart: string;
  weekEnd: string;
  timezone: string;
  generatedAt: string;
  diagnosisSummary: string;
  dataSufficiency: WeeklyMissionDataSufficiency;
  missions: WeeklyMission[];
  missionCount: number;
  status: WeeklyMissionReviewStatus;
  nextReviewAvailableAt: string;
  warnings: string[];
};

export type WeeklyMissionAiInput = {
  weekStart: string;
  weekEnd: string;
  enabledMetricTypes: WeeklyMissionMetricType[];
  sourceCounts: Record<string, number>;
  speakingMinutes: number;
  activeDays: string[];
  topWeaknesses: Array<{
    category: string;
    label: string;
    count: number;
    practiceFocus?: string;
  }>;
  priorIncompleteMissions: Array<{
    metricType: WeeklyMissionMetricType;
    title: string;
    targetValue: number;
  }>;
};

export type WeeklyMissionAiOutput = {
  diagnosisSummary: string;
  dataSufficiency: WeeklyMissionDataSufficiency;
  topWeaknesses: Array<{
    category: string;
    label: string;
    reason: string;
  }>;
  missions: WeeklyMission[];
};

export type WeeklyMissionActivitySummary = {
  completedPodchatSessions: number;
  speakingMinutes: number;
  activeDays: number;
  vocabularyItemsCollected: number;
  articlePracticeCompleted: number;
  repeatedWeaknessCount: number;
};
