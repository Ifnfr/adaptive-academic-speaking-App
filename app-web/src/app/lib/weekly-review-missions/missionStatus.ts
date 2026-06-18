import type { WeeklyMissionStatus } from "./types";

function parseWeekEndDate(weekEnd: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(weekEnd)) {
    return new Date(`${weekEnd}T23:59:59.999Z`);
  }
  return new Date(weekEnd);
}

export function deriveWeeklyMissionStatus(input: {
  currentValue: number;
  targetValue: number;
  now: Date;
  weekEnd: string;
  carriedOver?: boolean;
}): WeeklyMissionStatus {
  const currentValue = Number.isFinite(input.currentValue)
    ? Math.max(0, input.currentValue)
    : 0;
  const hasValidTarget = Number.isFinite(input.targetValue) && input.targetValue > 0;
  const weekEndDate = parseWeekEndDate(input.weekEnd);
  const isExpired = Number.isFinite(weekEndDate.getTime()) && input.now.getTime() > weekEndDate.getTime();

  if (hasValidTarget && currentValue >= input.targetValue) {
    return "completed";
  }

  if (input.carriedOver === true) {
    return "carried_over";
  }

  if (isExpired) {
    return "expired";
  }

  if (currentValue <= 0) {
    return "not_started";
  }

  return "in_progress";
}
