import { test, expect } from "@playwright/test";

test.describe("Learning Path - Micro Speaking Lesson Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Set localStorage progress to unlock Day 5 card (micro-speaking)
    await page.evaluate(() => {
      localStorage.setItem("fonetik:learning-path-progress:v1", JSON.stringify({
        pathId: "beginner-confidence-ladder",
        phaseId: "confidence-foundation",
        cards: {
          "card-d1-c1": { cardId: "card-d1-c1", status: "completed", attemptCount: 1 },
          "card-d2-c1": { cardId: "card-d2-c1", status: "completed", attemptCount: 1 },
          "card-d3-c1": { cardId: "card-d3-c1", status: "completed", attemptCount: 1 },
          "card-d4-c1": { cardId: "card-d4-c1", status: "completed", attemptCount: 1 }
        }
      }));
    });
    await page.reload();
    await page.getByRole("button", { name: "Learning Path" }).click();
  });

  test("1. Opens micro-speaking lesson correctly", async ({ page }) => {
    const day5Card = page.locator("[data-testid='card-card-d5-c1']");
    await expect(day5Card).toBeVisible();

    await day5Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    const lesson = shell.locator("[data-testid='micro-speaking-lesson']");
    await expect(lesson).toBeVisible();
    await expect(lesson.locator("[data-testid='lesson-card-title']")).toContainText("Self-Introduction Practice");
    
    // Check initial state buttons
    await expect(lesson.locator("[data-testid='start-record-btn']")).toBeVisible();
    await expect(lesson.locator("[data-testid='continue-btn']")).toBeVisible();
    await expect(lesson.locator("[data-testid='complete-btn']")).toBeDisabled();
  });

  test("2. Start attempt triggers attempted status and recording state", async ({ page }) => {
    const day5Card = page.locator("[data-testid='card-card-d5-c1']");
    await day5Card.getByRole("button", { name: "Preview Lesson" }).click();

    const lesson = page.locator("[data-testid='micro-speaking-lesson']");
    
    await lesson.locator("[data-testid='start-record-btn']").click();
    
    // UI should show listening state
    await expect(lesson).toContainText("Listening... Read the phrases clearly.");
    await expect(lesson.locator("[data-testid='stop-record-btn']")).toBeVisible();
    
    // shell status tag should update to In Progress
    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell.locator("span", { hasText: "In Progress" })).toBeVisible();
  });

  test("3. Stop recording triggers recorded state, enables complete button", async ({ page }) => {
    const day5Card = page.locator("[data-testid='card-card-d5-c1']");
    await day5Card.getByRole("button", { name: "Preview Lesson" }).click();

    const lesson = page.locator("[data-testid='micro-speaking-lesson']");
    
    await lesson.locator("[data-testid='start-record-btn']").click();
    await lesson.locator("[data-testid='stop-record-btn']").click();
    
    // UI should show recorded state
    await expect(lesson).toContainText("Attempt recorded locally.");
    await expect(lesson.locator("[data-testid='retry-record-btn']")).toBeVisible();
    
    // Complete button should be enabled
    const completeBtn = lesson.locator("[data-testid='complete-btn']");
    await expect(completeBtn).toBeEnabled();
  });

  test("4. Completed with support updates progress and recommendation advances", async ({ page }) => {
    const day5Card = page.locator("[data-testid='card-card-d5-c1']");
    const day6Card = page.locator("[data-testid='card-card-d6-c1']");

    await day5Card.getByRole("button", { name: "Preview Lesson" }).click();

    const lesson = page.locator("[data-testid='micro-speaking-lesson']");
    
    await lesson.locator("[data-testid='start-record-btn']").click();
    await lesson.locator("[data-testid='stop-record-btn']").click();
    await lesson.locator("[data-testid='complete-btn']").click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).not.toBeVisible();

    await expect(day5Card.locator("span", { hasText: "completed" })).toBeVisible();
    await expect(day6Card.locator("span", { hasText: "recommended" })).toBeVisible();
  });

  test("5. Privacy: No private fields render in micro-speaking lesson DOM", async ({ page }) => {
    const day5Card = page.locator("[data-testid='card-card-d5-c1']");
    await day5Card.getByRole("button", { name: "Preview Lesson" }).click();

    const lesson = page.locator("[data-testid='micro-speaking-lesson']");
    await expect(lesson).toBeVisible();

    const bodyText = await lesson.innerText();
    const forbidden = [
      "retry_transcript",
      "vocabulary_sentence",
      "article_url",
      "main_weakness",
      "csv",
      "source_id",
      "owner_id",
      "email",
      "transcript",
      "audio"
    ];

    for (const pattern of forbidden) {
      expect(bodyText).not.toContain(`"${pattern}"`);
      expect(bodyText).not.toContain(`${pattern}:`);
    }

    expect(bodyText).not.toContain("@");
  });
});
