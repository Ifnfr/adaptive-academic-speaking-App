import { test, expect, Route } from "@playwright/test";

test.describe("Podchat Phase 1 connected UI", () => {
  test.beforeEach(async ({ page }) => {
    // Add init script to monitor microphone access
    await page.addInitScript(() => {
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
    });
  });

  test("runs full setup, speaking, and evaluation with mocked API routes", async ({ page }) => {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let receivedPayload: any = null;
    await page.route("**/api/podchat/turn", async (route: Route) => {
      receivedPayload = route.request().postDataJSON();
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let receivedEvalPayload: any = null;
    await page.route("**/api/podchat/evaluate", async (route: Route) => {
      receivedEvalPayload = route.request().postDataJSON();
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

    // 1. Setup renders
    await expect(page.getByTestId("podchat-setup")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Economics" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Technology" })).toBeVisible();

    // 2. Selecting topic and difficulty works
    await page.getByRole("radio", { name: "Economics" }).click();
    await expect(page.getByRole("radio", { name: "Economics" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("radio", { name: "Technology" }).click();
    await expect(page.getByRole("radio", { name: "Technology" })).toHaveAttribute("aria-checked", "true");

    await page.getByRole("radio", { name: /Beginner/ }).click();
    await page.getByRole("radio", { name: /Intermediate/ }).click();
    await expect(page.getByRole("radio", { name: /Intermediate/ })).toHaveAttribute("aria-checked", "true");

    // 3. Start a Podchat transitions to speaking
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await expect(page.getByTestId("podchat-speaking")).toBeVisible();
    await expect(page.getByTestId("podchat-turn-progress")).toContainText("Turn 1 of 5");
    await expect(page.getByTestId("podchat-status")).toContainText("Your turn");

    // 4. Submit Turn calls /api/podchat/turn
    await page.getByRole("button", { name: "Mock learner answer" }).click();
    await page.getByRole("button", { name: "Submit Turn" }).click();

    // Wait for API turn to resolve and check payload
    await expect(page.getByTestId("podchat-turn-progress")).toContainText("Turn 2 of 5");
    expect(receivedPayload).toEqual({
      topic: "Technology",
      difficulty: "Intermediate",
      turnIndex: 0,
      maxUserTurns: 5,
      turns: [
        { speaker: "host", text: "Welcome to Podchat. Let's explore how technology changes the way people study and work. Which technology trend feels most important to you right now?" },
        { speaker: "learner", text: "I think technology changes learning because people can access information faster and practice more independently." }
      ]
    });

    // 5. Mocked response appears in rolling transcript
    await expect(page.getByTestId("podchat-rolling-transcript")).toContainText("This is a mocked host response. What is your next point?");

    // 7. End Session calls /api/podchat/evaluate
    await page.getByRole("button", { name: "End Session" }).click();
    await expect(page.getByTestId("podchat-evaluation")).toBeVisible();

    expect(receivedEvalPayload).toBeDefined();
    expect(receivedEvalPayload.turns.length).toBe(3); // host -> learner -> host

    // 8. Mocked evaluation response renders all structured sections
    await expect(page.getByTestId("podchat-evaluation-success")).toBeVisible();
    await expect(page.getByText("This is a mocked summary evaluation.")).toBeVisible();
    await expect(page.getByText("wrong grammar").first()).toBeVisible();
    await expect(page.getByText("correct grammar")).toBeVisible();
    await expect(page.getByText("Better academic sentence.")).toBeVisible();
    await expect(page.getByText("excellent").first()).toBeVisible();
    await expect(page.getByText("Focus on academic vocabulary.")).toBeVisible();

    // 11. No microphone permission prompt
    const microphoneRequested = await page.evaluate(
      () => Boolean((window as unknown as { __PODCHAT_MIC_REQUESTED__?: boolean }).__PODCHAT_MIC_REQUESTED__)
    );
    expect(microphoneRequested).toBe(false);

    // 12. No audio/blob/recording URL behavior
    const storageSnapshot = await page.evaluate(() => JSON.stringify(localStorage));
    expect(storageSnapshot).not.toMatch(/audioBlob|recordingUrl|blob:/i);

    // 13. No Supabase/cloud write route is called
    expect(providerCalls).toEqual([]);
  });

  test("handles turn route failure with retry capability", async ({ page }) => {
    // Force turn route failure
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

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await page.getByRole("button", { name: "Mock learner answer" }).click();
    await page.getByRole("button", { name: "Submit Turn" }).click();

    // 9. Turn route failure shows safe error and does not crash
    await expect(page.getByTestId("podchat-turn-error")).toContainText("Provider turn error simulated.");
    await expect(page.getByRole("button", { name: "Retry Turn" })).toBeVisible();

    // Retry and succeed
    await page.getByRole("button", { name: "Retry Turn" }).click();
    await expect(page.getByTestId("podchat-rolling-transcript")).toContainText("Turn recovered. Are we good?");
  });

  test("handles evaluate route failure", async ({ page }) => {
    // Force evaluate route failure
    await page.route("**/api/podchat/evaluate", async (route: Route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Provider evaluation error simulated." })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await page.getByRole("button", { name: "Mock learner answer" }).click();
    await page.route("**/api/podchat/turn", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          hostText: "Ready for eval.",
          followUpQuestion: "Shall we evaluate?"
        })
      });
    });
    await page.getByRole("button", { name: "Submit Turn" }).click();
    await page.getByRole("button", { name: "End Session" }).click();

    // 10. evaluate route failure shows safe error and does not fake success
    await expect(page.getByTestId("podchat-evaluation-error")).toBeVisible();
    await expect(page.getByText("Provider evaluation error simulated.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry Evaluation" })).toBeVisible();
  });

  test("shows error if user tries to end session with zero learner turns", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start a Podchat" }).click();
    await page.getByRole("button", { name: "End Session" }).click();

    // Verify warning message is displayed
    await expect(page.getByTestId("podchat-turn-error")).toContainText("Complete at least one turn before evaluation.");
    await expect(page.getByTestId("podchat-speaking")).toBeVisible();
  });
});
