import { expect, test, type Page } from "@playwright/test";
import {
  calculateWeeklyMissionProgress,
  deriveWeeklyMissionActiveDays,
  getWeeklyMissionSourceSnapshot,
} from "../src/app/lib/storage/supabase-weekly-mission-review-adapter";
import type { FonetikSupabaseClient } from "../src/app/lib/supabase";
import type { WeeklyMission, WeeklyMissionMetricType } from "../src/app/lib/weekly-review-missions";

// Helper mission generator for UI test mocks
function mockMission(overrides: Record<string, unknown> = {}) {
  return {
    missionId: "mission-podchat",
    title: "Complete a baseline Podchat",
    description: "Finish one evaluated Podchat session.",
    reason: "Start with a real speaking sample before diagnosing patterns.",
    weaknessTarget: null,
    metricType: "podchat_sessions",
    targetValue: 1,
    currentValue: 0,
    unit: "sessions",
    sourceFeatures: ["podchat"],
    status: "not_started",
    recommendedAction: { label: "Start Podchat", routeTarget: "podchat" },
    createdAt: "2026-06-18T12:00:00.000Z",
    weekStart: "2026-06-15",
    weekEnd: "2026-06-21",
    ...overrides,
  };
}

const baseMission: WeeklyMission = mockMission() as WeeklyMission;

// Helper review generator for UI test mocks
function mockReview(overrides: Record<string, unknown> = {}) {
  return {
    reviewId: "review-1",
    weekStart: "2026-06-15",
    weekEnd: "2026-06-21",
    timezone: "UTC",
    generatedAt: "2026-06-18T12:00:00.000Z",
    diagnosisSummary: "Baseline learning progress check.",
    dataSufficiency: "starter",
    missions: [
      mockMission(),
      mockMission({
        missionId: "mission-pattern",
        title: "Drill your top weakness",
        metricType: "pattern_drill_sessions",
        unit: "sessions",
        sourceFeatures: ["pattern_drill"],
        recommendedAction: { label: "Open Drill Mode", routeTarget: "pattern_drill" },
      }),
      mockMission({
        missionId: "mission-vocab",
        title: "Collect vocabulary items",
        metricType: "vocabulary_collected",
        unit: "items",
        sourceFeatures: ["vocabulary"],
        recommendedAction: { label: "Open Vocabulary", routeTarget: "vocabulary" },
      }),
      mockMission({
        missionId: "mission-article",
        title: "Complete article practice",
        metricType: "article_practice_completed",
        unit: "sessions",
        sourceFeatures: ["article_practice"],
        recommendedAction: { label: "Start Article Practice", routeTarget: "article_practice" },
      }),
      mockMission({
        missionId: "mission-commonplace",
        title: "Review Commonplace",
        metricType: "vocab_sentence_submitted", // commonplace is CTA-only, maps to supported metric
        unit: "sentences",
        sourceFeatures: ["commonplace"],
        recommendedAction: { label: "Open Commonplace", routeTarget: "commonplace" },
      }),
    ],
    missionCount: 5,
    status: "active",
    nextReviewAvailableAt: "2026-06-22T00:00:00.000Z",
    warnings: [],
    ...overrides,
  };
}

async function gotoMockApp(page: Page) {
  await page.goto("/?mockAuth=true");
  await expect(page.getByTestId("podchat-setup")).toBeVisible();
}

async function openWeeklyReview(page: Page) {
  const backButton = page.getByRole("button", { name: /Kembali ke Fonetik|Back to Fonetik/i });
  if (await backButton.isVisible().catch(() => false)) {
    await backButton.click();
  }
  const menuButton = page.getByTestId("mobile-nav-toggle");
  if (await menuButton.isVisible().catch(() => false)) {
    await menuButton.click();
  }
  await page.getByRole("button", { name: "Weekly Review" }).click();
  await expect(page.getByTestId("weekly-mission-dashboard")).toBeVisible();
}

type TableRows = Record<string, Array<Record<string, unknown>>>;

function createMockSupabase(sourceRows: TableRows) {
  const calls: string[] = [];

  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      const builder = {
        select(columns: string) {
          calls.push(`select:${table}:${columns}`);
          // Safety checks: ensure sensitive text columns are never queried
          expect(columns).not.toContain("transcript");
          expect(columns).not.toContain("answer");
          expect(columns).not.toContain("sentence");
          expect(columns).not.toContain("text");
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
          return Promise.resolve({ data: sourceRows[table] ?? [], error: null });
        },
      };
      return builder;
    },
  };

  return {
    calls,
    client: client as unknown as FonetikSupabaseClient,
  };
}

// ─── Playwright UI Integration Tests ─────────────────────────────────────────

test.describe("Weekly Mission CTA Routing UI Integration", () => {
  test("mission CTAs route to respective application views, including commonplace", async ({ page }) => {
    // Mock the mission API endpoint
    await page.route("**/api/weekly-review/mission", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ state: "existing", review: mockReview() }),
      });
    });

    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "empty", reason: "No weakness data yet." }),
      });
    });

    await gotoMockApp(page);
    await openWeeklyReview(page);

    // 1. Podchat CTA
    await page.getByRole("button", { name: "Start Podchat" }).click();
    await expect(page.getByRole("button", { name: "Podchat", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("podchat-setup")).toBeVisible();

    // 2. Drill Mode CTA
    await openWeeklyReview(page);
    await page.getByRole("button", { name: "Open Drill Mode" }).click();
    await expect(page.getByRole("heading", { name: "Active Session" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Drill Mode" })).toHaveAttribute("aria-pressed", "true");

    // 3. Vocabulary CTA
    await openWeeklyReview(page);
    await page.getByRole("button", { name: "Open Vocabulary" }).click();
    await expect(page.locator("h2:has-text(\"Vocabulary Notebook\")")).toBeVisible();

    // 4. Article Practice CTA
    await openWeeklyReview(page);
    await page.getByRole("button", { name: "Start Article Practice" }).click();
    await expect(page.locator("h2:has-text(\"Article Practice\")")).toBeVisible();

    // 5. Commonplace CTA
    await openWeeklyReview(page);
    await page.getByRole("button", { name: "Open Commonplace" }).click();
    await expect(page.getByTestId("commonplace-view")).toBeVisible();

    // 6. Generate button visibility check
    await openWeeklyReview(page);
    await expect(page.getByRole("button", { name: "Generate Weekly Missions" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Start Podchat" })).toBeVisible();
  });
});

// ─── Progress Source Adapter Integration Tests ────────────────────────────────

test.describe("Weekly Mission Progress Source Snapshot & Metrics integration", () => {
  test("deriveWeeklyMissionActiveDays extracts and dedupes active dates from various features", () => {
    const activityRows = [
      { created_at: "2026-06-15T08:00:00.000Z" },
      { created_at: "2026-06-15T14:30:00.000Z" }, // duplicate day
      { checked_at: "2026-06-16T12:00:00.000Z" },
      { created_at: "2026-06-17T23:59:59.000Z" },
    ];

    const activeDays = deriveWeeklyMissionActiveDays(activityRows);
    expect(activeDays).toEqual(["2026-06-15", "2026-06-16", "2026-06-17"]);
  });

  test("getWeeklyMissionSourceSnapshot returns correct count for ready metrics and dedupes activeDays", async () => {
    const sourceRows: TableRows = {
      podchat_sessions: [
        { id: "p1", created_at: "2026-06-15T10:00:00.000Z", duration_seconds: 300, elapsed_seconds: 0 },
        { id: "p2", created_at: "2026-06-16T10:00:00.000Z", duration_seconds: 150, elapsed_seconds: 180 }, // uses elapsed_seconds over duration
      ],
      pattern_drill_sessions: [
        { id: "d1", created_at: "2026-06-15T11:00:00.000Z" },
      ],
      vocabulary_items: [
        { id: "v1", created_at: "2026-06-15T12:00:00.000Z" },
        { id: "v2", created_at: "2026-06-15T12:05:00.000Z" },
      ],
      vocabulary_sentences: [
        { id: "s1", created_at: "2026-06-15T12:10:00.000Z" },
      ],
      vocabulary_corrections: [
        { id: "c1", checked_at: "2026-06-17T09:00:00.000Z" },
      ],
      article_writing_sessions: [
        { id: "a1", created_at: "2026-06-17T14:00:00.000Z" },
      ],
      learner_error_patterns: [],
    };

    const mock = createMockSupabase(sourceRows);
    const snapshot = await getWeeklyMissionSourceSnapshot(
      { ownerId: "user-123", weekStart: "2026-06-15", weekEnd: "2026-06-21" },
      mock.client
    );

    expect(snapshot.podchatSessions).toBe(2);
    expect(snapshot.speakingMinutes).toBe(8); // (300 + 180) / 60 = 8 minutes
    expect(snapshot.patternDrillSessions).toBe(1);
    expect(snapshot.vocabularyCollected).toBe(2);
    expect(snapshot.vocabularySentencesSubmitted).toBe(1);
    expect(snapshot.vocabularyCorrectionsSaved).toBe(1);
    expect(snapshot.articlePracticeCompleted).toBe(1);
    expect(snapshot.activeDays).toEqual(["2026-06-15", "2026-06-16", "2026-06-17"]);
  });

  test("getWeeklyMissionSourceSnapshot handles 0 duration and draft rows correctly (exclusion of drafts/aborted)", async () => {
    const sourceRows: TableRows = {
      podchat_sessions: [
        { id: "p1", created_at: "2026-06-15T10:00:00.000Z", duration_seconds: 0, elapsed_seconds: 0 }, // aborted session
        { id: "p2", created_at: "2026-06-16T10:00:00.000Z", duration_seconds: 60, elapsed_seconds: null },
      ],
      pattern_drill_sessions: [],
      vocabulary_items: [],
      vocabulary_sentences: [],
      vocabulary_corrections: [],
      article_writing_sessions: [], // unsubmitted articles/essays are never saved to database
      learner_error_patterns: [],
    };

    const mock = createMockSupabase(sourceRows);
    const snapshot = await getWeeklyMissionSourceSnapshot(
      { ownerId: "user-123", weekStart: "2026-06-15", weekEnd: "2026-06-21" },
      mock.client
    );

    expect(snapshot.speakingMinutes).toBe(1); // 60 seconds / 60
    expect(snapshot.podchatSessions).toBe(2); // row is present, so counted as session (though speaking seconds are 0 for p1)
  });

  test("calculateWeeklyMissionProgress recomputes currentValue and status for missions", () => {
    const baseMissionInstance: WeeklyMission = {
      ...baseMission,
      metricType: "speaking_minutes",
      targetValue: 10,
      currentValue: 0,
    };

    const dailyPracticeMissionInstance: WeeklyMission = {
      ...baseMission,
      metricType: "daily_practice_days",
      targetValue: 3,
      currentValue: 0,
      unit: "days",
    };

    const missions: WeeklyMission[] = [
      baseMissionInstance,
      dailyPracticeMissionInstance,
    ];

    const snapshot = {
      podchatSessions: 1,
      speakingSeconds: 300,
      speakingMinutes: 5,
      patternDrillSessions: 0,
      vocabularyCollected: 0,
      vocabularySentencesSubmitted: 0,
      vocabularyCorrectionsSaved: 0,
      articlePracticeCompleted: 0,
      activeDays: ["2026-06-15", "2026-06-16"],
      repeatedWeaknessCount: 0,
      topWeaknesses: [],
    };

    const updated = calculateWeeklyMissionProgress({
      missions,
      sourceSnapshot: snapshot,
      now: new Date("2026-06-18T12:00:00.000Z"),
    });

    expect(updated[0].currentValue).toBe(5);
    expect(updated[0].status).toBe("in_progress");

    expect(updated[1].currentValue).toBe(2);
    expect(updated[1].status).toBe("in_progress");
  });

  test("calculateWeeklyMissionProgress handles deferred metrics by returning 0", () => {
    const vocabReviewedMissionInstance: WeeklyMission = {
      ...baseMission,
      metricType: "vocabulary_reviewed" as WeeklyMissionMetricType,
      targetValue: 5,
      currentValue: 3, // existing value
    };

    const weaknessResolutionMissionInstance: WeeklyMission = {
      ...baseMission,
      metricType: "weakness_resolution" as WeeklyMissionMetricType,
      targetValue: 1,
      currentValue: 1, // existing value
    };

    const missions: WeeklyMission[] = [
      vocabReviewedMissionInstance,
      weaknessResolutionMissionInstance,
    ];

    const snapshot = {
      podchatSessions: 1,
      speakingSeconds: 300,
      speakingMinutes: 5,
      patternDrillSessions: 1,
      vocabularyCollected: 0,
      vocabularySentencesSubmitted: 0,
      vocabularyCorrectionsSaved: 0,
      articlePracticeCompleted: 0,
      activeDays: ["2026-06-15"],
      repeatedWeaknessCount: 0,
      topWeaknesses: [],
    };

    const updated = calculateWeeklyMissionProgress({
      missions,
      sourceSnapshot: snapshot,
      now: new Date("2026-06-18T12:00:00.000Z"),
    });

    // Both should be coerced/recomputed to 0 since they are deferred
    expect(updated[0].currentValue).toBe(0);
    expect(updated[1].currentValue).toBe(0);
  });
});
