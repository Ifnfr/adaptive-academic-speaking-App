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

function missionMetrics(json: { review: { missions: WeeklyMission[] } }) {
  return json.review.missions.map((mission) => mission.metricType);
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

  test("provider failure uses starter baseline fallback missions for no activity", async () => {
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
    expect(json.review.dataSufficiency).toBe("starter");
    expect(json.review.missions).toHaveLength(5);
    expect(missionMetrics(json).slice(0, 4)).toEqual([
      "podchat_sessions",
      "speaking_minutes",
      "vocabulary_collected",
      "daily_practice_days",
    ]);
    expect(missionMetrics(json)).not.toContain("pattern_drill_sessions");
    expect(json.review.missions.every((mission: WeeklyMission) => mission.weaknessTarget === null)).toBe(true);
  });

  test("partial fallback prioritizes speaking when speaking activity is low", async () => {
    const supabase = createMockSupabase({
      cachedReview: null,
      sourceRows: {
        vocabulary_items: [
          { id: "vocab-1", created_at: "2026-06-15T10:00:00.000Z" },
          { id: "vocab-2", created_at: "2026-06-16T10:00:00.000Z" },
          { id: "vocab-3", created_at: "2026-06-17T10:00:00.000Z" },
          { id: "vocab-4", created_at: "2026-06-18T10:00:00.000Z" },
        ],
      },
    });
    const handlers = buildHandlers({
      supabase,
      provider: async () => {
        throw new Error("provider unavailable");
      },
    });

    const response = await handlers.POST(postRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.review.dataSufficiency).toBe("partial");
    expect(missionMetrics(json).slice(0, 2)).toEqual(["speaking_minutes", "podchat_sessions"]);
    expect(missionMetrics(json)).not.toContain("pattern_drill_sessions");
  });

  test("partial fallback includes vocabulary mission when vocabulary activity is the gap", async () => {
    const supabase = createMockSupabase({
      cachedReview: null,
      sourceRows: {
        podchat_sessions: [
          { id: "pod-1", created_at: "2026-06-15T10:00:00.000Z", duration_seconds: 1200, elapsed_seconds: null },
          { id: "pod-2", created_at: "2026-06-17T10:00:00.000Z", duration_seconds: 1200, elapsed_seconds: null },
        ],
      },
    });
    const handlers = buildHandlers({
      supabase,
      provider: async () => {
        throw new Error("provider unavailable");
      },
    });

    const response = await handlers.POST(postRequest());
    const json = await response.json();
    const vocabularyMission = json.review.missions.find((mission: WeeklyMission) => mission.metricType === "vocabulary_collected");

    expect(response.status).toBe(200);
    expect(json.review.dataSufficiency).toBe("partial");
    expect(vocabularyMission).toBeTruthy();
    expect(vocabularyMission?.title).toContain("vocabulary gap");
    expect(vocabularyMission?.reason).toContain("Vocabulary activity is low");
  });

  test("strong fallback includes weakness-focused Pattern Drill and differs from partial fallback", async () => {
    const partialSupabase = createMockSupabase({
      cachedReview: null,
      sourceRows: {
        podchat_sessions: [
          { id: "pod-1", created_at: "2026-06-15T10:00:00.000Z", duration_seconds: 1200, elapsed_seconds: null },
          { id: "pod-2", created_at: "2026-06-17T10:00:00.000Z", duration_seconds: 1200, elapsed_seconds: null },
        ],
      },
    });
    const strongSupabase = createMockSupabase({
      cachedReview: null,
      sourceRows: {
        podchat_sessions: [
          { id: "pod-1", created_at: "2026-06-15T10:00:00.000Z", duration_seconds: 1200, elapsed_seconds: null },
          { id: "pod-2", created_at: "2026-06-17T10:00:00.000Z", duration_seconds: 1200, elapsed_seconds: null },
        ],
        learner_error_patterns: [
          { id: "weak-1", created_at: "2026-06-16T10:00:00.000Z", category: "Grammar", label: "Verb form", practice_focus: "Use correct verb forms." },
          { id: "weak-2", created_at: "2026-06-18T10:00:00.000Z", category: "Grammar", label: "Verb form", practice_focus: "Use correct verb forms." },
        ],
      },
    });
    const provider = async () => {
      throw new Error("provider unavailable");
    };
    const partialHandlers = buildHandlers({ supabase: partialSupabase, provider });
    const strongHandlers = buildHandlers({ supabase: strongSupabase, provider });

    const partialResponse = await partialHandlers.POST(postRequest());
    const strongResponse = await strongHandlers.POST(postRequest());
    const partialJson = await partialResponse.json();
    const strongJson = await strongResponse.json();
    const patternMission = strongJson.review.missions.find((mission: WeeklyMission) => mission.metricType === "pattern_drill_sessions");

    expect(partialResponse.status).toBe(200);
    expect(strongResponse.status).toBe(200);
    expect(partialJson.review.dataSufficiency).toBe("partial");
    expect(strongJson.review.dataSufficiency).toBe("strong");
    expect(patternMission).toBeTruthy();
    expect(patternMission?.weaknessTarget).toEqual({
      category: "Grammar",
      label: "Verb form",
      practiceFocus: "Use correct verb forms.",
    });
    expect(missionMetrics(strongJson)).toContain("speaking_minutes");
    expect(missionMetrics(strongJson)).not.toEqual(missionMetrics(partialJson));
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

  test("GET existing review recomputes live progress from updated source data and does not write to database", async () => {
    const supabase = createMockSupabase({
      cachedReview: weeklyRow(),
      sourceRows: {
        podchat_sessions: [
          { id: "pod-1", created_at: "2026-06-18T10:00:00.000Z", duration_seconds: 900, elapsed_seconds: null },
        ],
      },
    });

    const handlers = buildHandlers({ supabase });
    const response = await handlers.GET(getRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.state).toBe("existing");
    // speaking_minutes target is 15. The sourceRow speaking_minutes is 15.
    expect(json.review.missions[0].currentValue).toBe(15);
    expect(json.review.missions[0].status).toBe("completed");

    // Verify no insert queries were run
    expect(supabase.calls.filter((c) => c.startsWith("insert:")).length).toBe(0);
  });

  test("POST existing review behaves like GET and recomputes progress without calling provider", async () => {
    const supabase = createMockSupabase({
      cachedReview: weeklyRow(),
      sourceRows: {
        podchat_sessions: [
          { id: "pod-1", created_at: "2026-06-18T10:00:00.000Z", duration_seconds: 420, elapsed_seconds: null },
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
    // speaking_minutes currentValue = 7 minutes (420 / 60)
    expect(json.review.missions[0].currentValue).toBe(7);
    expect(json.review.missions[0].status).toBe("in_progress");
    expect(providerCalled).toBe(false);
  });

  test("status derives correctly under different values and time boundaries", async () => {
    // 1. Not started (currentValue = 0)
    const supabaseNotStarted = createMockSupabase({
      cachedReview: weeklyRow(),
      sourceRows: {},
    });
    const handlersNotStarted = createWeeklyMissionRouteHandlers({
      resolveCurrentUserId: async () => "user-123",
      getSupabaseClient: () => supabaseNotStarted.client,
      now: () => new Date("2026-06-18T12:00:00.000Z"), // before weekEnd
    });
    const res1 = await handlersNotStarted.GET(getRequest());
    const json1 = await res1.json();
    expect(json1.review.missions[0].status).toBe("not_started");

    // 2. In progress (0 < currentValue < targetValue)
    const supabaseInProgress = createMockSupabase({
      cachedReview: weeklyRow(),
      sourceRows: {
        podchat_sessions: [
          { id: "pod-1", created_at: "2026-06-18T10:00:00.000Z", duration_seconds: 300, elapsed_seconds: null },
        ],
      },
    });
    const handlersInProgress = createWeeklyMissionRouteHandlers({
      resolveCurrentUserId: async () => "user-123",
      getSupabaseClient: () => supabaseInProgress.client,
      now: () => new Date("2026-06-18T12:00:00.000Z"), // before weekEnd
    });
    const res2 = await handlersInProgress.GET(getRequest());
    const json2 = await res2.json();
    expect(json2.review.missions[0].status).toBe("in_progress");

    // 3. Completed (currentValue >= targetValue)
    const supabaseCompleted = createMockSupabase({
      cachedReview: weeklyRow(),
      sourceRows: {
        podchat_sessions: [
          { id: "pod-1", created_at: "2026-06-18T10:00:00.000Z", duration_seconds: 900, elapsed_seconds: null },
        ],
      },
    });
    const handlersCompleted = createWeeklyMissionRouteHandlers({
      resolveCurrentUserId: async () => "user-123",
      getSupabaseClient: () => supabaseCompleted.client,
      now: () => new Date("2026-06-18T12:00:00.000Z"), // before weekEnd
    });
    const res3 = await handlersCompleted.GET(getRequest());
    const json3 = await res3.json();
    expect(json3.review.missions[0].status).toBe("completed");

    // 4. Expired (now > weekEnd and currentValue < targetValue)
    const supabaseExpired = createMockSupabase({
      cachedReview: weeklyRow(),
      sourceRows: {
        podchat_sessions: [
          { id: "pod-1", created_at: "2026-06-18T10:00:00.000Z", duration_seconds: 300, elapsed_seconds: null },
        ],
      },
    });
    const handlersExpired = createWeeklyMissionRouteHandlers({
      resolveCurrentUserId: async () => "user-123",
      getSupabaseClient: () => supabaseExpired.client,
      now: () => new Date("2026-06-25T12:00:00.000Z"), // after weekEnd (2026-06-21)
    });
    const res4 = await handlersExpired.GET(getRequest());
    const json4 = await res4.json();
    expect(json4.review.missions[0].status).toBe("expired");
  });
});
