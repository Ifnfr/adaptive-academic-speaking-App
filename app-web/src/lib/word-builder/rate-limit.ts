// In-memory store: userId -> array of timestamps
const requestLog = new Map<string, number[]>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 50;

export function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const timestamps = requestLog.get(userId) ?? [];

  // Remove timestamps outside the window
  const recent = timestamps.filter(t => now - t < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    requestLog.set(userId, recent);
    return { allowed: false, remaining: 0 };
  }

  recent.push(now);
  requestLog.set(userId, recent);
  return { allowed: true, remaining: MAX_REQUESTS - recent.length };
}
