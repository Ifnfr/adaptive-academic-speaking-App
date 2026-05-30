import { test, expect } from "@playwright/test";

test.describe("Learning Path - Guided Word & Phrase Pattern Specialized Renderers", () => {
  test.describe("Guided Word Card (Day 1)", () => {
    test.beforeEach(async ({ page }) => {
      // Clear localStorage or start fresh
      await page.goto("/");
      await page.evaluate(() => {
        localStorage.removeItem("fonetik:learning-path-progress:v1");
      });
      await page.reload();
      await page.getByRole("button", { name: "Learning Path" }).click();
    });

    test("1. Renders specialized guided-word UI with correct context", async ({ page }) => {
      const day1Card = page.locator("[data-testid='card-card-d1-c1']");
      await day1Card.getByRole("button", { name: "Preview Lesson" }).click();

      const shell = page.locator("[data-testid='micro-lesson-shell']");
      await expect(shell).toBeVisible();

      // Verify specialized container
      const guidedWordLesson = shell.locator("[data-testid='guided-word-lesson']");
      await expect(guidedWordLesson).toBeVisible();

      // Target phrases visible
      const targetPhrases = guidedWordLesson.locator("[data-testid='target-phrase']");
      await expect(targetPhrases).toHaveCount(2);
      await expect(targetPhrases.nth(0)).toHaveText("Hello");
      await expect(targetPhrases.nth(1)).toHaveText("Good morning");

      // Indonesian explanation is visible
      await expect(guidedWordLesson).toContainText("Dengarkan dan ulangi kata sapaan dasar berikut dengan lantang.");

      // Scaffold is visible
      await expect(guidedWordLesson).toContainText("Hello / Good morning");

      // Listen model button exists and says "Listen to the model"
      const listenBtn = guidedWordLesson.locator("[data-testid='listen-model-btn']");
      await expect(listenBtn).toBeVisible();
      await expect(guidedWordLesson).toContainText("Listen to the model");

      // No claims of real pronunciation scoring
      const bodyText = await shell.innerText();
      expect(bodyText).not.toContain("pronunciation accuracy");
      expect(bodyText).not.toContain("phonetic accuracy");
      expect(bodyText).not.toContain("AI confidence score");
      expect(bodyText).not.toContain("grammar score");
    });

    test("2. Listen model button changes state and updates progress to viewed", async ({ page }) => {
      const day1Card = page.locator("[data-testid='card-card-d1-c1']");
      await day1Card.getByRole("button", { name: "Preview Lesson" }).click();

      const shell = page.locator("[data-testid='micro-lesson-shell']");
      const listenBtn = shell.locator("[data-testid='listen-model-btn']");

      // Click listen
      await listenBtn.click();
      await expect(shell).toContainText("Playing model audio...");
      await expect(listenBtn).toBeDisabled();

      // Wait for play to finish (1.2s timeout)
      await expect(shell.locator("span", { hasText: "In Progress" })).toBeVisible();

      // Check localStorage has marked it viewed
      const rawProgress = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
      const parsed = JSON.parse(rawProgress!);
      expect(parsed.cards["card-d1-c1"].status).toBe("viewed");
    });

    test("3. Practice action increments practice count and updates progress to attempted", async ({ page }) => {
      const day1Card = page.locator("[data-testid='card-card-d1-c1']");
      await day1Card.getByRole("button", { name: "Preview Lesson" }).click();

      const shell = page.locator("[data-testid='micro-lesson-shell']");
      const practiceBtn = shell.locator("[data-testid='practice-phrase-btn']");

      await practiceBtn.click();
      await expect(shell).toContainText("Practiced 1 time!");

      await practiceBtn.click();
      await expect(shell).toContainText("Practiced 2 times!");

      // Check localStorage has marked it attempted
      const rawProgress = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
      const parsed = JSON.parse(rawProgress!);
      expect(parsed.cards["card-d1-c1"].status).toBe("attempted");
    });

    test("4. Complete action marks card completed", async ({ page }) => {
      const day1Card = page.locator("[data-testid='card-card-d1-c1']");
      await day1Card.getByRole("button", { name: "Preview Lesson" }).click();

      const shell = page.locator("[data-testid='micro-lesson-shell']");
      const completeBtn = shell.locator("[data-testid='complete-btn']");

      await completeBtn.click();

      // Shell should close and card should be completed
      await expect(shell).not.toBeVisible();
      await expect(day1Card.locator("span", { hasText: "completed" })).toBeVisible();

      const rawProgress = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
      const parsed = JSON.parse(rawProgress!);
      expect(parsed.cards["card-d1-c1"].status).toBe("completed");
    });

    test("5. Privacy: No private fields render in DOM", async ({ page }) => {
      const day1Card = page.locator("[data-testid='card-card-d1-c1']");
      await day1Card.getByRole("button", { name: "Preview Lesson" }).click();

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

  test.describe("Phrase Pattern Card (Day 3)", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      // Unlock Day 3 by setting progress of Day 1 and Day 2 as completed
      await page.evaluate(() => {
        localStorage.setItem("fonetik:learning-path-progress:v1", JSON.stringify({
          pathId: "beginner-confidence-ladder",
          phaseId: "confidence-foundation",
          cards: {
            "card-d1-c1": { cardId: "card-d1-c1", status: "completed", attemptCount: 1 },
            "card-d2-c1": { cardId: "card-d2-c1", status: "completed", attemptCount: 1 }
          }
        }));
      });
      await page.reload();
      await page.getByRole("button", { name: "Learning Path" }).click();
    });

    test("1. Renders specialized phrase-pattern UI with correct context", async ({ page }) => {
      const day3Card = page.locator("[data-testid='card-card-d3-c1']");
      await expect(day3Card).toBeVisible();

      await day3Card.getByRole("button", { name: "Preview Lesson" }).click();

      const shell = page.locator("[data-testid='micro-lesson-shell']");
      await expect(shell).toBeVisible();

      const phrasePatternLesson = shell.locator("[data-testid='phrase-pattern-lesson']");
      await expect(phrasePatternLesson).toBeVisible();

      // Pattern formula visible
      await expect(phrasePatternLesson.locator("[data-testid='formula-scaffold']")).toHaveText("I am from [Country/City]");

      // Explanation visible
      await expect(phrasePatternLesson).toContainText("Lengkapi pola kalimat untuk menyebutkan dari mana Anda berasal.");

      // Examples are visible
      const examples = phrasePatternLesson.locator("[data-testid='phrase-example']");
      await expect(examples).toHaveCount(2);
      await expect(examples.nth(0)).toContainText("I am from Indonesia");
      await expect(examples.nth(1)).toContainText("I live in Jakarta");

      // Try pattern button exists
      const tryBtn = phrasePatternLesson.locator("[data-testid='try-pattern-btn']");
      await expect(tryBtn).toBeVisible();
      await expect(phrasePatternLesson).toContainText("Try the pattern");

      // No claims of real AI validation/scoring
      const bodyText = await shell.innerText();
      expect(bodyText).not.toContain("grammar validation");
      expect(bodyText).not.toContain("AI validation");
      expect(bodyText).not.toContain("accuracy score");
    });

    test("2. Try the pattern action updates progress to attempted", async ({ page }) => {
      const day3Card = page.locator("[data-testid='card-card-d3-c1']");
      await day3Card.getByRole("button", { name: "Preview Lesson" }).click();

      const shell = page.locator("[data-testid='micro-lesson-shell']");
      const tryBtn = shell.locator("[data-testid='try-pattern-btn']");

      await tryBtn.click();
      await expect(shell).toContainText("Tried pattern 1 time!");

      // Updates progress
      const rawProgress = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
      const parsed = JSON.parse(rawProgress!);
      expect(parsed.cards["card-d3-c1"].status).toBe("attempted");
    });

    test("3. Complete action marks card completed", async ({ page }) => {
      const day3Card = page.locator("[data-testid='card-card-d3-c1']");
      await day3Card.getByRole("button", { name: "Preview Lesson" }).click();

      const shell = page.locator("[data-testid='micro-lesson-shell']");
      const completeBtn = shell.locator("[data-testid='complete-btn']");

      await completeBtn.click();

      // Shell should close and card should be completed
      await expect(shell).not.toBeVisible();
      await expect(day3Card.locator("span", { hasText: "completed" })).toBeVisible();
    });
  });
});
