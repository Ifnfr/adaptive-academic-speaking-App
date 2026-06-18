import type {
  WeeklyMissionActivitySummary,
  WeeklyMissionDataSufficiency,
} from "./types";

function safeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function classifyWeeklyMissionDataSufficiency(
  summary: WeeklyMissionActivitySummary,
): WeeklyMissionDataSufficiency {
  const completedPodchatSessions = safeCount(summary.completedPodchatSessions);
  const speakingMinutes = safeCount(summary.speakingMinutes);
  const activeDays = safeCount(summary.activeDays);
  const vocabularyItemsCollected = safeCount(summary.vocabularyItemsCollected);
  const articlePracticeCompleted = safeCount(summary.articlePracticeCompleted);
  const patternDrillSessionsCompleted = safeCount(summary.patternDrillSessionsCompleted);
  const repeatedWeaknessCount = safeCount(summary.repeatedWeaknessCount);

  const meaningfulSignals = [
    completedPodchatSessions > 0,
    speakingMinutes >= 5,
    activeDays > 1,
    vocabularyItemsCollected >= 3,
    articlePracticeCompleted > 0,
    patternDrillSessionsCompleted > 0,
  ].filter(Boolean).length;

  if (meaningfulSignals === 0) {
    return "starter";
  }

  const hasStrongActivity =
    speakingMinutes >= 20 ||
    completedPodchatSessions >= 2 ||
    patternDrillSessionsCompleted >= 1 ||
    articlePracticeCompleted >= 1;

  if (repeatedWeaknessCount >= 1 && hasStrongActivity) {
    return "strong";
  }

  if (meaningfulSignals === 1 && activeDays === 1) {
    return "starter";
  }

  return "partial";
}
