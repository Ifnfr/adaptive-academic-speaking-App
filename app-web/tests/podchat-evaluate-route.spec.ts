import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { POST } from "../src/app/api/podchat/evaluate/route";

const originalClaudeKey = process.env.CLAUDE_API_KEY;
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;
const originalProvider = process.env.PODCHAT_AI_PROVIDER;
const originalFetch = globalThis.fetch;

function validEvaluation() {
  return {
    summary:
      "You kept the conversation connected to the topic and gave understandable answers. Your next improvement is to add clearer examples and more complete sentence endings.",
    corrections: [
      {
        original: "Technology help student study.",
        improved: "Technology helps students study more independently.",
        explanation:
          "Use the third-person verb form and a plural noun for a general academic statement.",
      },
    ],
    betterSentences: [
      "Technology can support independent learning when students use it with a clear goal.",
    ],
    vocabularySuggestions: [
      {
        originalOrBasic: "good",
        suggestion: "beneficial",
        example: "Online platforms can be beneficial for revision.",
      },
    ],
    recurringErrors: [
      {
        label: "Incomplete sentence endings",
        evidence: "Some answers ended before the idea was fully explained.",
        practiceFocus:
          "Finish each answer with one reason or example before stopping.",
      },
    ],
    nextPracticeFocus:
      "Give one clear claim, one reason, and one short example in each answer.",
  };
}

function buildRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/podchat/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      topic: "Technology",
      difficulty: "Intermediate",
      turns: [
        {
          speaker: "host",
          text: "Welcome to Podchat. Which technology trend matters most to you?",
        },
        {
          speaker: "learner",
          text: "I think AI tools matter because students can practise faster.",
        },
      ],
      ...body,
    }),
  });
}

function mockClaudeResponse(
  status: number,
  responseText: string,
  capture: { body?: Record<string, unknown> } = {},
) {
  process.env.CLAUDE_API_KEY = "test-claude-key";
  globalThis.fetch = (async (_url, init) => {
    if (init && typeof init.body === "string") {
      capture.body = JSON.parse(init.body) as Record<string, unknown>;
    }

    if (status === 200) {
      return new Response(
        JSON.stringify({
          content: [{ type: "text", text: responseText }],
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

function mockGeminiResponse(
  status: number,
  responseText: string,
  capture: { body?: Record<string, unknown> } = {},
) {
  process.env.GEMINI_API_KEY = "test-gemini-key";
  globalThis.fetch = (async (_url, init) => {
    if (init && typeof init.body === "string") {
      capture.body = JSON.parse(init.body) as Record<string, unknown>;
    }

    if (status === 200) {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: responseText }],
              },
            },
          ],
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

function mockDeepSeekResponse(
  status: number,
  responseText: string,
  capture: { body?: Record<string, unknown> } = {},
) {
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

test.describe("Podchat Evaluate Route", () => {
  test.afterEach(() => {
    process.env.CLAUDE_API_KEY = originalClaudeKey;
    process.env.GEMINI_API_KEY = originalGeminiKey;
    process.env.DEEPSEEK_API_KEY = originalDeepSeekKey;
    process.env.PODCHAT_AI_PROVIDER = originalProvider;
    globalThis.fetch = originalFetch;
  });

  test("valid request returns full structured evaluation", async () => {
    const capture: { body?: Record<string, unknown> } = {};
    mockClaudeResponse(200, JSON.stringify(validEvaluation()), capture);

    const response = await POST(buildRequest({}));
    const data = (await response.json()) as ReturnType<typeof validEvaluation>;

    expect(response.status).toBe(200);
    expect(data.summary).toContain("conversation");
    expect(data.corrections[0].original).toBe("Technology help student study.");
    expect(data.betterSentences).toHaveLength(1);
    expect(data.vocabularySuggestions[0].suggestion).toBe("beneficial");
    expect(data.recurringErrors[0].label).toBe("Incomplete sentence endings");
    expect(data.nextPracticeFocus).toContain("claim");

    const providerBody = JSON.stringify(capture.body);
    expect(providerBody).not.toMatch(
      /audio|blob|recordingUrl|email|userId|owner_id|auth|device/i,
    );
  });

  test("invalid topic rejects with 400", async () => {
    const response = await POST(buildRequest({ topic: "Culture" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
  });

  test("invalid difficulty rejects with 400", async () => {
    const response = await POST(buildRequest({ difficulty: "Expert" }));
    expect(response.status).toBe(400);
  });

  test("empty turns rejects with 400", async () => {
    const response = await POST(buildRequest({ turns: [] }));
    expect(response.status).toBe(400);
  });

  test("invalid speaker rejects with 400", async () => {
    const response = await POST(
      buildRequest({ turns: [{ speaker: "coach", text: "Hello" }] }),
    );
    expect(response.status).toBe(400);
  });

  test("empty turn text rejects with 400", async () => {
    const response = await POST(
      buildRequest({
        turns: [
          { speaker: "host", text: "Welcome." },
          { speaker: "learner", text: " " },
        ],
      }),
    );
    expect(response.status).toBe(400);
  });

  test("oversized turn text rejects with 400", async () => {
    const response = await POST(
      buildRequest({
        turns: [
          { speaker: "host", text: "Welcome." },
          { speaker: "learner", text: "a".repeat(1201) },
        ],
      }),
    );
    expect(response.status).toBe(400);
  });

  test("missing learner turn rejects with 400", async () => {
    const response = await POST(
      buildRequest({ turns: [{ speaker: "host", text: "Welcome." }] }),
    );
    expect(response.status).toBe(400);
  });

  test("missing host turn rejects with 400", async () => {
    const response = await POST(
      buildRequest({ turns: [{ speaker: "learner", text: "I like AI." }] }),
    );
    expect(response.status).toBe(400);
  });

  test("too-long transcript rejects with 400", async () => {
    const response = await POST(
      buildRequest({
        turns: [
          { speaker: "host", text: "a".repeat(1000) },
          { speaker: "learner", text: "b".repeat(1000) },
          { speaker: "host", text: "c".repeat(1000) },
          { speaker: "learner", text: "d".repeat(1000) },
          { speaker: "host", text: "e".repeat(1000) },
          { speaker: "learner", text: "f".repeat(1000) },
          { speaker: "host", text: "g".repeat(1000) },
          { speaker: "learner", text: "h".repeat(1000) },
          { speaker: "host", text: "i" },
          { speaker: "learner", text: "j" },
        ],
      }),
    );
    expect(response.status).toBe(400);
  });

  test("missing CLAUDE_API_KEY returns 503, not 400", async () => {
    process.env.CLAUDE_API_KEY = "";
    const response = await POST(buildRequest({}));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(data.error).toBe("Provider is not configured. Please try again later.");
  });

  test("Claude non-OK response returns sanitized 502", async () => {
    mockClaudeResponse(500, "raw provider failure with internal detail");

    const response = await POST(buildRequest({}));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(data.error).toBe("Provider request failed. Please try again later.");
    expect(data.error).not.toContain("internal detail");
  });

  test("malformed Claude JSON returns safe 502", async () => {
    mockClaudeResponse(200, "not-json");

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
  });

  test("malformed Claude schema returns safe 502", async () => {
    mockClaudeResponse(
      200,
      JSON.stringify({ ...validEvaluation(), summary: "" }),
    );

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
  });

  test("recurringErrors must be structured array, not string", async () => {
    mockClaudeResponse(
      200,
      JSON.stringify({
        ...validEvaluation(),
        recurringErrors: "Incomplete sentence endings",
      }),
    );

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
  });

  test("response contains no scores, pronunciation fields, or raw provider payload", async () => {
    mockClaudeResponse(200, JSON.stringify(validEvaluation()));

    const response = await POST(buildRequest({}));
    const data = await response.json();
    const serialized = JSON.stringify(data);

    expect(response.status).toBe(200);
    expect(serialized).not.toMatch(/"score|"scores|pronunciation|phoneme|rawProvider/i);
  });

  test("forbidden provider fields return safe 502", async () => {
    mockClaudeResponse(
      200,
      JSON.stringify({ ...validEvaluation(), scores: { clarity: 4 } }),
    );

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
  });

  test("route source contains no STT, TTS, Supabase, upload, or media behavior", () => {
    const source = readFileSync("src/app/api/podchat/evaluate/route.ts", "utf8");
    const forbidden = [
      "speechToText",
      "textToSpeech",
      "MediaRecorder",
      "Supabase",
      "upload",
      "audioBlob",
      "recordingUrl",
    ];

    for (const term of forbidden) {
      expect(source).not.toContain(term);
    }
  });

  test("valid Gemini request returns full structured evaluation", async () => {
    process.env.PODCHAT_AI_PROVIDER = "gemini";
    const capture: { body?: Record<string, unknown> } = {};
    mockGeminiResponse(200, JSON.stringify(validEvaluation()), capture);

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(200);
    const data = (await response.json()) as ReturnType<typeof validEvaluation>;
    expect(data.summary).toContain("conversation");
    expect(data.corrections[0].original).toBe("Technology help student study.");
    expect(data.betterSentences).toHaveLength(1);
    expect(data.vocabularySuggestions[0].suggestion).toBe("beneficial");
    expect(data.recurringErrors[0].label).toBe("Incomplete sentence endings");
    expect(data.nextPracticeFocus).toContain("claim");

    const bodyStr = JSON.stringify(capture.body);
    expect(bodyStr).not.toMatch(/audio|blob|recordingUrl|email|userId|owner_id|auth|device/i);
  });

  test("missing GEMINI_API_KEY with Gemini provider returns 503", async () => {
    process.env.PODCHAT_AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "";
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(503);
  });

  test("Gemini non-OK response returns sanitized 502", async () => {
    process.env.PODCHAT_AI_PROVIDER = "gemini";
    mockGeminiResponse(500, "Gemini Internal error");
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe("Provider request failed. Please try again later.");
  });

  test("malformed Gemini JSON returns safe 502", async () => {
    process.env.PODCHAT_AI_PROVIDER = "gemini";
    mockGeminiResponse(200, "Invalid JSON");
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
  });

  test("Gemini response schema mismatch returns safe 502", async () => {
    process.env.PODCHAT_AI_PROVIDER = "gemini";
    mockGeminiResponse(200, JSON.stringify({
      ...validEvaluation(),
      summary: ""
    }));
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
  });

  test("valid DeepSeek request returns full structured evaluation", async () => {
    process.env.PODCHAT_AI_PROVIDER = "deepseek";
    const capture: { body?: Record<string, unknown> } = {};
    mockDeepSeekResponse(200, JSON.stringify(validEvaluation()), capture);

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(200);
    const data = (await response.json()) as ReturnType<typeof validEvaluation>;
    expect(data.summary).toContain("conversation");
    expect(data.corrections[0].original).toBe("Technology help student study.");
    expect(data.betterSentences).toHaveLength(1);
    expect(data.vocabularySuggestions[0].suggestion).toBe("beneficial");
    expect(data.recurringErrors[0].label).toBe("Incomplete sentence endings");
    expect(data.nextPracticeFocus).toContain("claim");

    const bodyStr = JSON.stringify(capture.body);
    expect(bodyStr).not.toMatch(/audio|blob|recordingUrl|email|userId|owner_id|auth|device/i);
  });

  test("missing DEEPSEEK_API_KEY with DeepSeek provider returns 503", async () => {
    process.env.PODCHAT_AI_PROVIDER = "deepseek";
    process.env.DEEPSEEK_API_KEY = "";
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(503);
  });

  test("DeepSeek non-OK response returns sanitized 502", async () => {
    process.env.PODCHAT_AI_PROVIDER = "deepseek";
    mockDeepSeekResponse(500, "DeepSeek Internal error");
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe("Provider request failed. Please try again later.");
  });

  test("malformed DeepSeek JSON returns safe 502", async () => {
    process.env.PODCHAT_AI_PROVIDER = "deepseek";
    mockDeepSeekResponse(200, "Invalid JSON");
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
  });

  test("DeepSeek response schema mismatch returns safe 502", async () => {
    process.env.PODCHAT_AI_PROVIDER = "deepseek";
    mockDeepSeekResponse(200, JSON.stringify({
      ...validEvaluation(),
      summary: ""
    }));
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
  });
});
