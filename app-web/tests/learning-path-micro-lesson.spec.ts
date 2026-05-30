import { test, expect } from "@playwright/test";

test.describe("Learning Path - Micro-Lesson Shell Tests", () => {
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
          "card-d4-c1": { cardId: "card-d4-c1", status: "completed", attemptCount: 1 },
          "card-d5-c1": { cardId: "card-d5-c1", status: "completed", attemptCount: 1 },
          "card-d6-c1": { cardId: "card-d6-c1", status: "completed", attemptCount: 1 }
        }
      }));
    });
    await page.reload();
    await page.getByRole("button", { name: "Learning Path" }).click();
  });

  test("1. Clicking a card opens the MicroLessonShell with complete card context", async ({ page }) => {
    const day7Card = page.locator("[data-testid='card-card-d7-c1']");
    await expect(day7Card).toBeVisible();

    await day7Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    await expect(shell.locator("[data-testid='lesson-card-title']")).toContainText("Unit 1 Checkpoint");
    await expect(shell.locator("[data-testid='lesson-learner-instruction']")).toContainText("Combine your name, origin, and a greeting in one go.");
    await expect(shell).toContainText("Gabungkan sapaan, nama, asal, dan kalimat penutup dalam satu rekaman.");
    await expect(shell).toContainText("Hello, my name is Alex. I am from Jakarta. Nice to meet you.");
    await expect(shell).toContainText("Hello, my name is [Name]. I am from [City]. Nice to meet you.");
    await expect(shell).toContainText("Est: 5 mins");
  });


  test("2. Closing/backing out returns to Learning Path", async ({ page }) => {
    const day7Card = page.locator("[data-testid='card-card-d7-c1']");
    await day7Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    await shell.locator("[data-testid='close-lesson-btn']").click();

    await expect(shell).not.toBeVisible();
    await expect(page.locator("[data-testid='learning-path-container']")).toBeVisible();
  });

  test("3. Interactivity - Mark as viewed updates progress safely", async ({ page }) => {
    const day7Card = page.locator("[data-testid='card-card-d7-c1']");
    await day7Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");

    await shell.locator("[data-testid='mark-viewed-btn']").click();

    await expect(shell.locator("span", { hasText: "In Progress" })).toBeVisible();

    await shell.locator("[data-testid='close-lesson-btn']").click();
    await expect(day7Card.locator("span", { hasText: "current" })).toBeVisible();
  });

  test("4. Interactivity - Mark as attempted updates progress safely", async ({ page }) => {
    const day7Card = page.locator("[data-testid='card-card-d7-c1']");
    await day7Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");

    await shell.locator("[data-testid='mark-attempted-btn']").click();
    await expect(shell.locator("span", { hasText: "In Progress" })).toBeVisible();

    await shell.locator("[data-testid='close-lesson-btn']").click();
    await expect(day7Card.locator("span", { hasText: "current" })).toBeVisible();
  });

  test("5. Interactivity - Continue anyway updates progress safely", async ({ page }) => {
    const day7Card = page.locator("[data-testid='card-card-d7-c1']");
    await day7Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");

    await shell.locator("[data-testid='continue-anyway-btn']").click();
    await expect(shell.locator("span", { hasText: "In Progress" })).toBeVisible();

    await shell.locator("[data-testid='close-lesson-btn']").click();
    await expect(day7Card.locator("span", { hasText: "current" })).toBeVisible();
  });

  test("6. Interactivity - Completed with support updates progress and recommendation advances", async ({ page }) => {
    const day7Card = page.locator("[data-testid='card-card-d7-c1']");
    const day8Card = page.locator("[data-testid='card-card-d8-c1']");

    await day7Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");

    await shell.locator("[data-testid='mark-completed-btn']").click();

    await expect(shell).not.toBeVisible();

    await expect(day7Card.locator("span.rounded-full", { hasText: "completed" })).toBeVisible();
    await expect(day8Card.locator("span", { hasText: "recommended" })).toBeVisible();
  });

  test("7. Privacy: No private fields render in micro-lesson shell DOM", async ({ page }) => {
    const day7Card = page.locator("[data-testid='card-card-d7-c1']");
    await day7Card.getByRole("button", { name: "Preview Lesson" }).click();

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
    const day7Card = page.locator("[data-testid='card-card-d7-c1']");
    await day7Card.getByRole("button", { name: "Preview Lesson" }).click();

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await shell.locator("[data-testid='mark-viewed-btn']").click();

    const storageKeys = await page.evaluate(() => Object.keys(localStorage));

    expect(storageKeys).toContain("fonetik:learning-path-progress:v1");

    const rawVal = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    expect(rawVal).toBeTruthy();
    const parsed = JSON.parse(rawVal!);

    expect(parsed.pathId).toBe("beginner-confidence-ladder");
    expect(parsed.cards["card-d7-c1"].status).toBe("viewed");
    expect(parsed.cards["card-d7-c1"].attemptCount).toBeDefined();

    const strVal = rawVal!.toLowerCase();
    expect(strVal).not.toContain("email");
    expect(strVal).not.toContain("transcript");
    expect(strVal).not.toContain("@");
  });
});
