import { expect, test } from "@playwright/test";
import {
  getWeeklyReviewMemory,
  buildDeterministicWeeklyReview,
  getCachedWeeklyReview,
  saveWeeklyReview,
} from "../src/app/lib/storage/supabase-weekly-review-adapter";
import type { FonetikSupabaseClient } from "../src/app/lib/supabase";

type MockRow = Record<string, unknown>;

interface MockClientConfig {
  podchatData?: MockRow[];
  podchatError?: Record<string, unknown>;
  articleData?: MockRow[];
  articleError?: Record<string, unknown>;
  errorData?: MockRow[];
  errorError?: Record<string, unknown>;
  cachedData?: MockRow;
  cachedError?: Record<string, unknown>;
  saveData?: MockRow;
  saveError?: Record<string, unknown>;
}

function createMockSupabaseClient(config: MockClientConfig = {}) {
  const calls: string[] = [];

  const client = {
    from(table: string) {
      calls.push(`from:${table}`);

      const builder = {
        select(columns?: string) {
          calls.push(`select:${columns || "*"}`);
          // Verify that forbidden fields are not selected
          if (columns) {
            expect(columns).not.toContain("raw_audio");
            expect(columns).not.toContain("audio_blob");
            expect(columns).not.toContain("recording_url");
            expect(columns).not.toContain("media_recorder");
            expect(columns).not.toContain("raw_stt");
            expect(columns).not.toContain("raw_tts");
            expect(columns).not.toContain("source_url");
            expect(columns).not.toContain("full_article");
          }
          return builder;
        },
        eq(column: string, value: string) {
          calls.push(`eq:${column}:${value}`);
          return builder;
        },
        gte(column: string, value: string) {
          calls.push(`gte:${column}:${value}`);
          return builder;
        },
        lte(column: string, value: string) {
          calls.push(`lte:${column}:${value}`);
          return builder;
        },
        maybeSingle() {
          calls.push("maybeSingle");
          if (table === "weekly_reviews") {
            if (config.cachedError) {
              return Promise.resolve({ data: null, error: config.cachedError });
            }
            return Promise.resolve({ data: config.cachedData || null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        single() {
          calls.push("single");
          if (table === "weekly_reviews") {
            if (config.saveError) {
              return Promise.resolve({ data: null, error: config.saveError });
            }
            return Promise.resolve({ data: config.saveData || { id: "inserted-id" }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        upsert(values: Record<string, unknown>) {
          calls.push(`upsert:${JSON.stringify(values)}`);
          // Verify forbidden fields are not stored
          expect(JSON.stringify(values)).not.toContain("raw_audio");
          expect(JSON.stringify(values)).not.toContain("audio_blob");
          expect(JSON.stringify(values)).not.toContain("recording_url");
          return builder;
        },
        then(resolve: (value: { data: unknown[] | null; error: unknown }) => void) {
          if (table === "podchat_sessions") {
            if (config.podchatError) {
              resolve({ data: null, error: config.podchatError });
            } else {
              resolve({ data: config.podchatData || [], error: null });
            }
          } else if (table === "article_writing_sessions") {
            if (config.articleError) {
              resolve({ data: null, error: config.articleError });
            } else {
              resolve({ data: config.articleData || [], error: null });
            }
          } else if (table === "learner_error_patterns") {
            if (config.errorError) {
              resolve({ data: null, error: config.errorError });
            } else {
              resolve({ data: config.errorData || [], error: null });
            }
          } else {
            resolve({ data: [], error: null });
          }
        },
      };

      return builder;
    },
  };

  return { client: client as unknown as FonetikSupabaseClient, calls };
}

test.describe("Supabase Weekly Review Adapter", () => {
  // 1. valid memory aggregation reads only owner-scoped rows
  test("valid memory aggregation reads only owner-scoped rows and filters dates", async () => {
    const { client, calls } = createMockSupabaseClient({
      podchatData: [
        {
          id: "podchat-1",
          created_at: "2026-05-20T10:00:00Z",
          topic: "Economics",
          difficulty: "Intermediate",
          duration_seconds: 120,
          evaluation: { summary: "Good work speaking.", nextPracticeFocus: "Verb forms" },
        },
      ],
      articleData: [
        {
          id: "article-1",
          created_at: "2026-05-21T12:00:00Z",
          level: "Intermediate",
          evaluation: { overallFeedback: "Good structure.", nextWritingFocus: "Flow" },
        },
      ],
      errorData: [
        {
          category: "Grammar",
          label: "Subject-Verb Agreement",
          evidence: "He run",
          correction: "He runs",
          practice_focus: "Add -s to singular verbs",
        },
      ],
    });

    const res = await getWeeklyReviewMemory(
      {
        ownerId: "user-123",
        periodStart: "2026-05-18",
        periodEnd: "2026-05-24",
      },
      client,
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.podchatSessionCount).toBe(1);
      expect(res.data.articleWritingSessionCount).toBe(1);
      expect(res.data.totalSessionCount).toBe(2);
      expect(res.data.topErrorPatterns[0].label).toBe("Subject-Verb Agreement");
    }

    // Verify owner check
    expect(calls).toContain("eq:owner_id:user-123");
    expect(calls).toContain("gte:created_at:2026-05-18T00:00:00.000Z");
    expect(calls).toContain("lte:created_at:2026-05-24T23:59:59.999Z");
  });

  // 2. missing ownerId rejects before querying
  test("missing ownerId rejects before querying", async () => {
    const { client, calls } = createMockSupabaseClient();
    const res = await getWeeklyReviewMemory(
      {
        ownerId: "",
        periodStart: "2026-05-18",
        periodEnd: "2026-05-24",
      },
      client,
    );
    expect(res.ok).toBe(false);
    expect(calls.length).toBe(0);
  });

  // 3. invalid date rejects before querying
  test("invalid date rejects before querying", async () => {
    const { client, calls } = createMockSupabaseClient();
    const res = await getWeeklyReviewMemory(
      {
        ownerId: "user-123",
        periodStart: "invalid-date",
        periodEnd: "2026-05-24",
      },
      client,
    );
    expect(res.ok).toBe(false);
    expect(calls.length).toBe(0);
  });

  // 4. periodEnd before periodStart rejects before querying
  test("periodEnd before periodStart rejects before querying", async () => {
    const { client, calls } = createMockSupabaseClient();
    const res = await getWeeklyReviewMemory(
      {
        ownerId: "user-123",
        periodStart: "2026-05-24",
        periodEnd: "2026-05-18",
      },
      client,
    );
    expect(res.ok).toBe(false);
    expect(calls.length).toBe(0);
  });

  // 5. empty memory returns totalSessionCount 0 and safe warnings
  test("empty memory returns totalSessionCount 0", async () => {
    const { client } = createMockSupabaseClient({
      podchatData: [],
      articleData: [],
      errorData: [],
    });
    const res = await getWeeklyReviewMemory(
      {
        ownerId: "user-123",
        periodStart: "2026-05-18",
        periodEnd: "2026-05-24",
      },
      client,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.totalSessionCount).toBe(0);
      const review = buildDeterministicWeeklyReview(res.data);
      expect(review.warnings.length).toBeGreaterThan(0);
      expect(review.warnings[0]).toContain("requires at least 4 completed practice sessions");
    }
  });

  // 6. totalSessionCount < 4 returns deterministic not-enough-data review
  test("totalSessionCount < 4 returns deterministic not-enough-data review", () => {
    const mockMemory = {
      periodStart: "2026-05-18",
      periodEnd: "2026-05-24",
      podchatSessionCount: 1,
      articleWritingSessionCount: 1,
      totalSessionCount: 2,
      topErrorPatterns: [],
      podchatSummaries: ["A speaking summary"],
      articleWritingSummaries: ["A writing summary"],
      nextPracticeFocuses: ["Verb usage"],
      sourceSessionIds: ["s1", "s2"],
    };
    const review = buildDeterministicWeeklyReview(mockMemory);
    expect(review.warnings.length).toBe(1);
    expect(review.summary).toContain("You completed 2 practice session(s)");
    expect(review.recurringWeakness).toBe("Not enough sessions to analyze recurring weaknesses.");
    expect(review.recommendedPlan.length).toBe(7);
  });

  // 7. totalSessionCount >= 4 returns deterministic review with exactly 7 recommendedPlan items
  test("totalSessionCount >= 4 returns deterministic review with exactly 7 recommendedPlan items", () => {
    const mockMemory = {
      periodStart: "2026-05-18",
      periodEnd: "2026-05-24",
      podchatSessionCount: 2,
      articleWritingSessionCount: 2,
      totalSessionCount: 4,
      topErrorPatterns: [
        {
          category: "Vocabulary",
          label: "Academic tone",
          count: 3,
          evidence: "good",
          correction: "beneficial",
          practiceFocus: "Use academic adjectives",
        },
      ],
      podchatSummaries: ["Speak summaries"],
      articleWritingSummaries: ["Write summaries"],
      nextPracticeFocuses: ["Tenses"],
      sourceSessionIds: ["s1", "s2", "s3", "s4"],
    };
    const review = buildDeterministicWeeklyReview(mockMemory);
    expect(review.warnings.length).toBe(0);
    expect(review.recommendedPlan.length).toBe(7);
    expect(review.recurringWeakness).toContain("Academic tone");
    expect(review.recurringWeakness).toContain("good");
  });

  // 8. topErrorPatterns are grouped and counted correctly
  test("topErrorPatterns are grouped and counted correctly", async () => {
    const { client } = createMockSupabaseClient({
      errorData: [
        { category: "Grammar", label: "Verb Form", evidence: "run", correction: "runs" },
        { category: "Grammar", label: "Verb Form", evidence: "go", correction: "goes" },
        { category: "Vocabulary", label: "Word Choice", evidence: "bad", correction: "unfavorable" },
      ],
    });
    const res = await getWeeklyReviewMemory(
      {
        ownerId: "user-123",
        periodStart: "2026-05-18",
        periodEnd: "2026-05-24",
      },
      client,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.topErrorPatterns.length).toBe(2);
      expect(res.data.topErrorPatterns[0].label).toBe("Verb Form");
      expect(res.data.topErrorPatterns[0].count).toBe(2);
      expect(res.data.topErrorPatterns[1].label).toBe("Word Choice");
      expect(res.data.topErrorPatterns[1].count).toBe(1);
    }
  });

  // 9. adapter does not read podchat_turns or article_writing_answers
  test("adapter does not read podchat_turns or article_writing_answers", async () => {
    const { client, calls } = createMockSupabaseClient();
    await getWeeklyReviewMemory(
      {
        ownerId: "user-123",
        periodStart: "2026-05-18",
        periodEnd: "2026-05-24",
      },
      client,
    );
    // Ensure turns and answers tables were never targeted
    for (const call of calls) {
      expect(call).not.toContain("podchat_turns");
      expect(call).not.toContain("article_writing_answers");
    }
  });

  // 10. forbidden fields are not selected, returned, or stored
  test("forbidden fields are not stored or queried", async () => {
    const { client } = createMockSupabaseClient();
    // getCachedWeeklyReview
    const cached = await getCachedWeeklyReview("user-123", "2026-05-18", "2026-05-24", client);
    expect(cached).toBeNull();

    // saveWeeklyReview
    const saved = await saveWeeklyReview(
      "user-123",
      "2026-05-18",
      "2026-05-24",
      { summary: "test review" },
      ["session-1"],
      client,
    );
    expect(saved.ok).toBe(true);
  });

  // 11. Supabase query failure returns safe { ok: false, error: "weekly_review_memory_failed" }
  // 13. raw Supabase errors are not exposed to callers
  test("Supabase query failure returns safe error without exposing internal error message", async () => {
    const { client } = createMockSupabaseClient({
      podchatError: { message: "Internal DB Timeout" },
    });
    const res = await getWeeklyReviewMemory(
      {
        ownerId: "user-123",
        periodStart: "2026-05-18",
        periodEnd: "2026-05-24",
      },
      client,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("weekly_review_memory_failed");
    }
  });
});
