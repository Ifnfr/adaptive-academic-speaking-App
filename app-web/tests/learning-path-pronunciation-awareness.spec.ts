import { test, expect, Page } from "@playwright/test";
import { phase2Curriculum } from "../src/app/lib/learning-path/phase2-curriculum";

async function openCard(page: Page, card: unknown) {
  await page.evaluate((c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__DEV_TEST_ONLY_OPEN_CARD__(c);
  }, card);
}

test.describe("Learning Path - Pronunciation Awareness MVP Tests (TASK-052I)", () => {

  const pronunciationCard = phase2Curriculum.units
    .flatMap(u => u.days.flatMap(d => d.cards))
    .find(c => c.type === "pronunciation-awareness")!;

  const malformedCard = {
    id: "malformed-sound-card",
    dayNumber: 16,
    unitId: "asking-and-answering",
    type: "pronunciation-awareness",
    title: "Malformed Sound Card",
    targetPhrases: ["this", "that"],
    learnerInstruction: "Identify sound",
    indonesianExplanation: "Bicara",
    scaffold: "...",
    estimatedMinutes: 2,
    completionRule: "completed",
    linkedEngine: "pronunciation-awareness",
    mobileLayoutHint: "standard"
  };

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
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

  test("1. Renders pronunciation-awareness card without crashing and displays focus sound", async ({ page }) => {
    await openCard(page, pronunciationCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    const lesson = shell.locator("[data-testid='pronunciation-awareness-lesson']");
    await expect(lesson).toBeVisible();

    // Focus sound displayed
    await expect(lesson.locator("[data-testid='pronunciation-focus-sound']")).toContainText("/θ/ & /ð/");

    // Title / info
    await expect(lesson.locator("[data-testid='lesson-card-title']")).toContainText(pronunciationCard.title);

    // Minimal pair options
    const options = lesson.locator("[data-testid='pronunciation-pair-option']");
    expect(await options.count()).toBe(2);
    await expect(options.nth(0)).toContainText(pronunciationCard.pronunciationFocus!.pairs[0].wordA);
    await expect(options.nth(1)).toContainText(pronunciationCard.pronunciationFocus!.pairs[0].wordB);
  });

  test("2. Selecting a fixed option displays selected choice and shows feedback, no free text input", async ({ page }) => {
    await openCard(page, pronunciationCard);

    const lesson = page.locator("[data-testid='pronunciation-awareness-lesson']");
    await expect(lesson).toBeVisible();

    // No free text input
    await expect(page.locator("textarea")).not.toBeVisible();
    await expect(page.locator("input[type='text']")).not.toBeVisible();

    const pair = pronunciationCard.pronunciationFocus!.pairs[0];
    const correctWord = pair.correct === "A" ? pair.wordA : pair.wordB;
    const incorrectWord = pair.correct === "A" ? pair.wordB : pair.wordA;

    // Click incorrect
    await lesson.locator(`[data-testid='pronunciation-pair-option']`, { hasText: incorrectWord }).click();
    await expect(lesson.locator("[data-testid='builder-feedback-retry']")).toBeVisible();

    // Click correct
    await lesson.locator(`[data-testid='pronunciation-pair-option']`, { hasText: correctWord }).click();
    await expect(lesson.locator("[data-testid='builder-feedback-success']")).toBeVisible();

    // Selection preview visible
    const preview = lesson.locator("[data-testid='selected-pronunciation-choice']");
    await expect(preview).toBeVisible();
    await expect(preview).toContainText(correctWord);

    // Buttons are present
    await expect(lesson.locator("[data-testid='listen-pronunciation-model-btn']")).toBeVisible();
    await expect(lesson.locator("[data-testid='listen-pronunciation-option-btn']").first()).toBeVisible();
  });

  test("3. Start speaking, stop attempt, and reset flows", async ({ page }) => {
    await openCard(page, pronunciationCard);

    const lesson = page.locator("[data-testid='pronunciation-awareness-lesson']");
    await expect(lesson).toBeVisible();

    // Select correct option
    const pair = pronunciationCard.pronunciationFocus!.pairs[0];
    const correctWord = pair.correct === "A" ? pair.wordA : pair.wordB;
    await lesson.locator(`[data-testid='pronunciation-pair-option']`, { hasText: correctWord }).click();

    // Start speaking
    await lesson.locator("[data-testid='start-pronunciation-speaking-btn']").click();
    await expect(lesson.locator("[data-testid='stop-pronunciation-speaking-btn']")).toBeVisible();

    // Stop attempt
    await lesson.locator("[data-testid='stop-pronunciation-speaking-btn']").click();
    await expect(lesson.locator("[data-testid='retry-pronunciation-speaking-btn']")).toBeVisible();

    // Try again resets
    await lesson.locator("[data-testid='retry-pronunciation-speaking-btn']").click();
    await expect(lesson.locator("[data-testid='start-pronunciation-speaking-btn']")).toBeVisible();
  });

  test("4. Completed with support works after selected choice + recorded attempt, continue anyway works anytime", async ({ page }) => {
    await openCard(page, pronunciationCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    const lesson = shell.locator("[data-testid='pronunciation-awareness-lesson']");

    await expect(lesson.locator("[data-testid='complete-pronunciation-awareness-btn']")).toBeDisabled();

    // Select + start + stop
    const pair = pronunciationCard.pronunciationFocus!.pairs[0];
    const correctWord = pair.correct === "A" ? pair.wordA : pair.wordB;
    await lesson.locator(`[data-testid='pronunciation-pair-option']`, { hasText: correctWord }).click();
    await lesson.locator("[data-testid='start-pronunciation-speaking-btn']").click();
    await lesson.locator("[data-testid='stop-pronunciation-speaking-btn']").click();

    // Complete button becomes enabled
    const completeBtn = lesson.locator("[data-testid='complete-pronunciation-awareness-btn']");
    await expect(completeBtn).toBeEnabled();
    await completeBtn.click();
    await expect(shell).not.toBeVisible();

    const rawVal = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    expect(rawVal).toBeTruthy();
    const parsed = JSON.parse(rawVal!);
    expect(parsed.cards[pronunciationCard.id].status).toBe("completed");
  });

  test("5. Continue anyway action bypasses choice and speaking", async ({ page }) => {
    await openCard(page, pronunciationCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    const lesson = shell.locator("[data-testid='pronunciation-awareness-lesson']");

    await lesson.locator("[data-testid='continue-btn']").click();

    // Manual close
    await shell.locator("[data-testid='close-lesson-btn']").click();
    await expect(shell).not.toBeVisible();

    const rawVal = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    expect(rawVal).toBeTruthy();
    const parsed = JSON.parse(rawVal!);
    expect(parsed.cards[pronunciationCard.id].status).toBe("continued");
  });

  test("6. Malformed pronunciationFocus does not crash", async ({ page }) => {
    await openCard(page, malformedCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    const lesson = shell.locator("[data-testid='pronunciation-awareness-lesson']");
    await expect(lesson).toBeVisible();
    await expect(lesson.locator("[data-testid='lesson-card-title']")).toContainText(malformedCard.title);
  });

  test("7. Pronunciation awareness does not show forbidden scoring/AI terms in DOM", async ({ page }) => {
    await openCard(page, pronunciationCard);

    const lesson = page.locator("[data-testid='pronunciation-awareness-lesson']");
    const textContent = await lesson.innerText();
    const banned = [
      "accuracy score",
      "pronunciation score",
      "grammar score",
      "phoneme score",
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
      "harsh label",
      "final exam"
    ];

    banned.forEach(word => {
      expect(textContent.toLowerCase()).not.toContain(word);
    });
  });

  test("8. Privacy: LocalStorage contains no forbidden private fields", async ({ page }) => {
    await openCard(page, pronunciationCard);

    const lesson = page.locator("[data-testid='pronunciation-awareness-lesson']");
    const pair = pronunciationCard.pronunciationFocus!.pairs[0];
    const correctWord = pair.correct === "A" ? pair.wordA : pair.wordB;
    await lesson.locator(`[data-testid='pronunciation-pair-option']`, { hasText: correctWord }).click();
    await lesson.locator("[data-testid='start-pronunciation-speaking-btn']").click();
    await lesson.locator("[data-testid='stop-pronunciation-speaking-btn']").click();

    const rawVal = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    expect(rawVal).toBeTruthy();

    const strVal = rawVal!.toLowerCase();
    const bannedKeys = [
      "transcript",
      "speechtotext",
      "audioblob",
      "recordingurl",
      "rawlearnersentence",
      "exactlearnersentence",
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
