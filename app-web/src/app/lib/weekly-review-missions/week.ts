export type WeeklyMissionPeriod = {
  weekStart: string;
  weekEnd: string;
  nextReviewAvailableAt: string;
  timezone: string;
};

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function getWeeklyMissionPeriod(options?: {
  now?: Date;
  timezone?: string;
}): WeeklyMissionPeriod {
  const now = options?.now ?? new Date();
  const timezone = options?.timezone?.trim() || "UTC";

  // TODO: Full IANA timezone week-boundary support is not implemented yet.
  // WR-1 treats timezone as metadata only and keeps calculations in UTC.
  const today = startOfUtcDay(now);
  const day = today.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const monday = addUtcDays(today, -daysSinceMonday);
  const sunday = addUtcDays(monday, 6);
  const nextMonday = addUtcDays(monday, 7);

  return {
    weekStart: toUtcDateString(monday),
    weekEnd: toUtcDateString(sunday),
    nextReviewAvailableAt: nextMonday.toISOString(),
    timezone,
  };
}
