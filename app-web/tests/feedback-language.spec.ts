import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { POST } from "../src/app/api/feedback/route";

const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;
const originalFetch = globalThis.fetch;

function buildRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "DeepSeek",
      level: "Beginner",
      mode: "Fluency Sprint",
      feedbackType: "Quick Feedback",
      sessionType: "Timed",
      todayTarget: "Use a clearer topic sentence.",
      transcript:
        "I think online education is helpful because students can study anywhere.",
      durationSeconds: 45,
      ...body,
    }),
  });
}

function mockDeepSeekResponse(capture: { systemPrompt?: string }) {
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
        choices: [
          {
            message: {
              content: JSON.stringify({
                mainWeakness: "Your topic sentence needs clearer focus.",
                evidence:
                  "You said online education is helpful, but the main idea could be sharper.",
                betterPhrase:
                  "Online education is useful because it gives students flexible access to learning.",
                retryTask:
                  "Say one clear topic sentence, then give one because-reason.",
                scores: {
                  fluency: 4,
                  grammar: 3,
                  coherence: 3,
                },
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;
}

test.describe("active session feedback language policy", () => {
  test.afterEach(() => {
    process.env.DEEPSEEK_API_KEY = originalDeepSeekKey;
    globalThis.fetch = originalFetch;
  });

  test("missing language fields default to English and old request shape works", async () => {
    const capture: { systemPrompt?: string } = {};
    mockDeepSeekResponse(capture);

    const response = await POST(buildRequest({}));
    const data = (await response.json()) as { betterPhrase?: string };

    expect(response.status).toBe(200);
    expect(Object.keys(data).sort()).toEqual([
      "betterPhrase",
      "evidence",
      "mainWeakness",
      "providerUsed",
      "retryTask",
      "scores",
    ]);
    expect(data.betterPhrase).toBe(
      "Online education is useful because it gives students flexible access to learning.",
    );
    expect(capture.systemPrompt).toContain(
      "Write mainWeakness, evidence, retryTask, and feedback explanations in English.",
    );
    expect(capture.systemPrompt).toContain(
      "Keep betterPhrase and any corrected phrase examples in English.",
    );
    expect(capture.systemPrompt).toContain(
      "Do not translate the full learner transcript.",
    );
  });

  test("Indonesian feedback keeps betterPhrase in English", async () => {
    const capture: { systemPrompt?: string } = {};
    mockDeepSeekResponse(capture);

    const response = await POST(
      buildRequest({
        feedbackLanguage: "id",
        targetLanguage: "en",
      }),
    );
    const data = (await response.json()) as { betterPhrase?: string };

    expect(response.status).toBe(200);
    expect(data.betterPhrase).toBe(
      "Online education is useful because it gives students flexible access to learning.",
    );
    expect(capture.systemPrompt).toContain(
      "Write mainWeakness, evidence, retryTask, and feedback explanations in Indonesian.",
    );
    expect(capture.systemPrompt).toContain(
      "Keep betterPhrase and any corrected phrase examples in English.",
    );
    expect(capture.systemPrompt).toContain(
      "Use concise, beginner-friendly Indonesian.",
    );
  });

  test("invalid language fields normalize to English without a 400", async () => {
    const capture: { systemPrompt?: string } = {};
    mockDeepSeekResponse(capture);

    const response = await POST(
      buildRequest({
        feedbackLanguage: "ja",
        targetLanguage: "id",
      }),
    );

    expect(response.status).toBe(200);
    expect(capture.systemPrompt).toContain(
      "Write mainWeakness, evidence, retryTask, and feedback explanations in English.",
    );
    expect(capture.systemPrompt).toContain(
      "Keep betterPhrase and any corrected phrase examples in English.",
    );
    expect(capture.systemPrompt).not.toContain(
      "Use concise, beginner-friendly Indonesian.",
    );
  });

  test("feedback route does not use global cache helpers", () => {
    const routeSource = readFileSync("src/app/api/feedback/route.ts", "utf8");

    expect(routeSource).not.toContain("../../lib/cache/ai-cache");
    expect(routeSource).not.toContain("getGlobalCachedResponse");
    expect(routeSource).not.toContain("saveGlobalCachedResponse");
  });
});
