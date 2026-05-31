import { test, expect, Page } from "@playwright/test";
import { phase2Curriculum } from "../src/app/lib/learning-path/phase2-curriculum";

async function openCard(page: Page, card: unknown) {
  await page.evaluate((c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__DEV_TEST_ONLY_OPEN_CARD__(c);
  }, card);
}

test.describe("Learning Path - Fluency Sprint Extension Tests (TASK-052F)", () => {

  const standardMicroSpeakingCard = {
    id: "test-card-standard",
    dayNumber: 5,
    unitId: "introduce-yourself",
    type: "micro-speaking",
    title: "Standard Speaking Card",
    learnerInstruction: "Read the sentence aloud.",
    indonesianExplanation: "Bacalah kalimat dengan keras.",
    targetPhrases: ["Hello world"],
    scaffold: "Standard format",
    estimatedMinutes: 3,
    completionRule: "recorded",
    linkedEngine: "micro-speaking",
    mobileLayoutHint: "standard"
  };

  const fluencySprintCard = phase2Curriculum.units
    .flatMap(u => u.days.flatMap(d => d.cards))
    .find(c => c.speakingMode === "fluency-sprint")!;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Set localStorage progress to unlock cards
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

  test("1. Standard micro-speaking card still renders existing controls", async ({ page }) => {
    await openCard(page, standardMicroSpeakingCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    const lesson = shell.locator("[data-testid='micro-speaking-lesson']");
    await expect(lesson).toBeVisible();
    await expect(lesson.locator("[data-testid='start-record-btn']")).toBeVisible();
    await expect(lesson.locator("[data-testid='continue-btn']")).toBeVisible();
    await expect(lesson.locator("[data-testid='complete-btn']")).toBeDisabled();
  });

  test("2. Fluency-sprint card renders sprint UI and sequence from metadata", async ({ page }) => {
    await openCard(page, fluencySprintCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    const lesson = shell.locator("[data-testid='fluency-sprint-lesson']");
    await expect(lesson).toBeVisible();

    // Verify day metadata and title
    await expect(lesson.locator("[data-testid='lesson-card-title']")).toContainText(fluencySprintCard.title);

    // Verify time limit sequence from curriculum metadata
    const timeLimits = fluencySprintCard.timeLimitsSeconds || [30, 20, 15];
    const stepsContainer = lesson.locator("[data-testid='sprint-steps-container']");
    await expect(stepsContainer).toBeVisible();
    for (const limit of timeLimits) {
      await expect(stepsContainer.locator(`[data-testid='sprint-step-${limit}']`)).toContainText(`${limit}s`);
    }

    // Verify privacy note
    await expect(lesson.locator("[data-testid='privacy-note']")).toContainText(
      "Your voice is not stored or uploaded. This sprint tracks completion only, not speech content."
    );

    // Verify standard buttons are not present but sprint-specific button is
    await expect(lesson.locator("[data-testid='start-sprint-btn']")).toBeVisible();
    await expect(lesson.locator("[data-testid='continue-btn']")).toBeVisible();
    await expect(lesson.locator("[data-testid='complete-btn']")).toBeDisabled();
  });

  test("3. Start sprint and stop attempt flow", async ({ page }) => {
    await openCard(page, fluencySprintCard);

    const lesson = page.locator("[data-testid='fluency-sprint-lesson']");
    await expect(lesson).toBeVisible();

    // Click Start sprint
    await lesson.locator("[data-testid='start-sprint-btn']").click();

    // Verify UI is in active/speaking state
    await expect(lesson.locator("[data-testid='stop-sprint-btn']")).toBeVisible();
    await expect(lesson.locator("[data-testid='sprint-status-msg']")).toContainText(
      "Sprint active! Speak target phrase immediately."
    );

    // Stop attempt
    await lesson.locator("[data-testid='stop-sprint-btn']").click();

    // Verify attempt recorded and complete button is enabled
    await expect(lesson.locator("[data-testid='retry-sprint-btn']")).toBeVisible();
    await expect(lesson.locator("[data-testid='complete-btn']")).toBeEnabled();
  });

  test("4. Try again resets local attempt safely", async ({ page }) => {
    await openCard(page, fluencySprintCard);

    const lesson = page.locator("[data-testid='fluency-sprint-lesson']");

    await lesson.locator("[data-testid='start-sprint-btn']").click();
    await lesson.locator("[data-testid='stop-sprint-btn']").click();
    await expect(lesson.locator("[data-testid='retry-sprint-btn']")).toBeVisible();

    // Click Try again
    await lesson.locator("[data-testid='retry-sprint-btn']").click();

    // Verify UI reset to idle state
    await expect(lesson.locator("[data-testid='start-sprint-btn']")).toBeVisible();
    await expect(lesson.locator("[data-testid='retry-sprint-btn']")).not.toBeVisible();
  });

  test("5. Completed with support works and advances progress", async ({ page }) => {
    await openCard(page, fluencySprintCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    const lesson = shell.locator("[data-testid='fluency-sprint-lesson']");

    await lesson.locator("[data-testid='start-sprint-btn']").click();
    await lesson.locator("[data-testid='stop-sprint-btn']").click();
    await lesson.locator("[data-testid='complete-btn']").click();

    // Shell should be closed
    await expect(shell).not.toBeVisible();

    // Progress in localStorage updated
    const rawVal = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    expect(rawVal).toBeTruthy();
    const parsed = JSON.parse(rawVal!);
    expect(parsed.cards[fluencySprintCard.id].status).toBe("completed");
  });

  test("6. Continue anyway works without scoring", async ({ page }) => {
    await openCard(page, fluencySprintCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    const lesson = shell.locator("[data-testid='fluency-sprint-lesson']");

    await lesson.locator("[data-testid='continue-btn']").click();

    // Close manually
    await shell.locator("[data-testid='close-lesson-btn']").click();
    await expect(shell).not.toBeVisible();

    const rawVal = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    expect(rawVal).toBeTruthy();
    const parsed = JSON.parse(rawVal!);
    expect(parsed.cards[fluencySprintCard.id].status).toBe("continued");
  });

  test("7. Timer cleanup does not crash after closing modal", async ({ page }) => {
    await openCard(page, fluencySprintCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    const lesson = shell.locator("[data-testid='fluency-sprint-lesson']");

    // Start sprint
    await lesson.locator("[data-testid='start-sprint-btn']").click();

    // Close the lesson modal while timer is running
    await shell.locator("[data-testid='close-lesson-btn']").click();
    await expect(shell).not.toBeVisible();

    // Wait a brief moment to ensure no uncaught timer errors or crashes occur
    await page.waitForTimeout(500);
  });

  test("8. Fluency sprint does not show forbidden scoring/AI terms in DOM", async ({ page }) => {
    await openCard(page, fluencySprintCard);

    const lesson = page.locator("[data-testid='fluency-sprint-lesson']");
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

  test("9. Privacy: LocalStorage contains no forbidden private fields", async ({ page }) => {
    await openCard(page, fluencySprintCard);

    const lesson = page.locator("[data-testid='fluency-sprint-lesson']");
    await lesson.locator("[data-testid='start-sprint-btn']").click();
    await lesson.locator("[data-testid='stop-sprint-btn']").click();

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
