import { test, expect, Page } from "@playwright/test";
import { phase2Curriculum } from "../src/app/lib/learning-path/phase2-curriculum";

async function openCard(page: Page, card: unknown) {
  await page.evaluate((c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__DEV_TEST_ONLY_OPEN_CARD__(c);
  }, card);
}

test.describe("Learning Path - Progressive Sentence Builder Tests (TASK-052G)", () => {

  const standardBuilderCard = {
    id: "test-card-standard-builder",
    dayNumber: 4,
    unitId: "introduce-yourself",
    type: "sentence-builder",
    title: "Standard Builder Card",
    learnerInstruction: "Arrange the words.",
    indonesianExplanation: "Susun kata.",
    targetPhrases: ["I am happy"],
    scaffold: "Standard scaffold",
    estimatedMinutes: 3,
    completionRule: "attempted",
    linkedEngine: "sentence-builder",
    mobileLayoutHint: "standard"
  };

  const progressiveCard = phase2Curriculum.units
    .flatMap(u => u.days.flatMap(d => d.cards))
    .find(c => c.builderMode === "progressive")!;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Set localStorage progress to ensure clean slate
    await page.evaluate(() => {
      localStorage.setItem("fonetik:learning-path-progress:v1", JSON.stringify({
        pathId: "beginner-confidence-ladder",
        phaseId: "confidence-foundation",
        cards: {}
      }));
    });
    await page.reload();
    await page.getByRole("button", { name: "Learning Path" }).click();
  });

  test("1. Standard sentence-builder card still renders existing word-order UI", async ({ page }) => {
    await openCard(page, standardBuilderCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    const lesson = shell.locator("[data-testid='sentence-builder-lesson']");
    await expect(lesson).toBeVisible();
    await expect(lesson.locator("[data-testid='shuffled-tokens-box']")).toBeVisible();
    await expect(lesson.locator("[data-testid='continue-btn']")).toBeVisible();
    await expect(lesson.locator("[data-testid='complete-btn']")).toBeDisabled();
  });

  test("2. Progressive sentence-builder card renders slot-by-slot UI and display labels", async ({ page }) => {
    await openCard(page, progressiveCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    const lesson = shell.locator("[data-testid='progressive-builder-lesson']");
    await expect(lesson).toBeVisible();

    // displays slot sequence
    const slotsContainer = lesson.locator("[data-testid='progressive-slots-container']");
    await expect(slotsContainer).toBeVisible();

    const firstSlot = progressiveCard.progressiveSlots![0];
    await expect(slotsContainer.locator(`[data-testid='slot-step-${firstSlot.id}']`)).toContainText(firstSlot.label);

    // Displays current slot focus
    await expect(lesson.locator("[data-testid='current-slot-focus']")).toContainText(`Current Slot: ${firstSlot.label}`);

    // Predefined choices only
    const choicesBox = lesson.locator("[data-testid='choices-box']");
    await expect(choicesBox).toBeVisible();
    for (const choice of firstSlot.choices) {
      await expect(choicesBox.locator(`[data-testid='choice-btn-${choice.id}']`)).toContainText(choice.text);
    }
  });

  test("3. Selection flow: incorrect option shows retry copy, correct advances", async ({ page }) => {
    await openCard(page, progressiveCard);

    const lesson = page.locator("[data-testid='progressive-builder-lesson']");
    await expect(lesson).toBeVisible();

    const firstSlot = progressiveCard.progressiveSlots![0];
    const incorrectChoice = firstSlot.choices.find(c => !c.isCorrect)!;
    const correctChoice = firstSlot.choices.find(c => c.isCorrect)!;

    // Click incorrect choice
    await lesson.locator(`[data-testid='choice-btn-${incorrectChoice.id}']`).click();

    // Verify retry feedback shown
    await expect(lesson.locator("[data-testid='builder-feedback-retry']")).toContainText(
      "Try another option. You are building the sentence step by step."
    );

    // Click correct choice
    await lesson.locator(`[data-testid='choice-btn-${correctChoice.id}']`).click();

    // Verify advanced to second slot
    const secondSlot = progressiveCard.progressiveSlots![1];
    await expect(lesson.locator("[data-testid='current-slot-focus']")).toContainText(`Current Slot: ${secondSlot.label}`);
  });

  test("4. Assembled sentence preview updates and completes successfully", async ({ page }) => {
    await openCard(page, progressiveCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    const lesson = shell.locator("[data-testid='progressive-builder-lesson']");

    // Cycle through all slots by selecting correct choices
    for (const slot of progressiveCard.progressiveSlots!) {
      const correctChoice = slot.choices.find(c => c.isCorrect)!;
      await lesson.locator(`[data-testid='choice-btn-${correctChoice.id}']`).click();
    }

    // Success state reached
    await expect(lesson.locator("[data-testid='builder-feedback-success']")).toContainText(
      "Great. You built the sentence step by step."
    );

    // Verify assembled sentence words exist
    const assembledBox = lesson.locator("[data-testid='assembled-words-box']");
    for (const slot of progressiveCard.progressiveSlots!) {
      const correctChoice = slot.choices.find(c => c.isCorrect)!;
      await expect(assembledBox).toContainText(correctChoice.text);
    }

    // Complete with support is enabled
    const completeBtn = lesson.locator("[data-testid='complete-btn']");
    await expect(completeBtn).toBeEnabled();

    // Clicking completes the lesson
    await completeBtn.click();
    await expect(shell).not.toBeVisible();

    const rawVal = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    expect(rawVal).toBeTruthy();
    const parsed = JSON.parse(rawVal!);
    expect(parsed.cards[progressiveCard.id].status).toBe("completed");
  });

  test("5. Try again/reset clears local slot state", async ({ page }) => {
    await openCard(page, progressiveCard);

    const lesson = page.locator("[data-testid='progressive-builder-lesson']");
    await expect(lesson).toBeVisible();

    const firstSlot = progressiveCard.progressiveSlots![0];
    const correctChoice = firstSlot.choices.find(c => c.isCorrect)!;

    // Click correct
    await lesson.locator(`[data-testid='choice-btn-${correctChoice.id}']`).click();

    // Verify second slot is active
    const secondSlot = progressiveCard.progressiveSlots![1];
    await expect(lesson.locator("[data-testid='current-slot-focus']")).toContainText(`Current Slot: ${secondSlot.label}`);

    // Click Try again
    await lesson.locator("[data-testid='reset-builder-btn']").click();

    // Verify reset to slot 1
    await expect(lesson.locator("[data-testid='current-slot-focus']")).toContainText(`Current Slot: ${firstSlot.label}`);
    await expect(lesson.locator("[data-testid='assembled-words-box']")).toContainText(
      "Select choices below to construct the sentence..."
    );
  });

  test("6. Continue anyway works without scoring", async ({ page }) => {
    await openCard(page, progressiveCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    const lesson = shell.locator("[data-testid='progressive-builder-lesson']");

    await lesson.locator("[data-testid='continue-btn']").click();

    // Close manually
    await shell.locator("[data-testid='close-lesson-btn']").click();
    await expect(shell).not.toBeVisible();

    const rawVal = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    expect(rawVal).toBeTruthy();
    const parsed = JSON.parse(rawVal!);
    expect(parsed.cards[progressiveCard.id].status).toBe("continued");
  });

  test("7. Progressive builder does not show forbidden scoring/AI terms in DOM", async ({ page }) => {
    await openCard(page, progressiveCard);

    const lesson = page.locator("[data-testid='progressive-builder-lesson']");
    const textContent = await lesson.innerText();
    const banned = [
      "accuracy score",
      "pronunciation score",
      "grammar score",
      "confidence score",
      "baseline threshold",
      "acoustic threshold",
      "transcript",
      "speech-to-text",
      "speechtotext",
      "audioblob",
      "recordingurl",
      "ai grading",
      "ai scoring",
      "pass/fail",
      "failed",
      "wrong",
      "bad",
      "too slow",
      "poor fluency"
    ];

    banned.forEach(word => {
      expect(textContent.toLowerCase()).not.toContain(word);
    });
  });

  test("8. Privacy: LocalStorage contains no forbidden private fields", async ({ page }) => {
    await openCard(page, progressiveCard);

    const lesson = page.locator("[data-testid='progressive-builder-lesson']");
    
    const firstSlot = progressiveCard.progressiveSlots![0];
    const correctChoice = firstSlot.choices.find(c => c.isCorrect)!;
    await lesson.locator(`[data-testid='choice-btn-${correctChoice.id}']`).click();

    const rawVal = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    expect(rawVal).toBeTruthy();

    const strVal = rawVal!.toLowerCase();
    const bannedKeys = [
      "transcript",
      "speechtotext",
      "audioblob",
      "recordingurl",
      "rawlearnersentence",
      "owner_id",
      "source_id",
      "userid",
      "sessionid",
      "rawpayload",
      "email"
    ];

    bannedKeys.forEach(key => {
      expect(strVal).not.toContain(key);
    });
    expect(strVal).not.toContain("@");
  });

});
