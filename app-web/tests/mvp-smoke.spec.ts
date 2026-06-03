import { test, expect } from "@playwright/test";

test.describe("MVP Smoke Flows", () => {
  // Test A: App loads
  test("A. App loads and renders sidebar/navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("img[alt=\"fonetik logo\"]")).toBeVisible();
    await expect(page.locator("aside")).toContainText("Active Session");
    await expect(page.locator("aside")).toContainText("Vocabulary Notebook");
    await expect(page.locator("aside")).toContainText("Article Practice");
    await expect(page.locator("header")).toContainText("Local only");
    await expect(
      page.getByRole("button", { name: /restore cloud data|import cloud data/i }),
    ).toHaveCount(0);
  });

  // Test B: Podchat Phase 1 basic flow
  test("B. Podchat Phase 1 local flow without providers or audio", async ({
    page,
  }) => {
    const providerCalls: string[] = [];

    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia() {
            (window as unknown as { __PODCHAT_MIC_REQUESTED__?: boolean })
              .__PODCHAT_MIC_REQUESTED__ = true;
            return Promise.reject(new Error("Microphone must not be requested"));
          },
        },
      });
    });

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
    await page.route("**/api/podchat/turn", async (route) => {
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
    await page.route("**/api/podchat/evaluate", async (route) => {
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

    await page.goto("/");

    await expect(page.getByTestId("podchat-setup")).toBeVisible();
    await page.getByRole("radio", { name: "Economics" }).click();
    await expect(page.getByRole("radio", { name: "Economics" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByRole("radio", { name: /Advanced/ }).click();
    await expect(page.getByRole("radio", { name: /Advanced/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await expect(page.getByTestId("podchat-speaking")).toBeVisible();
    // Duration-based session: time left shown instead of turn count
    await expect(page.getByTestId("podchat-time-left")).toBeVisible();
    await expect(page.getByTestId("podchat-time-left")).toContainText("Time left:");
    await expect(page.getByTestId("podchat-turns-completed")).toContainText("Turns completed:");
    await page.getByTestId("podchat-start-recording").click();
    await page.getByTestId("podchat-stop-recording").click();
    await expect(page.getByTestId("podchat-locked-transcript")).toBeVisible();
    await page.getByTestId("podchat-submit-turn").click();
    await expect(page.getByTestId("podchat-rolling-transcript")).toContainText(
      "Learner",
    );
    await page.getByRole("button", { name: "End Session" }).click();
    await expect(page.getByTestId("podchat-evaluation")).toBeVisible();
    await expect(page.getByTestId("podchat-evaluation-success")).toBeVisible();

    const microphoneRequested = await page.evaluate(() =>
      Boolean(
        (window as unknown as { __PODCHAT_MIC_REQUESTED__?: boolean })
          .__PODCHAT_MIC_REQUESTED__,
      ),
    );
    const storageSnapshot = await page.evaluate(() => JSON.stringify(localStorage));

    expect(microphoneRequested).toBe(false);
    expect(providerCalls).toEqual([]);
    expect(storageSnapshot).not.toMatch(/audioBlob|recordingUrl|blob:/i);
  });

  // Test C: Vocabulary Notebook
  test("C. Vocabulary Notebook basic operations", async ({ page }) => {
    // Intercept vocabulary correction API
    await page.route("**/api/vocabulary-correction", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "natural",
          explanation: "Good usage of clarify.",
          correctedSentence: "Let me clarify this issue.",
          collocationTip: "clarify the meaning, clarify the context",
          retryInstruction: "Try another context.",
          targetUsageRole:
            "Here, clarify functions as a verb meaning to make something clear.",
          warnings: [],
        }),
      });
    });

    await page.goto("/");

    // Navigate to Vocabulary Notebook
    await page.click("button:has-text(\"Vocabulary Notebook\")");

    // Fill word and meaning
    await page.locator("#vocab-word").fill("clarify");
    await page.locator("#vocab-meaning").fill("to make clear");
    await page.click("button:has-text(\"Add Vocabulary\")");

    // Verify word added to recent preview
    await expect(page.locator("p:has-text(\"clarify\")").first()).toBeVisible();

    // Active recall opens a fixed practice card
    await page.click("button:has-text(\"Start Practice\")");
    await expect(page.locator("text=Card 1 of 1")).toBeVisible();
    await expect(page.locator("h3:has-text(\"clarify\")")).toBeVisible();

    // Sentence practice without word should fail validation
    await page.locator("#vocab-sentence").fill("I want to explain the details.");
    await page.click("button:has-text(\"Submit Sentence\")");
    await expect(page.locator("p[role=\"status\"]")).toContainText(
      "Use the vocabulary word in your sentence first.",
    );

    // Sentence practice with word should succeed
    await page.locator("#vocab-sentence").fill("I want to clarify the details.");
    await page.click("button:has-text(\"Submit Sentence\")");
    await expect(page.locator("p[role=\"status\"]")).toContainText(
      "Sentence saved.",
    );

    // Sentence should appear under saved list, click Check Usage
    await page.click("button:has-text(\"Check Usage\")");

    // Correction feedback should load and display
    await expect(page.locator("span:has-text(\"Natural\")")).toBeVisible();
    await expect(
      page.locator("p:has-text(\"Good usage of clarify.\")"),
    ).toBeVisible();
    await expect(
      page.locator("text=Target role in your sentence"),
    ).toBeVisible();

    // Complete the recall session, then open full dictionary management
    await page.click("button:has-text(\"Finish Session\")");
    await expect(page.locator("h3:has-text(\"Session complete\")")).toBeVisible();
    await expect(
      page.locator("text=Completion XP requires 5 saved sentences"),
    ).toBeVisible();
    await page.click("button:has-text(\"Back to Vocabulary Notebook\")");
    await page.click("button:has-text(\"View All / Manage Vocabulary\")");
    await expect(page.locator("h3:has-text(\"All vocabulary\")")).toBeVisible();
    await expect(page.locator("text=Sentence history: 1")).toBeVisible();

    // Delete item from dictionary mode
    await page.click("button:has-text(\"Delete\")");
    await expect(page.locator("p:has-text(\"clarify\")").first()).not.toBeVisible();
  });

  // Test D: Article Practice UI
  test("D. Article Practice view loads and accepts input", async ({ page }) => {
    await page.goto("/");
    await page.click("button:has-text(\"Article Practice\")");

    await expect(page.locator("h2:has-text(\"Article Practice\")")).toBeVisible();
    await expect(page.locator("#article-url")).toBeVisible();
    await expect(page.locator("#article-focus")).toBeVisible();
    await expect(
      page.locator("button:has-text(\"Generate Practice\")"),
    ).toBeVisible();
  });

  // Test E: Gamification UI
  test("E. Gamification UI renders without crash", async ({ page }) => {
    await page.goto("/");
    await page.click("button:has-text(\"Progress\")");

    // Should render Speaker Level panel and claim button
    await expect(page.locator("p:has-text(\"Speaker Level\")").first()).toBeVisible();
    await expect(page.locator("button:has-text(\"Claim XP\")")).toBeVisible();
  });

  // Test F: Article -> Podchat navigation
  test("F. Article Practice opens Podchat without starting capture", async ({
    page,
  }) => {
    // Intercept article-practice API
    await page.route("**/api/article-practice", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sourceTitle: "Test Article Title",
          sourceUrl: "https://example.com/test-article",
          sourceDomain: "example.com",
          articleBrief: "Brief summary.",
          mainIdea: "Main idea.",
          keyPoints: ["Point 1", "Point 2"],
          usefulVocabulary: [
            { word: "synthesize", meaning: "combine", whyUseful: "academic" },
          ],
          comprehensionChecks: ["Check 1"],
          speakingTask: {
            title: "Synthesize the Findings",
            instruction: "Explain how synthesis works.",
            timeLimitSeconds: 120,
            targetStructure: ["Structure 1", "Structure 2"],
          },
          followUpQuestions: ["Follow up"],
          warnings: [],
        }),
      });
    });

    await page.goto("/");
    await page.click("button:has-text(\"Article Practice\")");

    // Fill URL and generate practice
    await page.locator("#article-url").fill("https://example.com/test-article");
    await page.click("button:has-text(\"Generate Practice\")");

    // Verify generated task title is visible
    await expect(
      page.locator("h4:has-text(\"Synthesize the Findings\")"),
    ).toBeVisible();

    // Click bridge button
    await page.click("button:has-text(\"Practice This Speaking Task\")");

    // The bridge now lands on the Podchat setup, without old Active Practice UI
    // and without auto-starting capture or a speaking screen.
    await expect(page.getByTestId("podchat-setup")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Economics" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Technology" })).toBeVisible();
    await expect(
      page.locator("h2:has-text(\"Speaking prompt\")"),
    ).not.toBeVisible();
    await expect(
      page.locator("h2:has-text(\"Speaking attempt\")"),
    ).not.toBeVisible();
    await expect(page.getByTestId("podchat-speaking")).toHaveCount(0);
  });
});
