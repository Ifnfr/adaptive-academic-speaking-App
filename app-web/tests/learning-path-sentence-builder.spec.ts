import { test, expect } from "@playwright/test";

test.describe("Learning Path - Sentence Builder Specialized Renderer", () => {
  test.beforeEach(async ({ page }) => {
    // Route browser console logs to node stdout
    page.on("console", msg => console.log(`[BROWSER CONSOLE] ${msg.text()}`));

    await page.goto("/");
    // Unlock Day 4 (sentence-builder) by completing days 1, 2, 3
    await page.evaluate(() => {
      localStorage.setItem("fonetik:learning-path-progress:v1", JSON.stringify({
        pathId: "beginner-confidence-ladder",
        phaseId: "confidence-foundation",
        cards: {
          "card-d1-c1": { cardId: "card-d1-c1", status: "completed", attemptCount: 1 },
          "card-d2-c1": { cardId: "card-d2-c1", status: "completed", attemptCount: 1 },
          "card-d3-c1": { cardId: "card-d3-c1", status: "completed", attemptCount: 1 }
        }
      }));
    });
    await page.reload();
    await page.getByRole("button", { name: "Learning Path" }).click();
  });

  test("1. Renders specialized sentence-builder UI with correct tokens", async ({ page }) => {
    const day4Card = page.locator("[data-testid='card-card-d4-c1']");
    await expect(day4Card).toBeVisible();

    await day4Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    const builderLesson = shell.locator("[data-testid='sentence-builder-lesson']");
    await expect(builderLesson).toBeVisible();

    // Static text references are visible
    await expect(builderLesson).toContainText("Build the sentence");
    await expect(builderLesson).toContainText("I am a student / I work as..."); // Title or context
    await expect(builderLesson).toContainText("Susun kalimat yang mendeskripsikan pekerjaan"); // Indonesian explanation

    // Check hint list
    const hints = builderLesson.locator("[data-testid='target-phrases-hint-list']");
    await expect(hints).toBeVisible();
    await expect(hints).toContainText("I am a student");
    await expect(hints).toContainText("I work in an office");

    // Word tokens are rendered
    const tokenBox = builderLesson.locator("[data-testid='shuffled-tokens-box']");
    await expect(tokenBox.locator("[data-testid='word-token-I']")).toBeVisible();
    await expect(tokenBox.locator("[data-testid='word-token-am']")).toBeVisible();
    await expect(tokenBox.locator("[data-testid='word-token-a']")).toBeVisible();
    await expect(tokenBox.locator("[data-testid='word-token-student']")).toBeVisible();

    // No claims of real AI analysis
    const bodyText = await shell.innerText();
    expect(bodyText).not.toContain("grammar score");
    expect(bodyText).not.toContain("semantic score");
    expect(bodyText).not.toContain("phonetic accuracy");
  });

  test("2. Selects words in correct sequence to trigger success feedback and enable completion", async ({ page }) => {
    const day4Card = page.locator("[data-testid='card-card-d4-c1']");
    await day4Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");

    // Click words in order: "I", "am", "a", "student"
    await shell.locator("[data-testid='word-token-I']").click();
    await shell.locator("[data-testid='word-token-am']").click();
    await shell.locator("[data-testid='word-token-a']").click();
    await shell.locator("[data-testid='word-token-student']").click();

    // Verify correct order feedback
    await expect(shell.locator("[data-testid='builder-feedback-success']")).toBeVisible();
    await expect(shell.locator("[data-testid='builder-feedback-success']")).toContainText("Good order!");

    // Verify localStorage shows attempted during the build process
    let rawProgress = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    let parsed = JSON.parse(rawProgress!);
    expect(parsed.cards["card-d4-c1"].status).toBe("attempted");

    // Completed with support CTA should be active
    const completeBtn = shell.locator("[data-testid='complete-btn']");
    await expect(completeBtn).not.toHaveClass(/cursor-not-allowed/);
    await completeBtn.click();

    // Modal closes and day 4 shows completed in UI
    await expect(shell).not.toBeVisible();
    await expect(day4Card.locator("span", { hasText: "completed" })).toBeVisible();

    // Verify localStorage was updated to completed after clicking completion button
    rawProgress = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    parsed = JSON.parse(rawProgress!);
    expect(parsed.cards["card-d4-c1"].status).toBe("completed");
  });

  test("3. Selects words in incorrect sequence to trigger retry feedback", async ({ page }) => {
    const day4Card = page.locator("[data-testid='card-card-d4-c1']");
    await day4Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");

    // Click words in wrong order: "am", "I", "a", "student"
    await shell.locator("[data-testid='word-token-am']").click();
    await shell.locator("[data-testid='word-token-I']").click();
    await shell.locator("[data-testid='word-token-a']").click();
    await shell.locator("[data-testid='word-token-student']").click();

    // Verify retry feedback
    await expect(shell.locator("[data-testid='builder-feedback-retry']")).toBeVisible();
    await expect(shell.locator("[data-testid='builder-feedback-retry']")).toContainText("Try again");

    // Verify progress helper indicates attempted
    const rawProgress = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    const parsed = JSON.parse(rawProgress!);
    expect(parsed.cards["card-d4-c1"].status).toBe("attempted");
  });

  test("4. Clear / Reset resets selected word list and allows trying again", async ({ page }) => {
    const day4Card = page.locator("[data-testid='card-card-d4-c1']");
    await day4Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");

    await shell.locator("[data-testid='word-token-am']").click();
    await expect(shell.locator("[data-testid='selected-word-token']")).toHaveCount(1);

    // Reset
    await shell.locator("[data-testid='reset-builder-btn']").click();
    await expect(shell.locator("[data-testid='selected-word-token']")).toHaveCount(0);

    // Select correct sequence
    await shell.locator("[data-testid='word-token-I']").click();
    await shell.locator("[data-testid='word-token-am']").click();
    await shell.locator("[data-testid='word-token-a']").click();
    await shell.locator("[data-testid='word-token-student']").click();

    // Success visible
    await expect(shell.locator("[data-testid='builder-feedback-success']")).toBeVisible();
  });

  test("5. Continue anyway action updates progress to continued", async ({ page }) => {
    const day4Card = page.locator("[data-testid='card-card-d4-c1']");
    await day4Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await shell.locator("[data-testid='continue-btn']").click();

    await shell.locator("[data-testid='close-lesson-btn']").click();
    await expect(shell).not.toBeVisible();
    await expect(day4Card.locator("span", { hasText: "current" })).toBeVisible();

    const rawProgress = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    const parsed = JSON.parse(rawProgress!);
    expect(parsed.cards["card-d4-c1"].status).toBe("continued");
  });

  test("6. Privacy: No private fields render in sentence-builder DOM", async ({ page }) => {
    const day4Card = page.locator("[data-testid='card-card-d4-c1']");
    await day4Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    const bodyText = await shell.innerText();

    const forbidden = [
      "retry_transcript",
      "vocabulary_sentence",
      "article_url",
      "main_weakness",
      "csv",
      "source_id",
      "owner_id",
      "email"
    ];

    for (const pattern of forbidden) {
      expect(bodyText).not.toContain(`"${pattern}"`);
      expect(bodyText).not.toContain(`${pattern}:`);
    }

    expect(bodyText).not.toContain("@");
  });
});
