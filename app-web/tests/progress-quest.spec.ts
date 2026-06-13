import { test, expect } from "@playwright/test";

test.describe("Progress & Quest UI Clarity Tests", () => {
  test.beforeEach(async ({ page }) => {
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

  test("sidebar navigation, headers, quest list presence and layout", async ({ page }) => {
    // Log console errors from the page
    page.on("console", (msg) => {
      console.log(`BROWSER CONSOLE: [${msg.type()}] ${msg.text()}`);
    });
    page.on("pageerror", (err) => {
      console.log(`BROWSER EXCEPTION: ${err.message}`);
    });

    await page.goto("/");

    // Wait for hydration to complete (gamificationReady goes true)
    await expect(page.locator("aside")).not.toContainText("Loading speaker progress");

    // 1. Sidebar shows "Progress & Quest" instead of only "Progress"
    const sidebarProgressQuestBtn = page.locator("aside button:has-text(\"Progress & Quest\")");
    await expect(sidebarProgressQuestBtn).toBeVisible();

    // 2. Clicking "Progress & Quest" opens the progress page
    await sidebarProgressQuestBtn.click();
    await expect(page.locator("h2:has-text(\"Progress & Quest\")")).toBeVisible();

    // 3. Daily Quest section appears below Daily Claim
    const dailyQuestTitle = page.locator("h3:has-text(\"Daily Quest\")");
    await expect(dailyQuestTitle).toBeVisible();

    const dailyQuestSubtitle = page.locator("p:has-text(\"Complete these activities to build your daily speaking habit.\")");
    await expect(dailyQuestSubtitle).toBeVisible();

    // 4. Daily Quest list hides disabled Learning Path and shows active safe quest titles
    const dailyQuestSection = page.getByTestId("daily-quests-section");
    await expect(dailyQuestSection).not.toContainText("Today's Learning Path");
    await expect(dailyQuestSection).not.toContainText("Complete your recommended lesson.");

    const sentenceQuest = dailyQuestSection
      .locator(".app-panel")
      .filter({ hasText: "Sentence Practice" })
      .first();
    await expect(sentenceQuest).toBeVisible();
    await expect(sentenceQuest).toContainText(
      "Use one saved word in a complete sentence.",
    );
    await expect(sentenceQuest).toContainText("+15 XP");

    const speakingQuest = page.getByText("Speaking Practice").first();
    await expect(speakingQuest).toBeVisible();

    const vocabQuest = page.getByText("Vocabulary Review").first();
    await expect(vocabQuest).toBeVisible();

    const articleQuest = page.getByText("Article Practice").first();
    await expect(articleQuest).toBeVisible();

    const weeklyQuest = page.getByText("Weekly Review").first();
    await expect(weeklyQuest).toBeVisible();

    const claimQuest = page.getByText("Daily Claim").first();
    await expect(claimQuest).toBeVisible();

    // 5. Quest copy does not mention raw scoring, transcript, AI grading, or punitive labels
    const questContainerText = await dailyQuestSection.innerText();
    const forbiddenWords = ["failed", "missed", "bad", "weak", "punitive"];
    for (const word of forbiddenWords) {
      expect(questContainerText.toLowerCase()).not.toContain(word);
    }

    // 8. No private fields appear in the DOM
    const privateFields = ["email", "transcript", "recording", "audio"];
    for (const field of privateFields) {
      expect(questContainerText.toLowerCase()).not.toContain(field);
    }

    // 6. Existing sidebar navigation still works
    const sidebarActiveSessionBtn = page.locator("aside button:has-text(\"Active Session\")");
    await expect(sidebarActiveSessionBtn).toBeVisible();
    await sidebarActiveSessionBtn.click();
    await expect(page.getByTestId("podchat-setup")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Economics" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Intermediate/ })).toBeVisible();

    // 7. Sentence Practice goes to Vocabulary Notebook, never the disabled Learning Path
    await sidebarProgressQuestBtn.click();
    await sentenceQuest.getByRole("button", { name: /Go/ }).click();
    await expect(page.locator("h2:has-text(\"Vocabulary Notebook\")")).toBeVisible();
    await expect(page.locator("[data-testid='learning-path-container']")).not.toBeVisible();
  });
});
