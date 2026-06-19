import { expect, test, type Page } from "@playwright/test";

const MOCK_WEAKNESS_FOUND = {
  status: "found",
  weakness: {
    title: "No sentence endings",
    description: "Add clear sentence endings to ensure clarity.",
    category: "Coherence",
    label: "No sentence endings",
    evidence: "Did not finish sentence.",
    practiceFocus: "Focus on endings.",
    failureCount: 3,
    lastSeenAt: "2026-06-10T12:00:00Z",
    derivedConfidence: 0.8,
  },
};

const MOCK_BRIEF = {
  briefId: "mock-brief-id-001",
  title: "Claim-Reason-Evidence Structure",
  focus: "Add clear sentence endings to ensure clarity.",
  qualityCriteria: ["State claim clearly", "Support with one reason", "Cite brief evidence"],
  responsePattern: {
    name: "CRE Structure",
    steps: ["[claim]", "because [reason]", "for example [evidence]"],
    spokenModelFragment: "I think this matters because it changes the evidence.",
  },
  miniExample: "Technology helps students learn independently because it gives flexible access.",
  commonMistakes: ["Jumping straight to evidence", "Incomplete thoughts"],
};

function makeSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sessionId: "session-001",
    currentPhase: 0,
    briefContent: MOCK_BRIEF,
    phase1Results: [],
    phase2Results: [],
    phase3Results: [],
    entryPhase: null,
    ...overrides,
  };
}

async function openDrillMode(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Drill Mode" }).click();
}

async function injectMediaMocks(page: Page) {
  await page.addInitScript(() => {
    class MockMediaRecorder {
      mimeType: string;
      state = "inactive";
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(_stream: unknown, opts?: { mimeType?: string }) {
        this.mimeType = opts?.mimeType ?? "audio/webm";
      }

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["audio"], { type: this.mimeType }) });
        this.onstop?.();
      }

      static isTypeSupported(mime: string) {
        return mime === "audio/webm";
      }
    }

    window.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop: () => {} }],
        }),
      },
    });
  });
}

async function installStandardRoutes(page: Page, sttTranscripts: string[]) {
  await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_WEAKNESS_FOUND),
    });
  });

  await page.route("**/api/drill-session/start", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeSession()),
    });
  });

  await page.route("**/api/podchat/stt", async (route) => {
    const transcript = sttTranscripts.shift() ?? "A spoken drill answer.";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ transcript }),
    });
  });

  await page.route("**/api/drill-session/turn", async (route) => {
    const body = route.request().postDataJSON() as {
      session: ReturnType<typeof makeSession>;
      phase: "quick_check" | 1 | 2 | 3;
      topic?: string;
      attemptNumber?: 1 | 2 | 3;
      roundSeconds?: number;
      roundIndex?: number;
      simplifiedTopicUsed?: boolean;
    };

    if (body.phase === "quick_check") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: { ...body.session, currentPhase: 1, entryPhase: 1 },
          turnResult: { phase: "quick_check", result: "not_detected_or_partial", entryPhase: 1 },
        }),
      });
      return;
    }

    if (body.phase === 1) {
      const phase1Results = [
        ...body.session.phase1Results,
        { phase: 1, detected: true, topic: body.topic },
      ];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: {
            ...body.session,
            currentPhase: phase1Results.length >= 2 ? 2 : 1,
            phase1Results,
          },
          turnResult: { phase: 1, detected: true, topic: body.topic },
        }),
      });
      return;
    }

    if (body.phase === 2) {
      const turnResult = {
        phase: 2,
        credit: "full",
        missingSteps: [],
        usedSteps: ["[claim]", "because [reason]", "for example [evidence]"],
        shortFeedback: "Good pattern use.",
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: {
            ...body.session,
            currentPhase: 2,
            phase2Results: [
              ...body.session.phase2Results,
              {
                ...turnResult,
                topic: body.topic,
                attemptNumber: body.attemptNumber,
                simplifiedTopicUsed: body.simplifiedTopicUsed,
              },
            ],
          },
          turnResult,
        }),
      });
      return;
    }

    const turnResult = {
      phase: 3,
      patternDetected: true,
      usedSteps: ["[claim]", "because [reason]"],
      missingSteps: [],
      timedOut: false,
      shortFeedback: "Clear under pressure.",
    };
    const phase3Results = [
      ...body.session.phase3Results,
      {
        ...turnResult,
        roundSeconds: body.roundSeconds,
        roundIndex: body.roundIndex,
      },
    ];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: {
          ...body.session,
          currentPhase: phase3Results.length >= 4 ? "complete" : 3,
          phase3Results,
        },
        turnResult,
      }),
    });
  });

  await page.route("**/api/drill-session/complete", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        phase1BaselineCompleteness: "complete",
        phase2Accuracy: 100,
        fullCreditCount: 2,
        partialCreditCount: 0,
        noCreditCount: 0,
        evaluatedAttemptCount: 2,
        finalFullCreditStreak: 2,
        mostMissedSteps: [],
        simplifiedTopicUsed: false,
        improvementSignal: "strong",
        nextSessionRecommendation: "Pattern mastered. Ready for full context speaking.",
        weaknessUpdate: null,
        phase3PressureAccuracy: 100,
        pressureFailRate: 0,
        saved: true,
        session: { ...(route.request().postDataJSON() as Record<string, unknown>), currentPhase: "complete" },
      }),
    });
  });
}

async function recordOneAttempt(page: Page) {
  await page.getByTestId("start-speaking-btn").click();
  await page.getByTestId("stop-recording-btn").click();
}

test.describe("Big-2 Drill Mode single-flow spoken UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (
        url.pathname === "/" &&
        !url.searchParams.has("mockAuth") &&
        route.request().resourceType() === "document"
      ) {
        url.searchParams.set("mockAuth", "true");
        await route.fulfill({ status: 302, headers: { location: url.toString() } });
        return;
      }
      await route.continue();
    });
  });

  test("does not fetch latest weakness until Drill Mode is opened", async ({ page }) => {
    let weaknessCalled = false;
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      weaknessCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "empty" }),
      });
    });

    await page.goto("/");
    await expect(page.getByTestId("podchat-setup")).toBeVisible();
    expect(weaknessCalled).toBe(false);

    await page.getByRole("button", { name: "Drill Mode" }).click();
    await expect(page.getByTestId("weakness-empty")).toBeVisible();
    expect(weaknessCalled).toBe(true);
  });

  test("generates Phase 0 through drill-session start and not legacy Pattern Brief route", async ({ page }) => {
    let startCalled = false;
    let legacyPatternBriefCalled = false;

    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_WEAKNESS_FOUND),
      });
    });
    await page.route("**/api/drill-session/start", async (route) => {
      startCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeSession()),
      });
    });
    await page.route("**/api/pattern-brief/**", async (route) => {
      legacyPatternBriefCalled = true;
      await route.fulfill({ status: 404 });
    });

    await openDrillMode(page);
    await expect(page.getByTestId("weakness-found")).toBeVisible();
    await page.getByTestId("generate-brief-btn").click();

    await expect(page.getByTestId("brief-generated")).toBeVisible();
    await expect(page.getByTestId("brief-response-pattern")).toContainText("CRE Structure");
    expect(startCalled).toBe(true);
    expect(legacyPatternBriefCalled).toBe(false);
  });

  test("removes Phase 0 from DOM after Start Drill and keeps spoken phases free of visual crutches", async ({ page }) => {
    await injectMediaMocks(page);
    await installStandardRoutes(page, [
      "Quick check spoken answer.",
      "Phase one baseline answer.",
      "Phase one second answer.",
      "Phase two first answer.",
    ]);

    await openDrillMode(page);
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-response-pattern")).toContainText("[claim]");

    await page.getByTestId("start-drill-btn").click();
    await expect(page.getByTestId("brief-response-pattern")).toHaveCount(0);
    await expect(page.getByTestId("brief-mini-example")).toHaveCount(0);
    await expect(page.getByTestId("brief-common-mistakes")).toHaveCount(0);
    await expect(page.getByText("[claim]")).toHaveCount(0);

    await recordOneAttempt(page);
    await expect(page.getByTestId("phase-indicator")).toContainText("Phase 1 - Cold Recall");
    await expect(page.getByText("Quick check spoken answer.")).toHaveCount(0);
    await expect(page.getByText("[claim]")).toHaveCount(0);

    await recordOneAttempt(page);
    await expect(page.getByTestId("baseline-result")).toContainText("Baseline response recorded");
    await expect(page.getByText("Phase one baseline answer.")).toHaveCount(0);

    await recordOneAttempt(page);
    await expect(page.getByTestId("phase-indicator")).toContainText("Phase 2 - Contrastive Repetition");
    await expect(page.getByText("[claim]")).toHaveCount(0);

    await recordOneAttempt(page);
    await expect(page.getByTestId("drill-feedback-text")).toContainText("Good pattern use.");
    await expect(page.getByText("Phase two first answer.")).toHaveCount(0);
    await expect(page.getByTestId("drill-transcript-input")).toHaveCount(0);
  });

  test("runs Phase 3 through drill-session turns and completes with in-place summary", async ({ page }) => {
    await injectMediaMocks(page);
    await installStandardRoutes(page, [
      "Quick check spoken answer.",
      "Phase one baseline answer.",
      "Phase one second answer.",
      "Phase two first answer.",
      "Phase two second answer.",
      "Pressure answer one.",
      "Pressure answer two.",
      "Pressure answer three.",
      "Pressure answer four.",
    ]);

    await openDrillMode(page);
    await page.getByTestId("generate-brief-btn").click();
    await page.getByTestId("start-drill-btn").click();

    await recordOneAttempt(page);
    await recordOneAttempt(page);
    await recordOneAttempt(page);
    await recordOneAttempt(page);
    await page.getByTestId("drill-next-btn").click();
    await recordOneAttempt(page);
    await page.getByTestId("drill-next-btn").click();

    await expect(page.getByTestId("phase-indicator")).toContainText("Phase 3 - Pressure Test");
    for (let round = 0; round < 4; round += 1) {
      await page.getByTestId("start-pressure-round-btn").click();
      await expect(page.getByTestId("pressure-countdown")).toBeVisible();
      await recordOneAttempt(page);
      if (round < 3) {
        await page.getByTestId("pressure-next-btn").click();
      }
    }

    await expect(page.getByTestId("drill-session-summary")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("summary-save-status")).toContainText("Saved to your practice history.");
    await expect(page.getByText("Pressure answer four.")).toHaveCount(0);

    await page.getByRole("button", { name: "New Session" }).click();
    await expect(page.getByTestId("drill-session-summary")).toHaveCount(0);
    await expect(page.getByTestId("brief-generated")).toBeVisible();
    await expect(page.getByTestId("brief-response-pattern")).toContainText("CRE Structure");
    await expect(page.getByTestId("start-drill-btn")).toBeVisible();
  });
});
