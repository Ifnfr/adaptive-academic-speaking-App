import { expect, test } from "@playwright/test";
import { POST } from "../src/app/api/article-practice/route";
import { getArticlePracticeCacheKey } from "../src/app/lib/cache/ai-cache";
import { getArticlePracticeRequestHash } from "../src/app/lib/cache/ai-idempotency";

const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;
const originalFetch = globalThis.fetch;

function buildRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/article-practice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "DeepSeek",
      url: "https://example.com/test-article",
      level: "Intermediate",
      mode: "Speaking",
      focus: "Coherence",
      ...body,
    }),
  });
}

function mockFetchForArticlePractice(capture: { systemPrompt?: string }) {
  process.env.DEEPSEEK_API_KEY = "test-key";
  globalThis.fetch = (async (url, init) => {
    const urlStr = typeof url === "string" ? url : (url as URL).toString();

    if (urlStr.includes("example.com/test-article")) {
      return new Response(
        `<html>
          <head><title>Test Article Title</title></head>
          <body>
            <article>
              This is the full text sample of the article. It has enough characters to pass the minimum requirement.
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
              Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
              Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
            </article>
          </body>
        </html>`,
        {
          status: 200,
          headers: { "content-type": "text/html" },
        }
      );
    }

    if (urlStr.includes("api.deepseek.com")) {
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
                  sourceTitle: "Test Article Title",
                  sourceUrl: "https://example.com/test-article",
                  sourceDomain: "example.com",
                  articleBrief: "Brief summary.",
                  mainIdea: "Main idea.",
                  keyPoints: ["Point 1", "Point 2", "Point 3"],
                  usefulVocabulary: [
                    { word: "synthesize", meaning: "combine", whyUseful: "academic" },
                    { word: "evaluate", meaning: "assess", whyUseful: "analysis" },
                    { word: "critique", meaning: "review", whyUseful: "discussion" }
                  ],
                  comprehensionChecks: ["Check 1", "Check 2", "Check 3"],
                  speakingTask: {
                    title: "Speaking title",
                    instruction: "Speaking instruction",
                    timeLimitSeconds: 120,
                    targetStructure: ["Structure 1", "Structure 2"],
                  },
                  followUpQuestions: ["Follow up 1", "Follow up 2"],
                  warnings: [],
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    }

    return new Response("Not found", { status: 404 });
  }) as typeof fetch;
}

test.describe("Article Practice Feedback Language and Cache/Idempotency", () => {
  test.afterEach(() => {
    process.env.DEEPSEEK_API_KEY = originalDeepSeekKey;
    globalThis.fetch = originalFetch;
  });

  test("old requests without language fields still work & default to English", async () => {
    const capture: { systemPrompt?: string } = {};
    mockFetchForArticlePractice(capture);

    const response = await POST(buildRequest({}));
    const data = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(data.sourceTitle).toBe("Test Article Title");
    expect(data.articleBrief).toBe("Brief summary.");

    // Check prompt policy was injected with English
    expect(capture.systemPrompt).toContain(
      "Write articleBrief, mainIdea, keyPoints, usefulVocabulary.meaning, usefulVocabulary.whyUseful, comprehensionChecks, speakingTask.title, speakingTask.instruction, followUpQuestions, and warnings in English."
    );
    expect(capture.systemPrompt).toContain("usefulVocabulary.word MUST remain in English.");
    expect(capture.systemPrompt).toContain("speakingTask.targetStructure MUST remain in English.");
    expect(capture.systemPrompt).toContain("sourceTitle, sourceUrl, and sourceDomain are source-derived and MUST NOT be translated.");
  });

  test("invalid language fields normalize to English without 400", async () => {
    const capture: { systemPrompt?: string } = {};
    mockFetchForArticlePractice(capture);

    const response = await POST(buildRequest({
      feedbackLanguage: "fr",
      targetLanguage: "jp",
    }));

    expect(response.status).toBe(200);
    expect(capture.systemPrompt).toContain("in English");
    expect(capture.systemPrompt).not.toContain("concise, beginner-friendly Indonesian");
  });

  test("Indonesian prompt policy is included correctly", async () => {
    const capture: { systemPrompt?: string } = {};
    mockFetchForArticlePractice(capture);

    const response = await POST(buildRequest({
      feedbackLanguage: "id",
      targetLanguage: "en",
    }));

    expect(response.status).toBe(200);
    expect(capture.systemPrompt).toContain("in Indonesian");
    expect(capture.systemPrompt).toContain("Use concise, beginner-friendly Indonesian for all Indonesian text.");
    expect(capture.systemPrompt).toContain("usefulVocabulary.word MUST remain in English.");
    expect(capture.systemPrompt).toContain("speakingTask.targetStructure MUST remain in English.");
    expect(capture.systemPrompt).toContain("sourceTitle, sourceUrl, and sourceDomain are source-derived and MUST NOT be translated.");
  });

  test("cache key differs for feedbackLanguage en vs id", () => {
    const keyEn = getArticlePracticeCacheKey(
      "https://example.com/test",
      "Beginner",
      "Gemini",
      "mode",
      "focus",
      "en",
      "en"
    );
    const keyId = getArticlePracticeCacheKey(
      "https://example.com/test",
      "Beginner",
      "Gemini",
      "mode",
      "focus",
      "id",
      "en"
    );
    expect(keyEn).not.toBe(keyId);
  });

  test("idempotency request_hash differs for feedbackLanguage en vs id", () => {
    const hashEn = getArticlePracticeRequestHash({
      url: "https://example.com/test",
      level: "Beginner",
      provider: "Gemini",
      model: "gemini-2.0-flash",
      mode: "mode",
      focus: "focus",
      promptVersion: "v1.1",
      feedbackLanguage: "en",
      targetLanguage: "en",
    });
    const hashId = getArticlePracticeRequestHash({
      url: "https://example.com/test",
      level: "Beginner",
      provider: "Gemini",
      model: "gemini-2.0-flash",
      mode: "mode",
      focus: "focus",
      promptVersion: "v1.1",
      feedbackLanguage: "id",
      targetLanguage: "en",
    });
    expect(hashEn).not.toBe(hashId);
  });

  test("response JSON keys remain unchanged", async () => {
    const capture: { systemPrompt?: string } = {};
    mockFetchForArticlePractice(capture);

    const response = await POST(buildRequest({
      feedbackLanguage: "id",
    }));
    const data = (await response.json()) as Record<string, unknown>;

    const expectedKeys = [
      "sourceTitle",
      "sourceUrl",
      "sourceDomain",
      "articleBrief",
      "mainIdea",
      "keyPoints",
      "usefulVocabulary",
      "comprehensionChecks",
      "speakingTask",
      "followUpQuestions",
      "warnings",
    ].sort();

    expect(Object.keys(data).sort()).toEqual(expectedKeys);
  });
});
