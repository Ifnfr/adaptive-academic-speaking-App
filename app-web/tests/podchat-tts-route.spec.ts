import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { POST } from "../src/app/api/podchat/tts/route";

const originalAccessKey = process.env.AWS_ACCESS_KEY_ID;
const originalSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
const originalRegion = process.env.AWS_REGION;
const originalProvider = process.env.TTS_PROVIDER;
const originalLegacyProvider = process.env.PODCHAT_TTS_PROVIDER;
const originalVoiceProfile = process.env.AMAZON_POLLY_DEFAULT_VOICE_PROFILE;
const originalOutputFormat = process.env.AMAZON_POLLY_OUTPUT_FORMAT;
const originalSampleRate = process.env.AMAZON_POLLY_SAMPLE_RATE;
const originalElevenLabsKey = process.env.ELEVENLABS_API_KEY;
const originalElevenLabsVoice = process.env.ELEVENLABS_VOICE_ID;
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
  process.env.AMAZON_POLLY_DEFAULT_VOICE_PROFILE =
    overrides.AMAZON_POLLY_DEFAULT_VOICE_PROFILE ?? "british_female";
  process.env.AMAZON_POLLY_OUTPUT_FORMAT =
    overrides.AMAZON_POLLY_OUTPUT_FORMAT ?? "mp3";
  process.env.AMAZON_POLLY_SAMPLE_RATE =
    overrides.AMAZON_POLLY_SAMPLE_RATE ?? "24000";
}

function clearAwsEnv() {
  process.env.AWS_ACCESS_KEY_ID = "";
  process.env.AWS_SECRET_ACCESS_KEY = "";
  process.env.AWS_REGION = "";
  process.env.AMAZON_POLLY_DEFAULT_VOICE_PROFILE = "";
  process.env.AMAZON_POLLY_OUTPUT_FORMAT = "";
  process.env.AMAZON_POLLY_SAMPLE_RATE = "";
}

function configureElevenLabsEnv(
  overrides: Record<string, string | undefined> = {},
) {
  process.env.ELEVENLABS_API_KEY =
    overrides.ELEVENLABS_API_KEY ?? "test-el-key";
  process.env.ELEVENLABS_VOICE_ID =
    overrides.ELEVENLABS_VOICE_ID ?? "test-voice-id";
}

function clearElevenLabsEnv() {
  process.env.ELEVENLABS_API_KEY = "";
  process.env.ELEVENLABS_VOICE_ID = "";
}

function mockElevenLabsResponse(
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
    process.env.TTS_PROVIDER = originalProvider;
    process.env.PODCHAT_TTS_PROVIDER = originalLegacyProvider;
    process.env.AMAZON_POLLY_DEFAULT_VOICE_PROFILE = originalVoiceProfile;
    process.env.AMAZON_POLLY_OUTPUT_FORMAT = originalOutputFormat;
    process.env.AMAZON_POLLY_SAMPLE_RATE = originalSampleRate;
    process.env.ELEVENLABS_API_KEY = originalElevenLabsKey;
    process.env.ELEVENLABS_VOICE_ID = originalElevenLabsVoice;
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

  test("omitted voiceProfile uses configured default profile", async () => {
    const capture: { body?: Record<string, unknown> } = {};
    configureAwsEnv({ AMAZON_POLLY_DEFAULT_VOICE_PROFILE: "american_male" });
    mockPollyResponse(200, new Uint8Array([4]), capture);

    const response = await POST(buildRequest({}));

    expect(response.status).toBe(200);
    expect(capture.body?.VoiceId).toBe("Stephen");
  });

  test("omitted voiceProfile falls back to british_female when env profile is invalid", async () => {
    const capture: { body?: Record<string, unknown> } = {};
    configureAwsEnv({ AMAZON_POLLY_DEFAULT_VOICE_PROFILE: "invalid_profile" });
    mockPollyResponse(200, new Uint8Array([5]), capture);

    const response = await POST(buildRequest({}));

    expect(response.status).toBe(200);
    expect(capture.body?.VoiceId).toBe("Amy");
  });

  const voiceProfiles = [
    ["british_female", "Amy", "en-GB"],
    ["british_male", "Arthur", "en-GB"],
    ["american_female", "Danielle", "en-US"],
    ["american_male", "Stephen", "en-US"],
  ] as const;

  for (const [voiceProfile, voiceId, languageCode] of voiceProfiles) {
    test(`amazon-polly ${voiceProfile} maps to ${voiceId}`, async () => {
      const capture: { body?: Record<string, unknown> } = {};
      configureAwsEnv();
      mockPollyResponse(200, new Uint8Array([6]), capture);

      const response = await POST(buildRequest({ ttsProvider: "amazon-polly", voiceProfile }));

      expect(response.status).toBe(200);
      expect(capture.body?.VoiceId).toBe(voiceId);
      expect(capture.body?.LanguageCode).toBe(languageCode);
      expect(capture.body?.Engine).toBe("neural");
    });
  }

  test("invalid voiceProfile rejects safely with 400", async () => {
    configureAwsEnv();
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response("should not be called", { status: 500 });
    }) as typeof fetch;

    const response = await POST(buildRequest({ ttsProvider: "amazon-polly", voiceProfile: "joanna" }));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(data.error).toBe("invalid_tts_voice_profile");
    expect(fetchCalled).toBe(false);
  });

  test("client VoiceId is rejected even when it looks valid", async () => {
    configureAwsEnv();
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response("should not be called", { status: 500 });
    }) as typeof fetch;

    const response = await POST(buildRequest({ ttsProvider: "amazon-polly", voice: "Amy" }));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(data.error).toBe("invalid_tts_voice_profile");
    expect(fetchCalled).toBe(false);
  });

  test("malformed JSON rejects with 400", async () => {
    configureAwsEnv();
    const response = await POST(buildMalformedJsonRequest());
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(data.error).toBe("invalid_tts_input");
  });

  test("empty text rejects with 400", async () => {
    configureAwsEnv();
    const response = await POST(buildRequest({ text: " " }));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(data.error).toBe("invalid_tts_input");
  });

  test("oversized text rejects with 400", async () => {
    configureAwsEnv();
    const response = await POST(buildRequest({ text: "a".repeat(701) }));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(data.error).toBe("invalid_tts_input");
  });

  test("missing AWS env returns sanitized 503", async () => {
    clearAwsEnv();
    const response = await POST(buildRequest({}));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(data.error).toBe("tts_unavailable");
  });

  test("AWS failure returns sanitized 502", async () => {
    configureAwsEnv();
    mockPollyResponse(500, JSON.stringify({ secret: "raw aws detail" }));

    const response = await POST(buildRequest({}));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(data.error).toBe("tts_provider_error");
    expect(data.error).not.toMatch(/aws|secret|raw/i);
  });

  test("missing Polly audio stream returns safe provider error", async () => {
    configureAwsEnv();
    mockPollyResponse(200, new Uint8Array([]));

    const response = await POST(buildRequest({ ttsProvider: "amazon-polly" }));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(data.error).toBe("tts_provider_error");
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
      LanguageCode: "en-GB",
      OutputFormat: "mp3",
      SampleRate: "24000",
      Text: "Host text only.",
      VoiceId: "Amy",
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

  // ---------------------------------------------------------------------------
  // ElevenLabs provider tests
  // ---------------------------------------------------------------------------

  test("amazon-polly provider (explicit) returns audio/mpeg", async () => {
    configureAwsEnv();
    mockPollyResponse(200, new Uint8Array([10, 20, 30]));

    const response = await POST(
      buildRequest({ ttsProvider: "amazon-polly", voiceProfile: "british_female" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
  });

  test("legacy polly provider alias still returns audio/mpeg", async () => {
    configureAwsEnv();
    mockPollyResponse(200, new Uint8Array([11, 22, 33]));

    const response = await POST(
      buildRequest({ ttsProvider: "polly", voiceProfile: "british_female" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
  });

  test("invalid ttsProvider falls back safely to amazon-polly", async () => {
    configureAwsEnv();
    mockPollyResponse(200, new Uint8Array([11, 22, 33]));

    const response = await POST(buildRequest({ ttsProvider: "GoogleCloud" }));
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(Array.from(bytes)).toEqual([11, 22, 33]);
  });

  test("ElevenLabs provider returns audio/mpeg", async () => {
    configureElevenLabsEnv();
    mockElevenLabsResponse(200, new Uint8Array([40, 50, 60]));

    const response = await POST(
      buildRequest({ ttsProvider: "elevenlabs", elevenLabsModelId: "eleven_flash_v2_5" }),
    );
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(Array.from(bytes)).toEqual([40, 50, 60]);
  });

  test("ElevenLabs missing model returns safe 503", async () => {
    configureElevenLabsEnv();
    const response = await POST(
      buildRequest({ ttsProvider: "elevenlabs", elevenLabsModelId: undefined }),
    );
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(data.error).toBe("tts_unavailable");
  });

  test("ElevenLabs invalid model returns safe 503", async () => {
    configureElevenLabsEnv();
    const response = await POST(
      buildRequest({ ttsProvider: "elevenlabs", elevenLabsModelId: "invalid_model" }),
    );
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(data.error).toBe("tts_unavailable");
  });

  test("ElevenLabs does not fallback to ELEVENLABS_MODEL_ID", async () => {
    const originalModelEnv = process.env.ELEVENLABS_MODEL_ID;
    try {
      process.env.ELEVENLABS_MODEL_ID = "eleven_flash_v2_5";
      configureElevenLabsEnv();
      const response = await POST(
        buildRequest({ ttsProvider: "elevenlabs", elevenLabsModelId: undefined }),
      );
      const data = (await response.json()) as { error: string };

      expect(response.status).toBe(503);
      expect(data.error).toBe("tts_unavailable");
    } finally {
      process.env.ELEVENLABS_MODEL_ID = originalModelEnv;
    }
  });

  test("ElevenLabs missing env returns sanitized 503", async () => {
    clearElevenLabsEnv();
    const response = await POST(
      buildRequest({ ttsProvider: "elevenlabs", elevenLabsModelId: "eleven_flash_v2_5" }),
    );
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(data.error).toBe("tts_unavailable");
  });

  test("ElevenLabs upstream failure returns sanitized 502", async () => {
    configureElevenLabsEnv();
    mockElevenLabsResponse(
      500,
      JSON.stringify({ secret: "raw elevenlabs detail" }),
    );

    const response = await POST(
      buildRequest({ ttsProvider: "elevenlabs", elevenLabsModelId: "eleven_flash_v2_5" }),
    );
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(data.error).toBe("tts_provider_error");
    expect(data.error).not.toMatch(/elevenlabs|secret|raw/i);
  });

  test("ElevenLabs request uses xi-api-key auth header", async () => {
    const capture: {
      url?: string;
      headers?: Headers;
      body?: Record<string, unknown>;
    } = {};
    configureElevenLabsEnv();
    mockElevenLabsResponse(200, new Uint8Array([70]), capture);

    const response = await POST(
      buildRequest({ ttsProvider: "elevenlabs", elevenLabsModelId: "eleven_flash_v2_5", text: "ElevenLabs host text." }),
    );

    expect(response.status).toBe(200);
    expect(capture.url).toContain("api.elevenlabs.io");
    expect(capture.url).toContain("test-voice-id");
    expect(capture.body?.model_id).toBe("eleven_flash_v2_5");
    const xiKey = capture.headers?.get("xi-api-key") ?? "";
    expect(xiKey).toBe("test-el-key");
    // Raw key must never appear in the response
    const responseText = JSON.stringify(await response.arrayBuffer());
    expect(responseText).not.toContain("test-el-key");
  });

  test("ElevenLabs response does not expose API key or voice ID in error", async () => {
    configureElevenLabsEnv();
    mockElevenLabsResponse(
      403,
      JSON.stringify({
        apiKey: "test-el-key",
        voiceId: "test-voice-id",
        stack: "internal detail",
      }),
    );

    const response = await POST(
      buildRequest({ ttsProvider: "elevenlabs", elevenLabsModelId: "eleven_flash_v2_5" }),
    );
    const serialized = JSON.stringify(await response.json());

    expect(serialized).not.toContain("test-el-key");
    expect(serialized).not.toContain("test-voice-id");
    expect(serialized).not.toMatch(/stack|internal/i);
  });

  test("uses env fallback when request ttsProvider is missing or invalid", async () => {
    const originalFallback = process.env.TTS_PROVIDER;
    try {
      process.env.TTS_PROVIDER = "elevenlabs";
      configureElevenLabsEnv();
      mockElevenLabsResponse(200, new Uint8Array([8, 9]));

      const response = await POST(buildRequest({ ttsProvider: undefined, elevenLabsModelId: "eleven_flash_v2_5" }));
      const bytes = new Uint8Array(await response.arrayBuffer());

      expect(response.status).toBe(200);
      expect(Array.from(bytes)).toEqual([8, 9]);
    } finally {
      process.env.TTS_PROVIDER = originalFallback;
    }
  });

  test(".env.example contains only placeholders", () => {
    const envExample = readFileSync(".env.example", "utf8");
    expect(envExample).not.toMatch(/sk-[a-zA-Z0-9]{32,}/);
    expect(envExample).toContain("TTS_PROVIDER=amazon-polly");
    expect(envExample).toContain("AWS_ACCESS_KEY_ID=");
    expect(envExample).toContain("AMAZON_POLLY_DEFAULT_VOICE_PROFILE=british_female");
    expect(envExample).toContain("ELEVENLABS_API_KEY=");
  });
});

test.describe("Podchat TTS Browser Integration", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (
        url.pathname === "/" &&
        !url.searchParams.has("mockAuth") &&
        route.request().resourceType() === "document"
      ) {
        url.searchParams.set("mockAuth", "true");
        await route.fulfill({
          status: 302,
          headers: { location: url.toString() },
        });
        return;
      }

      await route.continue();
    });

    await page.addInitScript(() => {
      class MockMediaStreamTrack {
        kind = "audio";
        enabled = true;
        stop() {}
      }
      class MockMediaStream {
        getTracks() {
          return [new MockMediaStreamTrack()];
        }
      }
      const mediaDevices = {
        async getUserMedia() {
          return new MockMediaStream();
        },
      };
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: mediaDevices,
      });

      class MockMediaRecorder {
        state = "inactive";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        static isTypeSupported(type: string) {
          return ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg"].includes(type);
        }
        start() {
          this.state = "recording";
        }
        stop() {
          this.state = "inactive";
          if (this.ondataavailable) {
            const mockBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
            this.ondataavailable({ data: mockBlob });
          }
          if (this.onstop) {
            setTimeout(() => {
              if (this.onstop) this.onstop();
            }, 0);
          }
        }
      }
      (window as unknown as { MediaRecorder: unknown }).MediaRecorder = MockMediaRecorder;

      (window as unknown as { Audio: unknown }).Audio = function () {
        return {
          play: async () => Promise.resolve(),
          pause: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
        };
      };
    });

    await page.route("**/api/podchat/stt", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ transcript: "Hello host." }),
      });
    });

    await page.route("**/api/podchat/turn", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          hostText: "This is a response.",
          followUpQuestion: "Any questions?",
        }),
      });
    });

    await page.route("**/api/podchat/start", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          opener: "Let's discuss technology. How do you think technology changes learning?",
          sessionPlan: {
            topicAngle: "how tech impacts learning",
            targetSkill: "providing reasons/examples",
            followUpStrategy: "ask about details or downsides"
          }
        })
      });
    });
  });

  test("Settings saves canonical lowercase provider to localStorage and does not expose keys", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("API Key");
    expect(page.locator("input[placeholder*='ElevenLabs']")).toHaveCount(0);
    expect(page.locator("input[placeholder*='elevenlabs']")).toHaveCount(0);

    const select = page.locator("#default-tts-provider-select");
    await select.selectOption("elevenlabs");

    const stored = await page.evaluate(() => localStorage.getItem("defaultTtsProvider"));
    expect(stored).toBe("elevenlabs");

    await expect(select).toHaveValue("elevenlabs");

    const hasKeys = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || "";
        if (key.toLowerCase().includes("api") || key.toLowerCase().includes("key")) return true;
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i) || "";
        if (key.toLowerCase().includes("api") || key.toLowerCase().includes("key")) return true;
      }
      return false;
    });
    expect(hasKeys).toBe(false);
  });

  test("Invalid localStorage defaultTtsProvider sanitizes to amazon-polly", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("defaultTtsProvider", "GoogleCloud");
    });
    await page.reload();
    await page.waitForTimeout(100);

    const stored = await page.evaluate(() => localStorage.getItem("defaultTtsProvider"));
    expect(stored).toBe("amazon-polly");
  });

  test("Amazon Polly voice profiles render, persist, and default safely", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();

    const providerSelect = page.locator("#default-tts-provider-select");
    await expect(providerSelect).toHaveValue("amazon-polly");

    const profileSelect = page.locator("#default-tts-voice-profile-select");
    await expect(profileSelect).toBeVisible();
    await expect(profileSelect).toHaveValue("british_female");

    await expect(profileSelect.locator("option")).toHaveText([
      "British Female",
      "British Male",
      "American Female",
      "American Male",
    ]);

    for (const profile of ["british_female", "british_male", "american_female", "american_male"] as const) {
      await profileSelect.selectOption(profile);
      const storedProfile = await page.evaluate(() => localStorage.getItem("defaultTtsVoiceProfile"));
      expect(storedProfile).toBe(profile);
      await expect(profileSelect).toHaveValue(profile);
    }

    await page.evaluate(() => {
      localStorage.setItem("defaultTtsVoiceProfile", "Joanna");
    });
    await page.reload();
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.locator("#default-tts-voice-profile-select")).toHaveValue("british_female");
    const storedProfile = await page.evaluate(() => localStorage.getItem("defaultTtsVoiceProfile"));
    expect(storedProfile).toBe("british_female");
  });

  test("Podchat TTS request sends canonical provider value", async ({ page }) => {
    let requestPayload: { ttsProvider?: string; elevenLabsModelId?: string } | null = null;
    await page.route("**/api/podchat/tts", async (route) => {
      requestPayload = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 200,
        contentType: "audio/mpeg",
        body: Buffer.from([1, 2, 3]),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.locator("#default-tts-provider-select").selectOption("elevenlabs");
    await page.locator("#default-elevenlabs-model-select").selectOption("eleven_flash_v2_5");

    await page.getByRole("button", { name: "Active Session" }).click();
    await page.getByRole("button", { name: "Start a Podchat" }).click();

    // Trigger turn submission to fire TTS
    await page.getByTestId("podchat-start-recording").click();
    await page.getByTestId("podchat-stop-recording").click();
    await page.getByTestId("podchat-submit-turn").click();

    // Wait for requestPayload to populate
    await expect.poll(() => requestPayload).not.toBeNull();

    const payload = requestPayload as unknown as { ttsProvider?: string; elevenLabsModelId?: string };
    expect(payload.ttsProvider).toBe("elevenlabs");
    expect(payload.elevenLabsModelId).toBe("eleven_flash_v2_5");
  });

  test("Settings renders TTS Provider Status and handles checking", async ({ page }) => {
    await page.route("**/api/provider-status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          providers: {
            Claude: { configured: true },
            Gemini: { configured: false },
            DeepSeek: { configured: false }
          },
          ttsProviders: {
            Polly: { configured: true },
            ElevenLabs: { configured: false }
          }
        }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();

    // Click check status inside settings
    await page.getByRole("button", { name: "Check Status" }).first().click();

    // Verify it renders the status
    await expect(page.getByTestId("tts-status-polly")).toContainText("AWS Polly");
    await expect(page.getByTestId("tts-status-polly")).toContainText("Configured");
    await expect(page.getByTestId("tts-status-elevenlabs")).toContainText("ElevenLabs");
    await expect(page.getByTestId("tts-status-elevenlabs")).toContainText("Missing");

    // Explain text must be rendered
    await expect(page.locator("body")).toContainText(
      "This checks whether server-side voice provider credentials are present. It does not validate quota, billing, or provider availability."
    );
  });

  test("ElevenLabs Model selector is rendered with Recommended label, saves to localStorage, and sanitizes invalid values", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();

    const providerSelect = page.locator("#default-tts-provider-select");
    await providerSelect.selectOption("elevenlabs");

    const modelSelect = page.locator("#default-elevenlabs-model-select");
    await expect(modelSelect).toBeVisible();

    // Check default is empty if localStorage is empty
    await expect(modelSelect).toHaveValue("");

    // Check eleven_flash_v2_5 shows "Recommended"
    const recommendedOption = page.locator("#default-elevenlabs-model-select option[value='eleven_flash_v2_5']");
    await expect(recommendedOption).toContainText("Recommended");

    // Selecting a model stores allowed model ID in localStorage
    await modelSelect.selectOption("eleven_flash_v2_5");
    let storedModel = await page.evaluate(() => localStorage.getItem("defaultElevenLabsModel"));
    expect(storedModel).toBe("eleven_flash_v2_5");

    // Invalid localStorage model value sanitizes to empty/unset
    await page.evaluate(() => {
      localStorage.setItem("defaultElevenLabsModel", "invalid_model_name");
    });
    await page.reload();
    await page.waitForTimeout(100);
    storedModel = await page.evaluate(() => localStorage.getItem("defaultElevenLabsModel"));
    expect(storedModel).toBeNull(); // sanitized/removed

    await page.getByRole("button", { name: "Settings" }).click();
    await providerSelect.selectOption("elevenlabs");
    await expect(modelSelect).toHaveValue("");
  });

  test("Podchat sends selected voiceProfile for Amazon Polly", async ({ page }) => {
    let requestPayload: { ttsProvider?: string; elevenLabsModelId?: string; voiceProfile?: string } | null = null;
    await page.route("**/api/podchat/tts", async (route) => {
      requestPayload = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 200,
        contentType: "audio/mpeg",
        body: Buffer.from([1, 2, 3]),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.locator("#default-tts-provider-select").selectOption("amazon-polly");
    await page.locator("#default-tts-voice-profile-select").selectOption("american_male");

    await page.getByRole("button", { name: "Active Session" }).click();
    await page.getByRole("button", { name: "Start a Podchat" }).click();

    // Trigger turn submission to fire TTS
    await page.getByTestId("podchat-start-recording").click();
    await page.getByTestId("podchat-stop-recording").click();
    await page.getByTestId("podchat-submit-turn").click();

    // Wait for requestPayload to populate
    await expect.poll(() => requestPayload).not.toBeNull();
    expect(requestPayload!.ttsProvider).toBe("amazon-polly");
    expect(requestPayload!.voiceProfile).toBe("american_male");
    expect(requestPayload!.elevenLabsModelId).toBeUndefined();
  });
});
