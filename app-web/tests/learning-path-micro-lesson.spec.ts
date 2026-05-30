import { test, expect } from "@playwright/test";

test.describe("Learning Path - Micro-Lesson Shell Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Set localStorage progress to unlock Day 4 card (sentence-builder)
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

  test("1. Clicking a card opens the MicroLessonShell with complete card context", async ({ page }) => {
    const day4Card = page.locator("[data-testid='card-card-d4-c1']");
    await expect(day4Card).toBeVisible();

    await day4Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    await expect(shell.locator("[data-testid='lesson-card-title']")).toContainText("I am a student / I work as...");
    await expect(shell.locator("[data-testid='lesson-learner-instruction']")).toContainText("Build sentences describing your occupation.");
    await expect(shell).toContainText("Susun kalimat yang mendeskripsikan pekerjaan");
    await expect(shell).toContainText("I am a student");
    await expect(shell).toContainText("I work in an office");
    await expect(shell).toContainText("I am a [Job] / I work in [Place]");
    await expect(shell).toContainText("Est: 4 mins");
  });

  test("2. Closing/backing out returns to Learning Path", async ({ page }) => {
    const day4Card = page.locator("[data-testid='card-card-d4-c1']");
    await day4Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    await shell.locator("[data-testid='close-lesson-btn']").click();

    await expect(shell).not.toBeVisible();
    await expect(page.locator("[data-testid='learning-path-container']")).toBeVisible();
  });

  test("3. Interactivity - Mark as viewed updates progress safely", async ({ page }) => {
    const day4Card = page.locator("[data-testid='card-card-d4-c1']");
    await day4Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");

    await shell.locator("[data-testid='mark-viewed-btn']").click();

    await expect(shell.locator("span", { hasText: "In Progress" })).toBeVisible();

    await shell.locator("[data-testid='close-lesson-btn']").click();
    await expect(day4Card.locator("span", { hasText: "current" })).toBeVisible();
  });

  test("4. Interactivity - Mark as attempted updates progress safely", async ({ page }) => {
    const day4Card = page.locator("[data-testid='card-card-d4-c1']");
    await day4Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");

    await shell.locator("[data-testid='mark-attempted-btn']").click();
    await expect(shell.locator("span", { hasText: "In Progress" })).toBeVisible();

    await shell.locator("[data-testid='close-lesson-btn']").click();
    await expect(day4Card.locator("span", { hasText: "current" })).toBeVisible();
  });

  test("5. Interactivity - Continue anyway updates progress safely", async ({ page }) => {
    const day4Card = page.locator("[data-testid='card-card-d4-c1']");
    await day4Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");

    await shell.locator("[data-testid='continue-anyway-btn']").click();
    await expect(shell.locator("span", { hasText: "In Progress" })).toBeVisible();

    await shell.locator("[data-testid='close-lesson-btn']").click();
    await expect(day4Card.locator("span", { hasText: "current" })).toBeVisible();
  });

  test("6. Interactivity - Completed with support updates progress and recommendation advances", async ({ page }) => {
    const day4Card = page.locator("[data-testid='card-card-d4-c1']");
    const day5Card = page.locator("[data-testid='card-card-d5-c1']");

    await day4Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");

    await shell.locator("[data-testid='mark-completed-btn']").click();

    await expect(shell).not.toBeVisible();

    await expect(day4Card.locator("span", { hasText: "completed" })).toBeVisible();
    await expect(day5Card.locator("span", { hasText: "recommended" })).toBeVisible();
  });

  test("7. Privacy: No private fields render in micro-lesson shell DOM", async ({ page }) => {
    const day4Card = page.locator("[data-testid='card-card-d4-c1']");
    await day4Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

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

  test("8. Storage: Progress values are saved strictly under the correct key", async ({ page }) => {
    const day4Card = page.locator("[data-testid='card-card-d4-c1']");
    await day4Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await shell.locator("[data-testid='mark-viewed-btn']").click();

    const storageKeys = await page.evaluate(() => Object.keys(localStorage));

    expect(storageKeys).toContain("fonetik:learning-path-progress:v1");

    const rawVal = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    expect(rawVal).toBeTruthy();
    const parsed = JSON.parse(rawVal!);

    expect(parsed.pathId).toBe("beginner-confidence-ladder");
    expect(parsed.cards["card-d4-c1"].status).toBe("viewed");
    expect(parsed.cards["card-d4-c1"].attemptCount).toBeDefined();

    const strVal = rawVal!.toLowerCase();
    expect(strVal).not.toContain("email");
    expect(strVal).not.toContain("transcript");
    expect(strVal).not.toContain("@");
  });
});
