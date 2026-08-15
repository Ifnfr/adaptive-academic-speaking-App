// app-web/src/app/api/listening-exercise/_lib/abandon-sessions.ts
//
// Cleanup for abandoned listening sessions. A session is "abandoned" when it
// stays in 'in_progress' longer than STALE_MS (24h) — the user left mid-way
// and will not finish it. Marking (not deleting) keeps the data for auditing
// while excluding it from history (start route only counts 'completed').

export const ABANDON_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function abandonStaleSessions(
  supabase: any,
  opts: { ownerId?: string; olderThanMs?: number } = {}
): Promise<number> {
  const olderThanMs = opts.olderThanMs ?? ABANDON_AFTER_MS;
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();

  let query = supabase
    .from("listening_exercise_sessions")
    .update({ status: "abandoned" })
    .eq("status", "in_progress")
    .lt("created_at", cutoff);

  if (opts.ownerId) {
    query = query.eq("owner_id", opts.ownerId);
  }

  const { data, error } = await query.select("id");

  if (error) {
    console.error("[listening] abandonStaleSessions failed:", error);
    return 0;
  }

  const count = Array.isArray(data) ? data.length : 0;
  if (count > 0) {
    console.info(`[listening] Marked ${count} stale session(s) as abandoned.`);
  }
  return count;
}
