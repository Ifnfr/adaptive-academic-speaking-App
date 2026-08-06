import { expect, test } from "@playwright/test";
import { POST } from "../src/app/api/podchat/evaluate-bubbles/route";
import type {
  PodchatBubbleEvaluation,
  PodchatBubbleSummary,
} from "../src/app/api/podchat/evaluate-bubbles/route";

const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;
const originalProvider = process.env.PODCHAT_AI_PROVIDER;
const originalFetch = globalThis.fetch;

function validEvaluation(bubbleId: string): PodchatBubbleEvaluation {
  return {
    bubbleId,
    status: "developing",
    strengths: ["Uses a complete sentence.", "Stays on the topic."],
    issues: [
      {
        type: "grammar",
        problem: "we solve to end the conversations here",
        correction: "we work through the conversations to reach a conclusion",
        explanation:
          "This follows Indonesian word order with a missing auxiliary; in English, say what you mean directly.",
      },
    ],
    strongerVersion:
      "It is like we work through the conversations until we reach a conclusion.",
    microDrill: {
      focus: "Add a subject and an auxiliary verb",
      instruction:
        "Say the sentence again with 'we work through' instead of 'we solve to end'.",
      example: "We work through each conversation until we reach a conclusion.",
    },
  };
}

function validSummary(): PodchatBubbleSummary {
  return {
    overallStatus: "developing",
    topWeaknesses: [
      {
        label: "Incomplete sentence structure",
        evidence: "we solve to end the conversations here",
        practiceFocus: "Practise subject + verb + object sentences.",
        count: 1,
      },
    ],
    nextPracticeFocus:
      "In your next Podchat, add a clear subject and auxiliary in every answer.",
  };
}

function validEvaluationsJson(bubbleIds: string[]): string {
  return JSON.stringify({
    evaluations: bubbleIds.map((id) => validEvaluation(id)),
  });
}

function buildRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/podchat/evaluate-bubbles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      topic: "Technology",
      difficulty: "Intermediate",
      sessionMode: "normal_timed",
      learnerBubbles: [
        {
          id: "podchat-turn-3",
          text: "I think AI tools help me study because I can practise speaking more often.",
          aiContext: "Which technology trend matters most to you?",
        },
      ],
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

function mockProviderFetch(
  responses: Array<{ status: number; text: string }>,
  capture: { bodies?: Array<Record<string, unknown>> } = {},
) {
  process.env.PODCHAT_AI_PROVIDER = "deepseek";
  process.env.DEEPSEEK_API_KEY = "test-deepseek-key";
  let callIndex = 0;
  globalThis.fetch = (async (_url, init) => {
    if (init && typeof init.body === "string") {
      if (!capture.bodies) capture.bodies = [];
      capture.bodies.push(JSON.parse(init.body) as Record<string, unknown>);
    }
    const response = responses[Math.min(callIndex, responses.length - 1)];
    callIndex += 1;
    if (response.status === 200) {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: response.text } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(response.text, {
      status: response.status,
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

  test("valid batch request returns structured evaluations plus summary", async () => {
    const capture: { bodies?: Array<Record<string, unknown>> } = {};
    mockProviderFetch(
      [
        { status: 200, text: validEvaluationsJson(["podchat-turn-3"]) },
        { status: 200, text: JSON.stringify(validSummary()) },
      ],
      capture,
    );

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      evaluations: PodchatBubbleEvaluation[];
      summary: PodchatBubbleSummary;
    };

    expect(data.evaluations).toHaveLength(1);
    expect(data.evaluations[0].bubbleId).toBe("podchat-turn-3");
    expect(data.evaluations[0].status).toBe("developing");
    expect(data.evaluations[0].issues[0].type).toBe("grammar");
    expect(data.evaluations[0].issues[0].correction).toContain("work through");
    expect(data.evaluations[0].strongerVersion.length).toBeGreaterThan(10);
    expect(data.evaluations[0].microDrill.focus.length).toBeGreaterThan(5);
    expect(data.summary.overallStatus).toBe("developing");
    expect(data.summary.topWeaknesses[0].count).toBe(1);
    expect(data.summary.nextPracticeFocus.length).toBeGreaterThan(10);
  });

  test("provider payload carries bubble ids and never leaks PII or audio data", async () => {
    const capture: { bodies?: Array<Record<string, unknown>> } = {};
    mockProviderFetch(
      [
        { status: 200, text: validEvaluationsJson(["podchat-turn-3"]) },
        { status: 200, text: JSON.stringify(validSummary()) },
      ],
      capture,
    );

    const response = await POST(
      buildRequest({
        learnerBubbles: [
          {
            id: "podchat-turn-3",
            text: "I think AI tools help me study.",
            aiContext: "Which trend matters most?",
          },
        ],
      }),
    );
    expect(response.status).toBe(200);

    const providerBody = JSON.stringify(capture.bodies?.[0] ?? {});
    expect(providerBody).not.toMatch(
      /audio|blob|recordingUrl|email|userId|owner_id|auth|device/i,
    );
    expect(providerBody).toContain("BUBBLES TO EVALUATE");
    expect(providerBody).toContain("podchat-turn-3");
  });

  test("mock provider returns deterministic evaluations without key or fetch", async () => {
    process.env.PODCHAT_AI_PROVIDER = "mock";
    process.env.DEEPSEEK_API_KEY = "";
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response("should not be called", { status: 500 });
    }) as typeof fetch;

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      evaluations: PodchatBubbleEvaluation[];
      summary: PodchatBubbleSummary;
    };
    expect(data.evaluations).toHaveLength(1);
    expect(["strong", "developing", "needs_work"]).toContain(
      data.evaluations[0].status,
    );
    expect(data.evaluations[0].microDrill.focus.length).toBeGreaterThan(5);
    expect(data.summary).not.toBeNull();
    expect(fetchCalled).toBe(false);
  });

  test("rejects learnerBubbles with a numeric score (forbidden key)", async () => {
    mockProviderFetch([
      {
        status: 200,
        text: JSON.stringify({
          evaluations: [
            {
              ...validEvaluation("podchat-turn-3"),
              score: 72,
            },
          ],
        }),
      },
    ]);

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain("Invalid provider response format");
  });

  test("rejects invalid status values", async () => {
    mockProviderFetch([
      {
        status: 200,
        text: JSON.stringify({
          evaluations: [
            { ...validEvaluation("podchat-turn-3"), status: "excellent" },
          ],
        }),
      },
    ]);

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
  });

  test("rejects malformed issue schema", async () => {
    mockProviderFetch([
      {
        status: 200,
        text: JSON.stringify({
          evaluations: [
            {
              ...validEvaluation("podchat-turn-3"),
              issues: [{ type: "grammar", problem: "missing correction" }],
            },
          ],
        }),
      },
    ]);

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
  });

  test("chunks large batches into multiple provider calls and merges results", async () => {
    const bubbleIds = Array.from({ length: 25 }, (_, i) => `bubble-${i + 1}`);
    const capture: { bodies?: Array<Record<string, unknown>> } = {};
    mockProviderFetch(
      [
        { status: 200, text: validEvaluationsJson(bubbleIds.slice(0, 10)) },
        { status: 200, text: validEvaluationsJson(bubbleIds.slice(10, 20)) },
        { status: 200, text: validEvaluationsJson(bubbleIds.slice(20, 25)) },
        { status: 200, text: JSON.stringify(validSummary()) },
      ],
      capture,
    );

    const response = await POST(
      buildRequest({
        learnerBubbles: bubbleIds.map((id) => ({
          id,
          text: "I think AI tools help me study because I can practise more.",
        })),
      }),
    );
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      evaluations: PodchatBubbleEvaluation[];
    };
    expect(data.evaluations).toHaveLength(25);
    // 3 evaluation chunks + 1 summary call.
    expect(capture.bodies?.length ?? 0).toBe(4);
  });

  test("rejects more than 40 bubbles", async () => {
    const bubbleIds = Array.from({ length: 41 }, (_, i) => `bubble-${i}`);
    const response = await POST(
      buildRequest({
        learnerBubbles: bubbleIds.map((id) => ({
          id,
          text: "A short learner answer.",
        })),
      }),
    );
    expect(response.status).toBe(400);
  });

  test("rejects duplicate bubble ids", async () => {
    const response = await POST(
      buildRequest({
        learnerBubbles: [
          { id: "dup-1", text: "First answer." },
          { id: "dup-1", text: "Second answer." },
        ],
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain("duplicate id");
  });

  test("keeps evaluations when the summary call fails (graceful)", async () => {
    mockProviderFetch([
      { status: 200, text: validEvaluationsJson(["podchat-turn-3"]) },
      { status: 500, text: "summary provider exploded" },
    ]);

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      evaluations: PodchatBubbleEvaluation[];
      summary: PodchatBubbleSummary | null;
    };
    expect(data.evaluations).toHaveLength(1);
    expect(data.summary).toBeNull();
  });
});
