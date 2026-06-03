import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { POST } from "../src/app/api/podchat/turn/route";

const originalClaudeKey = process.env.CLAUDE_API_KEY;
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;
const originalProvider = process.env.PODCHAT_AI_PROVIDER;
const originalFetch = globalThis.fetch;

// Default valid duration-based payload for Beginner (durationSeconds = 180)
function buildRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/podchat/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      topic: "Economics",
      difficulty: "Beginner",
      turnIndex: 0,
      durationSeconds: 180,
      elapsedSeconds: 30,
      remainingSeconds: 150,
      turns: [
        { speaker: "host", text: "Welcome to Podchat. What is your favorite economic concept?" },
        { speaker: "learner", text: "I like demand and supply because it dictates prices." }
      ],
      ...body,
    }),
  });
}

function mockClaudeResponse(status: number, responseText: string, capture: { body?: Record<string, unknown> } = {}) {
  process.env.CLAUDE_API_KEY = "test-claude-key";
  globalThis.fetch = (async (_url, init) => {
    if (init && typeof init.body === "string") {
      capture.body = JSON.parse(init.body) as Record<string, unknown>;
    }
    if (status === 200) {
      return new Response(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: responseText,
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    } else {
      return new Response(responseText, {
        status,
        headers: { "content-type": "text/plain" },
      });
    }
  }) as typeof fetch;
}

function mockGeminiResponse(status: number, responseText: string, capture: { body?: Record<string, unknown> } = {}) {
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
                parts: [
                  {
                    text: responseText,
                  },
                ],
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    } else {
      return new Response(responseText, {
        status,
        headers: { "content-type": "text/plain" },
      });
    }
  }) as typeof fetch;
}

function mockDeepSeekResponse(status: number, responseText: string, capture: { body?: Record<string, unknown> } = {}) {
  process.env.DEEPSEEK_API_KEY = "test-deepseek-key";
  globalThis.fetch = (async (_url, init) => {
    if (init && typeof init.body === "string") {
      capture.body = JSON.parse(init.body) as Record<string, unknown>;
    }
    if (status === 200) {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: responseText,
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    } else {
      return new Response(responseText, {
        status,
        headers: { "content-type": "text/plain" },
      });
    }
  }) as typeof fetch;
}

test.describe("Podchat Turn Route - Validation & Claude Integration", () => {
  test.afterEach(() => {
    process.env.CLAUDE_API_KEY = originalClaudeKey;
    process.env.GEMINI_API_KEY = originalGeminiKey;
    process.env.DEEPSEEK_API_KEY = originalDeepSeekKey;
    process.env.PODCHAT_AI_PROVIDER = originalProvider;
    globalThis.fetch = originalFetch;
  });

  // ── Duration schema validation ──────────────────────────────────────────────

  test("valid request with duration fields returns hostText and followUpQuestion", async () => {
    const capture: { body?: Record<string, unknown> } = {};
    mockClaudeResponse(200, JSON.stringify({
      hostText: "That is a brilliant starting point. Supply and demand really makes the world go round.",
      followUpQuestion: "Can you think of a recent price change you noticed in a shop?"
    }), capture);

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(200);
    const data = (await response.json()) as { hostText: string; followUpQuestion: string };
    expect(data.hostText).toBe("That is a brilliant starting point. Supply and demand really makes the world go round.");
    expect(data.followUpQuestion).toBe("Can you think of a recent price change you noticed in a shop?");

    expect(JSON.stringify(capture.body)).not.toContain("audio");
    expect(JSON.stringify(capture.body)).not.toContain("recording");
    expect(JSON.stringify(capture.body)).not.toContain("email");
    expect(JSON.stringify(capture.body)).not.toContain("userId");
  });

  test("old maxUserTurns-only request (without duration fields) rejects with 400", async () => {
    // Simulate old payload: has maxUserTurns but missing durationSeconds/elapsedSeconds/remainingSeconds
    const request = new Request("http://localhost/api/podchat/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic: "Economics",
        difficulty: "Beginner",
        turnIndex: 0,
        maxUserTurns: 3,
        turns: [
          { speaker: "host", text: "Welcome to Podchat." },
          { speaker: "learner", text: "Hello." }
        ],
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    // Should fail on missing/invalid durationSeconds
    expect(data.error).toContain("durationSeconds");
  });

  test("durationSeconds mismatch for difficulty rejects with 400", async () => {
    // Intermediate requires 300 but we send 180
    const response = await POST(buildRequest({ difficulty: "Intermediate", durationSeconds: 180, remainingSeconds: 150 }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("durationSeconds");
  });

  test("Advanced difficulty with correct durationSeconds (420) passes schema", async () => {
    const capture: { body?: Record<string, unknown> } = {};
    mockClaudeResponse(200, JSON.stringify({
      hostText: "A trade-off worth exploring.",
      followUpQuestion: "What is the wider implication of that?"
    }), capture);

    const response = await POST(buildRequest({
      difficulty: "Advanced",
      durationSeconds: 420,
      elapsedSeconds: 100,
      remainingSeconds: 320,
    }));
    expect(response.status).toBe(200);
  });

  test("negative elapsedSeconds rejects with 400", async () => {
    const response = await POST(buildRequest({ elapsedSeconds: -1 }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("elapsedSeconds");
  });

  test("elapsedSeconds exceeding durationSeconds rejects with 400", async () => {
    const response = await POST(buildRequest({ elapsedSeconds: 200, remainingSeconds: 0 }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("elapsedSeconds");
  });

  test("negative remainingSeconds rejects with 400", async () => {
    const response = await POST(buildRequest({ remainingSeconds: -1 }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("remainingSeconds");
  });

  test("inconsistent remainingSeconds outside tolerance rejects with 400", async () => {
    // durationSeconds=180, elapsedSeconds=30 → expected remaining=150, but we send 100 (diff=50 > 5)
    const response = await POST(buildRequest({ remainingSeconds: 100 }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("remainingSeconds");
  });

  test("remainingSeconds within 5s tolerance passes", async () => {
    const capture: { body?: Record<string, unknown> } = {};
    mockClaudeResponse(200, JSON.stringify({
      hostText: "A reasonable point.",
      followUpQuestion: "Could you give an example?"
    }), capture);

    // elapsedSeconds=30, durationSeconds=180 → expected=150, send 153 (diff=3 ≤ 5)
    const response = await POST(buildRequest({ remainingSeconds: 153 }));
    expect(response.status).toBe(200);
  });

  // ── Core validation ──────────────────────────────────────────────────────────

  test("invalid topic rejects with 400", async () => {
    const response = await POST(buildRequest({ topic: "InvalidTopic" }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("topic");
  });

  test("invalid difficulty rejects with 400", async () => {
    const response = await POST(buildRequest({ difficulty: "Expert" }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("difficulty");
  });

  test("empty turns rejects with 400", async () => {
    const response = await POST(buildRequest({ turns: [] }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("turns");
  });

  test("turns exceeding max length 20 rejects with 400", async () => {
    const manyTurns = Array.from({ length: 21 }, (_, i) => ({
      speaker: i % 2 === 0 ? "host" : "learner",
      text: "Sample text."
    }));
    const response = await POST(buildRequest({ turns: manyTurns }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("turns");
  });

  test("invalid speaker rejects with 400", async () => {
    const response = await POST(buildRequest({
      turns: [
        { speaker: "invalid_speaker", text: "Hello" }
      ]
    }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("speaker");
  });

  test("empty turn text rejects with 400", async () => {
    const response = await POST(buildRequest({
      turns: [
        { speaker: "host", text: " " }
      ]
    }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("text");
  });

  test("oversized turn text rejects with 400", async () => {
    const response = await POST(buildRequest({
      turns: [
        { speaker: "host", text: "Welcome to Podchat." },
        { speaker: "learner", text: "a".repeat(1201) }
      ]
    }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("text");
  });

  test("last turn not learner rejects with 400", async () => {
    const response = await POST(buildRequest({
      turns: [
        { speaker: "learner", text: "Hello" },
        { speaker: "host", text: "Welcome" }
      ]
    }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("learner");
  });

  test("learner turn count mismatch rejects with 400", async () => {
    const response = await POST(buildRequest({
      turnIndex: 1,
      turns: [
        { speaker: "host", text: "Welcome" },
        { speaker: "learner", text: "Thanks" }
      ]
    }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("Learner turn count");
  });

  test("user can submit many turns without fixed max-turn ending (turnIndex=9 accepted)", async () => {
    const capture: { body?: Record<string, unknown> } = {};
    mockClaudeResponse(200, JSON.stringify({
      hostText: "Excellent point.",
      followUpQuestion: "What else would you add?"
    }), capture);

    // Build 20-turn transcript: 10 host + 10 learner interleaved, ending with learner
    const manyTurns: Array<{ speaker: string; text: string }> = [];
    for (let i = 0; i < 10; i++) {
      manyTurns.push({ speaker: "host", text: `Host question ${i + 1}.` });
      manyTurns.push({ speaker: "learner", text: `Learner answer ${i + 1}.` });
    }
    const response = await POST(buildRequest({
      turnIndex: 9,
      elapsedSeconds: 90,
      remainingSeconds: 90,
      turns: manyTurns,
    }));
    expect(response.status).toBe(200);
  });

  // ── Provider: missing key ───────────────────────────────────────────────────

  test("missing CLAUDE_API_KEY returns 503, not 400", async () => {
    process.env.CLAUDE_API_KEY = "";
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(503);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("Provider is not configured");
  });

  // ── Mock provider ────────────────────────────────────────────────────────────

  test("mock provider returns deterministic host response without key or fetch", async () => {
    process.env.PODCHAT_AI_PROVIDER = "mock";
    process.env.CLAUDE_API_KEY = "";
    process.env.GEMINI_API_KEY = "";
    process.env.DEEPSEEK_API_KEY = "";
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response("should not be called", { status: 500 });
    }) as typeof fetch;

    const response = await POST(buildRequest({}));
    const data = (await response.json()) as {
      hostText: string;
      followUpQuestion: string;
    };

    expect(response.status).toBe(200);
    expect(fetchCalled).toBe(false);
    expect(data.hostText).toContain("Local mock host");
    expect(data.hostText).toContain("economics");
    expect(data.followUpQuestion).toContain("simple everyday example");
    expect((data.followUpQuestion.match(/\?/g) || []).length).toBe(1);
    expect(JSON.stringify(data)).not.toMatch(/audio|blob|recording|userId|email/i);
  });

  test("mock provider with low remainingSeconds returns closing context", async () => {
    process.env.PODCHAT_AI_PROVIDER = "mock";
    process.env.CLAUDE_API_KEY = "";

    // Send with 30s remaining (≤60 threshold)
    const response = await POST(buildRequest({
      elapsedSeconds: 150,
      remainingSeconds: 30,
    }));
    expect(response.status).toBe(200);
    const data = (await response.json()) as { hostText: string; followUpQuestion: string };
    expect(data.hostText).toContain("nearly out of time");
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

  // ── Claude ───────────────────────────────────────────────────────────────────

  test("Claude non-OK response returns sanitized 502", async () => {
    mockClaudeResponse(500, "Internal Server Error");
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe("Provider request failed. Please try again later.");
  });

  test("malformed Claude JSON returns safe 502", async () => {
    mockClaudeResponse(200, "Invalid { json }");
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe("Invalid provider response format. Please try again.");
  });

  test("malformed Claude schema returns safe 502", async () => {
    mockClaudeResponse(200, JSON.stringify({
      hostText: "",
      followUpQuestion: "Is this valid?"
    }));
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
  });

  test("follow-up with more than one question mark returns safe 502", async () => {
    mockClaudeResponse(200, JSON.stringify({
      hostText: "Valid statement.",
      followUpQuestion: "Is this valid? Or is it not?"
    }));
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
  });

  test("route source contains no STT, TTS, MediaRecorder, Supabase, upload, audio blob, or scoring behavior", () => {
    const source = readFileSync("src/app/api/podchat/turn/route.ts", "utf8");
    const forbidden = ["speechToText", "textToSpeech", "MediaRecorder", "Supabase", "upload", "audio", "blob"];
    for (const term of forbidden) {
      expect(source).not.toContain(term);
    }
  });

  // ── Gemini ───────────────────────────────────────────────────────────────────

  test("valid Gemini request returns hostText and followUpQuestion", async () => {
    process.env.PODCHAT_AI_PROVIDER = "gemini";
    const capture: { body?: Record<string, unknown> } = {};
    mockGeminiResponse(200, JSON.stringify({
      hostText: "Gemini is starting the discussion.",
      followUpQuestion: "What do you think?"
    }), capture);

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(200);
    const data = (await response.json()) as { hostText: string; followUpQuestion: string };
    expect(data.hostText).toBe("Gemini is starting the discussion.");
    expect(data.followUpQuestion).toBe("What do you think?");

    const bodyStr = JSON.stringify(capture.body);
    expect(bodyStr).not.toContain("audio");
    expect(bodyStr).not.toContain("recording");
    expect(bodyStr).not.toContain("email");
    expect(bodyStr).not.toContain("userId");
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
      hostText: "",
      followUpQuestion: "Hello?"
    }));
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
  });

  // ── DeepSeek ─────────────────────────────────────────────────────────────────

  test("valid DeepSeek request returns hostText and followUpQuestion", async () => {
    process.env.PODCHAT_AI_PROVIDER = "deepseek";
    const capture: { body?: Record<string, unknown> } = {};
    mockDeepSeekResponse(200, JSON.stringify({
      hostText: "DeepSeek is starting the discussion.",
      followUpQuestion: "What do you think?"
    }), capture);

    const response = await POST(buildRequest({}));
    expect(response.status).toBe(200);
    const data = (await response.json()) as { hostText: string; followUpQuestion: string };
    expect(data.hostText).toBe("DeepSeek is starting the discussion.");
    expect(data.followUpQuestion).toBe("What do you think?");

    const bodyStr = JSON.stringify(capture.body);
    expect(bodyStr).not.toContain("audio");
    expect(bodyStr).not.toContain("recording");
    expect(bodyStr).not.toContain("email");
    expect(bodyStr).not.toContain("userId");
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
      hostText: "",
      followUpQuestion: "Hello?"
    }));
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(502);
  });
});
