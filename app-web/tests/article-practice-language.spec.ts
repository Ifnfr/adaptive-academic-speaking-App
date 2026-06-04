import { expect, test } from "@playwright/test";
import { POST } from "../src/app/api/article-practice/route";
import { getArticlePracticeCacheKey } from "../src/app/lib/cache/ai-cache";
import { getArticlePracticeRequestHash } from "../src/app/lib/cache/ai-idempotency";

const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;
const originalFetch = globalThis.fetch;

function validEssayQuestions() {
  return [
    {
      id: "q1",
      question: "What is the main idea of the article?",
      expectedFocus: "Summarize the central argument using article evidence.",
      targetSkill: "main_idea",
      suggestedWordCount: { min: 50, max: 120 },
    },
    {
      id: "q2",
      question: "Which supporting detail best explains the article's argument?",
      expectedFocus: "Identify and explain one important supporting detail.",
      targetSkill: "supporting_detail",
      suggestedWordCount: { min: 50, max: 120 },
    },
    {
      id: "q3",
      question: "What can readers infer from the article's evidence?",
      expectedFocus: "Make a reasonable inference based on the article.",
      targetSkill: "inference",
      suggestedWordCount: { min: 50, max: 120 },
    },
    {
      id: "q4",
      question: "How is one key phrase used in the article's context?",
      expectedFocus: "Explain the meaning of a word or phrase in context.",
      targetSkill: "vocabulary_in_context",
      suggestedWordCount: { min: 50, max: 120 },
    },
    {
      id: "q5",
      question: "What implication or response follows from the article?",
      expectedFocus: "Give a critical response connected to the article.",
      targetSkill: "critical_response",
      suggestedWordCount: { min: 60, max: 140 },
    },
  ];
}

function validPreparedMarkdown(): string {
  return `# Article Context

## Title

Prepared AI Study Context

## Source

Class reading packet

## Short Summary

This prepared context explains how technology changes study habits, including benefits for access and risks around distraction. It summarizes a classroom reading without copying the full text.

## Main Idea

Technology can support learning when students use it with clear goals and healthy boundaries.

## Key Points

* Digital tools can make revision more flexible.
* Notifications can interrupt deep focus.
* Teachers can guide students toward better study routines.
* Access to resources is useful but does not replace careful thinking.
* Learners need strategies for evaluating online information.

## Important Vocabulary

* Word/Phrase: distraction
  Meaning: something that takes attention away
  Why useful: helps discuss study problems
* Word/Phrase: flexible learning
  Meaning: learning that can happen in different times or places
  Why useful: useful for education topics

## Debatable Issue

Whether technology improves learning more than it distracts students.

## Essay Comprehension Questions

### Q1

Question: What is the main idea?
Expected focus: Explain the central claim.
Suggested answer length: 60-100 words.

### Q2

Question: Which detail supports the argument?
Expected focus: Use a specific detail.
Suggested answer length: 60-100 words.

### Q3

Question: What can readers infer?
Expected focus: Make a reasonable inference.
Suggested answer length: 60-100 words.

### Q4

Question: What does distraction mean in context?
Expected focus: Explain vocabulary in context.
Suggested answer length: 60-100 words.

### Q5

Question: What critical response follows?
Expected focus: Give a balanced response.
Suggested answer length: 70-120 words.

## Speaking Practice Prompt

Explain whether technology helps students study better, using one benefit and one risk.

## Follow-up Discussion Questions

* What study tool helps you most?
* How can students reduce distractions?
* What role should teachers play?`;
}

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

function mockFetchForArticlePractice(capture: {
  systemPrompt?: string;
  userPrompt?: string;
  fetchUrls?: string[];
}) {
  process.env.DEEPSEEK_API_KEY = "test-key";
  globalThis.fetch = (async (url, init) => {
    const urlStr = typeof url === "string" ? url : (url as URL).toString();
    capture.fetchUrls = [...(capture.fetchUrls ?? []), urlStr];

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
      capture.userPrompt = body.messages?.find(
        (message) => message.role === "user",
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
                  essayQuestions: validEssayQuestions(),
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
    expect(data.comprehensionChecks).toEqual(["Check 1", "Check 2", "Check 3"]);
    expect(data.essayQuestions).toEqual(validEssayQuestions());

    // Check prompt policy was injected with English
    expect(capture.systemPrompt).toContain(
      "Write articleBrief, mainIdea, keyPoints, usefulVocabulary.meaning, usefulVocabulary.whyUseful, comprehensionChecks, speakingTask.title, speakingTask.instruction, followUpQuestions, and warnings in English."
    );
    expect(capture.systemPrompt).toContain("usefulVocabulary.word MUST remain in English.");
    expect(capture.systemPrompt).toContain("speakingTask.targetStructure MUST remain in English.");
    expect(capture.systemPrompt).toContain("sourceTitle, sourceUrl, and sourceDomain are source-derived and MUST NOT be translated.");
  });

  test("response includes exactly 5 essay questions with valid target skills", async () => {
    const capture: { systemPrompt?: string } = {};
    mockFetchForArticlePractice(capture);

    const response = await POST(buildRequest({}));
    const data = (await response.json()) as {
      essayQuestions?: ReturnType<typeof validEssayQuestions>;
      comprehensionChecks?: string[];
    };

    expect(response.status).toBe(200);
    expect(data.comprehensionChecks).toHaveLength(3);
    expect(data.essayQuestions).toHaveLength(5);
    expect(data.essayQuestions?.map((question) => question.targetSkill).sort()).toEqual([
      "critical_response",
      "inference",
      "main_idea",
      "supporting_detail",
      "vocabulary_in_context",
    ]);
    for (const question of data.essayQuestions ?? []) {
      expect(question.id).toBeTruthy();
      expect(question.question).toBeTruthy();
      expect(question.expectedFocus).toBeTruthy();
      expect(question.suggestedWordCount.min).toBeGreaterThanOrEqual(30);
      expect(question.suggestedWordCount.max).toBeLessThanOrEqual(220);
    }
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

  test("markdown mode with preparedContextMarkdown works without fetching URL", async () => {
    const capture: { systemPrompt?: string; userPrompt?: string; fetchUrls?: string[] } = {};
    mockFetchForArticlePractice(capture);

    const markdown = validPreparedMarkdown();
    const response = await POST(
      buildRequest({
        inputMode: "markdown",
        url: undefined,
        preparedContextMarkdown: markdown,
      }),
    );
    const data = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(data.sourceTitle).toBe("Prepared AI Study Context");
    expect(data.sourceUrl).toBe("prepared-markdown-context");
    expect(data.sourceDomain).toBe("Prepared Markdown");
    expect(data.essayQuestions).toEqual(validEssayQuestions());
    expect(JSON.stringify(data)).not.toContain(markdown.slice(0, 80));
    expect(capture.userPrompt).toContain("# Article Context");
    expect(capture.userPrompt).toContain("Prepared AI Study Context");
    expect(capture.fetchUrls ?? []).not.toContain("https://example.com/test-article");
  });

  test("markdown mode rejects missing preparedContextMarkdown", async () => {
    const response = await POST(
      buildRequest({
        inputMode: "markdown",
        url: undefined,
        preparedContextMarkdown: "",
      }),
    );
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(data.error).toBe("Prepared Markdown context is required.");
  });

  test("markdown mode rejects overlong markdown", async () => {
    const response = await POST(
      buildRequest({
        inputMode: "markdown",
        url: undefined,
        preparedContextMarkdown: `${validPreparedMarkdown()}\n${"x".repeat(20_001)}`,
      }),
    );
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(data.error).toBe("Prepared Markdown must be 20,000 characters or fewer.");
  });

  test("markdown mode rejects missing required headings", async () => {
    const response = await POST(
      buildRequest({
        inputMode: "markdown",
        url: undefined,
        preparedContextMarkdown: "# Article Context\n\n## Title\n\nOnly title",
      }),
    );
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(data.error).toContain("Prepared Markdown is missing required heading");
  });

  test("markdown mode rejects forbidden request fields", async () => {
    const response = await POST(
      buildRequest({
        inputMode: "markdown",
        url: undefined,
        preparedContextMarkdown: validPreparedMarkdown(),
        sourceUrl: "https://example.com/raw",
        fullArticleText: "raw full article",
        audio: "not allowed",
      }),
    );
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(data.error).toBe(
      "Markdown mode request contains unsupported private data.",
    );
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
      "essayQuestions",
      "speakingTask",
      "followUpQuestions",
      "warnings",
    ].sort();

    expect(Object.keys(data).sort()).toEqual(expectedKeys);
  });

  test("malformed essayQuestions provider output returns sanitized 502", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    globalThis.fetch = (async (url) => {
      const urlStr = typeof url === "string" ? url : (url as URL).toString();

      if (urlStr.includes("example.com/test-article")) {
        return new Response(
          `<html><body><article>${"Article content. ".repeat(40)}</article></body></html>`,
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }

      if (urlStr.includes("api.deepseek.com")) {
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
                      { word: "critique", meaning: "review", whyUseful: "discussion" },
                    ],
                    comprehensionChecks: ["Check 1", "Check 2", "Check 3"],
                    essayQuestions: validEssayQuestions().slice(0, 4),
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
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response("Not found", { status: 404 });
    }) as typeof fetch;

    const response = await POST(buildRequest({}));
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(502);
    expect(data.error).toBe(
      "Provider JSON did not match the Article Practice schema. Try again or switch provider.",
    );
  });
});
