import { test, expect } from "@playwright/test";

test.describe("Learning Path UI Shell Integration Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("1. Sidebar shows Learning Path and clicking it opens LearningPathView", async ({ page }) => {
    const sidebarItem = page.getByRole("button", { name: "Learning Path" });
    await expect(sidebarItem).toBeVisible();

    await sidebarItem.click();

    await expect(page.locator("header")).toContainText("Learning Path");
    await expect(page.locator("body")).toContainText("Beginner Confidence Ladder");
    await expect(page.locator("body")).toContainText("Membangun rasa percaya diri");
  });

  test("2. Learning Path renders Phase 1, Units, and 14 Days", async ({ page }) => {
    await page.getByRole("button", { name: "Learning Path" }).click();

    await expect(page.locator("body")).toContainText("Confidence Foundation");

    await expect(page.locator("[data-testid='unit-introduce-yourself']")).toBeVisible();
    await expect(page.locator("[data-testid='unit-my-daily-life']")).toBeVisible();
    await expect(page.locator("body")).toContainText("Introduce Yourself");
    await expect(page.locator("body")).toContainText("My Daily Life");

    for (let day = 1; day <= 14; day++) {
      const dayEl = page.locator(`[data-testid='day-${day}']`);
      await expect(dayEl).toBeVisible();
      await expect(dayEl).toContainText(`Day ${day}`);
    }
  });

  test("3. Today's Mission and Recommended Card render safely", async ({ page }) => {
    await page.getByRole("button", { name: "Learning Path" }).click();

    const missionSidebar = page.locator("[data-testid='mission-sidebar']");
    await expect(missionSidebar).toBeVisible();
    await expect(missionSidebar).toContainText("Today's Mission");
    await expect(missionSidebar).toContainText("Recommended");
    await expect(missionSidebar).toContainText("Day 1 Recommended");
    await expect(missionSidebar).toContainText("Greeting Someone");
  });

  test("4. Card statuses render safely and are style-appropriate", async ({ page }) => {
    await page.getByRole("button", { name: "Learning Path" }).click();

    const day1Card = page.locator("[data-testid='card-card-d1-c1']");
    await expect(day1Card).toBeVisible();
    await expect(day1Card.locator("span", { hasText: "recommended" })).toBeVisible();

    const day2Card = page.locator("[data-testid='card-card-d2-c1']");
    await expect(day2Card).toBeVisible();
    await expect(day2Card.locator("span", { hasText: "upcoming" })).toBeVisible();
  });

  test("5. Interactivity - Previewing a card changes status to current", async ({ page }) => {
    await page.getByRole("button", { name: "Learning Path" }).click();

    const day1Card = page.locator("[data-testid='card-card-d1-c1']");
    await expect(day1Card.locator("span", { hasText: "recommended" })).toBeVisible();

    await day1Card.getByRole("button", { name: "Preview Lesson" }).click();

    await expect(day1Card.locator("span", { hasText: "current" })).toBeVisible();
  });

  test("6. Interactivity - Completing cards updates progress and changes recommendations", async ({ page }) => {
    await page.getByRole("button", { name: "Learning Path" }).click();

    const day1Card = page.locator("[data-testid='card-card-d1-c1']");
    const day2Card = page.locator("[data-testid='card-card-d2-c1']");
    await expect(day1Card.locator("span", { hasText: "recommended" })).toBeVisible();

    await day1Card.getByRole("button", { name: "Mark Completed" }).click();

    await expect(day1Card.locator("span", { hasText: "completed" })).toBeVisible();
    await expect(day2Card.locator("span", { hasText: "recommended" })).toBeVisible();

    await expect(page.locator("body")).toContainText("1 / 14 lessons completed");
  });

  test("7. Privacy: Private fields do not appear in DOM", async ({ page }) => {
    await page.getByRole("button", { name: "Learning Path" }).click();

    const bodyText = await page.locator("body").innerText();
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
