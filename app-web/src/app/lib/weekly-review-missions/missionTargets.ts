import { isWeeklyMissionMetricType, type WeeklyMissionMetricType } from "./types";

export type WeeklyMissionTargetBounds = {
  min: number;
  max: number;
};

export const WEEKLY_MISSION_TARGET_BOUNDS: Record<
  WeeklyMissionMetricType,
  WeeklyMissionTargetBounds
> = {
  speaking_minutes: { min: 15, max: 180 },
  podchat_sessions: { min: 1, max: 14 },
  pattern_drill_sessions: { min: 1, max: 10 },
  vocabulary_collected: { min: 5, max: 150 },
  vocabulary_reviewed: { min: 5, max: 200 },
  vocab_sentence_submitted: { min: 1, max: 50 },
  vocab_correction_saved: { min: 1, max: 50 },
  article_practice_completed: { min: 1, max: 7 },
  daily_practice_days: { min: 1, max: 7 },
  weakness_resolution: { min: 1, max: 5 },
  listening_exercise_sessions: { min: 1, max: 7 },
};

export function validateWeeklyMissionTarget(input: {
  metricType: WeeklyMissionMetricType;
  proposedTargetValue: number;
}): {
  targetValue: number;
  wasClamped: boolean;
  min: number;
  max: number;
} {
  if (!isWeeklyMissionMetricType(input.metricType)) {
    throw new Error("Invalid weekly mission metric type.");
  }

  const { min, max } = WEEKLY_MISSION_TARGET_BOUNDS[input.metricType];
  const proposedTargetValue = Number.isFinite(input.proposedTargetValue)
    ? input.proposedTargetValue
    : min;
  const targetValue = Math.min(max, Math.max(min, Math.round(proposedTargetValue)));

  return {
    targetValue,
    wasClamped: targetValue !== input.proposedTargetValue,
    min,
    max,
  };
}

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function createWeeklyMissionId(input: {
  ownerId?: string;
  weekStart: string;
  metricType: WeeklyMissionMetricType;
  index: number;
}): string {
  const ownerHash = hashString(input.ownerId || "anonymous");
  const seed = `${input.weekStart}:${input.metricType}:${input.index}:${ownerHash}`;
  return `wm_${hashString(seed)}`;
}
