import { test, expect, Route } from "@playwright/test";

interface TurnPayload {
  topic?: string;
  difficulty?: string;
  turnIndex?: number;
  durationSeconds?: number;
  elapsedSeconds?: number;
  remainingSeconds?: number;
  turns?: Array<{ speaker: string; text: string }>;
}

interface EvalPayload {
  turns?: Array<{ speaker: string; text: string }>;
}

interface TtsPayload {
  text?: string;
}

test.describe("Podchat Phase 1 connected UI", () => {
  test.beforeEach(async ({ page }) => {
    // Add init script to monitor microphone access and stub Audio
    await page.addInitScript(() => {
      // Mock getUserMedia
      const mediaDevices = {
        getUserMedia() {
          (window as unknown as { __PODCHAT_MIC_REQUESTED__?: boolean })
            .__PODCHAT_MIC_REQUESTED__ = true;
          return Promise.reject(new Error("Microphone must not be requested"));
        },
      };
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: mediaDevices,
      });

      // Stub Audio / HTMLAudioElement
      (window as unknown as { __AUDIO_PLAY_CALLED__: string[] }).__AUDIO_PLAY_CALLED__ = [];
      (window as unknown as { __AUDIO_PAUSE_CALLED_COUNT__: number }).__AUDIO_PAUSE_CALLED_COUNT__ = 0;
      (window as unknown as { __AUDIO_REVOKE_CALLED_COUNT__: number }).__AUDIO_REVOKE_CALLED_COUNT__ = 0;

      interface MockAudio {
        src: string;
        play: () => Promise<void>;
        pause: () => void;
        addEventListener: (event: string, handler: () => void) => void;
        removeEventListener: (event: string, handler: () => void) => void;
        _trigger: (event: string) => void;
        _listeners: Record<string, Array<() => void>>;
      }

      (window as unknown as { Audio: unknown }).Audio = function (src: string) {
        const inst: MockAudio = {
          src,
          play: async () => {
            (window as unknown as { __AUDIO_PLAY_CALLED__: string[] }).__AUDIO_PLAY_CALLED__.push(src);
            return Promise.resolve();
          },
          pause: () => {
            (window as unknown as { __AUDIO_PAUSE_CALLED_COUNT__: number }).__AUDIO_PAUSE_CALLED_COUNT__++;
          },
          addEventListener(event: string, handler: () => void) {
            if (!this._listeners[event]) this._listeners[event] = [];
            this._listeners[event].push(handler);
          },
          removeEventListener(event: string, handler: () => void) {
            if (this._listeners[event]) {
              this._listeners[event] = this._listeners[event].filter((h) => h !== handler);
            }
          },
          _trigger(event: string) {
            if (this._listeners[event]) {
              this._listeners[event].forEach((h) => h());
            }
          },
          _listeners: {}
        };
        (window as unknown as { __LAST_AUDIO_INSTANCE__: unknown }).__LAST_AUDIO_INSTANCE__ = inst;
        return inst;
      };

      // Stub URL create/revoke
      const originalRevoke = URL.revokeObjectURL;
      URL.createObjectURL = (blob: Blob) => {
        return "blob:mocked-audio-url-" + blob.size + "-" + Math.random();
      };
      URL.revokeObjectURL = (url: string) => {
        if (url && url.startsWith("blob:mocked-audio-url-")) {
          (window as unknown as { __AUDIO_REVOKE_CALLED_COUNT__: number }).__AUDIO_REVOKE_CALLED_COUNT__++;
        } else {
          try {
            originalRevoke(url);
          } catch {
            // ignore
          }
        }
      };
    });
  });

  test("runs full setup, speaking, and evaluation with mocked API routes and TTS success", async ({ page }) => {
    const providerCalls: string[] = [];

    page.on("request", (request) => {
      const url = request.url();
      if (
        url.includes("anthropic.com") ||
        url.includes("deepgram.com") ||
        url.includes("polly")
      ) {
        providerCalls.push(url);
      }
    });

    // Mock API Turn Route
    let receivedPayload: TurnPayload | null = null;
    await page.route("**/api/podchat/turn", async (route: Route) => {
      receivedPayload = route.request().postDataJSON() as TurnPayload;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          hostText: "This is a mocked host response.",
          followUpQuestion: "What is your next point?"
        })
      });
    });

    // Mock API Evaluate Route
    let receivedEvalPayload: EvalPayload | null = null;
    await page.route("**/api/podchat/evaluate", async (route: Route) => {
      receivedEvalPayload = route.request().postDataJSON() as EvalPayload;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          summary: "This is a mocked summary evaluation.",
          corrections: [
            { original: "wrong grammar", improved: "correct grammar", explanation: "Because of rules." }
          ],
          betterSentences: ["Better academic sentence."],
          vocabularySuggestions: [
            { originalOrBasic: "good", suggestion: "excellent", example: "It is excellent." }
          ],
          recurringErrors: [
            { label: "Grammar mistake", evidence: "wrong grammar", practiceFocus: "Practice rules." }
          ],
          nextPracticeFocus: "Focus on academic vocabulary."
        })
      });
    });

    // Mock TTS Route
    const ttsPayloads: TtsPayload[] = [];
    await page.route("**/api/podchat/tts", async (route: Route) => {
      const data = route.request().postDataJSON() as TtsPayload;
      ttsPayloads.push(data || {});
      await route.fulfill({
        status: 200,
        contentType: "audio/mpeg",
        body: Buffer.from("fake-mpeg-bytes")
      });
    });

    await page.goto("/");

    // 1. Setup renders
    await expect(page.getByTestId("podchat-setup")).toBeVisible();
    await page.getByRole("radio", { name: "Economics" }).click();
    await page.getByRole("radio", { name: "Technology" }).click();
    await page.getByRole("radio", { name: /Intermediate/ }).click();

    // 2. Start a Podchat transitions to speaking
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await expect(page.getByTestId("podchat-speaking")).toBeVisible();

    // 3. Confirm no TTS is called for setup opener text
    expect(ttsPayloads.length).toBe(0);

    // 4. Submit Turn calls /api/podchat/turn and then triggers TTS
    await page.getByRole("button", { name: "Mock learner answer" }).click();
    await page.getByRole("button", { name: "Submit Turn" }).click();

    // Wait for text to render immediately (text-first)
    await expect(page.getByTestId("podchat-rolling-transcript")).toContainText("This is a mocked host response. What is your next point?");

    // Check TTS payload and invocation
    await expect.poll(() => ttsPayloads.length).toBe(1);
    expect(ttsPayloads[0]).toEqual({
      text: "This is a mocked host response. What is your next point?"
    });

    // Verify /api/podchat/turn payload has duration-based fields and NOT maxUserTurns
    const payload = receivedPayload as unknown as TurnPayload;
    expect(payload).toBeDefined();
    expect(payload?.topic).toBe("Technology");
    expect(payload?.difficulty).toBe("Intermediate");
    expect(payload?.turnIndex).toBe(0);
    expect(payload?.durationSeconds).toBe(300);
    expect(typeof payload?.elapsedSeconds).toBe("number");
    expect(typeof payload?.remainingSeconds).toBe("number");
    expect(payload).not.toHaveProperty("maxUserTurns");

    // Confirm audio playback was attempted
    const playCalls = await page.evaluate(() => (window as unknown as { __AUDIO_PLAY_CALLED__: string[] }).__AUDIO_PLAY_CALLED__);
    expect(playCalls.length).toBe(1);
    expect(playCalls[0]).toContain("blob:");

    // Confirm UI shows host speaking status
    await expect(page.getByTestId("podchat-status")).toContainText("Host speaking...");

    // Trigger audio ended to clear the speaking status
    await page.evaluate(() => {
      interface Triggerable {
        _trigger: (event: string) => void;
      }
      const inst = (window as unknown as { __LAST_AUDIO_INSTANCE__: Triggerable }).__LAST_AUDIO_INSTANCE__;
      if (inst) {
        inst._trigger("ended");
      }
    });
    await expect(page.getByTestId("podchat-status")).toContainText("Your turn");

    // 5. Submit second turn
    await page.getByRole("button", { name: "Mock learner answer" }).click();
    await page.getByRole("button", { name: "Submit Turn" }).click();

    await expect.poll(() => ttsPayloads.length).toBe(2);

    // 6. Starting evaluation does NOT trigger TTS
    await page.getByRole("button", { name: "End Session" }).click();
    await expect(page.getByTestId("podchat-evaluation")).toBeVisible();

    // Confirm evaluation payload
    const evalPayload = receivedEvalPayload as unknown as EvalPayload;
    expect(evalPayload).toBeDefined();
    expect(evalPayload?.turns?.length).toBeGreaterThanOrEqual(3);

    // TTS should not be called again
    expect(ttsPayloads.length).toBe(2);

    // 7. Verify no privacy leaks
    const microphoneRequested = await page.evaluate(
      () => Boolean((window as unknown as { __PODCHAT_MIC_REQUESTED__?: boolean }).__PODCHAT_MIC_REQUESTED__)
    );
    expect(microphoneRequested).toBe(false);

    const storageSnapshot = await page.evaluate(() => JSON.stringify(localStorage));
    expect(storageSnapshot).not.toMatch(/audioBlob|recordingUrl|blob:/i);
    expect(providerCalls).toEqual([]);
  });

  test("handles TTS route failure gracefully without blocking text conversation", async ({ page }) => {
    // Mock API Turn Route
    await page.route("**/api/podchat/turn", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          hostText: "Immediate text here.",
          followUpQuestion: "Can you read this?"
        })
      });
    });

    // Mock TTS Route to fail
    await page.route("**/api/podchat/tts", async (route: Route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Polly failed." })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await page.getByRole("button", { name: "Mock learner answer" }).click();
    await page.getByRole("button", { name: "Submit Turn" }).click();

    // Confirm text is still rendered
    await expect(page.getByTestId("podchat-rolling-transcript")).toContainText("Immediate text here. Can you read this?");

    // Confirm quiet fallback warning is displayed
    await expect(page.getByTestId("podchat-tts-error")).toContainText("Voice unavailable. Continuing with text.");

    // Confirm we can still proceed with text conversation
    await page.getByRole("button", { name: "Mock learner answer" }).click();
    await expect(page.getByRole("button", { name: "Submit Turn" })).toBeEnabled();
  });

  test("cleans up audio and revokes ObjectURL on reset", async ({ page }) => {
    await page.route("**/api/podchat/turn", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ hostText: "Sample.", followUpQuestion: "Reset me." })
      });
    });

    await page.route("**/api/podchat/tts", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "audio/mpeg",
        body: Buffer.from("mpeg")
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await page.getByRole("button", { name: "Mock learner answer" }).click();
    await page.getByRole("button", { name: "Submit Turn" }).click();

    // Verify audio is playing
    await expect(page.getByTestId("podchat-status")).toContainText("Host speaking...");

    // Click Start Over (Reset)
    await page.getByRole("button", { name: "End Session" }).click();
    await page.getByRole("button", { name: "Start New Podchat" }).click();

    // Confirm audio pause was called and object URL revoked
    const pauseCount = await page.evaluate(() => (window as unknown as { __AUDIO_PAUSE_CALLED_COUNT__: number }).__AUDIO_PAUSE_CALLED_COUNT__);
    const revokeCount = await page.evaluate(() => (window as unknown as { __AUDIO_REVOKE_CALLED_COUNT__: number }).__AUDIO_REVOKE_CALLED_COUNT__);
    expect(pauseCount).toBeGreaterThanOrEqual(1);
    expect(revokeCount).toBeGreaterThanOrEqual(1);
  });

  test("handles turn route failure with retry capability", async ({ page }) => {
    let callCount = 0;
    await page.route("**/api/podchat/turn", async (route: Route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Provider turn error simulated." })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            hostText: "Turn recovered.",
            followUpQuestion: "Are we good?"
          })
        });
      }
    });

    await page.route("**/api/podchat/tts", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "audio/mpeg",
        body: Buffer.from("mpeg")
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await page.getByRole("button", { name: "Mock learner answer" }).click();
    await page.getByRole("button", { name: "Submit Turn" }).click();

    await expect(page.getByTestId("podchat-turn-error")).toContainText("Provider turn error simulated.");
    await expect(page.getByRole("button", { name: "Retry Turn" })).toBeVisible();

    await page.getByRole("button", { name: "Retry Turn" }).click();
    await expect(page.getByTestId("podchat-rolling-transcript")).toContainText("Turn recovered. Are we good?");

    const playCalls = await page.evaluate(() => (window as unknown as { __AUDIO_PLAY_CALLED__: string[] }).__AUDIO_PLAY_CALLED__);
    expect(playCalls.length).toBe(1);
  });
});
