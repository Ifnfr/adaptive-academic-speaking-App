import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { POST } from "../src/app/api/podchat/turn/route";

const originalClaudeKey = process.env.CLAUDE_API_KEY;
const originalFetch = globalThis.fetch;

function buildRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/podchat/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      topic: "Economics",
      difficulty: "Beginner",
      maxUserTurns: 3,
      turnIndex: 0,
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

test.describe("Podchat Turn Route - Validation & Claude Integration", () => {
  test.afterEach(() => {
    process.env.CLAUDE_API_KEY = originalClaudeKey;
    globalThis.fetch = originalFetch;
  });

  test("valid request returns hostText and followUpQuestion", async () => {
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

  test("maxUserTurns mismatch rejects with 400", async () => {
    const response = await POST(buildRequest({ maxUserTurns: 5 }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("maxUserTurns");
  });

  test("empty turns rejects with 400", async () => {
    const response = await POST(buildRequest({ turns: [] }));
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

  test("missing CLAUDE_API_KEY returns 503, not 400", async () => {
    process.env.CLAUDE_API_KEY = "";
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(503);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("Provider is not configured");
  });

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
});
