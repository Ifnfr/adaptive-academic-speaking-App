import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { POST } from "../src/app/api/article-essay-evaluate/route";

const originalClaudeKey = process.env.CLAUDE_API_KEY;
const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalFetch = globalThis.fetch;

function validQuestions() {
  return [
    {
      id: "q1",
      question: "What is the main idea of the article?",
      expectedFocus: "Explain the central argument.",
      targetSkill: "main_idea",
      suggestedWordCount: { min: 50, max: 120 },
    },
    {
      id: "q2",
      question: "Which detail supports the article's argument?",
      expectedFocus: "Use one important detail from the article.",
      targetSkill: "supporting_detail",
      suggestedWordCount: { min: 50, max: 120 },
    },
    {
      id: "q3",
      question: "What can readers infer from the article?",
      expectedFocus: "Make a reasonable inference.",
      targetSkill: "inference",
      suggestedWordCount: { min: 50, max: 120 },
    },
    {
      id: "q4",
      question: "What does one key phrase mean in context?",
      expectedFocus: "Explain phrase meaning from context.",
      targetSkill: "vocabulary_in_context",
      suggestedWordCount: { min: 50, max: 120 },
    },
    {
      id: "q5",
      question: "What implication follows from the article?",
      expectedFocus: "Give a critical response based on the article.",
      targetSkill: "critical_response",
      suggestedWordCount: { min: 60, max: 140 },
    },
  ];
}

function validAnswers() {
  return validQuestions().map((question, index) => ({
    questionId: question.id,
    answer: `This is answer ${index + 1}. It explains the article clearly with relevant detail.`,
  }));
}

function validEvaluation() {
  return {
    overallFeedback:
      "Your answers show clear basic comprehension. Add more precise article details and connect each explanation more smoothly.",
    perQuestionFeedback: validQuestions().map((question) => ({
      questionId: question.id,
      comprehension: "You understood the question and answered the main point.",
      topicRelevance: "The answer stays connected to the article.",
      grammarNotes: ["Use consistent verb tense."],
      wordFormOrPartOfSpeechNotes: ["Check noun and verb forms carefully."],
      sentenceStructureNotes: ["Combine short ideas with a clear connector."],
      coherenceNotes: ["Add one linking phrase between ideas."],
      vocabularyNotes: ["Use more precise academic vocabulary."],
      improvedAnswerExample:
        "The article suggests that the issue matters because it affects both individual choices and wider outcomes.",
    })),
    recurringErrors: [
      {
        label: "Short explanations",
        explanation: "Several answers state a point without enough support.",
        exampleFromUser: "It is important for people.",
        correction: "It is important because it changes how people make decisions.",
      },
    ],
    nextWritingFocus:
      "For the next article, write one claim, one article detail, and one explanation for each answer.",
  };
}

function buildRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/article-essay-evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "DeepSeek",
      level: "Intermediate",
      feedbackLanguage: "English",
      targetLanguage: "English",
      articleContext: {
        sourceTitle: "Test Article",
        articleBrief: "This article explains how technology affects study habits.",
        mainIdea: "Technology can support learning when used intentionally.",
        keyPoints: [
          "Students can access information quickly.",
          "Tools can distract learners without clear goals.",
          "Privacy remains an important concern.",
        ],
      },
      questions: validQuestions(),
      answers: validAnswers(),
      ...body,
    }),
  });
}

function buildMalformedJsonRequest(): Request {
  return new Request("http://localhost/api/article-essay-evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "not-json",
  });
}

function mockDeepSeekResponse(
  status: number,
  content: string,
  capture: { systemPrompt?: string; userPrompt?: string; body?: Record<string, unknown> } = {},
) {
  process.env.DEEPSEEK_API_KEY = "test-key";
  globalThis.fetch = (async (_url, init) => {
    if (init && typeof init.body === "string") {
      capture.body = JSON.parse(init.body) as Record<string, unknown>;
      const messages = capture.body.messages as Array<{
        role: string;
        content: string;
      }>;
      capture.systemPrompt = messages.find((message) => message.role === "system")?.content;
      capture.userPrompt = messages.find((message) => message.role === "user")?.content;
    }

    if (status === 200) {
      return new Response(
        JSON.stringify({ choices: [{ message: { content } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    return new Response(content, {
      status,
      headers: { "content-type": "text/plain" },
    });
  }) as typeof fetch;
}

test.describe("Article Essay Evaluate Route", () => {
  test.afterEach(() => {
    process.env.CLAUDE_API_KEY = originalClaudeKey;
    process.env.DEEPSEEK_API_KEY = originalDeepSeekKey;
    process.env.GEMINI_API_KEY = originalGeminiKey;
    globalThis.fetch = originalFetch;
  });

  test("valid request returns structured evaluation", async () => {
    const capture: { systemPrompt?: string; userPrompt?: string } = {};
    mockDeepSeekResponse(200, JSON.stringify(validEvaluation()), capture);

    const response = await POST(buildRequest({}));
    const data = (await response.json()) as ReturnType<typeof validEvaluation>;

    expect(response.status).toBe(200);
    expect(data.overallFeedback).toContain("comprehension");
    expect(data.perQuestionFeedback).toHaveLength(5);
    expect(data.perQuestionFeedback[0].questionId).toBe("q1");
    expect(data.recurringErrors[0].label).toBe("Short explanations");
    expect(data.nextWritingFocus).toContain("next article");
    expect(capture.systemPrompt).toContain("Feedback language: English");
  });

  test("rejects malformed JSON with 400", async () => {
    const response = await POST(buildMalformedJsonRequest());
    expect(response.status).toBe(400);
  });

  test("rejects missing articleContext", async () => {
    const response = await POST(buildRequest({ articleContext: undefined }));
    expect(response.status).toBe(400);
  });

  test("rejects forbidden private or oversized context fields", async () => {
    for (const forbidden of [
      { fullArticleText: "raw article" },
      { sourceUrl: "https://example.com/article" },
      { userIdentity: "user-123" },
      { storagePath: "private/path" },
    ]) {
      const response = await POST(buildRequest(forbidden));
      expect(response.status).toBe(400);
    }
  });

  test("rejects answers length not equal to 5", async () => {
    const response = await POST(buildRequest({ answers: validAnswers().slice(0, 4) }));
    expect(response.status).toBe(400);
  });

  test("rejects missing answer for a question", async () => {
    const answers = validAnswers();
    answers[4] = { questionId: "q1", answer: "Duplicate answer." };
    const response = await POST(buildRequest({ answers }));
    expect(response.status).toBe(400);
  });

  test("rejects overlong answer", async () => {
    const answers = validAnswers();
    answers[0] = { questionId: "q1", answer: "a".repeat(1201) };
    const response = await POST(buildRequest({ answers }));
    expect(response.status).toBe(400);
  });

  test("provider non-OK returns sanitized 502", async () => {
    mockDeepSeekResponse(500, "raw provider failure with secret detail");

    const response = await POST(buildRequest({}));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(data.error).toBe("Provider request failed. Please try again later.");
    expect(data.error).not.toContain("secret detail");
  });

  test("malformed provider JSON returns sanitized 502", async () => {
    mockDeepSeekResponse(200, "not-json");

    const response = await POST(buildRequest({}));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(data.error).toBe("Invalid provider response format. Please try again.");
  });

  test("malformed evaluation schema returns sanitized 502", async () => {
    mockDeepSeekResponse(
      200,
      JSON.stringify({ ...validEvaluation(), perQuestionFeedback: [] }),
    );

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
  });

  test("provider request contains compact article context only", async () => {
    const capture: { userPrompt?: string } = {};
    mockDeepSeekResponse(200, JSON.stringify(validEvaluation()), capture);

    const response = await POST(buildRequest({}));

    expect(response.status).toBe(200);
    expect(capture.userPrompt).toContain("COMPACT ARTICLE CONTEXT");
    expect(capture.userPrompt).toContain("Test Article");
    expect(capture.userPrompt).not.toMatch(
      /fullArticleText|sourceUrl|https:\/\/example\.com|userIdentity|auth|storagePath|audioBlob|recordingUrl|transcript/i,
    );
  });

  test("feedbackLanguage is respected", async () => {
    const capture: { systemPrompt?: string } = {};
    mockDeepSeekResponse(200, JSON.stringify(validEvaluation()), capture);

    const response = await POST(buildRequest({ feedbackLanguage: "Indonesian" }));

    expect(response.status).toBe(200);
    expect(capture.systemPrompt).toContain("Feedback language: Indonesian");
  });

  test("response contains no score, pronunciation, phoneme, media, storage, or raw provider payload", async () => {
    mockDeepSeekResponse(200, JSON.stringify(validEvaluation()));

    const response = await POST(buildRequest({}));
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(200);
    expect(serialized).not.toMatch(
      /"score|"scores|pronunciation|phoneme|audio|speechToText|textToSpeech|Supabase|rawProvider/i,
    );
  });

  test("route source contains no persistence, user audio capture, or file handling behavior", () => {
    const source = readFileSync("src/app/api/article-essay-evaluate/route.ts", "utf8");
    expect(source).not.toMatch(/createClient|from\(|insert\(|upsert\(|localStorage|MediaRecorder|getUserMedia|writeFile|readFile/i);
  });
});
