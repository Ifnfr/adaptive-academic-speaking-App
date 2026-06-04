import type { FonetikSupabaseClient } from "../supabase";

export type GetWeeklyReviewMemoryInput = {
  ownerId: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
};

export type WeeklyReviewMemoryData = {
  periodStart: string;
  periodEnd: string;
  podchatSessionCount: number;
  articleWritingSessionCount: number;
  totalSessionCount: number;
  topErrorPatterns: Array<{
    category: string;
    label: string;
    count: number;
    evidence?: string;
    correction?: string;
    practiceFocus?: string;
  }>;
  podchatSummaries: string[];
  articleWritingSummaries: string[];
  nextPracticeFocuses: string[];
  sourceSessionIds: string[];
};

export type WeeklyReviewResult = {
  summary: string;
  recurringWeakness: string;
  bestImprovement: string;
  scoreTrend: string;
  nextWeekFocus: string;
  recommendedPlan: string[]; // exactly 7 items
  warnings: string[];
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(d: string): boolean {
  if (!DATE_REGEX.test(d)) return false;
  const t = Date.parse(d);
  return !isNaN(t);
}

export async function getWeeklyReviewMemory(
  input: GetWeeklyReviewMemoryInput,
  supabaseClient: FonetikSupabaseClient,
): Promise<{ ok: true; data: WeeklyReviewMemoryData } | { ok: false; error: string }> {
  // Validate inputs
  if (!input.ownerId || typeof input.ownerId !== "string" || input.ownerId.trim().length === 0) {
    return { ok: false, error: "weekly_review_memory_failed" };
  }
  if (!input.periodStart || !input.periodEnd || !isValidDateString(input.periodStart) || !isValidDateString(input.periodEnd)) {
    return { ok: false, error: "weekly_review_memory_failed" };
  }

  const start = new Date(input.periodStart);
  const end = new Date(input.periodEnd);
  if (start > end) {
    return { ok: false, error: "weekly_review_memory_failed" };
  }

  try {
    // Query podchat_sessions in date range
    // created_at is timestamp, so we search between periodStartT00:00:00Z and periodEndT23:59:59.999Z
    const { data: podchatData, error: podchatError } = await supabaseClient
      .from("podchat_sessions")
      .select("id, created_at, topic, difficulty, duration_seconds, evaluation")
      .eq("owner_id", input.ownerId)
      .gte("created_at", `${input.periodStart}T00:00:00.000Z`)
      .lte("created_at", `${input.periodEnd}T23:59:59.999Z`);

    if (podchatError) {
      return { ok: false, error: "weekly_review_memory_failed" };
    }

    // Query article_writing_sessions in date range
    const { data: articleData, error: articleError } = await supabaseClient
      .from("article_writing_sessions")
      .select("id, created_at, level, evaluation")
      .eq("owner_id", input.ownerId)
      .gte("created_at", `${input.periodStart}T00:00:00.000Z`)
      .lte("created_at", `${input.periodEnd}T23:59:59.999Z`);

    if (articleError) {
      return { ok: false, error: "weekly_review_memory_failed" };
    }

    // Query learner_error_patterns in date range
    const { data: errorData, error: errorError } = await supabaseClient
      .from("learner_error_patterns")
      .select("id, created_at, category, label, evidence, correction, practice_focus")
      .eq("owner_id", input.ownerId)
      .gte("created_at", `${input.periodStart}T00:00:00.000Z`)
      .lte("created_at", `${input.periodEnd}T23:59:59.999Z`);

    if (errorError) {
      return { ok: false, error: "weekly_review_memory_failed" };
    }

    // Aggregate counts & data
    const podchatSessionCount = podchatData?.length || 0;
    const articleWritingSessionCount = articleData?.length || 0;
    const totalSessionCount = podchatSessionCount + articleWritingSessionCount;

    const sourceSessionIds: string[] = [];
    if (podchatData) {
      podchatData.forEach((s) => sourceSessionIds.push(s.id));
    }
    if (articleData) {
      articleData.forEach((s) => sourceSessionIds.push(s.id));
    }

    // Process error pattern groupings
    const errorGroups: Record<string, {
      category: string;
      label: string;
      count: number;
      evidence?: string;
      correction?: string;
      practiceFocus?: string;
    }> = {};

    if (errorData) {
      for (const pattern of errorData) {
        const key = `${pattern.category || ""}:${pattern.label || ""}`;
        if (!errorGroups[key]) {
          errorGroups[key] = {
            category: pattern.category || "General",
            label: pattern.label || "Error",
            count: 0,
            evidence: pattern.evidence || undefined,
            correction: pattern.correction || undefined,
            practiceFocus: pattern.practice_focus || undefined,
          };
        }
        errorGroups[key].count += 1;
      }
    }

    const topErrorPatterns = Object.values(errorGroups).sort((a, b) => b.count - a.count);

    // Extract summaries and focuses
    const podchatSummaries: string[] = [];
    const nextPracticeFocuses: string[] = [];
    if (podchatData) {
      for (const s of podchatData) {
        const evalObj = s.evaluation as { summary?: string; nextPracticeFocus?: string } | null | undefined;
        if (evalObj?.summary) {
          podchatSummaries.push(evalObj.summary);
        }
        if (evalObj?.nextPracticeFocus) {
          nextPracticeFocuses.push(evalObj.nextPracticeFocus);
        }
      }
    }

    const articleWritingSummaries: string[] = [];
    if (articleData) {
      for (const s of articleData) {
        const evalObj = s.evaluation as { overallFeedback?: string; nextWritingFocus?: string } | null | undefined;
        if (evalObj?.overallFeedback) {
          articleWritingSummaries.push(evalObj.overallFeedback);
        }
        if (evalObj?.nextWritingFocus) {
          nextPracticeFocuses.push(evalObj.nextWritingFocus);
        }
      }
    }

    return {
      ok: true,
      data: {
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        podchatSessionCount,
        articleWritingSessionCount,
        totalSessionCount,
        topErrorPatterns,
        podchatSummaries,
        articleWritingSummaries,
        nextPracticeFocuses,
        sourceSessionIds,
      },
    };
  } catch {
    return { ok: false, error: "weekly_review_memory_failed" };
  }
}

export function buildDeterministicWeeklyReview(
  memory: WeeklyReviewMemoryData,
): WeeklyReviewResult {
  if (memory.totalSessionCount < 4) {
    return {
      summary: `You completed ${memory.totalSessionCount} practice session(s) this week. Keep practicing to unlock complete review insights.`,
      recurringWeakness: "Not enough sessions to analyze recurring weaknesses.",
      bestImprovement: "Not enough sessions to analyze improvements.",
      scoreTrend: "Not enough sessions to track score trend.",
      nextWeekFocus: "Practice consistency.",
      recommendedPlan: [
        "Day 1: Complete 1 new practice session.",
        "Day 2: Review your past feedback points.",
        "Day 3: Complete 1 new practice session.",
        "Day 4: Focus on speaking/writing without pausing.",
        "Day 5: Complete 1 new practice session.",
        "Day 6: Focus on correct subject-verb agreement.",
        "Day 7: Complete 1 new practice session.",
      ],
      warnings: [
        `Weekly Review requires at least 4 completed practice sessions. You have completed only ${memory.totalSessionCount}.`,
      ],
    };
  }

  // Determine top recurring weakness evidence
  let recurringWeakness = "No specific recurring grammar or vocabulary weaknesses detected.";
  let planFocus = "Review overall structure and consistency.";
  if (memory.topErrorPatterns.length > 0) {
    const top = memory.topErrorPatterns[0];
    recurringWeakness = `Your most recurring issue is in "${top.category}" under "${top.label}" (observed ${top.count} time(s)).`;
    if (top.evidence && top.correction) {
      recurringWeakness += ` Example: "${top.evidence}" -> "${top.correction}".`;
    }
    if (top.practiceFocus) {
      planFocus = top.practiceFocus;
    }
  }

  const nextWeekFocus = memory.nextPracticeFocuses.length > 0
    ? memory.nextPracticeFocuses[0]
    : planFocus;

  // Build custom plan based on errors if available
  const recommendedPlan = [
    "Day 1: Review your weekly review summary and identify your main grammar bottlenecks.",
    "Day 2: Practice speaking/writing sentences targeting: " + (memory.topErrorPatterns[0]?.label || "grammar structures") + ".",
    "Day 3: Complete a new practice session focusing entirely on correct word forms.",
    "Day 4: Do a 10-minute focus session practicing: " + nextWeekFocus + ".",
    "Day 5: Review past corrections and try to rewrite/re-speak one past exercise.",
    "Day 6: Speak or write for 60 seconds with emphasis on coherence and clear paragraph organization.",
    "Day 7: Complete a new practice session and self-evaluate for any recurring errors.",
  ];

  return {
    summary: `You completed ${memory.podchatSessionCount} speaking sessions and ${memory.articleWritingSessionCount} writing sessions. Overall, you are showing solid engagement across your practices.`,
    recurringWeakness,
    bestImprovement: "You showed great persistence and steady engagement across different practice formats.",
    scoreTrend: `Score trends are stable across the ${memory.totalSessionCount} sessions recorded this week.`,
    nextWeekFocus,
    recommendedPlan,
    warnings: [],
  };
}

export async function getCachedWeeklyReview(
  ownerId: string,
  periodStart: string,
  periodEnd: string,
  supabaseClient: FonetikSupabaseClient,
) {
  if (!ownerId || !periodStart || !periodEnd) return null;

  const { data, error } = await supabaseClient
    .from("weekly_reviews")
    .select("summary, source_session_ids")
    .eq("owner_id", ownerId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();

  if (error) {
    return null;
  }
  return data;
}

export async function saveWeeklyReview(
  ownerId: string,
  periodStart: string,
  periodEnd: string,
  review: unknown,
  sourceSessionIds: string[],
  supabaseClient: FonetikSupabaseClient,
) {
  if (!ownerId || !periodStart || !periodEnd || !review) {
    return { ok: false, error: "Invalid inputs" };
  }

  const { data, error } = await supabaseClient
    .from("weekly_reviews")
    .upsert({
      owner_id: ownerId,
      period_start: periodStart,
      period_end: periodEnd,
      summary: review,
      source_session_ids: sourceSessionIds,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id };
}
