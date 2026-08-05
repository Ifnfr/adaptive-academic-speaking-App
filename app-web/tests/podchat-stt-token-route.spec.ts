import { expect, test } from "@playwright/test";
import { GET } from "../src/app/api/podchat/stt-token/route";
import { testHooks } from "../src/app/api/podchat/stt/route-test-hooks";

const originalApiKey = process.env.DEEPGRAM_API_KEY;
const originalWsUrl = process.env.DEEPGRAM_WEBSOCKET_URL;

test.describe("Podchat STT Token Route", () => {
  test.beforeEach(() => {
    testHooks.resolveCurrentUserId = async () => "user-123";
  });

  test.afterEach(() => {
    process.env.DEEPGRAM_API_KEY = originalApiKey;
    process.env.DEEPGRAM_WEBSOCKET_URL = originalWsUrl;
    testHooks.resolveCurrentUserId = null;
  });

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

  test("returns wsUrl with token embedded using default deepgram endpoint", async () => {
    process.env.DEEPGRAM_API_KEY = "dg-test-key";
    delete process.env.DEEPGRAM_WEBSOCKET_URL;
    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      wsUrl?: string;
      encoding?: string;
      sampleRate?: number;
    };
    expect(typeof body.wsUrl).toBe("string");
    expect(body.wsUrl).toContain("wss://api.deepgram.com/v1/listen");
    expect(body.wsUrl).toContain("access_token=dg-test-key");
    expect(body.encoding).toBe("linear16");
    expect(body.sampleRate).toBe(16000);
  });

  test("appends token to a custom DEEPGRAM_WEBSOCKET_URL", async () => {
    process.env.DEEPGRAM_API_KEY = "dg-custom-key";
    process.env.DEEPGRAM_WEBSOCKET_URL =
      "wss://proxy.example.com/listen?model=nova-2";
    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { wsUrl?: string };
    expect(body.wsUrl).toContain("wss://proxy.example.com/listen?model=nova-2");
    expect(body.wsUrl).toContain("access_token=dg-custom-key");
  });

  test("embeds the key only as the access_token query param", async () => {
    process.env.DEEPGRAM_API_KEY = "dg-secret-leak-check";
    const response = await GET();
    const body = (await response.json()) as { wsUrl?: string };
    const match = body.wsUrl?.match(/[?&]access_token=([^&]*)/);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe("dg-secret-leak-check");
    // No other field should carry the raw key.
    expect(body.wsUrl?.match(/access_token=([^&]*)/g)?.length).toBe(1);
  });
});