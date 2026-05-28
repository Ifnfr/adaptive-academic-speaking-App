import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { POST as diagnosticPost } from "../src/app/api/diagnostic/route";
import { POST as mentalModelPost } from "../src/app/api/mental-model/route";
import { POST as weeklyReviewPost } from "../src/app/api/weekly-review/route";

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
    warnings: [],
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

  test("weekly review old requests default to English and keep response keys", async () => {
    const capture: Capture = {};
    mockDeepSeekResponse(capture, weeklyResponse());

    const response = await weeklyReviewPost(
      buildRequest("/api/weekly-review", { sessions: weeklySessions() }),
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
    expect(capture.systemPrompt).toContain(
      "Write summary, recurringWeakness, bestImprovement, scoreTrend, nextWeekFocus, recommendedPlan, and warnings in English.",
    );
    expect(capture.systemPrompt).toContain(
      "Keep sentence frames and reusable speaking templates in English.",
    );
  });

  test("weekly review invalid languages normalize to English without a 400", async () => {
    const capture: Capture = {};
    mockDeepSeekResponse(capture, weeklyResponse());

    const response = await weeklyReviewPost(
      buildRequest("/api/weekly-review", {
        sessions: weeklySessions(),
        feedbackLanguage: "ja",
        targetLanguage: "id",
      }),
    );

    expect(response.status).toBe(200);
    expect(capture.systemPrompt).toContain(
      "Write summary, recurringWeakness, bestImprovement, scoreTrend, nextWeekFocus, recommendedPlan, and warnings in English.",
    );
    expect(capture.systemPrompt).not.toContain(
      "Use concise, beginner-friendly Indonesian.",
    );
  });

  test("weekly review Indonesian policy is included", async () => {
    const capture: Capture = {};
    mockDeepSeekResponse(capture, weeklyResponse());

    const response = await weeklyReviewPost(
      buildRequest("/api/weekly-review", {
        sessions: weeklySessions(),
        feedbackLanguage: "id",
        targetLanguage: "en",
      }),
    );

    expect(response.status).toBe(200);
    expect(capture.systemPrompt).toContain(
      "Write summary, recurringWeakness, bestImprovement, scoreTrend, nextWeekFocus, recommendedPlan, and warnings in Indonesian.",
    );
    expect(capture.systemPrompt).toContain(
      "Use concise, beginner-friendly Indonesian.",
    );
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
});
