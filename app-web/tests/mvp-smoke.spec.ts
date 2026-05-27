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

  // Test B: Active Session basic flow
  test("B. Active Session basic flow with mocked feedback", async ({ page }) => {
    // Intercept feedback API
    await page.route("**/api/feedback", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          mainWeakness: "Speaks too fast occasionally.",
          evidence: "Fluency score is slightly lowered.",
          betterPhrase: "Slow down your rate of delivery.",
          retryTask: "Practice reading the sentence with deliberate pauses.",
          providerUsed: "Mock Claude",
          scores: {
            fluency: 4,
            grammar: 5,
            coherence: 4,
            vocabulary: 4,
            argument: 4,
            academicTone: 4,
          },
        }),
      });
    });

    await page.goto("/");

    // Fill in Today's Target
    const targetTextarea = page.locator("#target");
    await targetTextarea.fill("Improve fluency");

    // Start session
    await page.click("button:has-text(\"Start Session\")");

    // Verify Step 2 (Speaking prompt) and Step 3 (Speaking attempt) are visible
    await expect(page.locator("h2:has-text(\"Speaking prompt\")")).toBeVisible();
    await expect(page.locator("h2:has-text(\"Speaking attempt\")")).toBeVisible();

    // Fill in transcript
    const transcriptTextarea = page.locator("#transcript");
    await transcriptTextarea.fill(
      "I think academic research must be conducted with integrity and clarity.",
    );

    // Submit attempt
    await page.click("button:has-text(\"Submit Attempt\")");

    // Wait for "Get AI Feedback" button to appear in step 4 and click it
    await page.click("button:has-text(\"Get AI Feedback\")");

    // Verify feedback is visible
    await expect(page.locator("h3:has-text(\"Quick feedback\")")).toBeVisible();
    await expect(
      page.locator("dt:has-text(\"Main Weakness\")").locator("xpath=../dd"),
    ).toContainText("Speaks too fast occasionally.");

    // Step 5 (Retry attempt) panel should appear
    await expect(page.locator("h2:has-text(\"Retry attempt\")")).toBeVisible();
    const retryTextarea = page.locator("#retry-transcript");
    await retryTextarea.fill(
      "I think academic research must be conducted with deliberate pausing, integrity, and clarity.",
    );

    // Submit retry
    await page.click("button:has-text(\"Submit Retry\")");

    // Step 6 (Retry captured) panel should appear and offer "End Session"
    await expect(page.locator("h2:has-text(\"Retry captured\")")).toBeVisible();
    await page.click("button:has-text(\"End Session\")");

    // Step 7 (Session summary) should show the generated CSV
    await expect(page.locator("h2:has-text(\"Session summary\")")).toBeVisible();
    await expect(page.locator("pre")).toContainText(
      "Date,Level,Mode,Fluency",
    );
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

  // Test F: Article -> Active Session Bridge
  test("F. Article Practice to Active Session bridge works", async ({ page }) => {
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

    // Verifications:
    // 1. Should navigate to Active Session view
    await expect(page.locator("h2:has-text(\"Session setup\")")).toBeVisible();

    // 2. Today's target should be populated with the article practice info
    const targetValue = await page.locator("#target").inputValue();
    expect(targetValue).toContain(
      "Article speaking task: Synthesize the Findings",
    );
    expect(targetValue).toContain("Source: Test Article Title (example.com)");

    // 3. Mode should be set to Reading-to-Speaking
    // Let's verify the Reading-to-Speaking mode button is checked
    const readingToSpeakingButton = page.locator(
      "button[role=\"radio\"]:has-text(\"Reading-to-Speaking\")",
    );
    await expect(readingToSpeakingButton).toHaveAttribute(
      "aria-checked",
      "true",
    );

    // 4. Verify it does not auto-start recording/timer
    await expect(
      page.locator("h2:has-text(\"Speaking prompt\")"),
    ).not.toBeVisible();
    await expect(
      page.locator("h2:has-text(\"Speaking attempt\")"),
    ).not.toBeVisible();
  });
});
