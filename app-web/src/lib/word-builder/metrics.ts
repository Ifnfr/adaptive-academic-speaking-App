// =============================================================================
// app-web/src/lib/word-builder/metrics.ts
// Pure computation: database queries + analytics for Word Builder grammar errors.
// Does NOT call any AI API. Accepts a pre-initialized Supabase client.
// =============================================================================

export type ErrorCategory =
  | "auxiliary_verb"
  | "subject_verb_agreement"
  | "tense"
  | "article"
  | "preposition"
  | "word_order"
  | "verb_form";

export type Trend = "improving" | "stable" | "deteriorating";

export interface CategoryMetrics {
  category: ErrorCategory;
  errorRate: number;                  // 0-1, frequency in rolling 20-session window
  autonomousCorrectionRate: number;   // 0-1, fixed with L1 hint only
  echoTransferRate: number;           // 0-1, echo attempt correct rate
  hintDependencyScore: number;        // 0-3 average hints per error occurrence
  trend: Trend;
  occurrences: number;                // raw count in rolling window
}

export interface UserMetrics {
  userId: string;
  totalSessions: number;
  totalSentencesProduced: number;
  totalErrorsResolved: number;
  categories: CategoryMetrics[];
  weakestCategory: ErrorCategory | null; // highest errorRate + lowest echoTransferRate
  dataInsufficient: boolean;             // true if fewer than 50 ErrorEvents exist
  calculatedAt: string;                  // ISO 8601
}

// ---------------------------------------------------------------------------
// Internal types for raw DB rows
// ---------------------------------------------------------------------------

interface AttemptRow {
  id: string;
  is_correct: boolean;
  is_echo_attempt: boolean;
  attempt_number: number;
  hints_used: number;
  session_id: string;
}

interface ErrorRow {
  category: ErrorCategory;
  severity: string;
  resolved: boolean;
  hints_used_for_error: number;
  is_echo_attempt: boolean;
  attempt_number: number;
  session_id: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_CATEGORIES: ErrorCategory[] = [
  "auxiliary_verb",
  "subject_verb_agreement",
  "tense",
  "article",
  "preposition",
  "word_order",
  "verb_form",
];

const ROLLING_WINDOW = 20;
const DATA_INSUFFICIENT_THRESHOLD = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function zeroedCategories(): CategoryMetrics[] {
  return ALL_CATEGORIES.map((cat) => ({
    category: cat,
    errorRate: 0,
    autonomousCorrectionRate: 0,
    echoTransferRate: 0,
    hintDependencyScore: 0,
    trend: "stable" as Trend,
    occurrences: 0,
  }));
}

function zeroedMetrics(userId: string): UserMetrics {
  return {
    userId,
    totalSessions: 0,
    totalSentencesProduced: 0,
    totalErrorsResolved: 0,
    categories: zeroedCategories(),
    weakestCategory: null,
    dataInsufficient: true,
    calculatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

export async function calculateUserMetrics(
  supabase: any,
  userId: string
): Promise<UserMetrics> {
  try {
    // -----------------------------------------------------------------------
    // Step 1 — Get rolling 20-session window
    // -----------------------------------------------------------------------
    const { data: sessionRows, error: sessionsError } = await supabase
      .from("word_builder_sessions")
      .select("id")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(ROLLING_WINDOW);

    if (sessionsError) {
      console.error("calculateUserMetrics: sessions query failed", sessionsError);
      return zeroedMetrics(userId);
    }

    // No sessions yet — return zeroed metrics
    if (!sessionRows || sessionRows.length === 0) {
      return zeroedMetrics(userId);
    }

    const recentSessionIds: string[] = sessionRows.map((r: { id: string }) => r.id);

    // Ordered from most recent → oldest (matches .order ascending: false)
    // Index 0 = most recent, index N-1 = oldest
    const recent10Ids = new Set(recentSessionIds.slice(0, 10));
    const previous10Ids = new Set(recentSessionIds.slice(10, 20));

    // -----------------------------------------------------------------------
    // Step 2 — Get all attempts in rolling window
    // -----------------------------------------------------------------------
    const { data: attemptRows, error: attemptsError } = await supabase
      .from("word_builder_attempts")
      .select("id, is_correct, is_echo_attempt, attempt_number, hints_used, session_id")
      .in("session_id", recentSessionIds);

    if (attemptsError) {
      console.error("calculateUserMetrics: attempts query failed", attemptsError);
      return zeroedMetrics(userId);
    }

    const attempts: AttemptRow[] = attemptRows ?? [];

    // -----------------------------------------------------------------------
    // Step 3 — Get all errors in rolling window
    // -----------------------------------------------------------------------
    const { data: errorRows, error: errorsError } = await supabase
      .from("word_builder_errors")
      .select(
        `category, severity, resolved, hints_used_for_error,
         word_builder_attempts!inner ( is_echo_attempt, attempt_number, session_id )`
      )
      .in("word_builder_attempts.session_id", recentSessionIds);

    // Fallback: manual join via attempt IDs if the above relational query fails
    let errors: ErrorRow[] = [];
    if (errorsError || !errorRows) {
      // Attempt a manual join
      if (attempts.length > 0) {
        const attemptIds = attempts.map((a) => a.id);
        const { data: manualErrorRows, error: manualError } = await supabase
          .from("word_builder_errors")
          .select("category, severity, resolved, hints_used_for_error, attempt_id")
          .in("attempt_id", attemptIds);

        if (!manualError && manualErrorRows) {
          const attemptMap = new Map<string, AttemptRow>(
            attempts.map((a) => [a.id, a])
          );
          errors = (manualErrorRows as any[]).map((e: any) => {
            const parentAttempt = attemptMap.get(e.attempt_id);
            return {
              category: e.category as ErrorCategory,
              severity: e.severity,
              resolved: e.resolved,
              hints_used_for_error: e.hints_used_for_error ?? 0,
              is_echo_attempt: parentAttempt?.is_echo_attempt ?? false,
              attempt_number: parentAttempt?.attempt_number ?? 1,
              session_id: parentAttempt?.session_id ?? "",
            };
          });
        }
      }
    } else {
      // Normalize relational rows
      errors = (errorRows as any[]).map((e: any) => {
        const parentAttempt = e.word_builder_attempts;
        return {
          category: e.category as ErrorCategory,
          severity: e.severity,
          resolved: e.resolved,
          hints_used_for_error: e.hints_used_for_error ?? 0,
          is_echo_attempt: parentAttempt?.is_echo_attempt ?? false,
          attempt_number: parentAttempt?.attempt_number ?? 1,
          session_id: parentAttempt?.session_id ?? "",
        };
      });
    }

    // -----------------------------------------------------------------------
    // Step 4 — Get total all-time stats
    // -----------------------------------------------------------------------
    const { count: totalSessionsCount } = await supabase
      .from("word_builder_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const { count: totalAttemptsCount } = await supabase
      .from("word_builder_attempts")
      .select("word_builder_sessions!inner(*)", { count: "exact", head: true })
      .eq("word_builder_sessions.user_id", userId);

    const { count: totalResolvedCount } = await supabase
      .from("word_builder_errors")
      .select(
        "word_builder_attempts!inner(word_builder_sessions!inner(*))",
        { count: "exact", head: true }
      )
      .eq("resolved", true)
      .eq("word_builder_attempts.word_builder_sessions.user_id", userId);

    // Total all-time error count for dataInsufficient check
    const { count: totalErrorCount } = await supabase
      .from("word_builder_errors")
      .select(
        "word_builder_attempts!inner(word_builder_sessions!inner(*))",
        { count: "exact", head: true }
      )
      .eq("word_builder_attempts.word_builder_sessions.user_id", userId);

    const totalSessions = totalSessionsCount ?? 0;
    const totalSentencesProduced = totalAttemptsCount ?? 0;
    const totalErrorsResolved = totalResolvedCount ?? 0;
    const allTimeErrorCount = totalErrorCount ?? 0;
    const dataInsufficient = allTimeErrorCount < DATA_INSUFFICIENT_THRESHOLD;

    // -----------------------------------------------------------------------
    // Step 5 — Build lookup structures for metric computation
    // -----------------------------------------------------------------------

    // Group errors by category
    const errorsByCategory = new Map<ErrorCategory, ErrorRow[]>();
    for (const cat of ALL_CATEGORIES) {
      errorsByCategory.set(cat, []);
    }
    for (const e of errors) {
      if (ALL_CATEGORIES.includes(e.category)) {
        errorsByCategory.get(e.category)!.push(e);
      }
    }

    const totalErrorsInWindow = errors.length;

    // Group attempts by session for echoTransferRate
    const attemptsBySession = new Map<string, AttemptRow[]>();
    for (const a of attempts) {
      if (!attemptsBySession.has(a.session_id)) {
        attemptsBySession.set(a.session_id, []);
      }
      attemptsBySession.get(a.session_id)!.push(a);
    }

    // Group errors by session
    const errorsBySession = new Map<string, ErrorRow[]>();
    for (const e of errors) {
      if (e.session_id) {
        if (!errorsBySession.has(e.session_id)) {
          errorsBySession.set(e.session_id, []);
        }
        errorsBySession.get(e.session_id)!.push(e);
      }
    }

    // -----------------------------------------------------------------------
    // Step 6 — Compute per-category metrics
    // -----------------------------------------------------------------------

    const categoryMetrics: CategoryMetrics[] = ALL_CATEGORIES.map((cat) => {
      const catErrors = errorsByCategory.get(cat) ?? [];
      const occurrences = catErrors.length;

      // --- errorRate ---
      const errorRate =
        totalErrorsInWindow === 0 || occurrences === 0
          ? 0
          : occurrences / totalErrorsInWindow;

      // --- autonomousCorrectionRate ---
      const autonomousCount = catErrors.filter(
        (e) => e.resolved === true && e.hints_used_for_error <= 1
      ).length;
      const autonomousCorrectionRate =
        occurrences === 0 ? 0 : autonomousCount / occurrences;

      // --- echoTransferRate ---
      // Find sessions where this category had at least one error
      const sessionsWithCatError = new Set<string>();
      for (const e of catErrors) {
        if (e.session_id) sessionsWithCatError.add(e.session_id);
      }

      let echoCorrectCount = 0;
      let echoTotalCount = 0;
      for (const sessionId of sessionsWithCatError) {
        const sessionAttempts = attemptsBySession.get(sessionId) ?? [];
        for (const a of sessionAttempts) {
          if (a.is_echo_attempt) {
            echoTotalCount++;
            if (a.is_correct) echoCorrectCount++;
          }
        }
      }
      const echoTransferRate =
        echoTotalCount === 0 ? 0 : echoCorrectCount / echoTotalCount;

      // --- hintDependencyScore ---
      const totalHints = catErrors.reduce(
        (sum, e) => sum + (e.hints_used_for_error ?? 0),
        0
      );
      const rawHintScore = occurrences === 0 ? 0 : totalHints / occurrences;
      // Clamp to 0-3 per spec
      const hintDependencyScore = Math.max(0, Math.min(3, rawHintScore));

      // --- trend ---
      const catErrorsRecent10 = catErrors.filter((e) =>
        recent10Ids.has(e.session_id)
      );
      const catErrorsPrevious10 = catErrors.filter((e) =>
        previous10Ids.has(e.session_id)
      );

      const totalErrorsRecent10 = errors.filter((e) =>
        recent10Ids.has(e.session_id)
      ).length;
      const totalErrorsPrevious10 = errors.filter((e) =>
        previous10Ids.has(e.session_id)
      ).length;

      const recentRate =
        totalErrorsRecent10 === 0
          ? 0
          : catErrorsRecent10.length / totalErrorsRecent10;

      const previousRate =
        totalErrorsPrevious10 === 0
          ? 0
          : catErrorsPrevious10.length / totalErrorsPrevious10;

      let trend: Trend = "stable";
      if (previous10Ids.size === 0 || previousRate === 0) {
        trend = "stable";
      } else if (recentRate < previousRate * 0.85) {
        trend = "improving";
      } else if (recentRate > previousRate * 1.15) {
        trend = "deteriorating";
      } else {
        trend = "stable";
      }

      return {
        category: cat,
        errorRate: round4(clamp(errorRate)),
        autonomousCorrectionRate: round4(clamp(autonomousCorrectionRate)),
        echoTransferRate: round4(clamp(echoTransferRate)),
        hintDependencyScore: round4(hintDependencyScore),
        trend,
        occurrences,
      };
    });

    // -----------------------------------------------------------------------
    // Step 7 — Determine weakestCategory
    // -----------------------------------------------------------------------
    let weakestCategory: ErrorCategory | null = null;

    const withOccurrences = categoryMetrics.filter((c) => c.occurrences > 0);
    if (withOccurrences.length > 0) {
      const scored = withOccurrences.map((c) => ({
        category: c.category,
        weaknessScore: c.errorRate - c.echoTransferRate,
        errorRate: c.errorRate,
      }));

      scored.sort((a, b) => {
        if (b.weaknessScore !== a.weaknessScore) {
          return b.weaknessScore - a.weaknessScore;
        }
        // Tie-break: higher errorRate wins
        return b.errorRate - a.errorRate;
      });

      weakestCategory = scored[0].category;
    }

    // -----------------------------------------------------------------------
    // Step 8 — Return assembled UserMetrics
    // -----------------------------------------------------------------------
    return {
      userId,
      totalSessions,
      totalSentencesProduced,
      totalErrorsResolved,
      categories: categoryMetrics,
      weakestCategory,
      dataInsufficient,
      calculatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("calculateUserMetrics: unexpected error", err);
    return zeroedMetrics(userId);
  }
}
