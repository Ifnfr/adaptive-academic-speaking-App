type SessionForStreak = {
  date: string;
};

function parseISODateLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function dayDiff(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function computeDayStreak(
  sessions: ReadonlyArray<SessionForStreak>,
): number {
  if (sessions.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const uniqueDates = new Set<string>();
  for (const s of sessions) {
    if (s.date) uniqueDates.add(s.date);
  }

  const dates = Array.from(uniqueDates)
    .map(parseISODateLocal)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime());

  if (dates.length === 0) return 0;

  const gap = dayDiff(today, dates[0]);
  if (gap > 1) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = dayDiff(dates[i - 1], dates[i]);
    if (diff === 1) streak += 1;
    else if (diff === 0) continue;
    else break;
  }
  return streak;
}
