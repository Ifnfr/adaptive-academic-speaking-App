import { expect, test } from "@playwright/test";
import { createWeeklyMissionRouteHandlers } from "../src/app/api/weekly-review/mission/handler";
import type { FonetikSupabaseClient } from "../src/app/lib/supabase";
import type { WeeklyMission } from "../src/app/lib/weekly-review-missions";

const baseMission: WeeklyMission = {
  missionId: "wm_existing",
  title: "Speak for 15 minutes",
  description: "Build speaking consistency.",
  reason: "Speaking time improves fluency.",
  weaknessTarget: null,
  metricType: "speaking_minutes",
  targetValue: 15,
  currentValue: 0,
  unit: "minutes",
  sourceFeatures: ["podchat"],
  status: "not_started",
  recommendedAction: { label: "Start Podchat", routeTarget: "podchat" },
  createdAt: "2026-06-15T00:00:00.000Z",
  weekStart: "2026-06-15",
  weekEnd: "2026-06-21",
};

type TableRows = Record<string, Array<Record<string, unknown>>>;

function weeklyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "weekly-review-1",
    owner_id: "user-123",
    week_start: "2026-06-15",
    week_end: "2026-06-21",
    timezone: "UTC",
    generated_at: "2026-06-18T00:00:00.000Z",
    diagnosis_summary: "Existing mission plan.",
    data_sufficiency: "partial",
    missions: [baseMission],
    mission_count: 1,
    status: "active",
    source_snapshot: {},
    next_review_available_at: "2026-06-22T00:00:00.000Z",
    provider: "planning",
    created_at: "2026-06-18T00:00:00.000Z",
    updated_at: "2026-06-18T00:00:00.000Z",
    ...overrides,
  };
}

function createMockSupabase(options: {
  cachedReview?: Record<string, unknown> | null;
  sourceRows?: TableRows;
  insertError?: Error | null;
  conflictReview?: Record<string, unknown> | null;
} = {}) {
  const calls: string[] = [];
  const insertedRows: Record<string, unknown>[] = [];
  let cachedReadCount = 0;

  const sourceRows = options.sourceRows ?? {};

  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      expect(table).not.toBe("podchat_turns");
      expect(table).not.toBe("article_writing_answers");
      expect(table).not.toBe("xp_events");

      const builder = {
        select(columns: string) {
          calls.push(`select:${table}:${columns}`);
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
        maybeSingle() {
          calls.push(`maybeSingle:${table}`);
          if (table === "weekly_mission_reviews") {
            cachedReadCount += 1;
            if (cachedReadCount > 1 && options.conflictReview !== undefined) {
              return Promise.resolve({ data: options.conflictReview, error: null });
            }
            return Promise.resolve({ data: options.cachedReview ?? null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        insert(row: Record<string, unknown>) {
          calls.push(`insert:${table}`);
          insertedRows.push(row);
          return builder;
        },
        single() {
          calls.push(`single:${table}`);
          if (options.insertError) {
            return Promise.resolve({ data: null, error: options.insertError });
          }
          const inserted = insertedRows[insertedRows.length - 1] ?? {};
          return Promise.resolve({
            data: weeklyRow({
              ...inserted,
              id: "inserted-review",
              created_at: "2026-06-18T00:00:00.000Z",
              updated_at: "2026-06-18T00:00:00.000Z",
            }),
            error: null,
          });
        },
      };

      return builder;
    },
  };

  return {
    calls,
    insertedRows,
    client: client as unknown as FonetikSupabaseClient,
  };
}

function buildHandlers(input: {
  ownerId?: string | null;
  supabase?: ReturnType<typeof createMockSupabase>;
  provider?: (system: string, user: string) => Promise<string>;
}) {
  return createWeeklyMissionRouteHandlers({
    resolveCurrentUserId: async () => input.ownerId === undefined ? "user-123" : input.ownerId,
    getSupabaseClient: () => input.supabase?.client ?? null,
    callPlanningProvider: input.provider ?? (async () => JSON.stringify(validAiOutput())),
    now: () => new Date("2026-06-18T12:00:00.000Z"),
  });
}

function validAiOutput(overrides: Record<string, unknown> = {}) {
  return {
    diagnosisSummary: "You should balance speaking, vocabulary, and article practice this week.",
    dataSufficiency: "partial",
    topWeaknesses: [{ category: "Grammar", label: "Verb form", reason: "Repeated in feedback." }],
    missions: [
      {
        title: "Complete Podchat practice",
        description: "Finish two evaluated Podchat sessions.",
        reason: "Repeated speaking practice builds fluency.",
        weaknessTarget: null,
        metricType: "podchat_sessions",
        targetValue: 2,
        unit: "sessions",
        sourceFeatures: ["podchat"],
        recommendedAction: { label: "Start Podchat", routeTarget: "podchat" },
      },
      {
        title: "Speak for a focused block",
        description: "Reach a meaningful speaking minute total.",
        reason: "More time creates better evidence.",
        weaknessTarget: null,
        metricType: "speaking_minutes",
        targetValue: 999,
        unit: "minutes",
        sourceFeatures: ["podchat"],
        recommendedAction: { label: "Start Podchat", routeTarget: "podchat" },
      },
      {
        title: "Practice across days",
        description: "Complete tracked practice on multiple days.",
        reason: "Spacing practice improves retention.",
        weaknessTarget: null,
        metricType: "daily_practice_days",
        targetValue: 3,
        unit: "days",
        sourceFeatures: ["podchat", "vocabulary"],
        recommendedAction: { label: "Practice Today", routeTarget: "podchat" },
      },
    ],
    ...overrides,
  };
}

function postRequest(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/weekly-review/mission", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getRequest(query = "") {
  return new Request(`http://localhost/api/weekly-review/mission${query}`, {
    method: "GET",
  });
}

test.describe("Weekly Mission Review route handlers", () => {
  test("unauthenticated GET and POST reject without provider or database work", async () => {
    const supabase = createMockSupabase();
    let providerCalled = false;
    const handlers = buildHandlers({
      ownerId: null,
      supabase,
      provider: async () => {
        providerCalled = true;
        return "{}";
      },
    });

    const getResponse = await handlers.GET(getRequest());
    const postResponse = await handlers.POST(postRequest());

    expect(getResponse.status).toBe(401);
    expect(postResponse.status).toBe(401);
    expect(providerCalled).toBe(false);
    expect(supabase.calls).toEqual([]);
  });

  test("GET returns not_generated and never calls provider", async () => {
    const supabase = createMockSupabase({ cachedReview: null });
    let providerCalled = false;
    const handlers = buildHandlers({
      supabase,
      provider: async () => {
        providerCalled = true;
        return "{}";
      },
    });

    const response = await handlers.GET(getRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.state).toBe("not_generated");
    expect(json.review).toBeNull();
    expect(json.period.weekStart).toBe("2026-06-15");
    expect(providerCalled).toBe(false);
  });

  test("rejects owner identifiers from query or body", async () => {
    const supabase = createMockSupabase();
    const handlers = buildHandlers({ supabase });

    const getResponse = await handlers.GET(getRequest("?ownerId=attacker"));
    const postResponse = await handlers.POST(postRequest({ ownerId: "attacker" }));

    expect(getResponse.status).toBe(400);
    expect(postResponse.status).toBe(400);
  });

  test("POST returns existing review without provider call and recomputes progress", async () => {
    const supabase = createMockSupabase({
      cachedReview: weeklyRow(),
      sourceRows: {
        podchat_sessions: [
          { id: "pod-1", created_at: "2026-06-18T10:00:00.000Z", duration_seconds: 1200, elapsed_seconds: null },
        ],
      },
    });
    let providerCalled = false;
    const handlers = buildHandlers({
      supabase,
      provider: async () => {
        providerCalled = true;
        return "{}";
      },
    });

    const response = await handlers.POST(postRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.state).toBe("existing");
    expect(json.review.missions[0].currentValue).toBe(20);
    expect(json.review.missions[0].status).toBe("completed");
    expect(providerCalled).toBe(false);
  });

  test("successful AI generation saves once with server-computed data sufficiency and clamped target", async () => {
    const supabase = createMockSupabase({
      cachedReview: null,
      sourceRows: {
        podchat_sessions: [
          { id: "pod-1", created_at: "2026-06-18T10:00:00.000Z", duration_seconds: 600, elapsed_seconds: 540 },
        ],
      },
    });
    const handlers = buildHandlers({
      supabase,
      provider: async () => JSON.stringify(validAiOutput({ dataSufficiency: "strong" })),
    });

    const response = await handlers.POST(postRequest({ timezone: "Asia/Jakarta" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.state).toBe("created");
    expect(json.review.dataSufficiency).toBe("partial");
    expect(json.review.timezone).toBe("Asia/Jakarta");
    const speakingMission = json.review.missions.find((mission: WeeklyMission) => mission.metricType === "speaking_minutes");
    expect(speakingMission.targetValue).toBe(180);
    expect(speakingMission.currentValue).toBe(9);

    expect(supabase.insertedRows).toHaveLength(1);
    expect(supabase.insertedRows[0].owner_id).toBe("user-123");
    expect(supabase.insertedRows[0].data_sufficiency).toBe("partial");
    expect(supabase.insertedRows[0].mission_count).toBe(3);

    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain("provider");
    expect(serialized).not.toContain("owner_id");
    expect(serialized).not.toContain("source_snapshot");
    expect(serialized).not.toContain("raw");
    expect(serialized).not.toContain("prompt");
    expect(serialized).not.toContain("model");
  });

  test("provider failure uses deterministic fallback missions", async () => {
    const supabase = createMockSupabase({ cachedReview: null });
    const handlers = buildHandlers({
      supabase,
      provider: async () => {
        throw new Error("provider unavailable");
      },
    });

    const response = await handlers.POST(postRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.state).toBe("created");
    expect(json.review.missions).toHaveLength(5);
    expect(json.review.missions.map((mission: WeeklyMission) => mission.metricType)).toContain("podchat_sessions");
  });

  test("invalid or untrackable AI mission output falls back", async () => {
    const supabase = createMockSupabase({ cachedReview: null });
    const handlers = buildHandlers({
      supabase,
      provider: async () => JSON.stringify(validAiOutput({
        missions: [
          {
            title: "Review vocabulary",
            description: "Unsupported for now.",
            reason: "No durable review source yet.",
            weaknessTarget: null,
            metricType: "vocabulary_reviewed",
            targetValue: 5,
            unit: "reviews",
            sourceFeatures: ["vocabulary"],
            recommendedAction: { label: "Open Vocabulary", routeTarget: "vocabulary" },
          },
          {
            title: "Only second",
            description: "Too few valid missions.",
            reason: "Invalid output.",
            weaknessTarget: null,
            metricType: "podchat_sessions",
            targetValue: 1,
            unit: "sessions",
            sourceFeatures: ["podchat"],
            recommendedAction: { label: "Start Podchat", routeTarget: "podchat" },
          },
          {
            title: "Only third",
            description: "Invalid set.",
            reason: "Invalid output.",
            weaknessTarget: null,
            metricType: "daily_practice_days",
            targetValue: 1,
            unit: "days",
            sourceFeatures: ["podchat"],
            recommendedAction: { label: "Practice", routeTarget: "podchat" },
          },
        ],
      })),
    });

    const response = await handlers.POST(postRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.review.missions).toHaveLength(5);
    expect(json.review.missions.some((mission: WeeklyMission) => mission.metricType === "vocabulary_reviewed")).toBe(false);
  });

  test("AI currentValue/status fields are rejected and replaced by fallback", async () => {
    const supabase = createMockSupabase({ cachedReview: null });
    const handlers = buildHandlers({
      supabase,
      provider: async () => JSON.stringify(validAiOutput({
        missions: [
          { ...validAiOutput().missions[0], currentValue: 999, status: "completed" },
          validAiOutput().missions[1],
          validAiOutput().missions[2],
        ],
      })),
    });

    const response = await handlers.POST(postRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.review.missions).toHaveLength(5);
    expect(json.review.missions.every((mission: WeeklyMission) => mission.currentValue !== 999)).toBe(true);
  });

  test("provider input is bounded and excludes private/raw fields", async () => {
    const supabase = createMockSupabase({
      cachedReview: null,
      sourceRows: {
        learner_error_patterns: [
          {
            id: "weak-1",
            created_at: "2026-06-18T10:00:00.000Z",
            category: "Grammar",
            label: "Verb form",
            practice_focus: "Use correct verb forms.",
            evidence: "raw user sentence must not be selected",
          },
        ],
      },
    });
    let capturedUserPrompt = "";
    const handlers = buildHandlers({
      supabase,
      provider: async (_system, user) => {
        capturedUserPrompt = user;
        return JSON.stringify(validAiOutput());
      },
    });

    const response = await handlers.POST(postRequest());

    expect(response.status).toBe(200);
    expect(capturedUserPrompt).toContain("enabledMetricTypes");
    expect(capturedUserPrompt).not.toContain("owner");
    expect(capturedUserPrompt).not.toContain("email");
    expect(capturedUserPrompt).not.toContain("raw user sentence");
    expect(capturedUserPrompt).not.toContain("transcript");
    expect(capturedUserPrompt).not.toContain("answer");
  });

  test("insert conflict returns existing review", async () => {
    const supabase = createMockSupabase({
      cachedReview: null,
      insertError: new Error("duplicate"),
      conflictReview: weeklyRow(),
    });
    const handlers = buildHandlers({ supabase });

    const response = await handlers.POST(postRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.state).toBe("existing");
    expect(json.review.reviewId).toBe("weekly-review-1");
  });
});
