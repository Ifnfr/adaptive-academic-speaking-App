import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { POST } from "../src/app/api/podchat/tts/route";

const originalAccessKey = process.env.AWS_ACCESS_KEY_ID;
const originalSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
const originalRegion = process.env.AWS_REGION;
const originalVoice = process.env.POLLY_VOICE_ID;
const originalEngine = process.env.POLLY_ENGINE;
const originalFetch = globalThis.fetch;

function buildRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/podchat/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: "This is a short AI host response.",
      ...body,
    }),
  });
}

function buildMalformedJsonRequest(): Request {
  return new Request("http://localhost/api/podchat/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "not-json",
  });
}

function configureAwsEnv(overrides: Record<string, string | undefined> = {}) {
  process.env.AWS_ACCESS_KEY_ID = overrides.AWS_ACCESS_KEY_ID ?? "test-access";
  process.env.AWS_SECRET_ACCESS_KEY = overrides.AWS_SECRET_ACCESS_KEY ?? "test-secret";
  process.env.AWS_REGION = overrides.AWS_REGION ?? "eu-west-2";
  process.env.POLLY_VOICE_ID = overrides.POLLY_VOICE_ID ?? "Brian";
  process.env.POLLY_ENGINE = overrides.POLLY_ENGINE ?? "neural";
}

function clearAwsEnv() {
  process.env.AWS_ACCESS_KEY_ID = "";
  process.env.AWS_SECRET_ACCESS_KEY = "";
  process.env.AWS_REGION = "";
  process.env.POLLY_VOICE_ID = "";
  process.env.POLLY_ENGINE = "";
}

function mockPollyResponse(
  status: number,
  body: string | Uint8Array,
  capture: { url?: string; headers?: Headers; body?: Record<string, unknown> } = {},
) {
  globalThis.fetch = (async (url, init) => {
    capture.url = String(url);
    capture.headers = new Headers(init?.headers);
    if (init && typeof init.body === "string") {
      capture.body = JSON.parse(init.body) as Record<string, unknown>;
    }

    let responseBody: BodyInit;
    if (typeof body === "string") {
      responseBody = body;
    } else {
      const copy = new ArrayBuffer(body.byteLength);
      new Uint8Array(copy).set(body);
      responseBody = copy;
    }
    return new Response(responseBody, {
      status,
      headers: {
        "content-type": status === 200 ? "audio/mpeg" : "application/json",
      },
    });
  }) as typeof fetch;
}

test.describe("Podchat TTS Route", () => {
  test.afterEach(() => {
    process.env.AWS_ACCESS_KEY_ID = originalAccessKey;
    process.env.AWS_SECRET_ACCESS_KEY = originalSecretKey;
    process.env.AWS_REGION = originalRegion;
    process.env.POLLY_VOICE_ID = originalVoice;
    process.env.POLLY_ENGINE = originalEngine;
    globalThis.fetch = originalFetch;
  });

  test("valid text returns audio/mpeg", async () => {
    configureAwsEnv();
    mockPollyResponse(200, new Uint8Array([1, 2, 3]));

    const response = await POST(buildRequest({}));
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  test("omitted voice uses env voice when valid", async () => {
    const capture: { body?: Record<string, unknown> } = {};
    configureAwsEnv({ POLLY_VOICE_ID: "Amy" });
    mockPollyResponse(200, new Uint8Array([4]), capture);

    const response = await POST(buildRequest({}));

    expect(response.status).toBe(200);
    expect(capture.body?.VoiceId).toBe("Amy");
  });

  test("omitted voice falls back to Brian when env voice is invalid", async () => {
    const capture: { body?: Record<string, unknown> } = {};
    configureAwsEnv({ POLLY_VOICE_ID: "Joanna" });
    mockPollyResponse(200, new Uint8Array([5]), capture);

    const response = await POST(buildRequest({}));

    expect(response.status).toBe(200);
    expect(capture.body?.VoiceId).toBe("Brian");
  });

  for (const voice of ["Brian", "Amy", "Emma"] as const) {
    test(`${voice} voice is accepted`, async () => {
      const capture: { body?: Record<string, unknown> } = {};
      configureAwsEnv();
      mockPollyResponse(200, new Uint8Array([6]), capture);

      const response = await POST(buildRequest({ voice }));

      expect(response.status).toBe(200);
      expect(capture.body?.VoiceId).toBe(voice);
    });
  }

  test("invalid voice rejects with 400", async () => {
    configureAwsEnv();
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response("should not be called", { status: 500 });
    }) as typeof fetch;

    const response = await POST(buildRequest({ voice: "Joanna" }));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(data.error).toContain("voice");
    expect(fetchCalled).toBe(false);
  });

  test("malformed JSON rejects with 400", async () => {
    configureAwsEnv();
    const response = await POST(buildMalformedJsonRequest());
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(data.error).toContain("valid JSON");
  });

  test("empty text rejects with 400", async () => {
    configureAwsEnv();
    const response = await POST(buildRequest({ text: " " }));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(data.error).toContain("text");
  });

  test("oversized text rejects with 400", async () => {
    configureAwsEnv();
    const response = await POST(buildRequest({ text: "a".repeat(701) }));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(data.error).toContain("700");
  });

  test("missing AWS env returns sanitized 503", async () => {
    clearAwsEnv();
    const response = await POST(buildRequest({}));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(data.error).toBe(
      "Text-to-speech is not configured. Please try again later.",
    );
  });

  test("AWS failure returns sanitized 502", async () => {
    configureAwsEnv();
    mockPollyResponse(500, JSON.stringify({ secret: "raw aws detail" }));

    const response = await POST(buildRequest({}));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(data.error).toBe(
      "Text-to-speech request failed. Please try again later.",
    );
    expect(data.error).not.toMatch(/aws|secret|raw/i);
  });

  test("request to Polly contains only host text synthesis fields", async () => {
    const capture: {
      url?: string;
      headers?: Headers;
      body?: Record<string, unknown>;
    } = {};
    configureAwsEnv();
    mockPollyResponse(200, new Uint8Array([7]), capture);

    const response = await POST(buildRequest({ text: "Host text only." }));
    const serializedBody = JSON.stringify(capture.body);
    const authorization = capture.headers?.get("authorization") ?? "";

    expect(response.status).toBe(200);
    expect(capture.url).toBe("https://polly.eu-west-2.amazonaws.com/v1/speech");
    expect(capture.body).toEqual({
      Engine: "neural",
      OutputFormat: "mp3",
      Text: "Host text only.",
      VoiceId: "Brian",
    });
    expect(authorization).toContain("AWS4-HMAC-SHA256");
    expect(authorization).not.toContain("test-secret");
    expect(serializedBody).not.toMatch(
      /learner|transcript|userId|email|auth|device|microphone|MediaRecorder|audioBlob|recordingUrl|Supabase|score|pronunciation|phoneme/i,
    );
  });

  test("response does not expose AWS internals or keys", async () => {
    configureAwsEnv();
    mockPollyResponse(
      403,
      JSON.stringify({
        accessKey: "test-access",
        secret: "test-secret",
        stack: "internal stack",
      }),
    );

    const response = await POST(buildRequest({}));
    const serialized = JSON.stringify(await response.json());

    expect(serialized).not.toContain("test-access");
    expect(serialized).not.toContain("test-secret");
    expect(serialized).not.toMatch(/stack|internal/i);
  });

  test("route source contains no user audio, STT, storage, upload, or scoring behavior", () => {
    const source = readFileSync("src/app/api/podchat/tts/route.ts", "utf8");
    const forbidden = [
      "speechToText",
      "MediaRecorder",
      "getUserMedia",
      "createClient",
      "Supabase",
      "localStorage",
      "recordingUrl",
      "audioBlob",
      "upload",
      "pronunciation",
      "phoneme",
      "score",
    ];

    for (const term of forbidden) {
      expect(source).not.toContain(term);
    }
  });
});
