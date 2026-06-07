import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { POST, testHooks } from "../src/app/api/article-essay-evaluate/route";

const originalClaudeKey = process.env.CLAUDE_API_KEY;
const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalArticleAiProvider = process.env.ARTICLE_AI_PROVIDER;
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
    process.env.ARTICLE_AI_PROVIDER = originalArticleAiProvider;
    globalThis.fetch = originalFetch;
    testHooks.resolveCurrentUserId = null;
    testHooks.getSupabaseClient = null;
  });

  test("mock mode returns deterministic evaluation without fetch or API keys", async () => {
    process.env.ARTICLE_AI_PROVIDER = "mock";
    process.env.CLAUDE_API_KEY = "";
    process.env.DEEPSEEK_API_KEY = "";
    process.env.GEMINI_API_KEY = "";
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error("fetch should not be called in article essay mock mode");
    }) as typeof fetch;

    const response = await POST(buildRequest({}));
    const data = (await response.json()) as ReturnType<typeof validEvaluation> & {
      memory?: { saved: boolean };
    };

    expect(response.status).toBe(200);
    expect(fetchCalled).toBe(false);
    expect(data.overallFeedback).toContain("main message");
    expect(data.perQuestionFeedback).toHaveLength(5);
    expect(data.perQuestionFeedback[0]).toMatchObject({
      questionId: "q1",
    });
    expect(data.perQuestionFeedback[0].grammarNotes).toContain(
      "Use consistent verb tense when explaining article ideas.",
    );
    expect(data.perQuestionFeedback[0].wordFormOrPartOfSpeechNotes[0]).toContain(
      "nouns",
    );
    expect(data.perQuestionFeedback[0].sentenceStructureNotes[0]).toContain(
      "topic sentence",
    );
    expect(data.perQuestionFeedback[0].coherenceNotes[0]).toContain("Link");
    expect(data.perQuestionFeedback[0].topicRelevance).toContain("relevant");
    expect(data.recurringErrors[0].label).toBe("General support");
    expect(data.nextWritingFocus).toContain("one claim");
    expect(data.memory?.saved).toBe(false);
    expect(JSON.stringify(data)).not.toMatch(/api[_-]?key|rawProvider|score|pronunciation|phoneme/i);
  });

  test("mock mode keeps five-answer validation and forbidden-field rejection", async () => {
    process.env.ARTICLE_AI_PROVIDER = "mock";
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error("fetch should not be called for invalid mock requests");
    }) as typeof fetch;

    const shortAnswers = await POST(buildRequest({ answers: validAnswers().slice(0, 4) }));
    const forbiddenField = await POST(buildRequest({ sourceUrl: "https://example.com" }));

    expect(shortAnswers.status).toBe(400);
    expect(forbiddenField.status).toBe(400);
    expect(fetchCalled).toBe(false);
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

  test("route source contains no direct database write queries, user audio capture, or file handling behavior", () => {
    const source = readFileSync("src/app/api/article-essay-evaluate/route.ts", "utf8");
    expect(source).not.toMatch(/from\(|insert\(|upsert\(|localStorage|MediaRecorder|getUserMedia|writeFile|readFile/i);
  });

  test("successful authenticated evaluation calls saveArticleWritingMemory and respects privacy boundaries", async () => {
    mockDeepSeekResponse(200, JSON.stringify(validEvaluation()));

    testHooks.resolveCurrentUserId = async () => "mocked-clerk-user-123";

    interface MockSessionData {
      owner_id: string;
      level: string;
      feedback_language: string;
      provider: string;
      article_context: {
        sourceTitle: string;
      };
      questions: unknown[];
    }
    interface MockAnswerRow {
      session_id: string;
      owner_id: string;
    }
    interface MockErrorRow {
      owner_id: string;
      label: string;
    }

    const sessionCalls: MockSessionData[] = [];
    const answerCalls: MockAnswerRow[][] = [];
    const errorCalls: MockErrorRow[][] = [];

    const mockSupabase = {
      from(table: string) {
        if (table === "article_writing_sessions") {
          return {
            insert(data: unknown) {
              sessionCalls.push(data as MockSessionData);
              return {
                select() {
                  return {
                    async single() {
                      return { data: { id: "test-session-uuid-1" }, error: null };
                    }
                  };
                }
              };
            }
          };
        }
        if (table === "article_writing_answers") {
          return {
            async insert(data: unknown) {
              answerCalls.push(data as MockAnswerRow[]);
              return { error: null };
            }
          };
        }
        if (table === "learner_error_patterns") {
          return {
            async insert(data: unknown) {
              errorCalls.push(data as MockErrorRow[]);
              return { error: null };
            }
          };
        }
        return {};
      }
    };

    testHooks.getSupabaseClient = () => mockSupabase as unknown;

    const response = await POST(buildRequest({}));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.memory?.saved).toBe(true);

    // Verify session save was called once
    expect(sessionCalls).toHaveLength(1);
    const sessionData = sessionCalls[0];
    expect(sessionData.owner_id).toBe("mocked-clerk-user-123");
    expect(sessionData.level).toBe("Intermediate");
    expect(sessionData.feedback_language).toBe("English");
    expect(sessionData.provider).toBe("DeepSeek");
    expect(sessionData.article_context.sourceTitle).toBe("Test Article");

    // Verify questions and answers
    expect(sessionData.questions).toHaveLength(5);
    expect(answerCalls).toHaveLength(1);
    expect(answerCalls[0]).toHaveLength(5);
    expect(answerCalls[0][0].session_id).toBe("test-session-uuid-1");
    expect(answerCalls[0][0].owner_id).toBe("mocked-clerk-user-123");

    // Verify errors normalized
    expect(errorCalls).toHaveLength(1);
    expect(errorCalls[0]).toHaveLength(1);
    expect(errorCalls[0][0].owner_id).toBe("mocked-clerk-user-123");
    expect(errorCalls[0][0].label).toBe("Short explanations");

    // Verify privacy boundaries (no forbidden fields passed)
    const serializedInput = JSON.stringify(sessionData).toLowerCase();
    for (const forbidden of [
      "sourceurl",
      "rawmarkdown",
      "fullarticletext",
      "audio",
      "stt",
      "tts",
      "transcript",
      "rawproviderpayload",
    ]) {
      expect(serializedInput).not.toContain(forbidden);
    }
  });

  test("missing/unauthenticated user skips memory save and still returns evaluation", async () => {
    mockDeepSeekResponse(200, JSON.stringify(validEvaluation()));

    testHooks.resolveCurrentUserId = async () => null; // unauthenticated

    let clientWasCreated = false;
    testHooks.getSupabaseClient = () => {
      clientWasCreated = true;
      return {};
    };

    const response = await POST(buildRequest({}));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.overallFeedback).toContain("comprehension");
    expect(data.memory?.saved).toBe(false);
    expect(clientWasCreated).toBe(false); // shouldn't even call getSupabaseClient
  });

  test("memory save failure still returns evaluation response successfully", async () => {
    mockDeepSeekResponse(200, JSON.stringify(validEvaluation()));

    testHooks.resolveCurrentUserId = async () => "mocked-clerk-user-123";

    // Mock client where session insert fails
    const mockSupabase = {
      from() {
        return {
          insert() {
            return {
              select() {
                return {
                  async single() {
                    return { data: null, error: { message: "DB Error" } };
                  }
                };
              }
            };
          }
        };
      }
    };

    testHooks.getSupabaseClient = () => mockSupabase;

    const response = await POST(buildRequest({}));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.overallFeedback).toContain("comprehension");
    expect(data.memory?.saved).toBe(false); // save failed, but evaluation succeeds
  });

  test("provider failure does not call memory save", async () => {
    mockDeepSeekResponse(500, "raw provider failure");

    testHooks.resolveCurrentUserId = async () => "mocked-clerk-user-123";
    let clientWasCreated = false;
    testHooks.getSupabaseClient = () => {
      clientWasCreated = true;
      return {};
    };

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
    expect(clientWasCreated).toBe(false);
  });

  test("malformed provider output does not call memory save", async () => {
    mockDeepSeekResponse(200, "not-json");

    testHooks.resolveCurrentUserId = async () => "mocked-clerk-user-123";
    let clientWasCreated = false;
    testHooks.getSupabaseClient = () => {
      clientWasCreated = true;
      return {};
    };

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
    expect(clientWasCreated).toBe(false);
  });

  test("invalid request does not call memory save", async () => {
    testHooks.resolveCurrentUserId = async () => "mocked-clerk-user-123";
    let clientWasCreated = false;
    testHooks.getSupabaseClient = () => {
      clientWasCreated = true;
      return {};
    };

    const response = await POST(buildRequest({ answers: [] })); // invalid answer count
    expect(response.status).toBe(400);
    expect(clientWasCreated).toBe(false);
  });
});
