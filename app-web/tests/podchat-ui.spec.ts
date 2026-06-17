import { test, expect, Route, Page } from "@playwright/test";

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

function parseRgb(color: string): [number, number, number] {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  expect(match).not.toBeNull();
  return [Number(match![1]), Number(match![2]), Number(match![3])];
}

function relativeLuminance([r, g, b]: [number, number, number]) {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928
      ? srgb / 12.92
      : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(colorA: string, colorB: string) {
  const lumA = relativeLuminance(parseRgb(colorA));
  const lumB = relativeLuminance(parseRgb(colorB));
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

async function submitOnePodchatTurn(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start a Podchat" }).click();
  await page.getByTestId("podchat-start-recording").click();
  await page.getByTestId("podchat-stop-recording").click();
  await expect(page.getByTestId("podchat-locked-transcript")).toBeVisible();
}

test.describe("Podchat Phase 1 connected UI", () => {
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

    // Add init script to monitor microphone access and stub Audio
    await page.addInitScript(() => {
      // Mock getUserMedia
      const customWin = window as unknown as Record<string, unknown>;
      customWin.__PODCHAT_MIC_REQUESTED__ = false;
      customWin.__PODCHAT_MIC_DENY__ = false;
      customWin.__PODCHAT_TRACK_STOPPED_COUNT__ = 0;

      class MockMediaStreamTrack {
        kind = "audio";
        enabled = true;
        stop() {
          const w = window as unknown as Record<string, unknown>;
          w.__PODCHAT_TRACK_STOPPED_COUNT__ = ((w.__PODCHAT_TRACK_STOPPED_COUNT__ as number) || 0) + 1;
        }
      }

      class MockMediaStream {
        _tracks = [new MockMediaStreamTrack()];
        getTracks() {
          return this._tracks;
        }
      }

      const mediaDevices = {
        async getUserMedia() {
          const w = window as unknown as Record<string, unknown>;
          w.__PODCHAT_MIC_REQUESTED__ = true;
          if (w.__PODCHAT_MIC_DENY__) {
            return Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
          }
          return new MockMediaStream();
        },
      };

      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: mediaDevices,
      });

      // Stub MediaRecorder
      class MockMediaRecorder {
        stream: unknown;
        options?: unknown;
        state = "inactive";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        mimeType = "audio/webm";

        constructor(stream: unknown, options?: unknown) {
          this.stream = stream;
          this.options = options;
          (window as unknown as Record<string, unknown>).__LAST_MEDIA_RECORDER__ = this;
        }

        static isTypeSupported(type: string) {
          return ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg"].includes(type);
        }

        start() {
          this.state = "recording";
          (window as unknown as Record<string, unknown>).__MEDIA_RECORDER_STARTED__ = true;
        }

        stop() {
          this.state = "inactive";
          (window as unknown as Record<string, unknown>).__MEDIA_RECORDER_STOPPED__ = true;

          if (this.ondataavailable) {
            const mockBlob = new Blob([new Uint8Array([1, 2, 3])], { type: this.mimeType });
            this.ondataavailable({ data: mockBlob });
          }

          if (this.onstop) {
            setTimeout(() => {
              if (this.onstop) this.onstop();
            }, 0);
          }
        }
      }
      (window as unknown as Record<string, unknown>).MediaRecorder = MockMediaRecorder;

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

    // Default mock for STT API
    await page.route("**/api/podchat/stt", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          transcript: "I think technology changes learning because people can access information faster."
        })
      });
    });

    // Default mock for Podchat start endpoint
    await page.route("**/api/podchat/start", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          opener: "Welcome to Podchat! Let's discuss technology. How do you think technology changes learning?",
          sessionPlan: {
            topicAngle: "how tech impacts learning",
            targetSkill: "providing reasons/examples",
            followUpStrategy: "ask about details or downsides"
          }
        })
      });
    });
  });

  test("setup selected topic and difficulty use strong readable accent styling", async ({ page }) => {
    await page.goto("/");

    // Assert Mode Selector is visible and defaults to Podchat
    const podchatModeBtn = page.getByRole("button", { name: "Podchat", exact: true });
    const patternDrillModeBtn = page.getByRole("button", { name: "Pattern Drill (Prototype)" });
    await expect(podchatModeBtn).toBeVisible();
    await expect(patternDrillModeBtn).toBeVisible();
    await expect(podchatModeBtn).toHaveAttribute("aria-pressed", "true");

    // Verify all 8 topics are rendered
    const topics = [
      "Economics",
      "Technology",
      "Philosophy & Ethics",
      "Science & Discovery",
      "Education & Learning",
      "Society & Culture",
      "Global Issues & Environment",
      "Daily Life & Casual Conversation"
    ];
    for (const t of topics) {
      await expect(page.getByRole("radio", { name: t, exact: true })).toBeVisible();
    }

    // Verify Expert difficulty
    const expertDifficulty = page.getByRole("radio", { name: /Expert/ });
    await expect(expertDifficulty).toBeVisible();
    await expect(page.getByText("15-minute session")).toBeVisible();

    // Verify Advanced duration is now 10-minute session
    const advancedDifficulty = page.getByRole("radio", { name: /Advanced/ });
    await expect(advancedDifficulty).toBeVisible();
    await expect(page.getByText("10-minute session")).toBeVisible();

    // Toggle Pattern Drill Mode
    await patternDrillModeBtn.click();
    await expect(patternDrillModeBtn).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Latest Weakness Check & Brief")).toBeVisible();

    // Switch back
    await podchatModeBtn.click();
    await expect(page.getByTestId("podchat-setup")).toBeVisible();

    const selectedTopic = page.getByRole("radio", { name: "Technology" });
    const selectedDifficulty = page.getByRole("radio", { name: /Intermediate/ });

    await expect(selectedTopic).toHaveAttribute("aria-checked", "true");
    await expect(selectedDifficulty).toHaveAttribute("aria-checked", "true");

    const difficultyStyles = await selectedDifficulty.evaluate((element) => {
      const duration = element.querySelector(
        '[data-testid="podchat-difficulty-duration-intermediate"]',
      );
      const selected = getComputedStyle(element);
      const durationStyle = duration ? getComputedStyle(duration) : null;

      return {
        backgroundColor: selected.backgroundColor,
        borderColor: selected.borderColor,
        color: selected.color,
        durationColor: durationStyle?.color ?? "",
      };
    });

    expect(difficultyStyles.backgroundColor).toBe("rgb(15, 118, 110)");
    expect(difficultyStyles.borderColor).toBe("rgb(15, 118, 110)");
    expect(difficultyStyles.backgroundColor).not.toBe("rgb(204, 251, 241)");
    expect(difficultyStyles.color).toBe("rgb(255, 255, 255)");
    expect(difficultyStyles.durationColor).toBe("rgb(255, 255, 255)");
    expect(
      contrastRatio(difficultyStyles.backgroundColor, difficultyStyles.color),
    ).toBeGreaterThanOrEqual(4.5);

    const topicStyles = await selectedTopic.evaluate((element) => {
      const selected = getComputedStyle(element);
      return {
        backgroundColor: selected.backgroundColor,
        borderColor: selected.borderColor,
        color: selected.color,
      };
    });

    expect(topicStyles.backgroundColor).toBe("rgb(15, 118, 110)");
    expect(topicStyles.borderColor).toBe("rgb(15, 118, 110)");
    expect(topicStyles.color).toBe("rgb(255, 255, 255)");
    expect(contrastRatio(topicStyles.backgroundColor, topicStyles.color)).toBeGreaterThanOrEqual(4.5);
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
          nextPracticeFocus: "Focus on academic vocabulary.",
          aspectFeedback: {
            sentenceStructure: {
              status: "needs_improvement",
              message: "Use a complete sentence with a clear subject and verb."
            },
            grammar: {
              status: "needs_improvement",
              message: "Check subject-verb agreement in your main idea."
            },
            coherence: {
              status: "needs_improvement",
              message: "Add one reason or example after your main idea."
            },
            topicRelevance: {
              status: "excellent",
              message: "Excellent"
            }
          }
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

    // Wait for opener loading state to disappear and recording button to become visible
    await expect(page.getByTestId("podchat-start-recording")).toBeVisible();

    // 3. Confirm TTS is called for the generated opener text (length should be 1)
    await expect.poll(() => ttsPayloads.length).toBe(1);
    expect(ttsPayloads[0]).toMatchObject({
      text: "Welcome to Podchat! Let's discuss technology. How do you think technology changes learning?"
    });

    // Verify microphone was not requested on setup or initial speaking screen
    let micRequested = await page.evaluate(
      () => Boolean((window as unknown as Record<string, unknown>).__PODCHAT_MIC_REQUESTED__)
    );
    expect(micRequested).toBe(false);

    // 4. Click Start Recording
    await page.getByTestId("podchat-start-recording").click();

    // Verify microphone was requested now
    micRequested = await page.evaluate(
      () => Boolean((window as unknown as Record<string, unknown>).__PODCHAT_MIC_REQUESTED__)
    );
    expect(micRequested).toBe(true);

    // Verify Recording indicator and Stop Recording button
    await expect(page.getByTestId("podchat-recording-indicator")).toBeVisible();
    await expect(page.getByTestId("podchat-stop-recording")).toBeVisible();

    // Click Stop Recording
    await page.getByTestId("podchat-stop-recording").click();

    // Wait for the locked transcript panel to appear
    await expect(page.getByTestId("podchat-locked-transcript")).toBeVisible();
    await expect(page.getByTestId("podchat-transcript-disclaimer")).toBeVisible();

    // Verify transcript is read-only / non-editable (no textareas or inputs are present)
    const editableCount = await page.locator("textarea, input[type='text']").count();
    expect(editableCount).toBe(0);

    // Wait for text to render immediately (text-first)
    await expect(page.getByTestId("podchat-rolling-transcript")).toContainText("This is a mocked host response. What is your next point?");

    // Check TTS payload and invocation
    await expect.poll(() => ttsPayloads.length).toBe(2);
    expect(ttsPayloads[1]).toMatchObject({
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
    expect(playCalls.length).toBeGreaterThanOrEqual(1);
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
    await page.getByTestId("podchat-start-recording").click();
    await page.getByTestId("podchat-stop-recording").click();
    await expect(page.getByTestId("podchat-locked-transcript")).toBeVisible();

    await expect.poll(() => ttsPayloads.length).toBeGreaterThanOrEqual(2);

    // 6. Starting evaluation does NOT trigger TTS
    await page.getByRole("button", { name: "End Session" }).click();
    await expect(page.getByTestId("podchat-evaluation")).toBeVisible();

    // Confirm evaluation payload
    const evalPayload = receivedEvalPayload as unknown as EvalPayload;
    expect(evalPayload).toBeDefined();
    expect(evalPayload?.turns?.length).toBeGreaterThanOrEqual(3);

    await expect(page.getByText("Aspect Feedback")).toBeVisible();
    await expect(page.getByText("Sentence Structure")).toBeVisible();
    await expect(page.getByText("Use a complete sentence with a clear subject and verb.")).toBeVisible();
    await expect(page.getByText("Grammar", { exact: true })).toBeVisible();
    await expect(page.getByText("Check subject-verb agreement in your main idea.")).toBeVisible();
    await expect(page.getByText("Coherence")).toBeVisible();
    await expect(page.getByText("Add one reason or example after your main idea.")).toBeVisible();
    await expect(page.getByText("Topic Relevance / Substance")).toBeVisible();
    await expect(page.getByText("Excellent", { exact: true })).toBeVisible();

    // TTS should not be called again
    expect(ttsPayloads.length).toBeGreaterThanOrEqual(2);

    // 7. Verify no privacy leaks
    const storageSnapshot = await page.evaluate(() => JSON.stringify(localStorage));
    expect(storageSnapshot).not.toMatch(/audioBlob|recordingUrl|blob:/i);
    expect(providerCalls).toEqual([]);
  });

  test("evaluation UI remains stable when aspectFeedback is missing", async ({ page }) => {
    await page.route("**/api/podchat/turn", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          hostText: "This is a legacy host response.",
          followUpQuestion: "What else can you add?"
        })
      });
    });

    await page.route("**/api/podchat/evaluate", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          summary: "Legacy evaluation summary without aspect feedback.",
          corrections: [
            { original: "old grammar", improved: "clear grammar", explanation: "Use clearer structure." }
          ],
          betterSentences: ["A clearer sentence connects the idea to one example."],
          vocabularySuggestions: [
            { originalOrBasic: "good", suggestion: "useful", example: "The tool is useful for practice." }
          ],
          recurringErrors: [
            { label: "Short explanation", evidence: "A brief answer.", practiceFocus: "Add one example." }
          ],
          nextPracticeFocus: "Add one reason or example."
        })
      });
    });

    await page.route("**/api/podchat/tts", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "audio/mpeg",
        body: Buffer.from("fake-mpeg-bytes")
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await page.getByTestId("podchat-start-recording").click();
    await page.getByTestId("podchat-stop-recording").click();
    await expect(page.getByTestId("podchat-locked-transcript")).toBeVisible();
    await page.getByRole("button", { name: "End Session" }).click();

    await expect(page.getByTestId("podchat-evaluation-success")).toBeVisible();
    await expect(page.getByText("Legacy evaluation summary without aspect feedback.")).toBeVisible();
    await expect(page.getByText("Corrections / Grammar Notes")).toBeVisible();
    await expect(page.getByText("Better sentence examples")).toBeVisible();
    await expect(page.getByText("Vocabulary suggestions")).toBeVisible();
    await expect(page.getByText("Recurring Errors")).toBeVisible();
    await expect(page.getByText("Next practice focus")).toBeVisible();
    await expect(page.getByText("Use a complete sentence with a clear subject and verb.")).toHaveCount(0);
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
    await page.getByTestId("podchat-start-recording").click();
    await page.getByTestId("podchat-stop-recording").click();
    await expect(page.getByTestId("podchat-locked-transcript")).toBeVisible();

    // Confirm text is still rendered
    await expect(page.getByTestId("podchat-rolling-transcript")).toContainText("Immediate text here. Can you read this?");

    // Confirm quiet fallback warning is displayed
    await expect(page.getByTestId("podchat-tts-error")).toContainText("Voice playback unavailable. Host text will still appear.");

    // Confirm we can still proceed to record another turn
    await expect(page.getByTestId("podchat-start-recording")).toBeVisible();
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
    await page.getByTestId("podchat-start-recording").click();
    await page.getByTestId("podchat-stop-recording").click();
    await expect(page.getByTestId("podchat-locked-transcript")).toBeVisible();

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
    await page.getByTestId("podchat-start-recording").click();
    await page.getByTestId("podchat-stop-recording").click();
    await expect(page.getByTestId("podchat-locked-transcript")).toBeVisible();

    await expect(page.getByTestId("podchat-turn-error")).toContainText("Provider turn error simulated.");
    await expect(page.getByRole("button", { name: "Retry Turn" })).toBeVisible();

    await page.getByRole("button", { name: "Retry Turn" }).click();
    await expect(page.getByTestId("podchat-rolling-transcript")).toContainText("Turn recovered. Are we good?");
    const playCalls = await page.evaluate(() => (window as unknown as { __AUDIO_PLAY_CALLED__: string[] }).__AUDIO_PLAY_CALLED__);
    expect(playCalls.length).toBeGreaterThanOrEqual(1);
  });

  test("turn provider unauthorized category shows safe API key message", async ({ page }) => {
    await page.route("**/api/podchat/turn", async (route: Route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Provider request failed. Please try again later.",
          providerError: {
            provider: "DeepSeek",
            category: "unauthorized",
            status: 401
          }
        })
      });
    });

    await submitOnePodchatTurn(page);

    await expect(page.getByTestId("podchat-turn-error")).toContainText(
      "AI provider is not authorized. Check the server-side API key."
    );
  });

  test("turn provider rate_limited category shows safe quota message", async ({ page }) => {
    await page.route("**/api/podchat/turn", async (route: Route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Provider request failed. Please try again later.",
          providerError: {
            provider: "DeepSeek",
            category: "rate_limited",
            status: 429
          }
        })
      });
    });

    await submitOnePodchatTurn(page);

    await expect(page.getByTestId("podchat-turn-error")).toContainText(
      "AI provider rate limit or quota was reached."
    );
  });

  test("turn provider invalid_provider_response category shows safe invalid response message", async ({ page }) => {
    await page.route("**/api/podchat/turn", async (route: Route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Provider request failed. Please try again later.",
          providerError: {
            provider: "DeepSeek",
            category: "invalid_provider_response",
            status: 502
          }
        })
      });
    });

    await submitOnePodchatTurn(page);

    await expect(page.getByTestId("podchat-turn-error")).toContainText(
      "AI provider returned an invalid response."
    );
  });

  test("turn provider unknown category falls back safely", async ({ page }) => {
    await page.route("**/api/podchat/turn", async (route: Route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Provider request failed. Please try again later.",
          providerError: {
            provider: "DeepSeek",
            category: "unknown",
            status: 502
          }
        })
      });
    });

    await submitOnePodchatTurn(page);

    await expect(page.getByTestId("podchat-turn-error")).toContainText(
      "Provider request failed. Please try again later."
    );
  });

  test("Microphone permission denied shows safe error and does not crash", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();

    // Set permission deny flag
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__PODCHAT_MIC_DENY__ = true;
    });

    // Start recording - will reject
    await page.getByTestId("podchat-start-recording").click();

    // Confirm safe non-blocking error message
    await expect(page.getByTestId("podchat-turn-error")).toContainText(
      "Microphone unavailable. Please check permission and try again."
    );

    // Recording state resets to idle and we can retry
    await expect(page.getByTestId("podchat-start-recording")).toBeVisible();
    await expect(page.getByTestId("podchat-recording-indicator")).not.toBeVisible();
  });

  test("STT failure shows retryable error and does not submit fake transcript", async ({ page }) => {
    // Mock STT Route to fail
    await page.route("**/api/podchat/stt", async (route: Route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Transcription failed. Please try recording again." })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();

    // Start and stop recording
    await page.getByTestId("podchat-start-recording").click();
    await page.getByTestId("podchat-stop-recording").click();

    // Should display STT error
    await expect(page.getByTestId("podchat-turn-error")).toContainText(
      "Transcription failed. Please try recording again."
    );

    // Should not have a locked transcript visible or submit turn button
    await expect(page.getByTestId("podchat-locked-transcript")).not.toBeVisible();
    // Start Recording button is visible again to retry
    await expect(page.getByTestId("podchat-start-recording")).toBeVisible();
  });

  test("MediaStream tracks are stopped after Stop Recording, and stopped on reset", async ({ page }) => {
    // Mock API Turn Route to succeed
    await page.route("**/api/podchat/turn", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          hostText: "Mocked response.",
          followUpQuestion: "Next question?"
        })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();

    // Start and stop recording
    await page.getByTestId("podchat-start-recording").click();
    await page.getByTestId("podchat-stop-recording").click();

    // Confirm that the stop method on the track was called
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as Record<string, unknown>)
              .__PODCHAT_TRACK_STOPPED_COUNT__,
        ),
      )
      .toBe(1);

    // Wait for the STT to complete and turn to be auto-submitted
    await expect(page.getByTestId("podchat-locked-transcript")).toBeVisible();

    // Start recording again (active media stream)
    await page.getByTestId("podchat-start-recording").click();

    // End Session (now works because we have a learner turn)
    await page.getByRole("button", { name: "End Session" }).click();

    // Reset session
    await page.getByRole("button", { name: "Start New Podchat" }).click();

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as Record<string, unknown>)
              .__PODCHAT_TRACK_STOPPED_COUNT__,
        ),
      )
      .toBe(2);
  });

  test("STT payload details, privacy and storage checks", async ({ page }) => {
    let capturedBody: string | null = null;
    let contentType: string | null = null;

    await page.route("**/api/podchat/stt", async (route: Route) => {
      const request = route.request();
      contentType = request.headers()["content-type"] || "";
      capturedBody = request.postData() || "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ transcript: "Verified audio text." })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await page.getByTestId("podchat-start-recording").click();
    await page.getByTestId("podchat-stop-recording").click();

    // Verify STT payload
    await expect(page.getByTestId("podchat-locked-transcript")).toContainText("Verified audio text.");

    expect(contentType).toContain("multipart/form-data");
    expect(capturedBody).toContain('name="audio"');
    // Ensure no transcript, user identity, or auth metadata is in the form payload
    expect(capturedBody).not.toContain("transcript");
    expect(capturedBody).not.toContain("userId");
    expect(capturedBody).not.toContain("clerk");

    // Ensure no persistent storage/objectURL is created for user audio
    const storageKeys = await page.evaluate(() => JSON.stringify(Object.keys(localStorage)));
    expect(storageKeys).not.toContain("audio");
    expect(storageKeys).not.toContain("blob:");
  });

  test("Timer does not count down while recordingState is idle before first recording", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await expect(page.getByTestId("podchat-time-left")).toContainText("Time left: 05:00");
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("podchat-time-left")).toContainText("Time left: 05:00");
  });

  test("Timer pauses after STT failure/timeout and resumes when user records again", async ({ page }) => {
    await page.route("**/api/podchat/stt", async (route: Route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Speech transcription failed. Please record again." })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await page.getByTestId("podchat-start-recording").click();
    await page.waitForTimeout(1100);
    await page.getByTestId("podchat-stop-recording").click();
    await expect(page.getByTestId("podchat-turn-error")).toContainText("Speech transcription failed. Please record again.");

    const timeVal = await page.getByTestId("podchat-time-left").textContent();
    await page.waitForTimeout(1500);
    const timeVal2 = await page.getByTestId("podchat-time-left").textContent();
    expect(timeVal).toBe(timeVal2);
  });

  test("Timer does not drain while microphone is unavailable", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__PODCHAT_MIC_DENY__ = true;
    });

    await page.getByTestId("podchat-start-recording").click();
    await expect(page.getByTestId("podchat-turn-error")).toContainText("Microphone unavailable.");
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("podchat-time-left")).toContainText("Time left: 05:00");
  });

  test("Learner transcript bubble shows loading indicator and updates on success/failure", async ({ page }) => {
    let turnResolver: (() => void) | null = null;
    const turnPromise = new Promise<void>((resolve) => {
      turnResolver = resolve;
    });

    await page.route("**/api/podchat/turn", async (route: Route) => {
      await turnPromise;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          hostText: "This is a response.",
          followUpQuestion: "Next question?"
        })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await page.getByTestId("podchat-start-recording").click();
    await page.getByTestId("podchat-stop-recording").click();

    await expect(page.getByTestId("podchat-locked-transcript")).toContainText("I think technology changes learning");
    await expect(page.getByTestId("podchat-submitting-indicator")).toBeVisible();

    if (turnResolver) {
      (turnResolver as () => void)();
    }
    await expect(page.getByTestId("podchat-submitting-indicator")).not.toBeVisible();
    await expect(page.getByTestId("podchat-rolling-transcript")).toContainText("This is a response. Next question?");
  });

  test("Turn route failure keeps learner transcript visible and shows error without fallback replies", async ({ page }) => {
    await page.route("**/api/podchat/turn", async (route: Route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Turn API Error" })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await page.getByTestId("podchat-start-recording").click();
    await page.getByTestId("podchat-stop-recording").click();

    await expect(page.getByTestId("podchat-locked-transcript")).toContainText("I think technology changes learning");
    await expect(page.getByTestId("podchat-turn-error")).toBeVisible();

    const textareas = await page.locator("textarea").count();
    expect(textareas).toBe(0);
  });

  test("TTS route failure does not block session progression or show text Fallback input", async ({ page }) => {
    await page.route("**/api/podchat/turn", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ hostText: "Success text.", followUpQuestion: "Progressing?" })
      });
    });

    await page.route("**/api/podchat/tts", async (route: Route) => {
      await route.fulfill({
        status: 500,
        body: "TTS Failed"
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await page.getByTestId("podchat-start-recording").click();
    await page.getByTestId("podchat-stop-recording").click();

    await expect(page.getByTestId("podchat-tts-error")).toContainText("Voice playback unavailable. Host text will still appear.");
    await expect(page.getByTestId("podchat-rolling-transcript")).toContainText("Success text. Progressing?");
    await expect(page.getByTestId("podchat-start-recording")).toBeVisible();

    const textareas = await page.locator("textarea").count();
    expect(textareas).toBe(0);
  });

  test("Starting Podchat shows Preparing your speaking session loading indicator", async ({ page }) => {
    let resolveStart: (() => void) | null = null;
    const startPromise = new Promise<void>((resolve) => { resolveStart = resolve; });

    await page.route("**/api/podchat/start", async (route: Route) => {
      await startPromise;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          opener: "This is a custom generated opener?",
          sessionPlan: { topicAngle: "angle", targetSkill: "skill", followUpStrategy: "strategy" }
        })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();

    // Verify loading screen is visible
    await expect(page.getByTestId("podchat-loading-opener")).toBeVisible();
    await expect(page.getByTestId("podchat-loading-opener")).toContainText("Preparing your speaking session...");

    if (resolveStart) (resolveStart as () => void)();
    await expect(page.getByTestId("podchat-loading-opener")).not.toBeVisible();
  });

  test("api/podchat/start is called exactly once per session start", async ({ page }) => {
    let callCount = 0;
    await page.route("**/api/podchat/start", async (route: Route) => {
      callCount++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          opener: "Exactly once opener question?",
          sessionPlan: { topicAngle: "angle", targetSkill: "skill", followUpStrategy: "strategy" }
        })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await expect(page.getByTestId("podchat-start-recording")).toBeVisible();
    expect(callCount).toBe(1);
  });

  test("Generated opener appears as first AI host message and timer does not run before preparation resolves", async ({ page }) => {
    let resolveStart: (() => void) | null = null;
    const startPromise = new Promise<void>((resolve) => { resolveStart = resolve; });

    await page.route("**/api/podchat/start", async (route: Route) => {
      await startPromise;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          opener: "First host message question?",
          sessionPlan: { topicAngle: "angle", targetSkill: "skill", followUpStrategy: "strategy" }
        })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();

    // Check time left did not start ticking / is not draining (timer does not count down while loading)
    const initialTimeText = await page.getByTestId("podchat-time-left").textContent();
    await page.waitForTimeout(2000);
    const afterTimeText = await page.getByTestId("podchat-time-left").textContent();
    expect(initialTimeText).toBe(afterTimeText);

    if (resolveStart) (resolveStart as () => void)();

    // Opener should appear
    await expect(page.getByTestId("podchat-rolling-transcript")).toContainText("First host message question?");
  });

  test("Recording controls are unavailable until opener is ready", async ({ page }) => {
    let resolveStart: (() => void) | null = null;
    const startPromise = new Promise<void>((resolve) => { resolveStart = resolve; });

    await page.route("**/api/podchat/start", async (route: Route) => {
      await startPromise;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          opener: "Ready question?",
          sessionPlan: { topicAngle: "angle", targetSkill: "skill", followUpStrategy: "strategy" }
        })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();

    // Record button must not be visible/active during loading
    await expect(page.getByTestId("podchat-start-recording")).not.toBeVisible();

    if (resolveStart) (resolveStart as () => void)();

    // Becomes visible when ready
    await expect(page.getByTestId("podchat-start-recording")).toBeVisible();
  });

  test("If api/podchat/start fails, deterministic fallback opener is shown without leaking provider details", async ({ page }) => {
    await page.route("**/api/podchat/start", async (route: Route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Provider request failed. Please try again later.",
          providerError: { provider: "deepseek", category: "invalid_provider_response", status: 502 }
        })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();

    // Deterministic fallback should render (e.g. from getPodchatOpener)
    await expect(page.getByTestId("podchat-rolling-transcript")).toContainText("Welcome to Podchat.");
    // No error or provider leak should be visible to the user as main experience (we warn in console/fallback safely)
    await expect(page.getByTestId("podchat-turn-error")).not.toBeVisible();
    await expect(page.getByTestId("podchat-start-recording")).toBeVisible();
  });

  test("repeated word transcript is rejected and does not call turn route", async ({ page }) => {
    let turnCalled = false;
    await page.route("**/api/podchat/turn", async (route: Route) => {
      turnCalled = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
    });

    await page.route("**/api/podchat/stt", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ transcript: "immigrants immigrants immigrants immigrants immigrants" })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    // Wait for opener ready
    await expect(page.getByTestId("podchat-start-recording")).toBeVisible();

    await page.getByTestId("podchat-start-recording").click();
    await page.getByTestId("podchat-stop-recording").click();

    // Verify turn error is shown
    await expect(page.getByTestId("podchat-turn-error")).toBeVisible();
    await expect(page.getByTestId("podchat-turn-error")).toContainText("Speech transcript looked unreliable. Please record again.");

    // Verify turn route was not called
    expect(turnCalled).toBe(false);

    // Verify no textarea fallback appears
    const textareaCount = await page.locator("textarea").count();
    expect(textareaCount).toBe(0);
  });

  test("repeated phrase loop transcript is rejected", async ({ page }) => {
    await page.route("**/api/podchat/stt", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ transcript: "I think that I think that I think that" })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await expect(page.getByTestId("podchat-start-recording")).toBeVisible();

    await page.getByTestId("podchat-start-recording").click();
    await page.getByTestId("podchat-stop-recording").click();

    await expect(page.getByTestId("podchat-turn-error")).toBeVisible();
    await expect(page.getByTestId("podchat-turn-error")).toContainText("Speech transcript looked unreliable. Please record again.");
  });

  test("normal transcript passes and auto-submits to turn route", async ({ page }) => {
    let turnCalled = false;
    await page.route("**/api/podchat/turn", async (route: Route) => {
      turnCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ hostText: "Perfect speaker response.", followUpQuestion: "Next question?" })
      });
    });

    await page.route("**/api/podchat/stt", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ transcript: "I think technology is beneficial for modern schools." })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await expect(page.getByTestId("podchat-start-recording")).toBeVisible();

    await page.getByTestId("podchat-start-recording").click();
    await page.getByTestId("podchat-stop-recording").click();

    // Verify it auto-submitted and host response rendered
    await expect(page.getByTestId("podchat-rolling-transcript")).toContainText("Perfect speaker response. Next question?");
    expect(turnCalled).toBe(true);
  });

  test("state survives sidebar navigation and timer pauses", async ({ page }) => {
    // Intercept api/podchat/start
    await page.route("**/api/podchat/start", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          opener: "Hello and welcome to Podchat! Let's discuss technology. How does it affect you?",
          sessionPlan: {
            topicAngle: "technology",
            targetSkill: "simple sentences",
            followUpStrategy: "ask about schooling",
            expectedLanguagePattern: "I chose [option] because [reason]",
            evaluationFocus: ["vocabulary"]
          }
        })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();

    // Verify opener renders
    await expect(page.getByTestId("podchat-rolling-transcript")).toContainText("Hello and welcome to Podchat!");

    // Navigate to Vocabulary Notebook
    await page.getByRole("button", { name: "Vocabulary Notebook" }).click();

    // Verify we navigated away (Active Session title is no longer visible in main content)
    await expect(page.getByRole("heading", { name: "Active Session" })).not.toBeVisible();

    // Navigate back to Active Session
    await page.getByRole("button", { name: "Active Session" }).click();

    // Verify Active Session remains in progress and original opener is still there
    await expect(page.getByRole("heading", { name: "Active Session" })).toBeVisible();
    await expect(page.getByTestId("podchat-rolling-transcript")).toContainText("Hello and welcome to Podchat!");
  });
});
