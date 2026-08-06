import { expect, test } from "@playwright/test";
import { GET } from "../src/app/api/podchat/stt-token/route";
import { testHooks } from "../src/app/api/podchat/stt/route-test-hooks";

const originalApiKey = process.env.DEEPGRAM_API_KEY;
const originalWsUrl = process.env.DEEPGRAM_WEBSOCKET_URL;
const originalFetch = globalThis.fetch;

test.describe("Podchat STT Token Route", () => {
  test.beforeEach(() => {
    testHooks.resolveCurrentUserId = async () => "user-123";
  });

  test.afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.DEEPGRAM_API_KEY;
    } else {
      process.env.DEEPGRAM_API_KEY = originalApiKey;
    }
    if (originalWsUrl === undefined) {
      delete process.env.DEEPGRAM_WEBSOCKET_URL;
    } else {
      process.env.DEEPGRAM_WEBSOCKET_URL = originalWsUrl;
    }
    testHooks.resolveCurrentUserId = null;
    globalThis.fetch = originalFetch;
  });

  function mockEphemeralKeyResponse(
    ephemeralKey: string,
    status = 200,
    capture: { body?: Record<string, unknown>; authorization?: string } = {},
  ) {
    globalThis.fetch = (async (url, init) => {
      const requestUrl = typeof url === "string" ? url : url instanceof URL ? url.toString() : "";
      if (requestUrl.includes("/v1/keys")) {
        capture.authorization =
          (init?.headers as Record<string, string> | undefined)?.authorization ?? "";
        if (init && typeof init.body === "string") {
          capture.body = JSON.parse(init.body) as Record<string, unknown>;
        }
        if (status !== 200) {
          return new Response("ephemeral key request failed", { status });
        }
        return new Response(JSON.stringify({ key: ephemeralKey }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("unexpected fetch", { status: 500 });
    }) as typeof fetch;
  }

  test("returns 401 when unauthenticated", async () => {
    testHooks.resolveCurrentUserId = async () => null;
    process.env.DEEPGRAM_API_KEY = "dg-test-key";
    const response = await GET();
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBe("unauthorized");
  });

  test("returns 503 when Deepgram is not configured", async () => {
    delete process.env.DEEPGRAM_API_KEY;
    const response = await GET();
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain("Live speech-to-text is not configured");
  });

  test("returns wsUrl with an EPHEMERAL key (never the main key)", async () => {
    process.env.DEEPGRAM_API_KEY = "dg-main-secret-key";
    delete process.env.DEEPGRAM_WEBSOCKET_URL;
    const capture: { body?: Record<string, unknown>; authorization?: string } = {};
    mockEphemeralKeyResponse("ephemeral-abc123", 200, capture);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      wsUrl?: string;
      encoding?: string;
      sampleRate?: number;
    };
    expect(typeof body.wsUrl).toBe("string");
    expect(body.wsUrl).toContain("wss://api.deepgram.com/v1/listen");
    expect(body.wsUrl).toContain("access_token=ephemeral-abc123");
    // SECURITY: the main project key must never leave the server.
    expect(body.wsUrl).not.toContain("dg-main-secret-key");
    expect(body.encoding).toBe("linear16");
    expect(body.sampleRate).toBe(16000);

    // The ephemeral-key request must be authorized with the main key and
    // request a short-lived expiration.
    expect(capture.authorization).toBe("Token dg-main-secret-key");
    expect(capture.body?.expiration).toBe(600);
    expect(capture.body?.comment).toContain("fonetik-podchat");
  });

  test("appends ephemeral token to a custom DEEPGRAM_WEBSOCKET_URL", async () => {
    process.env.DEEPGRAM_API_KEY = "dg-main-secret-key";
    process.env.DEEPGRAM_WEBSOCKET_URL =
      "wss://proxy.example.com/listen?model=nova-2";
    mockEphemeralKeyResponse("ephemeral-custom-42", 200);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { wsUrl?: string };
    expect(body.wsUrl).toContain("wss://proxy.example.com/listen?model=nova-2");
    expect(body.wsUrl).toContain("access_token=ephemeral-custom-42");
    expect(body.wsUrl).not.toContain("dg-main-secret-key");
  });

  test("returns 503 (batch fallback) when the ephemeral key request fails", async () => {
    process.env.DEEPGRAM_API_KEY = "dg-main-secret-key";
    mockEphemeralKeyResponse("", 500);

    const response = await GET();
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain("Live speech-to-text is not configured");
  });
});
