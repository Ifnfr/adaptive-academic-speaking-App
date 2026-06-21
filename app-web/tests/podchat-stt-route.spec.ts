import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { POST } from "../src/app/api/podchat/stt/route";
import { testHooks } from "../src/app/api/podchat/stt/route-test-hooks";

const originalApiKey = process.env.DEEPGRAM_API_KEY;
const originalProvider = process.env.PODCHAT_STT_PROVIDER;
const originalInternalKey = process.env.INTERNAL_SPEECH_SECURITY_KEY;
const originalFetch = globalThis.fetch;

function buildSttRequest(options: {
  audio?: Blob;
  contentType?: string;
  useRawBody?: string;
  durationMs?: number;
}): Request {
  if (options.useRawBody !== undefined) {
    const headers: Record<string, string> = {
      "content-type": options.contentType ?? "application/json",
    };
    return new Request("http://localhost/api/podchat/stt", {
      method: "POST",
      headers,
      body: options.useRawBody,
    });
  }

  const formData = new FormData();
  if (options.audio !== undefined) {
    // WebM type is standard. We pass the blob and standard filename.
    formData.append("audio", options.audio, "speech.webm");
  }
  if (options.durationMs !== undefined) {
    formData.append("durationMs", String(options.durationMs));
  }

  return new Request("http://localhost/api/podchat/stt", {
    method: "POST",
    body: formData,
  });
}

function mockDeepgramResponse(
  status: number,
  body: string | Record<string, unknown>,
  capture: { url?: string; headers?: Headers; body?: ArrayBuffer } = {},
) {
  globalThis.fetch = (async (url, init) => {
    capture.url = String(url);
    capture.headers = new Headers(init?.headers);
    capture.body = init?.body as ArrayBuffer;

    const responseBody = typeof body === "string" ? body : JSON.stringify(body);
    return new Response(responseBody, {
      status,
      headers: {
        "content-type": "application/json",
      },
    });
  }) as typeof fetch;
}

test.describe("Podchat STT Route", () => {
  test.beforeEach(() => {
    // Authenticate the user by default
    testHooks.resolveCurrentUserId = async () => "user-123";
  });

  test.afterEach(() => {
    process.env.DEEPGRAM_API_KEY = originalApiKey;
    process.env.PODCHAT_STT_PROVIDER = originalProvider;
    process.env.INTERNAL_SPEECH_SECURITY_KEY = originalInternalKey;
    globalThis.fetch = originalFetch;
    testHooks.resolveCurrentUserId = null;
  });

  // ---------------------------------------------------------------------------
  // Clerk authentication tests
  // ---------------------------------------------------------------------------

  test("guard: unauthenticated request returns 401", async () => {
    testHooks.resolveCurrentUserId = async () => null;
    process.env.DEEPGRAM_API_KEY = "test-deepgram-key";
    const audioBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    const response = await POST(buildSttRequest({ audio: audioBlob }));
    const data = (await response.json()) as { error: string };
    expect(response.status).toBe(401);
    expect(data.error).toBe("unauthorized");
  });

  test("guard: authenticated request passes through to Deepgram key check", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    process.env.DEEPGRAM_API_KEY = "";
    const audioBlob = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    const response = await POST(buildSttRequest({ audio: audioBlob }));
    // Should reach the Deepgram key check and return 503, not 401
    expect(response.status).toBe(503);
  });

  test("1. valid audio returns transcript", async () => {
    process.env.DEEPGRAM_API_KEY = "test-deepgram-key";
    const capture: { url?: string; headers?: Headers; body?: ArrayBuffer } = {};
    mockDeepgramResponse(
      200,
      {
        results: {
          channels: [
            {
              alternatives: [
                {
                  transcript: "   Academic speaking is key.   ",
                },
              ],
            },
          ],
        },
      },
      capture,
    );

    const audioBytes = new Uint8Array([10, 20, 30]);
    const audioBlob = new Blob([audioBytes], { type: "audio/webm" });
    const response = await POST(buildSttRequest({ audio: audioBlob }));

    expect(response.status).toBe(200);
    const data = (await response.json()) as { transcript: string };
    expect(data.transcript).toBe("Academic speaking is key.");
    expect(capture.url).toBe("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true");
    expect(capture.headers?.get("content-type")).toBe("audio/webm");
  });

  test("1a. accepts browser WebM MIME type with codec parameters", async () => {
    process.env.DEEPGRAM_API_KEY = "test-deepgram-key";
    const capture: { headers?: Headers } = {};
    mockDeepgramResponse(
      200,
      {
        results: {
          channels: [{ alternatives: [{ transcript: "browser webm audio" }] }],
        },
      },
      capture,
    );

    const audioBlob = new Blob([new Uint8Array([10, 20, 30])], {
      type: "audio/webm;codecs=opus",
    });
    const response = await POST(buildSttRequest({ audio: audioBlob }));

    expect(response.status).toBe(200);
    const data = (await response.json()) as { transcript: string };
    expect(data.transcript).toBe("browser webm audio");
    expect(capture.headers?.get("content-type")).toBe("audio/webm");
  });

  test("1b. accepts Ogg MIME type with codec parameters", async () => {
    process.env.DEEPGRAM_API_KEY = "test-deepgram-key";
    const capture: { headers?: Headers } = {};
    mockDeepgramResponse(
      200,
      {
        results: {
          channels: [{ alternatives: [{ transcript: "ogg audio" }] }],
        },
      },
      capture,
    );

    const audioBlob = new Blob([new Uint8Array([10, 20, 30])], {
      type: "audio/ogg; codecs=opus",
    });
    const response = await POST(buildSttRequest({ audio: audioBlob }));

    expect(response.status).toBe(200);
    const data = (await response.json()) as { transcript: string };
    expect(data.transcript).toBe("ogg audio");
    expect(capture.headers?.get("content-type")).toBe("audio/ogg");
  });

  test("1c. normalizes uppercase and whitespace MIME type safely", async () => {
    process.env.DEEPGRAM_API_KEY = "test-deepgram-key";
    const capture: { headers?: Headers } = {};
    mockDeepgramResponse(
      200,
      {
        results: {
          channels: [{ alternatives: [{ transcript: "normalized audio" }] }],
        },
      },
      capture,
    );

    const audioBlob = new Blob([new Uint8Array([10, 20, 30])], {
      type: " AUDIO/WEBM ; CODECS=OPUS ",
    });
    const response = await POST(buildSttRequest({ audio: audioBlob }));

    expect(response.status).toBe(200);
    const data = (await response.json()) as { transcript: string };
    expect(data.transcript).toBe("normalized audio");
    expect(capture.headers?.get("content-type")).toBe("audio/webm");
  });

  test("2. missing DEEPGRAM_API_KEY returns safe 503", async () => {
    process.env.DEEPGRAM_API_KEY = "";
    const audioBytes = new Uint8Array([1]);
    const audioBlob = new Blob([audioBytes], { type: "audio/webm" });
    const response = await POST(buildSttRequest({ audio: audioBlob }));

    expect(response.status).toBe(503);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe("Speech-to-text is not configured. Please try again later.");
  });

  test("3. missing audio rejects with 400", async () => {
    process.env.DEEPGRAM_API_KEY = "key";
    const response = await POST(buildSttRequest({}));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("audio field is required");
  });

  test("4. zero-byte audio rejects with 400", async () => {
    process.env.DEEPGRAM_API_KEY = "key";
    const audioBlob = new Blob([], { type: "audio/webm" });
    const response = await POST(buildSttRequest({ audio: audioBlob }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("empty");
  });

  test("5. oversized audio rejects with 400", async () => {
    process.env.DEEPGRAM_API_KEY = "key";
    // Construct slightly over 2 MB blob (2.1 MB)
    const largeBuffer = new Uint8Array(2.1 * 1024 * 1024);
    const audioBlob = new Blob([largeBuffer], { type: "audio/webm" });
    const response = await POST(buildSttRequest({ audio: audioBlob }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("exceed 2 MB");
  });

  test("6. invalid MIME type rejects with 400", async () => {
    process.env.DEEPGRAM_API_KEY = "key";
    const audioBlob = new Blob([new Uint8Array([1, 2])], { type: "image/png" });
    const response = await POST(buildSttRequest({ audio: audioBlob }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("Invalid audio format");
  });

  test("6a. unsupported text and video MIME types reject with normalized safe error", async () => {
    process.env.DEEPGRAM_API_KEY = "key";

    const textBlob = new Blob([new Uint8Array([1, 2])], {
      type: "text/plain; charset=utf-8",
    });
    const textResponse = await POST(buildSttRequest({ audio: textBlob }));
    const textData = (await textResponse.json()) as { error: string };
    expect(textResponse.status).toBe(400);
    expect(textData.error).toContain("Invalid audio format: text/plain.");
    expect(textData.error).not.toContain("charset");

    const videoBlob = new Blob([new Uint8Array([1, 2])], {
      type: "video/mp4; codecs=avc1",
    });
    const videoResponse = await POST(buildSttRequest({ audio: videoBlob }));
    const videoData = (await videoResponse.json()) as { error: string };
    expect(videoResponse.status).toBe(400);
    expect(videoData.error).toContain("Invalid audio format: video/mp4.");
    expect(videoData.error).not.toContain("codecs");
  });

  test("7. Deepgram non-OK returns sanitized 502", async () => {
    process.env.DEEPGRAM_API_KEY = "key";
    mockDeepgramResponse(400, { error: "bad request to deepgram internals" });
    const audioBlob = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    const response = await POST(buildSttRequest({ audio: audioBlob }));

    expect(response.status).toBe(502);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe("Speech transcription failed. Please try again later.");
    expect(JSON.stringify(data)).not.toContain("bad request");
  });

  test("8. malformed Deepgram JSON returns sanitized 502", async () => {
    process.env.DEEPGRAM_API_KEY = "key";
    mockDeepgramResponse(200, "malformed { json");
    const audioBlob = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    const response = await POST(buildSttRequest({ audio: audioBlob }));

    expect(response.status).toBe(502);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe("Speech transcription failed. Please try again later.");
  });

  test("9. empty transcript returns 422", async () => {
    process.env.DEEPGRAM_API_KEY = "key";
    mockDeepgramResponse(200, {
      results: {
        channels: [
          {
            alternatives: [
              {
                transcript: "   ",
              },
            ],
          },
        ],
      },
    });
    const audioBlob = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    const response = await POST(buildSttRequest({ audio: audioBlob }));

    expect(response.status).toBe(422);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe("No speech was detected. Please try recording again.");
  });

  test("10. request to Deepgram uses Authorization header server-side", async () => {
    process.env.DEEPGRAM_API_KEY = "secure-deepgram-token-xyz";
    const capture: { headers?: Headers } = {};
    mockDeepgramResponse(200, {
      results: {
        channels: [{ alternatives: [{ transcript: "test" }] }]
      }
    }, capture);

    const audioBlob = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    await POST(buildSttRequest({ audio: audioBlob }));

    expect(capture.headers?.get("authorization")).toBe("Token secure-deepgram-token-xyz");
  });

  test("11. client response does not expose Deepgram key or raw payload", async () => {
    process.env.DEEPGRAM_API_KEY = "sensitive-secret-token";
    mockDeepgramResponse(401, {
      err_code: "AUTHORIZATION_FAILED",
      message: "Please provide a valid token key: sensitive-secret-token"
    });

    const audioBlob = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    const response = await POST(buildSttRequest({ audio: audioBlob }));
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(502);
    expect(serialized).not.toContain("sensitive-secret-token");
    expect(serialized).not.toContain("AUTHORIZATION_FAILED");
  });

  test("12. route source confirms no Supabase, disk storage, biometrics, diarization, or pronunciation/phoneme scoring is referenced", () => {
    const source = readFileSync("src/app/api/podchat/stt/route.ts", "utf8");
    const forbidden = [
      "createClient",
      "Supabase",
      "localStorage",
      "recordingUrl",
      "audioBlob",
      "diarization",
      "biometrics",
      "pronunciation",
      "phoneme",
      "speaker",
      "fs",
      "writeFile",
    ];

    for (const term of forbidden) {
      expect(source).not.toContain(term);
    }
  });

  test("13. PODCHAT_STT_PROVIDER=mock returns deterministic transcript and does not require Deepgram key or call fetch", async () => {
    process.env.PODCHAT_STT_PROVIDER = "mock";
    process.env.DEEPGRAM_API_KEY = "";

    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    const audioBytes = new Uint8Array([1, 2, 3]);
    const audioBlob = new Blob([audioBytes], { type: "audio/webm" });
    const response = await POST(buildSttRequest({ audio: audioBlob }));

    expect(response.status).toBe(200);
    const data = (await response.json()) as { transcript: string };
    expect(data.transcript).toBe("I use technology to learn English and practise speaking every day.");
    expect(fetchCalled).toBe(false);
  });

  test("13a. mock provider accepts normalized browser WebM MIME type", async () => {
    process.env.PODCHAT_STT_PROVIDER = "mock";
    process.env.DEEPGRAM_API_KEY = "";

    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    const audioBlob = new Blob([new Uint8Array([1, 2, 3])], {
      type: "audio/webm;codecs=opus",
    });
    const response = await POST(buildSttRequest({ audio: audioBlob }));

    expect(response.status).toBe(200);
    const data = (await response.json()) as { transcript: string };
    expect(data.transcript).toBe("I use technology to learn English and practise speaking every day.");
    expect(fetchCalled).toBe(false);
  });

  test("14. mock provider mode still validates multipart/form-data, presence of audio, size, and MIME type", async () => {
    process.env.PODCHAT_STT_PROVIDER = "mock";

    const reqJson = buildSttRequest({ useRawBody: "{}" });
    const resJson = await POST(reqJson);
    expect(resJson.status).toBe(400);

    const reqNoAudio = buildSttRequest({});
    const resNoAudio = await POST(reqNoAudio);
    expect(resNoAudio.status).toBe(400);

    const emptyBlob = new Blob([], { type: "audio/webm" });
    const reqEmpty = buildSttRequest({ audio: emptyBlob });
    const resEmpty = await POST(reqEmpty);
    expect(resEmpty.status).toBe(400);

    const largeBlob = new Blob([new Uint8Array(2.1 * 1024 * 1024)], { type: "audio/webm" });
    const reqLarge = buildSttRequest({ audio: largeBlob });
    const resLarge = await POST(reqLarge);
    expect(resLarge.status).toBe(400);

    const pngBlob = new Blob([new Uint8Array([1])], { type: "image/png" });
    const reqPng = buildSttRequest({ audio: pngBlob });
    const resPng = await POST(reqPng);
    expect(resPng.status).toBe(400);
  });

  test("15. repeated-word transcript returns 422 and safe details without raw transcript", async () => {
    process.env.DEEPGRAM_API_KEY = "key";
    mockDeepgramResponse(200, {
      results: {
        channels: [{ alternatives: [{ transcript: "immigrants immigrants immigrants immigrants immigrants" }] }]
      }
    });

    const audioBlob = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    const response = await POST(buildSttRequest({ audio: audioBlob }));

    expect(response.status).toBe(422);
    const data = await response.json();
    expect(data.error).toBe("Speech transcript looked unreliable. Please record again.");
    expect(data.reasonCode).toBe("repeated_words");
    expect(JSON.stringify(data)).not.toContain("immigrants");
  });

  test("16. phrase-loop transcript returns 422", async () => {
    process.env.DEEPGRAM_API_KEY = "key";
    mockDeepgramResponse(200, {
      results: {
        channels: [{ alternatives: [{ transcript: "I think that I think that I think that" }] }]
      }
    });

    const audioBlob = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    const response = await POST(buildSttRequest({ audio: audioBlob }));

    expect(response.status).toBe(422);
    const data = await response.json();
    expect(data.reasonCode).toBe("ngram_loop");
  });

  test("17. normal transcript returns 200", async () => {
    process.env.DEEPGRAM_API_KEY = "key";
    mockDeepgramResponse(200, {
      results: {
        channels: [{ alternatives: [{ transcript: "Learning economics is very important for understanding daily transactions." }] }]
      }
    });

    const audioBlob = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    const response = await POST(buildSttRequest({ audio: audioBlob }));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.transcript).toBe("Learning economics is very important for understanding daily transactions.");
  });

  test("18. impossible speed check rejects and returns 422 if durationMs is too short", async () => {
    process.env.DEEPGRAM_API_KEY = "key";
    // 15 words
    mockDeepgramResponse(200, {
      results: {
        channels: [{ alternatives: [{ transcript: "this is a long sentence with many words that is impossible to say quickly" }] }]
      }
    });

    const audioBlob = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    // Say 15 words in 1000ms (1 second) -> speed = 15 words/sec (> 6.5)
    const response = await POST(buildSttRequest({ audio: audioBlob, durationMs: 1000 }));

    expect(response.status).toBe(422);
    const data = await response.json();
    expect(data.reasonCode).toBe("impossible_speed");
  });
});
