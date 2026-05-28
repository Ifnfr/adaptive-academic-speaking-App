import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { POST } from "../src/app/api/vocabulary-correction/route";

const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;
const originalFetch = globalThis.fetch;

function buildRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/vocabulary-correction", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "DeepSeek",
      level: "Beginner",
      targetVocabulary: "clarify",
      meaning: "make clear",
      partOfSpeech: "verb",
      userSentence: "I want to clarify the main point.",
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
                status: "natural",
                explanation: "Good use of the target word.",
                correctedSentence: "I want to clarify the main point.",
                collocationTip: "Use clarify with ideas, reasons, or details.",
                retryInstruction: "Try one new sentence with clarify.",
                targetUsageRole:
                  "Clarify functions as a verb in this sentence.",
                warnings: [],
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

test.describe("vocabulary correction language policy", () => {
  test.afterEach(() => {
    process.env.DEEPSEEK_API_KEY = originalDeepSeekKey;
    globalThis.fetch = originalFetch;
  });

  test("missing language fields default to English", async () => {
    const capture: { systemPrompt?: string } = {};
    mockDeepSeekResponse(capture);

    const response = await POST(buildRequest({}));
    const data = (await response.json()) as { correctedSentence?: string };

    expect(response.status).toBe(200);
    expect(Object.keys(data).sort()).toEqual([
      "collocationTip",
      "correctedSentence",
      "explanation",
      "retryInstruction",
      "status",
      "targetUsageRole",
      "warnings",
    ]);
    expect(data.correctedSentence).toBe("I want to clarify the main point.");
    expect(capture.systemPrompt).toContain(
      "Write explanation, collocationTip, retryInstruction, targetUsageRole, and warnings in English.",
    );
    expect(capture.systemPrompt).toContain("Keep correctedSentence in English.");
    expect(capture.systemPrompt).toContain(
      "Do not translate the full learner sentence.",
    );
  });

  test("Indonesian feedback keeps correctedSentence in English", async () => {
    const capture: { systemPrompt?: string } = {};
    mockDeepSeekResponse(capture);

    const response = await POST(
      buildRequest({
        feedbackLanguage: "id",
        targetLanguage: "id",
      }),
    );
    const data = (await response.json()) as { correctedSentence?: string };

    expect(response.status).toBe(200);
    expect(data.correctedSentence).toBe("I want to clarify the main point.");
    expect(capture.systemPrompt).toContain(
      "Write explanation, collocationTip, retryInstruction, targetUsageRole, and warnings in Indonesian.",
    );
    expect(capture.systemPrompt).toContain("Keep correctedSentence in English.");
    expect(capture.systemPrompt).toContain(
      "Use concise, beginner-friendly Indonesian.",
    );
    expect(capture.systemPrompt).toContain(
      "Avoid long grammar terminology unless necessary.",
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
      "Write explanation, collocationTip, retryInstruction, targetUsageRole, and warnings in English.",
    );
    expect(capture.systemPrompt).toContain("Keep correctedSentence in English.");
    expect(capture.systemPrompt).not.toContain(
      "Use concise, beginner-friendly Indonesian.",
    );
  });

  test("vocabulary correction route does not use global cache helpers", () => {
    const routeSource = readFileSync(
      "src/app/api/vocabulary-correction/route.ts",
      "utf8",
    );

    expect(routeSource).not.toContain("../../lib/cache/ai-cache");
    expect(routeSource).not.toContain("getGlobalCachedResponse");
    expect(routeSource).not.toContain("saveGlobalCachedResponse");
  });
});
