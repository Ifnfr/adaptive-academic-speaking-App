import { test, expect } from "@playwright/test";

// A valid Pattern Brief API response for mocking
const MOCK_BRIEF_RESPONSE = {
  briefId: "mock-brief-id-001",
  title: "Claim-Reason-Evidence Structure",
  focus: "Add clear sentence endings to ensure clarity.",
  qualityCriteria: ["State claim clearly", "Support with one reason", "Cite brief evidence"],
  responsePattern: {
    name: "CRE Structure",
    steps: ["[claim]", "because [reason]", "for example [evidence]"],
  },
  miniExample:
    "Technology helps students learn independently. Illustration only — do not copy or memorize.",
  commonMistakes: ["Jumping straight to evidence", "Incomplete thoughts"],
  drillEntryConfig: {
    targetPattern: "CRE Structure",
    targetSteps: ["[claim]", "because [reason]", "for example [evidence]"],
    commonMistakes: ["Jumping straight to evidence", "Incomplete thoughts"],
    suggestedEntryPhase: 1,
  },
};

// A mock "found" weakness API response
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

test.describe("Pattern Drill UI Wiring", () => {
  test.beforeEach(async ({ page }) => {
    // Standard mock auth redirect bypass
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
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Existing tests (preserved with updated assertions for new milestone)
  // ──────────────────────────────────────────────────────────────────────────

  test("asserts latest-weakness API is NOT fetched on initial Active Session Podchat mount", async ({ page }) => {
    let apiCalled = false;
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      apiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "empty" }),
      });
    });

    await page.goto("/");
    // Active session loads Podchat view first
    await expect(page.getByTestId("podchat-setup")).toBeVisible();
    expect(apiCalled).toBe(false);
  });

  test("asserts latest-weakness API is fetched when Pattern Drill mode is entered", async ({ page }) => {
    let apiCalled = false;
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      apiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "empty" }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await expect(page.getByTestId("weakness-empty")).toBeVisible();
    expect(apiCalled).toBe(true);
  });

  test("displays found weakness state with all details — generate button now enabled", async ({ page }) => {
    let apiBriefCalled = false;
    let apiDrillCalled = false;

    await page.route("**/api/pattern-brief/**", async (route) => {
      apiBriefCalled = true;
      await route.fulfill({ status: 404 });
    });
    await page.route("**/api/drill/**", async (route) => {
      apiDrillCalled = true;
      await route.fulfill({ status: 404 });
    });
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_WEAKNESS_FOUND),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();

    // Verify found weakness fields
    await expect(page.getByTestId("weakness-found")).toBeVisible();
    await expect(page.getByText("Add clear sentence endings to ensure clarity.")).toBeVisible();
    await expect(page.getByText("Coherence")).toBeVisible();
    await expect(page.getByText("3 times")).toBeVisible();
    await expect(page.getByText("High (0.80)")).toBeVisible();
    await expect(page.getByText("Did not finish sentence.")).toBeVisible();
    await expect(page.getByText("Focus on endings.")).toBeVisible();

    // Generate button should now be ENABLED for found state (Milestone 5 change)
    const generateBtn = page.getByTestId("generate-brief-btn");
    await expect(generateBtn).toBeEnabled();
    await expect(generateBtn).not.toHaveAttribute("aria-disabled", "true");

    // No Pattern Brief or Drill calls on load
    expect(apiBriefCalled).toBe(false);
    expect(apiDrillCalled).toBe(false);
  });

  test("handles loading, empty, insufficient, and error states gracefully", async ({ page }) => {
    let mockStatus = "loading";

    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      if (mockStatus === "loading") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "loading" }),
        });
      } else if (mockStatus === "empty") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "empty" }),
        });
      } else if (mockStatus === "insufficient") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "insufficient" }),
        });
      } else {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "DB Error" }),
        });
      }
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();

    // Test loading display
    await expect(page.getByTestId("weakness-loading")).toBeVisible();
    await expect(page.getByText("Checking your latest speaking weakness...")).toBeVisible();

    // Test empty
    mockStatus = "empty";
    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await expect(page.getByTestId("weakness-empty")).toBeVisible();
    await expect(page.getByText("No speaking weakness data yet. Complete an evaluated Podchat session first.")).toBeVisible();

    // Test insufficient
    mockStatus = "insufficient";
    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await expect(page.getByTestId("weakness-insufficient")).toBeVisible();
    await expect(
      page.getByText(
        "Your recent feedback is not specific enough for a useful Pattern Brief yet. Complete more evaluated Podchat sessions so Fonetik can detect a repeated pattern."
      )
    ).toBeVisible();

    // Test error
    mockStatus = "error";
    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await expect(page.getByTestId("weakness-error")).toBeVisible();
    await expect(page.getByText("Could not load weakness data. Try again later.")).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // New tests for Milestone 5 — Pattern Brief UI Wiring
  // ──────────────────────────────────────────────────────────────────────────

  test("generate button is disabled and shows explanation for loading/empty/insufficient/error weakness states", async ({ page }) => {
    const states: Array<{ mockStatus: string; weakness?: unknown; testId: string }> = [
      { mockStatus: "loading", testId: "weakness-loading" },
      { mockStatus: "empty", testId: "weakness-empty" },
      { mockStatus: "insufficient", testId: "weakness-insufficient" },
    ];

    for (const { mockStatus, testId } of states) {
      await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: mockStatus }),
        });
      });

      await page.goto("/");
      await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
      await expect(page.getByTestId(testId)).toBeVisible();

      const generateBtn = page.getByTestId("generate-brief-btn");
      await expect(generateBtn).toBeDisabled();
      await expect(generateBtn).toHaveAttribute("aria-disabled", "true");
      // Should also show an explanatory reason
      await expect(page.getByTestId("generate-disabled-reason")).toBeVisible();
    }

    // Error state (HTTP 500)
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "DB Error" }),
      });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await expect(page.getByTestId("weakness-error")).toBeVisible();
    const generateBtn = page.getByTestId("generate-brief-btn");
    await expect(generateBtn).toBeDisabled();
  });

  test("pattern brief API is NOT called on Pattern Drill page load", async ({ page }) => {
    let briefApiCalled = false;
    await page.route("**/api/pattern-brief/**", async (route) => {
      briefApiCalled = true;
      await route.fulfill({ status: 404 });
    });
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_WEAKNESS_FOUND),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    // Wait for weakness to load
    await expect(page.getByTestId("weakness-found")).toBeVisible();

    // Brief API must NOT have been called
    expect(briefApiCalled).toBe(false);
  });

  test("successful generation — sections render in order, slot notation visible, warning shown, drillEntryConfig hidden", async ({ page }) => {
    let capturedRequestBody: Record<string, unknown> | null = null;
    let briefApiCallCount = 0;

    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_WEAKNESS_FOUND),
      });
    });

    await page.route("**/api/pattern-brief/generate", async (route) => {
      briefApiCallCount++;
      capturedRequestBody = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BRIEF_RESPONSE),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await expect(page.getByTestId("weakness-found")).toBeVisible();

    // Click generate
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();

    // Request body checks
    expect(briefApiCallCount).toBe(1);
    expect(capturedRequestBody).toBeDefined();
    expect(capturedRequestBody?.["source"]).toBe("latest_weakness");
    // Must NOT include raw weakness text as trusted input
    expect(capturedRequestBody?.["focus"]).toBeUndefined();
    expect(capturedRequestBody?.["description"]).toBeUndefined();
    expect(capturedRequestBody?.["evidence"]).toBeUndefined();
    expect(capturedRequestBody?.["practiceFocus"]).toBeUndefined();

    // 1. Quality Criteria renders
    const qcSection = page.getByTestId("brief-quality-criteria");
    await expect(qcSection).toBeVisible();
    await expect(qcSection.getByText("State claim clearly")).toBeVisible();
    await expect(qcSection.getByText("Support with one reason")).toBeVisible();

    // 2. Response Pattern renders with slot notation
    const rpSection = page.getByTestId("brief-response-pattern");
    await expect(rpSection).toBeVisible();
    await expect(rpSection.getByText("CRE Structure")).toBeVisible();
    // Slot notation visible
    await expect(rpSection.getByText("[claim]")).toBeVisible();
    await expect(rpSection.getByText("because [reason]")).toBeVisible();
    await expect(rpSection.getByText("for example [evidence]")).toBeVisible();

    // 3. Mini Example renders with warning
    const meSection = page.getByTestId("brief-mini-example");
    await expect(meSection).toBeVisible();
    await expect(page.getByTestId("mini-example-warning")).toBeVisible();
    await expect(page.getByTestId("mini-example-warning")).toContainText("Illustration only");

    // 4. Common Mistakes renders
    const cmSection = page.getByTestId("brief-common-mistakes");
    await expect(cmSection).toBeVisible();
    await expect(cmSection.getByText("Jumping straight to evidence")).toBeVisible();

    // 5. Start Drill placeholder renders and is disabled
    const startDrillBtn = page.getByTestId("start-drill-btn");
    await expect(startDrillBtn).toBeVisible();
    await expect(startDrillBtn).toBeDisabled();

    // drillEntryConfig and suggestedEntryPhase must NOT be visible in the DOM
    await expect(page.getByText("drillEntryConfig")).not.toBeVisible();
    await expect(page.getByText("suggestedEntryPhase")).not.toBeVisible();
    await expect(page.getByText("targetPattern")).not.toBeVisible();

    // Weakness details still visible after generation
    await expect(page.getByTestId("weakness-found")).toBeVisible();
    await expect(page.getByTestId("weakness-found").getByText("Add clear sentence endings to ensure clarity.")).toBeVisible();
  });

  test("generating state — shows loading text and disables button, prevents duplicate API calls", async ({ page }) => {
    let resolveRequest!: () => void;
    const requestBlocked = new Promise<void>((res) => { resolveRequest = res; });
    let callCount = 0;

    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_WEAKNESS_FOUND),
      });
    });

    await page.route("**/api/pattern-brief/generate", async (route) => {
      callCount++;
      // Hold first request pending to test generating state
      await requestBlocked;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BRIEF_RESPONSE),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await expect(page.getByTestId("weakness-found")).toBeVisible();

    // Click generate — the route is held pending
    await page.getByTestId("generate-brief-btn").click();

    // While pending, button should be disabled and show loading text
    await expect(page.getByTestId("generate-brief-btn")).toBeDisabled();
    await expect(page.getByTestId("generate-brief-btn")).toContainText("Building your pattern brief");

    // Click again while generating — must not fire a second request
    await page.getByTestId("generate-brief-btn").click({ force: true });

    // Unblock the route
    resolveRequest();
    await expect(page.getByTestId("brief-generated")).toBeVisible();

    // Only one API call despite duplicate click attempt
    expect(callCount).toBe(1);
  });

  test("error state — shows safe copy only, no internal details, retry is possible", async ({ page }) => {
    let briefCallCount = 0;

    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_WEAKNESS_FOUND),
      });
    });

    // First call fails, second call succeeds
    await page.route("**/api/pattern-brief/generate", async (route) => {
      briefCallCount++;
      if (briefCallCount === 1) {
        await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "provider_unavailable" }) });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_BRIEF_RESPONSE),
        });
      }
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await expect(page.getByTestId("weakness-found")).toBeVisible();

    // First click — triggers error
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-error")).toBeVisible();

    // Safe copy shown
    await expect(page.getByTestId("brief-error")).toContainText("Unable to generate. Please try again.");

    // No internal error details exposed
    await expect(page.getByText("provider_unavailable")).not.toBeVisible();
    await expect(page.getByText("502")).not.toBeVisible();
    await expect(page.getByText("Claude")).not.toBeVisible();

    // Button re-enabled for retry
    await expect(page.getByTestId("generate-brief-btn")).toBeEnabled();

    // Retry click — should succeed
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();
    expect(briefCallCount).toBe(2);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Milestone 7 — Voice/STT Quick Check UI tests
  // ──────────────────────────────────────────────────────────────────────────

  // Helper: inject deterministic MediaRecorder + getUserMedia mocks into the page
  async function injectMediaMocks(page: import("@playwright/test").Page) {
    await page.addInitScript(() => {
      class MockMediaRecorder {
        mimeType: string;
        state: string;
        ondataavailable: ((e: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;

        constructor(_stream: unknown, opts?: { mimeType?: string }) {
          this.mimeType = opts?.mimeType ?? "audio/webm";
          this.state = "inactive";
        }

        start() {
          this.state = "recording";
        }

        stop() {
          this.state = "inactive";
          const chunk = new Blob(["audio"], { type: this.mimeType });
          if (this.ondataavailable) this.ondataavailable({ data: chunk });
          if (this.onstop) this.onstop();
        }

        static isTypeSupported(mime: string) {
          return mime === "audio/webm";
        }
      }

      // @ts-expect-error — override global in test environment
      window.MediaRecorder = MockMediaRecorder;

      Object.defineProperty(navigator, "mediaDevices", {
        writable: true,
        value: {
          getUserMedia: async () => ({
            getTracks: () => [{ stop: () => {} }],
          }),
        },
      });
    });
  }

  test("quick check section is hidden before brief is generated", async ({ page }) => {
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await expect(page.getByTestId("weakness-found")).toBeVisible();

    await expect(page.getByTestId("quick-check-section")).not.toBeVisible();
  });

  test("STT route is NOT called on page load or after brief generation", async ({ page }) => {
    let sttCalled = false;
    await page.route("**/api/podchat/stt", async (route) => {
      sttCalled = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transcript: "test" }) });
    });
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await expect(page.getByTestId("weakness-found")).toBeVisible();
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();

    expect(sttCalled).toBe(false);
  });

  test("quick check route is NOT called on page load or after brief generation", async ({ page }) => {
    let quickCheckCalled = false;
    await page.route("**/api/pattern-drill/quick-check", async (route) => {
      quickCheckCalled = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: "detected", entryPhase: 3 }) });
    });
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();

    expect(quickCheckCalled).toBe(false);
  });

  test("microphone is NOT requested until user clicks Start Speaking", async ({ page }) => {
    await injectMediaMocks(page);
    await page.addInitScript(() => {
      const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (c) => {
        (window as unknown as Record<string, unknown>).__gumCount = ((window as unknown as Record<string, unknown>).__gumCount as number ?? 0) + 1;
        return orig(c);
      };
    });

    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();

    await page.getByTestId("start-quick-check-btn").click();
    await expect(page.getByTestId("quick-check-recording-ready")).toBeVisible();

    const called = await page.evaluate(() => Boolean((window as unknown as Record<string, unknown>).__gumCount));
    expect(called).toBe(false);
  });

  test("starting quick check hides response pattern and mini example before recording", async ({ page }) => {
    await injectMediaMocks(page);
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();

    await expect(page.getByTestId("brief-response-pattern")).toBeVisible();
    await expect(page.getByTestId("brief-mini-example")).toBeVisible();

    await page.getByTestId("start-quick-check-btn").click();

    await expect(page.getByTestId("brief-pattern-hidden")).toBeVisible();
    await expect(page.getByText("Pattern hidden for the check.")).toBeVisible();
    await expect(page.getByTestId("brief-mini-example")).not.toBeVisible();
    await expect(page.getByTestId("brief-quality-criteria")).toBeVisible();
    await expect(page.getByTestId("start-speaking-btn")).toBeVisible();
  });

  test("clicking Start Speaking transitions to recording state", async ({ page }) => {
    await injectMediaMocks(page);
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });
    // Keep STT pending so we can observe "recording" state
    await page.route("**/api/podchat/stt", async (route) => {
      await new Promise<void>((r) => setTimeout(r, 10000));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transcript: "test" }) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();
    await page.getByTestId("start-quick-check-btn").click();

    await page.getByTestId("start-speaking-btn").click();

    await expect(page.getByTestId("quick-check-recording")).toBeVisible();
    await expect(page.getByTestId("stop-recording-btn")).toBeVisible();
  });

  test("stop recording triggers STT upload to /api/podchat/stt exactly once", async ({ page }) => {
    let sttCallCount = 0;

    await injectMediaMocks(page);
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });
    await page.route("**/api/podchat/stt", async (route) => {
      sttCallCount++;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transcript: "Technology helps students learn." }) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();
    await page.getByTestId("start-quick-check-btn").click();
    await page.getByTestId("start-speaking-btn").click();
    await expect(page.getByTestId("stop-recording-btn")).toBeVisible();
    await page.getByTestId("stop-recording-btn").click();

    await expect(page.getByTestId("quick-check-transcript-ready")).toBeVisible({ timeout: 5000 });
    expect(sttCallCount).toBe(1);
  });

  test("successful STT transcript appears in quick-check-transcript", async ({ page }) => {
    const mockTranscript = "Technology helps students learn independently.";

    await injectMediaMocks(page);
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });
    await page.route("**/api/podchat/stt", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transcript: mockTranscript }) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();
    await page.getByTestId("start-quick-check-btn").click();
    await page.getByTestId("start-speaking-btn").click();
    await page.getByTestId("stop-recording-btn").click();

    await expect(page.getByTestId("quick-check-transcript")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("quick-check-transcript")).toHaveText(mockTranscript);
  });

  test("transcript is sent to /api/pattern-drill/quick-check with correct body (no owner/weakness fields)", async ({ page }) => {
    const mockTranscript = "Technology helps students learn independently.";
    const captured: { body: Record<string, unknown> | null } = { body: null };

    await injectMediaMocks(page);
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });
    await page.route("**/api/podchat/stt", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transcript: mockTranscript }) });
    });
    await page.route("**/api/pattern-drill/quick-check", async (route) => {
      captured.body = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: "detected", entryPhase: 3 }) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();
    await page.getByTestId("start-quick-check-btn").click();
    await page.getByTestId("start-speaking-btn").click();
    await page.getByTestId("stop-recording-btn").click();
    await expect(page.getByTestId("quick-check-transcript")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("submit-check-btn").click();

    await expect(page.getByTestId("quick-check-result")).toBeVisible({ timeout: 5000 });

    const body = captured.body!;
    expect(body.briefId).toBe(MOCK_BRIEF_RESPONSE.briefId);
    expect(body.transcript).toBe(mockTranscript);
    expect((body.responsePattern as Record<string, unknown>).name).toBe(MOCK_BRIEF_RESPONSE.responsePattern.name);
    expect(body.ownerId).toBeUndefined();
    expect(body.owner_id).toBeUndefined();
    expect(body.drillEntryConfig).toBeUndefined();
    expect(body.description).toBeUndefined();
    expect(body.evidence).toBeUndefined();
  });

  test("detected result shows Phase 3 copy", async ({ page }) => {
    await injectMediaMocks(page);
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });
    await page.route("**/api/podchat/stt", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transcript: "My sentence." }) });
    });
    await page.route("**/api/pattern-drill/quick-check", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: "detected", entryPhase: 3 }) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();
    await page.getByTestId("start-quick-check-btn").click();
    await page.getByTestId("start-speaking-btn").click();
    await page.getByTestId("stop-recording-btn").click();
    await expect(page.getByTestId("quick-check-transcript")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("submit-check-btn").click();

    await expect(page.getByTestId("quick-check-result")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Pattern detected. Future Drill will start from Phase 3.")).toBeVisible();
    await expect(page.getByTestId("start-drill-btn")).toBeEnabled();
    await expect(page.getByText("Start the repetition drill (Phase 3).")).toBeVisible();
  });

  test("not_detected_or_partial result shows Phase 1 copy", async ({ page }) => {
    await injectMediaMocks(page);
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });
    await page.route("**/api/podchat/stt", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transcript: "I like things." }) });
    });
    await page.route("**/api/pattern-drill/quick-check", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: "not_detected_or_partial", entryPhase: 1 }) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();
    await page.getByTestId("start-quick-check-btn").click();
    await page.getByTestId("start-speaking-btn").click();
    await page.getByTestId("stop-recording-btn").click();
    await expect(page.getByTestId("quick-check-transcript")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("submit-check-btn").click();

    await expect(page.getByTestId("quick-check-result")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Pattern not clearly detected. Future Drill will start from Phase 1.")).toBeVisible();
    await expect(page.getByTestId("start-drill-btn")).toBeEnabled();
    await expect(page.getByText("Start the repetition drill (Phase 1).")).toBeVisible();
  });

  test("skip from idle — Phase 1, STT and quick-check routes NOT called", async ({ page }) => {
    let sttCalled = false;
    let qcCalled = false;

    await page.route("**/api/podchat/stt", async (route) => {
      sttCalled = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transcript: "test" }) });
    });
    await page.route("**/api/pattern-drill/quick-check", async (route) => {
      qcCalled = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: "detected", entryPhase: 3 }) });
    });
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();
    await page.getByTestId("skip-check-btn-idle").click();

    await expect(page.getByTestId("quick-check-result")).toBeVisible();
    await expect(page.getByText("Quick check skipped. Future Drill will start from Phase 1.")).toBeVisible();
    await expect(page.getByTestId("start-drill-btn")).toBeEnabled();
    await expect(page.getByText("Start the repetition drill (Phase 1).")).toBeVisible();

    expect(sttCalled).toBe(false);
    expect(qcCalled).toBe(false);
  });

  test("STT failure shows safe copy and Record Again button", async ({ page }) => {
    await injectMediaMocks(page);
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });
    await page.route("**/api/podchat/stt", async (route) => {
      await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "provider_unavailable" }) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();
    await page.getByTestId("start-quick-check-btn").click();
    await page.getByTestId("start-speaking-btn").click();
    await page.getByTestId("stop-recording-btn").click();

    await expect(page.getByTestId("quick-check-error-stt")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Speech transcription failed. Please try recording again.")).toBeVisible();
    await expect(page.getByText("provider_unavailable")).not.toBeVisible();
    await expect(page.getByText("502")).not.toBeVisible();
    await expect(page.getByTestId("record-again-btn")).toBeVisible();
    await expect(page.getByTestId("start-drill-btn")).toBeDisabled();
  });

  test("quick-check failure shows safe copy and retry is possible", async ({ page }) => {
    await injectMediaMocks(page);
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });
    await page.route("**/api/podchat/stt", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transcript: "My sentence." }) });
    });
    await page.route("**/api/pattern-drill/quick-check", async (route) => {
      await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "provider_unavailable" }) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();
    await page.getByTestId("start-quick-check-btn").click();
    await page.getByTestId("start-speaking-btn").click();
    await page.getByTestId("stop-recording-btn").click();
    await expect(page.getByTestId("quick-check-transcript")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("submit-check-btn").click();

    await expect(page.getByTestId("quick-check-error-check")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Unable to check that sentence. Please try again.")).toBeVisible();
    await expect(page.getByText("provider_unavailable")).not.toBeVisible();
    await expect(page.getByTestId("retry-check-btn")).toBeVisible();
    await expect(page.getByTestId("start-drill-btn")).toBeDisabled();
  });

  test("record again clears transcript and permits a new recording", async ({ page }) => {
    let sttCallCount = 0;

    await injectMediaMocks(page);
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });
    await page.route("**/api/podchat/stt", async (route) => {
      sttCallCount++;
      const t = sttCallCount === 1 ? "First recording." : "Second recording.";
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transcript: t }) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();
    await page.getByTestId("start-quick-check-btn").click();

    // First recording
    await page.getByTestId("start-speaking-btn").click();
    await page.getByTestId("stop-recording-btn").click();
    await expect(page.getByTestId("quick-check-transcript")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("quick-check-transcript")).toHaveText("First recording.");

    // Click Record Again
    await page.getByTestId("record-again-btn").click();
    await expect(page.getByTestId("quick-check-recording-ready")).toBeVisible();
    await expect(page.getByTestId("quick-check-transcript")).not.toBeVisible();

    // Second recording
    await page.getByTestId("start-speaking-btn").click();
    await page.getByTestId("stop-recording-btn").click();
    await expect(page.getByTestId("quick-check-transcript")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("quick-check-transcript")).toHaveText("Second recording.");

    expect(sttCallCount).toBe(2);
  });

  test("no localStorage or sessionStorage writes occur during the full flow", async ({ page }) => {
    await injectMediaMocks(page);
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });
    await page.route("**/api/podchat/stt", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transcript: "My sentence." }) });
    });
    await page.route("**/api/pattern-drill/quick-check", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: "detected", entryPhase: 3 }) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();
    await page.getByTestId("start-quick-check-btn").click();
    await page.getByTestId("start-speaking-btn").click();
    await page.getByTestId("stop-recording-btn").click();
    await expect(page.getByTestId("quick-check-transcript")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("submit-check-btn").click();
    await expect(page.getByTestId("quick-check-result")).toBeVisible({ timeout: 5000 });

    const patternDrillKeys = await page.evaluate(() => {
      // Collect all localStorage + sessionStorage keys belonging to Pattern Drill.
      // Clerk and other framework libs may write their own keys — we only care
      // that Pattern Drill does not persist transcript, audio, brief, or drill context.
      const keywords = ["transcript", "brief", "drill", "audio", "quick", "pattern"];
      const localKeys = Object.keys(window.localStorage).filter((k) =>
        keywords.some((kw) => k.toLowerCase().includes(kw))
      );
      const sessionKeys = Object.keys(window.sessionStorage).filter((k) =>
        keywords.some((kw) => k.toLowerCase().includes(kw))
      );
      return [...localKeys, ...sessionKeys];
    });
    expect(patternDrillKeys).toHaveLength(0);
  });


  test("start drill button is enabled after detected result and clicking it starts Phase 2 directly", async ({ page }) => {
    await injectMediaMocks(page);
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });
    await page.route("**/api/podchat/stt", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ transcript: "My sentence." }) });
    });
    await page.route("**/api/pattern-drill/quick-check", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: "detected", entryPhase: 3 }) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();
    await page.getByTestId("start-quick-check-btn").click();
    await page.getByTestId("start-speaking-btn").click();
    await page.getByTestId("stop-recording-btn").click();
    await expect(page.getByTestId("quick-check-transcript")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("submit-check-btn").click();
    await expect(page.getByTestId("quick-check-result")).toBeVisible({ timeout: 5000 });

    const startBtn = page.getByTestId("start-drill-btn");
    await expect(startBtn).toBeEnabled();
    await startBtn.click();

    // Directly in Phase 2
    const phaseIndicator = page.getByTestId("phase-indicator");
    await expect(phaseIndicator).toContainText("Phase 2");
    await expect(page.getByTestId("phase3-deferred-notice")).toBeVisible();
  });

  test("skip quick check starts Phase 1 and progresses through exactly two prompts to Phase 2", async ({ page }) => {
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();

    // Skip
    await page.getByTestId("skip-check-btn-idle").click();
    await page.getByTestId("start-drill-btn").click();

    // Phase 1 Cold Recall
    await expect(page.getByTestId("phase-indicator")).toContainText("Phase 1 — Cold Recall");
    await expect(page.getByTestId("drill-prompt-text")).toContainText("Online Education");

    // Submit Prompt 1
    await page.getByTestId("drill-transcript-input").fill("My response 1");
    await page.getByTestId("drill-submit-btn").click();

    // Prompt 2
    await expect(page.getByTestId("drill-prompt-text")).toContainText("Renewable Energy");
    await page.getByTestId("drill-transcript-input").fill("My response 2");
    await page.getByTestId("drill-submit-btn").click();

    // Transition to Phase 2
    await expect(page.getByTestId("phase-indicator")).toContainText("Phase 2 — Contrastive Repetition");
  });

  test("Phase 2 collapsed disclosure and evaluation turn credits", async ({ page }) => {
    let turnCount = 0;
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });
    await page.route("**/api/pattern-drill/drill-turn", async (route) => {
      turnCount++;
      const req = route.request().postDataJSON();
      expect(req.phase).toBe(2);
      expect(req.attemptNumber).toBe(turnCount);

      if (turnCount === 1) {
        // First turn partial
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            credit: "partial",
            missingSteps: ["[reason]"],
            usedSteps: ["[claim]", "because"],
            shortFeedback: "Missing slot: [reason].",
          }),
        });
      } else {
        // Second turn full
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            credit: "full",
            missingSteps: [],
            usedSteps: ["[claim]", "because", "[reason]"],
            shortFeedback: "Good.",
          }),
        });
      }
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await page.getByTestId("generate-brief-btn").click();
    await expect(page.getByTestId("brief-generated")).toBeVisible();
    await page.getByTestId("skip-check-btn-idle").click();
    await page.getByTestId("start-drill-btn").click();

    // Progress through Phase 1
    await page.getByTestId("drill-transcript-input").fill("Answer 1");
    await page.getByTestId("drill-submit-btn").click();
    await page.getByTestId("drill-transcript-input").fill("Answer 2");
    await page.getByTestId("drill-submit-btn").click();

    // Phase 2
    await expect(page.getByTestId("phase-indicator")).toContainText("Phase 2");

    // Pattern Reference disclosure collapsed by default
    await expect(page.getByTestId("pattern-ref-steps")).not.toBeVisible();
    await page.getByTestId("toggle-pattern-ref-btn").click();
    await expect(page.getByTestId("pattern-ref-steps")).toBeVisible();

    // Turn 1: Partial Credit
    await page.getByTestId("drill-transcript-input").fill("My attempt 1");
    await page.getByTestId("drill-submit-btn").click();

    await expect(page.getByTestId("drill-feedback-text")).toContainText("Missing slot: [reason].");
    await expect(page.getByTestId("drill-retry-prompt")).toBeVisible();

    // Turn 2: Full Credit
    await page.getByTestId("drill-transcript-input").fill("My attempt 2 corrected");
    await page.getByTestId("drill-submit-btn").click();

    await expect(page.getByTestId("drill-feedback-text")).toContainText("Good.");
    await page.getByTestId("drill-next-btn").click();
  });

  test("Phase 2 topic simplification after 3 No Credit failures", async ({ page }) => {
    let callIndex = 0;
    await page.route("**/api/pattern-drill/latest-weakness", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_WEAKNESS_FOUND) });
    });
    await page.route("**/api/pattern-brief/generate", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BRIEF_RESPONSE) });
    });
    await page.route("**/api/pattern-drill/drill-turn", async (route) => {
      callIndex++;
      const req = route.request().postDataJSON();
      expect(req.attemptNumber).toBe(callIndex);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          credit: "none",
          missingSteps: ["[claim]", "because", "[reason]"],
          usedSteps: [],
          shortFeedback: "You said nothing relevant.",
        }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Pattern Drill (Prototype)" }).click();
    await page.getByTestId("generate-brief-btn").click();
    await page.getByTestId("skip-check-btn-idle").click();
    await page.getByTestId("start-drill-btn").click();

    // P1
    await page.getByTestId("drill-transcript-input").fill("A");
    await page.getByTestId("drill-submit-btn").click();
    await page.getByTestId("drill-transcript-input").fill("B");
    await page.getByTestId("drill-submit-btn").click();

    // Attempt 1 (No Credit)
    await page.getByTestId("drill-transcript-input").fill("Attempt 1");
    await page.getByTestId("drill-submit-btn").click();

    // Attempt 2 (No Credit)
    await page.getByTestId("drill-transcript-input").fill("Attempt 2");
    await page.getByTestId("drill-submit-btn").click();

    // Attempt 3 (No Credit) - triggers simplification
    await page.getByTestId("drill-transcript-input").fill("Attempt 3");
    await page.getByTestId("drill-submit-btn").click();

    // Notice shown and topic simplified (input is cleared and ready for new turn on simplified topic)
    await expect(page.getByTestId("simplified-notice")).toBeVisible();
    await expect(page.getByTestId("drill-prompt-text")).toContainText("eating healthy");
    await expect(page.getByTestId("drill-transcript-input")).toHaveValue("");
    expect(callIndex).toBe(3);
  });
});
