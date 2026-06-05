import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import { POST as diagnosticPost } from "../src/app/api/diagnostic/route";
import { POST as mentalModelPost } from "../src/app/api/mental-model/route";
import { createWeeklyReviewPostHandler } from "../src/app/api/weekly-review/route";
import type { FonetikSupabaseClient } from "../src/app/lib/supabase";

const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;
const originalFetch = globalThis.fetch;

type Capture = { systemPrompt?: string };

function buildRequest(url: string, body: Record<string, unknown>): Request {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "DeepSeek",
      ...body,
    }),
  });
}

function mockDeepSeekResponse(capture: Capture, content: Record<string, unknown>) {
  process.env.DEEPSEEK_API_KEY = "test-key";
  globalThis.fetch = (async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      messages?: Array<{ role: string; content: string }>;
    };
    capture.systemPrompt = body.messages?.find(
      (message) => message.role === "system",
    )?.content;

    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(content) } }],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;
}

function diagnosticBody(extra: Record<string, unknown> = {}) {
  return {
    transcript:
      "I want to improve academic speaking because clear arguments help students explain research.",
    durationSeconds: 120,
    currentLevel: "Beginner",
    todayTarget: "Clearer structure",
    ...extra,
  };
}

function diagnosticResponse() {
  return {
    recommendedLevel: "Beginner",
    mainBottleneck: "You need clearer organization.",
    summary: "Your ideas are understandable, but the structure needs focus.",
    scores: {
      fluency: 3,
      grammar: 3,
      vocabulary: 3,
      coherence: 3,
      argument: 2,
      academicTone: 3,
    },
    sevenDayFocusPlan: [
      "Day 1: Say one clear topic sentence.",
      "Day 2: Speak for 45 seconds with one because-reason.",
      "Day 3: Record a short answer with one example.",
      "Day 4: Repeat a simple academic template aloud.",
      "Day 5: Explain one idea with a clear ending.",
      "Day 6: Practice saying a position and reason.",
      "Day 7: Present a short answer with structure.",
    ],
  };
}

function weeklySessions() {
  return Array.from({ length: 4 }, (_, index) => ({
    date: `2026-05-2${index}`,
    level: "Beginner",
    mode: "Fluency Sprint",
    durationSeconds: 60,
    mainWeakness: "Needs clearer structure.",
    evidence: "The answer had ideas but no clear order.",
    retryTask: "Say one topic sentence and one because-reason.",
    csv: "Date,Level,Mode,Fluency\n2026-05-20,Beginner,Fluency Sprint,3",
  }));
}

function weeklyResponse() {
  return {
    summary: "This week shows steady practice with recurring structure issues.",
    recurringWeakness: "Your answers need clearer order.",
    bestImprovement: "You gave more complete reasons.",
    scoreTrend: "Scores stayed mostly stable.",
    nextWeekFocus: "Use one simple structure every session.",
    recommendedPlan: [
      "Day 1: Say one topic sentence.",
      "Day 2: Record one answer with because.",
      "Day 3: Explain one idea with an example.",
      "Day 4: Practice a simple opening sentence.",
      "Day 5: Speak for 60 seconds with clear order.",
      "Day 6: Repeat a short academic template.",
      "Day 7: Present a structured summary aloud.",
    ],
    warnings: [] as string[],
  };
}

type WeeklyReviewRouteDeps = Parameters<typeof createWeeklyReviewPostHandler>[0];

function weeklyMemory(overrides: Record<string, unknown> = {}) {
  return {
    periodStart: "2026-05-29",
    periodEnd: "2026-06-04",
    podchatSessionCount: 2,
    articleWritingSessionCount: 2,
    totalSessionCount: 4,
    topErrorPatterns: [
      {
        category: "grammar",
        label: "Verb agreement",
        count: 2,
        evidence: "Technology help students.",
        correction: "Technology helps students.",
        practiceFocus: "Use subject-verb agreement in short answers.",
      },
    ],
    podchatSummaries: ["You discussed technology clearly."],
    articleWritingSummaries: ["Your writing shows article comprehension."],
    nextPracticeFocuses: ["Use one simple structure every session."],
    sourceSessionIds: ["podchat-1", "podchat-2", "article-1", "article-2"],
    ...overrides,
  };
}

function buildWeeklyRoute(options: {
  ownerId?: string | null;
  cachedReview?: ReturnType<typeof weeklyResponse> | null;
  memoryData?: ReturnType<typeof weeklyMemory>;
  memoryError?: boolean;
  buildResult?: ReturnType<typeof weeklyResponse>;
  saveThrows?: boolean;
  supabaseClient?: FonetikSupabaseClient | null;
} = {}) {
  const fakeSupabase =
    options.supabaseClient === undefined
      ? ({} as FonetikSupabaseClient)
      : options.supabaseClient;
  const calls: {
    cache: Array<{ ownerId: string; periodStart: string; periodEnd: string }>;
    memory: Array<{ ownerId: string; periodStart: string; periodEnd: string }>;
    build: unknown[];
    save: Array<{
      ownerId: string;
      periodStart: string;
      periodEnd: string;
      review: unknown;
      sourceSessionIds: string[];
    }>;
  } = {
    cache: [],
    memory: [],
    build: [],
    save: [],
  };

  const deps: WeeklyReviewRouteDeps = {
    resolveCurrentUserId: async () =>
      options.ownerId === undefined ? "user_real" : options.ownerId,
    getSupabaseClient: async () => fakeSupabase,
    getCachedReview: async (ownerId, periodStart, periodEnd) => {
      calls.cache.push({ ownerId, periodStart, periodEnd });
      return options.cachedReview
        ? { summary: options.cachedReview, source_session_ids: ["cached-1"] }
        : null;
    },
    getMemory: async (input) => {
      calls.memory.push(input);
      if (options.memoryError) {
        return { ok: false, error: "weekly_review_memory_failed" };
      }
      return { ok: true, data: options.memoryData ?? weeklyMemory() };
    },
    buildReview: (memory) => {
      calls.build.push(memory);
      return options.buildResult ?? weeklyResponse();
    },
    saveReview: async (
      ownerId,
      periodStart,
      periodEnd,
      review,
      sourceSessionIds,
    ) => {
      calls.save.push({
        ownerId,
        periodStart,
        periodEnd,
        review,
        sourceSessionIds,
      });
      if (options.saveThrows) {
        throw new Error("cache write failed");
      }
      return { ok: true, id: "weekly-review-1" };
    },
    now: () => new Date("2026-06-04T12:00:00.000Z"),
  };

  return {
    post: createWeeklyReviewPostHandler(deps),
    calls,
  };
}

function mentalBody(extra: Record<string, unknown> = {}) {
  return {
    level: "Beginner",
    mode: "Argument Drill",
    focus: "Clear structure",
    latestWeakness: "Needs clearer topic sentence.",
    latestRetryTask: "Say one position and one reason.",
    ...extra,
  };
}

function mentalResponse() {
  return {
    coreStandard: "A strong answer has one clear position and one clear reason.",
    qualityCriteria: ["Clear position", "Simple reason", "Short example"],
    weakPattern: "The speaker gives ideas without order.",
    strongPattern: "The speaker says a position, reason, and example.",
    selfCheckQuestions: [
      "Did I state my position?",
      "Did I give one reason?",
      "Did I end clearly?",
    ],
    microDrill: "Say one position and one because-reason.",
    referenceModel:
      "I think online learning is useful because it gives students flexible access to classes.",
  };
}

test.describe("AI review language policy routes", () => {
  test.afterEach(() => {
    process.env.DEEPSEEK_API_KEY = originalDeepSeekKey;
    globalThis.fetch = originalFetch;
  });

  test("diagnostic old requests default to English and keep response keys", async () => {
    const capture: Capture = {};
    mockDeepSeekResponse(capture, diagnosticResponse());

    const response = await diagnosticPost(
      buildRequest("/api/diagnostic", diagnosticBody()),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(data).sort()).toEqual([
      "mainBottleneck",
      "recommendedLevel",
      "scores",
      "sevenDayFocusPlan",
      "summary",
    ]);
    expect(capture.systemPrompt).toContain(
      "Write mainBottleneck, summary, sevenDayFocusPlan, explanations, and warnings in English.",
    );
    expect(capture.systemPrompt).toContain(
      "Keep reusable speaking phrases and templates in English.",
    );
  });

  test("diagnostic invalid languages normalize to English without a 400", async () => {
    const capture: Capture = {};
    mockDeepSeekResponse(capture, diagnosticResponse());

    const response = await diagnosticPost(
      buildRequest(
        "/api/diagnostic",
        diagnosticBody({ feedbackLanguage: "ja", targetLanguage: "id" }),
      ),
    );

    expect(response.status).toBe(200);
    expect(capture.systemPrompt).toContain(
      "Write mainBottleneck, summary, sevenDayFocusPlan, explanations, and warnings in English.",
    );
    expect(capture.systemPrompt).not.toContain(
      "Use concise, beginner-friendly Indonesian.",
    );
  });

  test("diagnostic Indonesian policy is included", async () => {
    const capture: Capture = {};
    mockDeepSeekResponse(capture, diagnosticResponse());

    const response = await diagnosticPost(
      buildRequest(
        "/api/diagnostic",
        diagnosticBody({ feedbackLanguage: "id", targetLanguage: "en" }),
      ),
    );

    expect(response.status).toBe(200);
    expect(capture.systemPrompt).toContain(
      "Write mainBottleneck, summary, sevenDayFocusPlan, explanations, and warnings in Indonesian.",
    );
    expect(capture.systemPrompt).toContain(
      "Use concise, beginner-friendly Indonesian.",
    );
  });

  test("weekly review unauthenticated requests fail safely", async () => {
    const { post, calls } = buildWeeklyRoute({ ownerId: null });

    const response = await post(buildRequest("/api/weekly-review", {}));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Sign in to generate a weekly review.");
    expect(calls.cache).toHaveLength(0);
    expect(calls.memory).toHaveLength(0);
    expect(calls.save).toHaveLength(0);
  });

  test("weekly review returns cached Supabase memory review without regenerating", async () => {
    globalThis.fetch = (async () => {
      throw new Error("AI provider should not be called");
    }) as typeof fetch;
    delete process.env.CLAUDE_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const cachedReview = weeklyResponse();
    const { post, calls } = buildWeeklyRoute({ cachedReview });

    const response = await post(
      buildRequest("/api/weekly-review", {
        ownerId: "attacker",
        sessions: weeklySessions(),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(cachedReview);
    expect(data.recommendedPlan).toHaveLength(7);
    expect(calls.cache).toEqual([
      {
        ownerId: "user_real",
        periodStart: "2026-05-29",
        periodEnd: "2026-06-04",
      },
    ]);
    expect(calls.memory).toHaveLength(0);
    expect(calls.build).toHaveLength(0);
    expect(calls.save).toHaveLength(0);
  });

  test("weekly review builds deterministic review from Supabase memory and saves cache", async () => {
    globalThis.fetch = (async () => {
      throw new Error("AI provider should not be called");
    }) as typeof fetch;

    const { post, calls } = buildWeeklyRoute();

    const response = await post(
      buildRequest("/api/weekly-review", {
        ownerId: "attacker",
        fullArticleText: "must be ignored",
        audioBlob: "must be ignored",
        sourceUrl: "https://example.com/private",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-04",
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(data).sort()).toEqual([
      "bestImprovement",
      "nextWeekFocus",
      "recommendedPlan",
      "recurringWeakness",
      "scoreTrend",
      "summary",
      "warnings",
    ]);
    expect(data.recommendedPlan).toHaveLength(7);
    expect(calls.memory).toEqual([
      {
        ownerId: "user_real",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-04",
      },
    ]);
    expect(calls.save).toEqual([
      {
        ownerId: "user_real",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-04",
        review: weeklyResponse(),
        sourceSessionIds: ["podchat-1", "podchat-2", "article-1", "article-2"],
      },
    ]);

    const serialized = JSON.stringify(data).toLowerCase();
    for (const forbidden of [
      "fullarticletext",
      "sourceurl",
      "audioblob",
      "recordingurl",
      "rawprovider",
      "phoneme",
      "pronunciation",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  test("weekly review cache save failure still returns deterministic review", async () => {
    const { post, calls } = buildWeeklyRoute({ saveThrows: true });

    const response = await post(buildRequest("/api/weekly-review", {}));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(weeklyResponse());
    expect(calls.save).toHaveLength(1);
  });

  test("weekly review returns valid warning response when memory has too little data", async () => {
    const lowData = weeklyMemory({
      podchatSessionCount: 1,
      articleWritingSessionCount: 1,
      totalSessionCount: 2,
      topErrorPatterns: [],
      sourceSessionIds: ["podchat-1", "article-1"],
    });
    const { post } = buildWeeklyRoute({
      memoryData: lowData,
      buildResult: {
        summary:
          "You completed 2 practice session(s) this week. Keep practicing to unlock complete review insights.",
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
          "Weekly Review requires at least 4 completed practice sessions. You have completed only 2.",
        ],
      },
    });

    const response = await post(buildRequest("/api/weekly-review", {}));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.recommendedPlan).toHaveLength(7);
    expect(data.warnings[0]).toContain("requires at least 4 completed practice sessions");
  });

  test("weekly review rejects invalid date periods safely", async () => {
    const { post, calls } = buildWeeklyRoute();

    const invalidDateResponse = await post(
      buildRequest("/api/weekly-review", {
        periodStart: "2026-02-31",
        periodEnd: "2026-06-04",
      }),
    );
    const invalidDateData = await invalidDateResponse.json();

    expect(invalidDateResponse.status).toBe(400);
    expect(invalidDateData.error).toBe(
      "periodStart and periodEnd must be valid YYYY-MM-DD dates.",
    );

    const reversedResponse = await post(
      buildRequest("/api/weekly-review", {
        periodStart: "2026-06-05",
        periodEnd: "2026-06-04",
      }),
    );
    const reversedData = await reversedResponse.json();

    expect(reversedResponse.status).toBe(400);
    expect(reversedData.error).toBe(
      "periodEnd must be greater than or equal to periodStart.",
    );
    expect(calls.memory).toHaveLength(0);
  });

  test("mental model old requests default to English and keep response keys", async () => {
    const capture: Capture = {};
    mockDeepSeekResponse(capture, mentalResponse());

    const response = await mentalModelPost(
      buildRequest("/api/mental-model", mentalBody()),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(data).sort()).toEqual([
      "coreStandard",
      "microDrill",
      "qualityCriteria",
      "referenceModel",
      "selfCheckQuestions",
      "strongPattern",
      "weakPattern",
    ]);
    expect(capture.systemPrompt).toContain(
      "Write coreStandard, qualityCriteria, weakPattern, strongPattern, selfCheckQuestions, and microDrill in English.",
    );
    expect(capture.systemPrompt).toContain(
      "Keep referenceModel in English because it is a target-language speech pattern sample.",
    );
  });

  test("mental model invalid languages normalize to English without a 400", async () => {
    const capture: Capture = {};
    mockDeepSeekResponse(capture, mentalResponse());

    const response = await mentalModelPost(
      buildRequest(
        "/api/mental-model",
        mentalBody({ feedbackLanguage: "ja", targetLanguage: "id" }),
      ),
    );

    expect(response.status).toBe(200);
    expect(capture.systemPrompt).toContain(
      "Write coreStandard, qualityCriteria, weakPattern, strongPattern, selfCheckQuestions, and microDrill in English.",
    );
    expect(capture.systemPrompt).not.toContain(
      "Use concise, beginner-friendly Indonesian.",
    );
  });

  test("mental model Indonesian policy keeps referenceModel English", async () => {
    const capture: Capture = {};
    mockDeepSeekResponse(capture, mentalResponse());

    const response = await mentalModelPost(
      buildRequest(
        "/api/mental-model",
        mentalBody({ feedbackLanguage: "id", targetLanguage: "en" }),
      ),
    );
    const data = (await response.json()) as { referenceModel?: string };

    expect(response.status).toBe(200);
    expect(data.referenceModel).toBe(
      "I think online learning is useful because it gives students flexible access to classes.",
    );
    expect(capture.systemPrompt).toContain(
      "Write coreStandard, qualityCriteria, weakPattern, strongPattern, selfCheckQuestions, and microDrill in Indonesian.",
    );
    expect(capture.systemPrompt).toContain(
      "Keep referenceModel in English because it is a target-language speech pattern sample.",
    );
    expect(capture.systemPrompt).toContain(
      "Use concise, beginner-friendly Indonesian.",
    );
  });

  test("AI review routes do not use global cache helpers", () => {
    for (const routePath of [
      "src/app/api/diagnostic/route.ts",
      "src/app/api/weekly-review/route.ts",
      "src/app/api/mental-model/route.ts",
    ]) {
      const routeSource = readFileSync(routePath, "utf8");
      expect(routeSource).not.toContain("../../lib/cache/ai-cache");
      expect(routeSource).not.toContain("getGlobalCachedResponse");
      expect(routeSource).not.toContain("saveGlobalCachedResponse");
    }
  });

  test("Clerk proxy config enables auth context for API routes", () => {
    expect(existsSync("src/proxy.ts")).toBe(true);
    const proxySource = readFileSync("src/proxy.ts", "utf8");

    expect(proxySource).toContain("clerkMiddleware");
    expect(proxySource).toContain("export default clerkMiddleware()");
    expect(proxySource).toContain("\"/(api|trpc)(.*)\"");
    expect(proxySource).not.toContain("CLERK_SECRET_KEY");
    expect(proxySource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
