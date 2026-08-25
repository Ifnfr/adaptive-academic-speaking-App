import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import {
  ELEVENLABS_MODEL_IDS,
  ELEVENLABS_VOICE_CATALOG,
  isElevenLabsVoiceId,
  resolveElevenLabsModelId,
  resolveElevenLabsVoiceId,
  resolveTtsProvider,
} from "../src/app/lib/tts/voiceProfiles";
import {
  getElevenLabsCredentials,
  synthesizeWithElevenLabs,
} from "../src/app/lib/tts/elevenlabs";

const originalElKey = process.env.ELEVENLABS_API_KEY;
const originalElVoice = process.env.ELEVENLABS_VOICE_ID;
const originalElModel = process.env.ELEVENLABS_MODEL_ID;
const originalTtsProvider = process.env.TTS_PROVIDER;
const originalPodchatTtsProvider = process.env.PODCHAT_TTS_PROVIDER;
const originalFetch = globalThis.fetch;

test.describe("Listening TTS provider selection", () => {
  test.beforeEach(() => {
    // Hermetic: strip ambient env so precedence tests only see what they pass.
    delete process.env.TTS_PROVIDER;
    delete process.env.PODCHAT_TTS_PROVIDER;
    delete process.env.ELEVENLABS_MODEL_ID;
  });

  test.afterEach(() => {
    process.env.ELEVENLABS_API_KEY = originalElKey;
    process.env.ELEVENLABS_VOICE_ID = originalElVoice;
    process.env.ELEVENLABS_MODEL_ID = originalElModel;
    process.env.TTS_PROVIDER = originalTtsProvider;
    process.env.PODCHAT_TTS_PROVIDER = originalPodchatTtsProvider;
    globalThis.fetch = originalFetch;
  });

  // ---------------------------------------------------------------------------
  // resolveTtsProvider — shared precedence chain (mirrors /api/podchat/tts)
  // ---------------------------------------------------------------------------

  test("explicit elevenlabs wins over Polly env", () => {
    expect(
      resolveTtsProvider("elevenlabs", { TTS_PROVIDER: "amazon-polly" }),
    ).toBe("elevenlabs");
  });

  test("explicit provider is case-insensitive and trimmed", () => {
    expect(resolveTtsProvider("  ElevenLabs ")).toBe("elevenlabs");
    expect(resolveTtsProvider("AMAZON-POLLY")).toBe("amazon-polly");
  });

  test("invalid explicit provider falls back safely to amazon-polly", () => {
    expect(resolveTtsProvider("GoogleCloud")).toBe("amazon-polly");
  });

  test("empty explicit provider defers to env", () => {
    expect(resolveTtsProvider("", { TTS_PROVIDER: "elevenlabs" })).toBe("elevenlabs");
  });

  test("no explicit provider: TTS_PROVIDER env selects elevenlabs", () => {
    expect(resolveTtsProvider(undefined, { TTS_PROVIDER: "elevenlabs" })).toBe("elevenlabs");
  });

  test("no explicit provider: legacy PODCHAT_TTS_PROVIDER selects elevenlabs", () => {
    expect(
      resolveTtsProvider(undefined, { PODCHAT_TTS_PROVIDER: "elevenlabs" }),
    ).toBe("elevenlabs");
  });

  test("TTS_PROVIDER takes precedence over legacy PODCHAT_TTS_PROVIDER", () => {
    expect(
      resolveTtsProvider(undefined, {
        TTS_PROVIDER: "amazon-polly",
        PODCHAT_TTS_PROVIDER: "elevenlabs",
      }),
    ).toBe("amazon-polly");
    expect(
      resolveTtsProvider(undefined, {
        TTS_PROVIDER: "elevenlabs",
        PODCHAT_TTS_PROVIDER: "amazon-polly",
      }),
    ).toBe("elevenlabs");
  });

  test("no signals at all defaults to amazon-polly", () => {
    expect(resolveTtsProvider(undefined, {})).toBe("amazon-polly");
  });

  // ---------------------------------------------------------------------------
  // resolveElevenLabsModelId — request allow-list, then env fallback
  // ---------------------------------------------------------------------------

  for (const modelId of ELEVENLABS_MODEL_IDS) {
    test(`allowed request model passes through verbatim (${modelId})`, () => {
      expect(resolveElevenLabsModelId(modelId)).toBe(modelId);
    });
  }

  test("disallowed request model falls back to ELEVENLABS_MODEL_ID env", () => {
    const prev = process.env.ELEVENLABS_MODEL_ID;
    try {
      process.env.ELEVENLABS_MODEL_ID = "eleven_flash_v2_5";
      expect(resolveElevenLabsModelId("invalid_model")).toBe("eleven_flash_v2_5");
    } finally {
      process.env.ELEVENLABS_MODEL_ID = prev;
    }
  });

  test("missing request model with no env returns null", () => {
    const prev = process.env.ELEVENLABS_MODEL_ID;
    try {
      process.env.ELEVENLABS_MODEL_ID = "";
      expect(resolveElevenLabsModelId(undefined)).toBeNull();
      expect(resolveElevenLabsModelId("")).toBeNull();
    } finally {
      process.env.ELEVENLABS_MODEL_ID = prev;
    }
  });
});

// ---------------------------------------------------------------------------
// ElevenLabs voice catalog + per-request voice resolution
// ---------------------------------------------------------------------------

test.describe("ElevenLabs voice catalog", () => {
  test.beforeEach(() => {
    delete process.env.ELEVENLABS_VOICE_ID;
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_MODEL_ID;
  });

  test.afterEach(() => {
    process.env.ELEVENLABS_VOICE_ID = originalElVoice;
  });

  test("catalog includes both approved voices with labels", () => {
    expect(Object.keys(ELEVENLABS_VOICE_CATALOG).sort()).toEqual([
      "BIvP0GN1cAtSRTxNHnWS",
      "lUTamkMw7gOzZbFIwmq4",
    ]);
    expect(ELEVENLABS_VOICE_CATALOG.BIvP0GN1cAtSRTxNHnWS.label).toContain("Ellen");
    expect(ELEVENLABS_VOICE_CATALOG.lUTamkMw7gOzZbFIwmq4.label).toContain("James");
  });

  test("isElevenLabsVoiceId accepts only catalog ids", () => {
    expect(isElevenLabsVoiceId("BIvP0GN1cAtSRTxNHnWS")).toBe(true);
    expect(isElevenLabsVoiceId("lUTamkMw7gOzZbFIwmq4")).toBe(true);
    expect(isElevenLabsVoiceId("random-voice-id")).toBe(false);
    expect(isElevenLabsVoiceId(undefined)).toBe(false);
    expect(isElevenLabsVoiceId("")).toBe(false);
  });

  test("resolveElevenLabsVoiceId: request wins, then env, then null", () => {
    expect(resolveElevenLabsVoiceId("BIvP0GN1cAtSRTxNHnWS")).toBe(
      "BIvP0GN1cAtSRTxNHnWS",
    );
    // Non-catalog request values are rejected even when env has a default.
    process.env.ELEVENLABS_VOICE_ID = "lUTamkMw7gOzZbFIwmq4";
    expect(resolveElevenLabsVoiceId("random-voice-id")).toBe("lUTamkMw7gOzZbFIwmq4");

    process.env.ELEVENLABS_VOICE_ID = "";
    expect(resolveElevenLabsVoiceId(undefined)).toBeNull();
  });
});

test.describe("Listening TTS synthesis helper", () => {
  function mockFetch(
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
        headers: { "content-type": status === 200 ? "audio/mpeg" : "application/json" },
      });
    }) as typeof fetch;
  }

  function configureElEnv(overrides: Record<string, string> = {}) {
    process.env.ELEVENLABS_API_KEY = overrides.ELEVENLABS_API_KEY ?? "test-el-key";
    process.env.ELEVENLABS_VOICE_ID = overrides.ELEVENLABS_VOICE_ID ?? "test-voice-id";
  }

  test.afterEach(() => {
    process.env.ELEVENLABS_API_KEY = originalElKey;
    process.env.ELEVENLABS_VOICE_ID = originalElVoice;
    globalThis.fetch = originalFetch;
  });

  test("getElevenLabsCredentials: only the API key is mandatory", () => {
    const prevKey = process.env.ELEVENLABS_API_KEY;
    const prevVoice = process.env.ELEVENLABS_VOICE_ID;
    try {
      process.env.ELEVENLABS_API_KEY = "";
      process.env.ELEVENLABS_VOICE_ID = "v";
      expect(getElevenLabsCredentials()).toBeNull();

      // Voice may be empty at credential level — callers can pass one per request.
      process.env.ELEVENLABS_API_KEY = "k";
      process.env.ELEVENLABS_VOICE_ID = "  ";
      expect(getElevenLabsCredentials()).toEqual({ apiKey: "k", voiceId: "" });

      process.env.ELEVENLABS_API_KEY = "  k  ";
      process.env.ELEVENLABS_VOICE_ID = " v ";
      expect(getElevenLabsCredentials()).toEqual({ apiKey: "k", voiceId: "v" });
    } finally {
      process.env.ELEVENLABS_API_KEY = prevKey;
      process.env.ELEVENLABS_VOICE_ID = prevVoice;
    }
  });

  test("no voice from any source yields missing_config instead of a bad URL", async () => {
    const prevKey = process.env.ELEVENLABS_API_KEY;
    const prevVoice = process.env.ELEVENLABS_VOICE_ID;
    try {
      process.env.ELEVENLABS_API_KEY = "k";
      process.env.ELEVENLABS_VOICE_ID = "";
      let fetchCalled = false;
      globalThis.fetch = (async () => {
        fetchCalled = true;
        return new Response("should not be called", { status: 500 });
      }) as typeof fetch;

      const result = await synthesizeWithElevenLabs("text", { modelId: "eleven_flash_v2_5" });

      expect(result).toEqual({ ok: false, reason: "missing_config" });
      expect(fetchCalled).toBe(false);
    } finally {
      process.env.ELEVENLABS_API_KEY = prevKey;
      process.env.ELEVENLABS_VOICE_ID = prevVoice;
    }
  });

  test("per-request voice works even when no env voice is configured", async () => {
    const prevKey = process.env.ELEVENLABS_API_KEY;
    const prevVoice = process.env.ELEVENLABS_VOICE_ID;
    try {
      process.env.ELEVENLABS_API_KEY = "k";
      process.env.ELEVENLABS_VOICE_ID = "";
      const capture: { url?: string } = {};
      mockFetch(200, new Uint8Array([3]), capture);

      const result = await synthesizeWithElevenLabs("hi", {
        modelId: "eleven_flash_v2_5",
        voiceId: "BIvP0GN1cAtSRTxNHnWS",
      });

      expect(result.ok).toBe(true);
      expect(capture.url).toContain("/text-to-speech/BIvP0GN1cAtSRTxNHnWS");
    } finally {
      process.env.ELEVENLABS_API_KEY = prevKey;
      process.env.ELEVENLABS_VOICE_ID = prevVoice;
    }
  });

  test("synthesis succeeds and hits the ElevenLabs text-to-speech endpoint", async () => {
    configureElEnv();
    const capture: { url?: string; headers?: Headers; body?: Record<string, unknown> } = {};
    mockFetch(200, new Uint8Array([9, 8, 7]), capture);

    const result = await synthesizeWithElevenLabs("Listening passage text.", {
      modelId: "eleven_flash_v2_5",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.from(new Uint8Array(result.audio))).toEqual([9, 8, 7]);
    }
    expect(capture.url).toContain("api.elevenlabs.io/v1/text-to-speech/test-voice-id");
    expect(capture.body?.text).toBe("Listening passage text.");
    expect(capture.body?.model_id).toBe("eleven_flash_v2_5");
    expect(capture.body?.output_format).toBe("mp3_44100_128");
    expect(capture.headers?.get("xi-api-key")).toBe("test-el-key");
  });

  test("per-call voiceId option overrides the env default voice", async () => {
    configureElEnv();
    const capture: { url?: string } = {};
    mockFetch(200, new Uint8Array([1]), capture);

    await synthesizeWithElevenLabs("hi", { modelId: "eleven_v3", voiceId: "custom-voice" });

    expect(capture.url).toContain("/text-to-speech/custom-voice");
  });

  test("upstream failure returns sanitized upstream_error without leaking details", async () => {
    configureElEnv();
    mockFetch(500, JSON.stringify({ detail: "raw upstream secret detail" }));

    const result = await synthesizeWithElevenLabs("text", { modelId: "eleven_flash_v2_5" });

    expect(result).toEqual({ ok: false, reason: "upstream_error" });
  });

  test("empty audio payload counts as upstream_error", async () => {
    configureElEnv();
    mockFetch(200, new Uint8Array([]));

    const result = await synthesizeWithElevenLabs("text", { modelId: "eleven_flash_v2_5" });

    expect(result).toEqual({ ok: false, reason: "upstream_error" });
  });

  test("network throw returns upstream_error instead of crashing", async () => {
    configureElEnv();
    globalThis.fetch = (async () => {
      throw new Error("connect ECONNREFUSED");
    }) as typeof fetch;

    const result = await synthesizeWithElevenLabs("text", { modelId: "eleven_flash_v2_5" });

    expect(result).toEqual({ ok: false, reason: "upstream_error" });
  });
});

test.describe("Listening audio route wiring", () => {
  test("route dispatches through the shared provider resolver and helper", () => {
    const source = readFileSync(
      "src/app/api/listening-exercise/audio/generate/route.ts",
      "utf8",
    );

    expect(source).toContain("resolveTtsProvider");
    expect(source).toContain("resolveElevenLabsModelId");
    expect(source).toContain("synthesizeWithElevenLabs");

    // Raw upstream responses must never be forwarded to the client.
    expect(source).not.toMatch(/errorText[\s\S]{0,200}NextResponse/);
  });

  test(".env.example documents the legacy PODCHAT_TTS_PROVIDER alias", () => {
    const envExample = readFileSync(".env.example", "utf8");
    expect(envExample).toContain("PODCHAT_TTS_PROVIDER=");
  });
});

// ---------------------------------------------------------------------------
// Browser behavior: the Settings TTS choice must reach
// /api/listening-exercise/audio/generate.
// ---------------------------------------------------------------------------

type AudioBody = Record<string, unknown>;

async function setupListeningMocks(page: import("@playwright/test").Page, captured: AudioBody[]) {
  await page.route("**/api/listening-exercise/session/start", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ session_id: "sess-test-1" }),
    }),
  );

  await page.route(/\/api\/listening-exercise\/session\/[^/]+\/status/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        section_index: 0,
        generation_status: "ready",
        section: {
          id: "sec-test-1",
          topic: "Urban economics",
          pre_listening_prompt: "Listen for the main idea.",
          questions: [
            {
              id: "q1",
              question_type: "true_false",
              question_text: "The passage discusses cities.",
              options: ["True", "False"],
            },
            {
              id: "q2",
              question_type: "multiple_choice",
              question_text: "What grows with city size?",
              options: ["Productivity", "Rainfall"],
            },
            {
              id: "q3",
              question_type: "fill_blank",
              question_text: "Cities drive economic ___.",
            },
          ],
        },
      }),
    }),
  );

  await page.route("**/api/listening-exercise/audio/generate", async (route) => {
    captured.push(JSON.parse(route.request().postData() || "{}") as AudioBody);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ audioUrl: "/mock-listening-audio.mp3" }),
    });
  });

  // Replace HTMLAudioElement so playback never touches real media decoding.
  await page.addInitScript(() => {
    class MockAudio {
      src = "";
      play() {
        return Promise.resolve();
      }
      pause() {}
      load() {}
      addEventListener() {}
      removeEventListener() {}
    }
    (window as unknown as { Audio: unknown }).Audio = MockAudio;
  });
}

test.describe("Listening audio request carries the Settings TTS choice", () => {
  test("Settings selection elevenlabs + model reaches the audio generate request", async ({
    page,
  }) => {
    const captured: AudioBody[] = [];
    await setupListeningMocks(page, captured);

    await page.goto("/?mockAuth=true");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.locator("#default-tts-provider-select").selectOption("elevenlabs");
    await page.locator("#default-elevenlabs-model-select").selectOption("eleven_flash_v2_5");
    await page.locator("#default-elevenlabs-voice-select").selectOption("BIvP0GN1cAtSRTxNHnWS");

    await page.getByRole("button", { name: "Listening", exact: true }).click();
    await page.getByRole("button", { name: "Start Assessment" }).click();

    await expect.poll(() => captured.length).toBeGreaterThan(0);
    expect(captured[0].ttsProvider).toBe("elevenlabs");
    expect(captured[0].elevenLabsModelId).toBe("eleven_flash_v2_5");
    expect(captured[0].elevenLabsVoiceId).toBe("BIvP0GN1cAtSRTxNHnWS");
  });

  test("fresh load without stored choice sends canonical amazon-polly and omits model", async ({
    page,
  }) => {
    const captured: AudioBody[] = [];
    await setupListeningMocks(page, captured);

    await page.goto("/?mockAuth=true");
    await page.getByRole("button", { name: "Listening", exact: true }).click();
    await page.getByRole("button", { name: "Start Assessment" }).click();

    await expect.poll(() => captured.length).toBeGreaterThan(0);
    // The main shell resolves localStorage (empty -> canonical default) and
    // always sends an explicit provider, mirroring Podchat's client behavior.
    expect(captured[0].ttsProvider).toBe("amazon-polly");
    expect(captured[0].elevenLabsModelId).toBeUndefined();
    expect(captured[0].elevenLabsVoiceId).toBeUndefined();
  });

  test("ElevenLabs voice dropdown only appears for the elevenlabs provider", async ({ page }) => {
    await page.goto("/?mockAuth=true");
    await page.getByRole("button", { name: "Settings" }).click();

    const voiceSelect = page.locator("#default-elevenlabs-voice-select");
    await expect(voiceSelect).toHaveCount(0);

    await page.locator("#default-tts-provider-select").selectOption("elevenlabs");
    await expect(voiceSelect).toBeVisible();

    // Catalog voices render with their labels; Ellen is selectable.
    const ellenOption = voiceSelect.locator("option[value='BIvP0GN1cAtSRTxNHnWS']");
    await expect(ellenOption).toContainText("Ellen");

    await voiceSelect.selectOption("BIvP0GN1cAtSRTxNHnWS");
    const stored = await page.evaluate(() => localStorage.getItem("defaultElevenLabsVoice"));
    expect(stored).toBe("BIvP0GN1cAtSRTxNHnWS");
  });
});
