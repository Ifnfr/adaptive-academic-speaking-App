// app-web/src/app/api/listening-exercise/_lib/orchestrator.ts
//
// Vercel-side orchestration for listening generation:
//   - builds prompts (fast, pure string work)
//   - fires the Supabase Edge Function `listening-generate` with one job per
//     call (fire-and-forget; the edge function owns the LONG AI call + DB writes)
//
// Edge function URL is derived from NEXT_PUBLIC_SUPABASE_URL.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getEdgeFunctionUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return `${url.replace(/\/+$/, "")}/functions/v1/listening-generate`;
}

/**
 * Fire-and-forget POST to the edge function. Aborts after 5s so the Vercel
 * request never blocks; the edge function keeps running regardless.
 */
export async function fireEdgeJob(payload: Record<string, unknown>): Promise<boolean> {
  const endpoint = getEdgeFunctionUrl();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!endpoint || !serviceRole) {
    console.error("[listening] edge function URL or service role key missing.");
    return false;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${serviceRole}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (res.ok) {
        // Edge function accepted the job (or finished; either way the DB has the truth)
        return true;
      }
      console.error(`[listening] edge function returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return false;
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    // Abort after 5s is EXPECTED (fire-and-forget): the edge function keeps
    // running server-side (Supabase Edge Functions survive client disconnect)
    // and the section status is updated directly in the DB. The next poll
    // re-fires only if the section is still 'pending'. Log as info, not error.
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("aborted")) {
      console.info("[listening] fireEdgeJob: fire-and-forget timeout (expected). Edge function continues.");
    } else {
      console.error("[listening] fireEdgeJob error:", message);
    }
    return false;
  }
}

/**
 * Fetch previous session history for adaptive planning.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchHistorySummary(
  supabase: any,
  ownerId: string,
  isPlacement: boolean,
): Promise<{
  historySummary: string;
  recentSessions: Array<{
    createdAt: string;
    sections: Array<{ domainId: string; topic: string }>;
  }>;
}> {
  const historySummary = "";
  const recentSessions: Array<{
    createdAt: string;
    sections: Array<{ domainId: string; topic: string }>;
  }> = [];

  if (isPlacement) return { historySummary, recentSessions };

  const { data: history } = await supabase
    .from("listening_exercise_sessions")
    .select("cefr_level, overall_score, estimated_band, generation_plan, created_at")
    .eq("owner_id", ownerId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(30);

  if (history && history.length > 0) {
    const summary = history
      .slice(0, 3)
      .map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (h: any, i: number) =>
          `Attempt ${i + 1}: CEFR Level = ${h.cefr_level}, Overall Score = ${h.overall_score}%, Estimated Band = ${h.estimated_band}`
      )
      .join("\n");

    for (const row of history) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plan = row.generation_plan as { sections?: Array<{ topic?: string; domain?: string }> } | null;
      const sections: Array<{ domainId: string; topic: string }> = [];
      if (plan?.sections && Array.isArray(plan.sections)) {
        for (const s of plan.sections) {
          if (
            s?.domain &&
            typeof s.domain === "string" &&
            s.domain.trim().length > 0 &&
            s?.topic &&
            typeof s.topic === "string" &&
            s.topic.trim().length > 0
          ) {
            sections.push({
              domainId: s.domain.trim(),
              topic: s.topic.trim(),
            });
          }
        }
      }
      if (row.created_at) {
        recentSessions.push({ createdAt: row.created_at, sections });
      }
    }
    return { historySummary: summary, recentSessions };
  }

  return { historySummary, recentSessions };
}
