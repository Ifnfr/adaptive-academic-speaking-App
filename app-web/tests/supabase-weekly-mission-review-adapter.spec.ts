import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  calculateWeeklyMissionProgress,
  deriveWeeklyMissionActiveDays,
  getCachedWeeklyMissionReview,
  getWeeklyMissionSourceSnapshot,
  mapWeeklyMissionReviewRow,
  saveWeeklyMissionReview,
  selectEnabledMissionMetrics,
  type WeeklyMissionReviewRow,
  type WeeklyMissionSourceSnapshot,
} from "../src/app/lib/storage/supabase-weekly-mission-review-adapter";
import type { FonetikSupabaseClient } from "../src/app/lib/supabase";
import type { WeeklyMission } from "../src/app/lib/weekly-review-missions";

const baseMission: WeeklyMission = {
  missionId: "wm_123",
  title: "Speak for 15 minutes",
  description: "Complete enough speaking practice to build fluency.",
  reason: "Speaking time is the main weekly focus.",
  weaknessTarget: null,
  metricType: "speaking_minutes",
  targetValue: 15,
  currentValue: 0,
  unit: "minutes",
  sourceFeatures: ["podchat"],
  status: "not_started",
  recommendedAction: {
    label: "Start Podchat",
    routeTarget: "podchat",
  },
  createdAt: "2026-06-15T00:00:00.000Z",
  weekStart: "2026-06-15",
  weekEnd: "2026-06-21",
};

const baseSnapshot: WeeklyMissionSourceSnapshot = {
  podchatSessions: 2,
  speakingSeconds: 960,
  speakingMinutes: 16,
  patternDrillSessions: 1,
  vocabularyCollected: 3,
  vocabularySentencesSubmitted: 2,
  vocabularyCorrectionsSaved: 1,
  articlePracticeCompleted: 1,
  activeDays: ["2026-06-15", "2026-06-17"],
  repeatedWeaknessCount: 1,
  topWeaknesses: [
    {
      category: "Grammar",
      label: "Verb agreement",
      count: 2,
      practiceFocus: "Use singular verb endings.",
    },
  ],
};

const baseRow: WeeklyMissionReviewRow = {
  id: "review-uuid",
  owner_id: "user_secret",
  week_start: "2026-06-15",
  week_end: "2026-06-21",
  timezone: "UTC",
  generated_at: "2026-06-15T00:00:00.000Z",
  diagnosis_summary: "Focus on speaking consistency.",
  data_sufficiency: "partial",
  missions: [baseMission],
  mission_count: 1,
  status: "active",
  source_snapshot: { ...baseSnapshot, warnings: ["Starter mission used."] },
  next_review_available_at: "2026-06-22T00:00:00.000Z",
  provider: "deepseek",
  created_at: "2026-06-15T00:00:00.000Z",
  updated_at: "2026-06-15T00:00:00.000Z",
};

type QueryResult = { data: unknown; error: Error | null };

function createMissionReviewClient(options: {
  cached?: QueryResult;
  insert?: QueryResult;
  cachedAfterConflict?: QueryResult;
} = {}) {
  const calls: string[] = [];
  let missionReviewReadCount = 0;

  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      const builder = {
        select(columns: string) {
          calls.push(`select:${columns}`);
          return builder;
        },
        eq(column: string, value: string) {
          calls.push(`eq:${table}:${column}:${value}`);
          return builder;
        },
        maybeSingle() {
          calls.push(`maybeSingle:${table}`);
          if (table === "weekly_mission_reviews") {
            missionReviewReadCount += 1;
            if (missionReviewReadCount > 1 && options.cachedAfterConflict) {
              return Promise.resolve(options.cachedAfterConflict);
            }
            return Promise.resolve(options.cached ?? { data: null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        insert(row: unknown) {
          calls.push(`insert:${table}:${JSON.stringify(row)}`);
          return builder;
        },
        single() {
          calls.push(`single:${table}`);
          return Promise.resolve(options.insert ?? { data: baseRow, error: null });
        },
      };
      return builder;
    },
  };

  return { calls, client: client as unknown as FonetikSupabaseClient };
}

function createSnapshotClient(tableRows: Record<string, QueryResult>) {
  const calls: string[] = [];

  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      const builder = {
        select(columns: string) {
          calls.push(`select:${table}:${columns}`);
          expect(columns).not.toContain("text");
          expect(columns).not.toContain("answer");
          expect(columns).not.toContain("sentence");
          expect(columns).not.toContain("transcript");
          return builder;
        },
        eq(column: string, value: string) {
          calls.push(`eq:${table}:${column}:${value}`);
          return builder;
        },
        gte(column: string, value: string) {
          calls.push(`gte:${table}:${column}:${value}`);
          return builder;
        },
        lte(column: string, value: string) {
          calls.push(`lte:${table}:${column}:${value}`);
          return Promise.resolve(tableRows[table] ?? { data: [], error: null });
        },
      };
      return builder;
    },
  };

  return { calls, client: client as unknown as FonetikSupabaseClient };
}

test.describe("Supabase weekly mission review adapter", () => {
  test("maps row to client contract without exposing owner, provider, or source snapshot", () => {
    const mapped = mapWeeklyMissionReviewRow(baseRow);

    expect(mapped).toEqual({
      reviewId: "review-uuid",
      weekStart: "2026-06-15",
      weekEnd: "2026-06-21",
      timezone: "UTC",
      generatedAt: "2026-06-15T00:00:00.000Z",
      diagnosisSummary: "Focus on speaking consistency.",
      dataSufficiency: "partial",
      missions: [baseMission],
      missionCount: 1,
      status: "active",
      nextReviewAvailableAt: "2026-06-22T00:00:00.000Z",
      warnings: ["Starter mission used."],
    });

    const serialized = JSON.stringify(mapped);
    expect(serialized).not.toContain("owner_id");
    expect(serialized).not.toContain("user_secret");
    expect(serialized).not.toContain("deepseek");
    expect(serialized).not.toContain("source_snapshot");
  });

  test("getCachedWeeklyMissionReview reads only weekly_mission_reviews by owner and week", async () => {
    const mock = createMissionReviewClient({
      cached: { data: baseRow, error: null },
    });

    const result = await getCachedWeeklyMissionReview(
      "user_secret",
      "2026-06-15",
      "2026-06-21",
      mock.client,
    );

    expect(result?.reviewId).toBe("review-uuid");
    expect(mock.calls).toContain("from:weekly_mission_reviews");
    expect(mock.calls).toContain("eq:weekly_mission_reviews:owner_id:user_secret");
    expect(mock.calls).toContain("eq:weekly_mission_reviews:week_start:2026-06-15");
    expect(mock.calls).toContain("eq:weekly_mission_reviews:week_end:2026-06-21");
    expect(mock.calls.join("|")).not.toContain("weekly_reviews");
  });

  test("getCachedWeeklyMissionReview returns null when no row exists", async () => {
    const mock = createMissionReviewClient({
      cached: { data: null, error: null },
    });

    await expect(
      getCachedWeeklyMissionReview("user_secret", "2026-06-15", "2026-06-21", mock.client),
    ).resolves.toBeNull();
  });

  test("saveWeeklyMissionReview inserts a new row when no owner-week review exists", async () => {
    const mock = createMissionReviewClient({
      cached: { data: null, error: null },
      insert: { data: baseRow, error: null },
    });

    const result = await saveWeeklyMissionReview(
      {
        ownerId: "user_secret",
        weekStart: "2026-06-15",
        weekEnd: "2026-06-21",
        timezone: "UTC",
        generatedAt: "2026-06-15T00:00:00.000Z",
        diagnosisSummary: "Focus on speaking consistency.",
        dataSufficiency: "partial",
        missions: [baseMission],
        status: "active",
        sourceSnapshot: baseSnapshot,
        nextReviewAvailableAt: "2026-06-22T00:00:00.000Z",
        provider: "deepseek",
      },
      mock.client,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.existing).toBe(false);
      expect(result.review.reviewId).toBe("review-uuid");
    }
    expect(mock.calls.some((call) => call.startsWith("insert:weekly_mission_reviews:"))).toBe(true);
  });

  test("saveWeeklyMissionReview returns existing row without overwriting missions", async () => {
    const mock = createMissionReviewClient({
      cached: { data: baseRow, error: null },
    });

    const result = await saveWeeklyMissionReview(
      {
        ownerId: "user_secret",
        weekStart: "2026-06-15",
        weekEnd: "2026-06-21",
        timezone: "UTC",
        generatedAt: "2026-06-15T00:00:00.000Z",
        diagnosisSummary: "New diagnosis should not overwrite.",
        dataSufficiency: "strong",
        missions: [{ ...baseMission, title: "Different mission" }],
        status: "active",
        sourceSnapshot: baseSnapshot,
        nextReviewAvailableAt: "2026-06-22T00:00:00.000Z",
      },
      mock.client,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.existing).toBe(true);
      expect(result.review.missions[0].title).toBe("Speak for 15 minutes");
    }
    expect(mock.calls.some((call) => call.startsWith("insert:weekly_mission_reviews:"))).toBe(false);
  });

  test("saveWeeklyMissionReview handles unique conflict by returning existing row", async () => {
    const mock = createMissionReviewClient({
      cached: { data: null, error: null },
      insert: { data: null, error: new Error("duplicate key value violates unique constraint") },
      cachedAfterConflict: { data: baseRow, error: null },
    });

    const result = await saveWeeklyMissionReview(
      {
        ownerId: "user_secret",
        weekStart: "2026-06-15",
        weekEnd: "2026-06-21",
        timezone: "UTC",
        generatedAt: "2026-06-15T00:00:00.000Z",
        diagnosisSummary: "Conflict review.",
        dataSufficiency: "partial",
        missions: [baseMission],
        status: "active",
        sourceSnapshot: baseSnapshot,
        nextReviewAvailableAt: "2026-06-22T00:00:00.000Z",
      },
      mock.client,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.existing).toBe(true);
      expect(result.review.reviewId).toBe("review-uuid");
    }
  });

  test("source snapshot counts ready metrics and avoids raw transcript/answer tables", async () => {
    const mock = createSnapshotClient({
      podchat_sessions: {
        data: [
          { id: "pod-1", created_at: "2026-06-15T10:00:00.000Z", duration_seconds: 600, elapsed_seconds: 540 },
          { id: "pod-2", created_at: "2026-06-16T10:00:00.000Z", duration_seconds: 300, elapsed_seconds: null },
        ],
        error: null,
      },
      pattern_drill_sessions: {
        data: [{ id: "drill-1", created_at: "2026-06-17T10:00:00.000Z" }],
        error: null,
      },
      vocabulary_items: {
        data: [{ id: "vocab-1", created_at: "2026-06-18T10:00:00.000Z" }],
        error: null,
      },
      vocabulary_sentences: {
        data: [{ id: "sentence-1", created_at: "2026-06-18T11:00:00.000Z" }],
        error: null,
      },
      vocabulary_corrections: {
        data: [{ id: "correction-1", checked_at: "2026-06-18T12:00:00.000Z" }],
        error: null,
      },
      article_writing_sessions: {
        data: [{ id: "article-1", created_at: "2026-06-19T10:00:00.000Z" }],
        error: null,
      },
      learner_error_patterns: {
        data: [
          { id: "weak-1", created_at: "2026-06-15T10:00:00.000Z", category: "Grammar", label: "Verb form", practice_focus: "Use correct verb forms." },
          { id: "weak-2", created_at: "2026-06-16T10:00:00.000Z", category: "Grammar", label: "Verb form", practice_focus: "Use correct verb forms." },
        ],
        error: null,
      },
    });

    const snapshot = await getWeeklyMissionSourceSnapshot(
      { ownerId: "user_secret", weekStart: "2026-06-15", weekEnd: "2026-06-21" },
      mock.client,
    );

    expect(snapshot).toMatchObject({
      podchatSessions: 2,
      speakingSeconds: 840,
      speakingMinutes: 14,
      patternDrillSessions: 1,
      vocabularyCollected: 1,
      vocabularySentencesSubmitted: 1,
      vocabularyCorrectionsSaved: 1,
      articlePracticeCompleted: 1,
      repeatedWeaknessCount: 1,
    });
    expect(snapshot.activeDays).toEqual([
      "2026-06-15",
      "2026-06-16",
      "2026-06-17",
      "2026-06-18",
      "2026-06-19",
    ]);
    expect(snapshot.topWeaknesses[0]).toMatchObject({
      category: "Grammar",
      label: "Verb form",
      count: 2,
    });

    expect(mock.calls.join("|")).not.toContain("podchat_turns");
    expect(mock.calls.join("|")).not.toContain("article_writing_answers");
    expect(mock.calls.join("|")).not.toContain("xp_events");
  });

  test("deriveWeeklyMissionActiveDays returns sorted distinct UTC days", () => {
    expect(
      deriveWeeklyMissionActiveDays([
        { created_at: "2026-06-16T23:59:00.000Z" },
        { created_at: "2026-06-16T01:00:00.000Z" },
        { checked_at: "2026-06-15T12:00:00.000Z" },
        { created_at: "invalid" },
      ]),
    ).toEqual(["2026-06-15", "2026-06-16"]);
  });

  test("calculateWeeklyMissionProgress updates current values and statuses deterministically", () => {
    const missions: WeeklyMission[] = [
      baseMission,
      { ...baseMission, missionId: "wm_pod", metricType: "podchat_sessions", targetValue: 3, unit: "sessions" },
      { ...baseMission, missionId: "wm_days", metricType: "daily_practice_days", targetValue: 2, unit: "days" },
      { ...baseMission, missionId: "wm_reviewed", metricType: "vocabulary_reviewed", targetValue: 5, unit: "reviews" },
    ];

    const result = calculateWeeklyMissionProgress({
      missions,
      sourceSnapshot: baseSnapshot,
      now: new Date("2026-06-18T00:00:00.000Z"),
    });

    expect(result.map((mission) => [mission.metricType, mission.currentValue, mission.status])).toEqual([
      ["speaking_minutes", 16, "completed"],
      ["podchat_sessions", 2, "in_progress"],
      ["daily_practice_days", 2, "completed"],
      ["vocabulary_reviewed", 0, "not_started"],
    ]);
  });

  test("default enabled metrics exclude unsupported mission metrics", () => {
    expect(selectEnabledMissionMetrics()).toEqual([
      "speaking_minutes",
      "podchat_sessions",
      "pattern_drill_sessions",
      "vocabulary_collected",
      "vocab_sentence_submitted",
      "vocab_correction_saved",
      "article_practice_completed",
      "daily_practice_days",
    ]);
    expect(selectEnabledMissionMetrics()).not.toContain("vocabulary_reviewed");
    expect(selectEnabledMissionMetrics()).not.toContain("weakness_resolution");
  });

  test("adapter has no provider, localStorage, sessionStorage, or raw table dependency", () => {
    const source = readFileSync(
      "src/app/lib/storage/supabase-weekly-mission-review-adapter.ts",
      "utf8",
    );

    for (const forbidden of [
      "localStorage",
      "sessionStorage",
      "fetch(",
      "podchat_turns",
      "article_writing_answers",
      "xp_events",
      "raw_transcript",
      "raw_provider",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  test("speaking_minutes calculation prefers elapsed_seconds over duration_seconds and floors sum", async () => {
    const mock = createSnapshotClient({
      podchat_sessions: {
        data: [
          { id: "pod-1", created_at: "2026-06-15T10:00:00.000Z", duration_seconds: 600, elapsed_seconds: 540 }, // prefers 540
          { id: "pod-2", created_at: "2026-06-16T10:00:00.000Z", duration_seconds: 330, elapsed_seconds: null }, // prefers 330
        ],
        error: null,
      },
    });

    const snapshot = await getWeeklyMissionSourceSnapshot(
      { ownerId: "user_secret", weekStart: "2026-06-15", weekEnd: "2026-06-21" },
      mock.client,
    );

    // 540 + 330 = 870 seconds. 870 / 60 = 14.5 -> floored to 14
    expect(snapshot.speakingSeconds).toBe(870);
    expect(snapshot.speakingMinutes).toBe(14);
  });

  test("daily_practice_days dedupes multiple activities on same UTC date", () => {
    const activeDays = deriveWeeklyMissionActiveDays([
      { created_at: "2026-06-15T02:00:00.000Z" },
      { created_at: "2026-06-15T10:00:00.000Z" },
      { checked_at: "2026-06-15T22:00:00.000Z" },
      { created_at: "2026-06-17T01:00:00.000Z" },
    ]);
    expect(activeDays).toEqual(["2026-06-15", "2026-06-17"]);
    expect(activeDays.length).toBe(2);
  });

  test("unsupported metrics default to currentValue = 0 without failing", () => {
    const missions: WeeklyMission[] = [
      { ...baseMission, missionId: "wm_reviewed", metricType: "vocabulary_reviewed", targetValue: 5 },
      { ...baseMission, missionId: "wm_resolved", metricType: "weakness_resolution", targetValue: 2 },
    ];

    const result = calculateWeeklyMissionProgress({
      missions,
      sourceSnapshot: baseSnapshot,
      now: new Date("2026-06-18T00:00:00.000Z"),
    });

    expect(result[0].currentValue).toBe(0);
    expect(result[1].currentValue).toBe(0);
    expect(result[0].status).toBe("not_started");
    expect(result[1].status).toBe("not_started");
  });
});
