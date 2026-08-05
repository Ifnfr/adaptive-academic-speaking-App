import { expect, test } from "@playwright/test";
import { POST } from "../src/app/api/podchat/evaluate-bubbles/route";
import type { PodchatBubbleEvaluation } from "../src/app/api/podchat/evaluate-bubbles/route";

const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;
const originalProvider = process.env.PODCHAT_AI_PROVIDER;
const originalFetch = globalThis.fetch;

function validBubbleEvaluation(): PodchatBubbleEvaluation {
  return {
    status: "good",
    score: 72,
    message: "You made a clear point about AI in education.",
    strengths: ["Stays on the topic.", "Uses a complete sentence."],
    improvements: ["Add one specific example to support your point."],
    suggestion: "Next time give a concrete example from your own experience.",
  };
}

function buildRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/podchat/evaluate-bubbles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      topic: "Technology",
      difficulty: "Intermediate",
      sessionMode: "normal_timed",
      bubble: {
        speaker: "learner",
        text: "I think AI tools help me study because I can practise speaking more often.",
      },
      turns: [
        {
          speaker: "host",
          text: "Welcome to Podchat. Which technology trend matters most to you?",
        },
        {
          speaker: "learner",
          text: "I think AI tools help me practise speaking more often.",
        },
      ],
      ...body,
    }),
  });
}

function mockDeepSeekResponse(
  status: number,
  responseText: string,
  capture: { body?: Record<string, unknown> } = {},
) {
  process.env.PODCHAT_AI_PROVIDER = "deepseek";
  process.env.DEEPSEEK_API_KEY = "test-deepseek-key";
  globalThis.fetch = (async (_url, init) => {
    if (init && typeof init.body === "string") {
      capture.body = JSON.parse(init.body) as Record<string, unknown>;
    }
    if (status === 200) {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: responseText } }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }
    return new Response(responseText, {
      status,
      headers: { "content-type": "text/plain" },
    });
  }) as typeof fetch;
}

test.describe("Podchat Evaluate Bubbles Route", () => {
  test.afterEach(() => {
    if (originalDeepSeekKey === undefined) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = originalDeepSeekKey;
    }
    if (originalProvider === undefined) {
      delete process.env.PODCHAT_AI_PROVIDER;
    } else {
      process.env.PODCHAT_AI_PROVIDER = originalProvider;
    }
    globalThis.fetch = originalFetch;
  });

  test("valid request returns structured bubble evaluation via deepseek", async () => {
    const capture: { body?: Record<string, unknown> } = {};
    mockDeepSeekResponse(200, JSON.stringify(validBubbleEvaluation()), capture);

    const response = await POST(buildRequest({}));
    const data = (await response.json()) as PodchatBubbleEvaluation;

    expect(response.status).toBe(200);
    expect(data.status).toBe("good");
    expect(data.score).toBe(72);
    expect(data.message).toContain("clear point");
    expect(data.strengths).toContain("Stays on the topic.");
    expect(data.improvements).toHaveLength(1);
    expect(data.suggestion).toContain("example");

    const providerBody = JSON.stringify(capture.body);
    expect(providerBody).not.toMatch(
      /audio|blob|recordingUrl|email|userId|owner_id|auth|device/i,
    );
    expect(providerBody).toContain("BUBBLE TO EVALUATE");
  });

  test("mock provider returns deterministic evaluation without key or fetch", async () => {
    process.env.PODCHAT_AI_PROVIDER = "mock";
    process.env.DEEPSEEK_API_KEY = "";
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response("should not be called", { status: 500 });
    }) as typeof fetch;

    const response = await POST(buildRequest({}));
    const data = (await response.json()) as PodchatBubbleEvaluation;

    expect(response.status).toBe(200);
    expect(fetchCalled).toBe(false);
    expect(["excellent", "good", "needs_improvement"]).toContain(data.status);
    expect(typeof data.score).toBe("number");
    expect(data.score).toBeGreaterThanOrEqual(0);
    expect(data.score).toBeLessThanOrEqual(100);
    expect(data.strengths.length).toBeGreaterThan(0);
  });

  test("mock provider still rejects malformed request before response", async () => {
    process.env.PODCHAT_AI_PROVIDER = "mock";
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response("should not be called", { status: 500 });
    }) as typeof fetch;

    const response = await POST(buildRequest({ turns: [] }));
    expect(response.status).toBe(400);
    expect(fetchCalled).toBe(false);
  });

  test("bubble must be a learner turn", async () => {
    const response = await POST(
      buildRequest({ bubble: { speaker: "host", text: "Hello there." } }),
    );
    expect(response.status).toBe(400);
  });

  test("missing bubble rejects with 400", async () => {
    const req = new Request("http://localhost/api/podchat/evaluate-bubbles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic: "Technology",
        difficulty: "Intermediate",
        turns: [
          { speaker: "host", text: "Hello?" },
          { speaker: "learner", text: "Hi." },
        ],
      }),
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  test("invalid topic rejects with 400", async () => {
    const response = await POST(buildRequest({ topic: "Culture" }));
    expect(response.status).toBe(400);
  });

  test("invalid difficulty rejects with 400", async () => {
    const response = await POST(buildRequest({ difficulty: "invalid" }));
    expect(response.status).toBe(400);
  });

  test("bubble text too long rejects with 400", async () => {
    const response = await POST(
      buildRequest({
        bubble: { speaker: "learner", text: "a".repeat(1201) },
      }),
    );
    expect(response.status).toBe(400);
  });

  test("missing host turn rejects with 400", async () => {
    const response = await POST(
      buildRequest({ turns: [{ speaker: "learner", text: "I like AI." }] }),
    );
    expect(response.status).toBe(400);
  });

  test("missing learner turn rejects with 400", async () => {
    const response = await POST(
      buildRequest({ turns: [{ speaker: "host", text: "Welcome." }] }),
    );
    expect(response.status).toBe(400);
  });

  test("deepseek non-OK response returns sanitized 502", async () => {
    mockDeepSeekResponse(500, "raw provider failure with internal detail");
    const response = await POST(buildRequest({}));
    const data = (await response.json()) as { error: string };
    expect(response.status).toBe(502);
    expect(data.error).toBe("Provider request failed. Please try again later.");
    expect(data.error).not.toContain("internal detail");
  });

  test("malformed deepseek JSON returns safe 502", async () => {
    mockDeepSeekResponse(200, "not-json");
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("Invalid provider response format");
  });

  test("deepseek response with invalid status returns safe 502", async () => {
    mockDeepSeekResponse(
      200,
      JSON.stringify({ ...validBubbleEvaluation(), status: "amazing" }),
    );
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
  });

  test("deepseek response with out-of-range score returns safe 502", async () => {
    mockDeepSeekResponse(
      200,
      JSON.stringify({ ...validBubbleEvaluation(), score: 150 }),
    );
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
  });

  test("missing API key returns 503", async () => {
    process.env.PODCHAT_AI_PROVIDER = "deepseek";
    process.env.DEEPSEEK_API_KEY = "";
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(503);
  });
});