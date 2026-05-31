import { test, expect, Page } from "@playwright/test";
import { phase2Curriculum } from "../src/app/lib/learning-path/phase2-curriculum";

async function openCard(page: Page, card: unknown) {
  await page.evaluate((c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__DEV_TEST_ONLY_OPEN_CARD__(c);
  }, card);
}

test.describe("Learning Path - Reflection Card MVP Tests (TASK-052J)", () => {

  const reflectionCard = phase2Curriculum.units
    .flatMap(u => u.days.flatMap(d => d.cards))
    .find(c => c.type === "reflection-card")!;

  const malformedCard = {
    id: "malformed-reflection-card",
    dayNumber: 20,
    unitId: "asking-and-answering",
    type: "reflection-card",
    title: "Malformed Reflection Card",
    targetPhrases: ["this", "that"],
    learnerInstruction: "Reflect",
    indonesianExplanation: "Bicara",
    scaffold: "...",
    estimatedMinutes: 2,
    completionRule: "completed",
    linkedEngine: "reflection-card",
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

  test("1. Renders reflection-card without crashing and displays question and options", async ({ page }) => {
    await openCard(page, reflectionCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    const lesson = shell.locator("[data-testid='reflection-card-lesson']");
    await expect(lesson).toBeVisible();

    // displays question
    await expect(lesson.locator("[data-testid='reflection-question']")).toContainText(
      reflectionCard.reflectionPrompt!.question
    );

    // displays fixed options
    const options = lesson.locator("[data-testid='reflection-option']");
    expect(await options.count()).toBe(reflectionCard.reflectionPrompt!.options.length);
    await expect(options.nth(0)).toContainText(reflectionCard.reflectionPrompt!.options[0]);
  });

  test("2. Selecting a fixed option displays preview and supportive feedback, no free text input exists", async ({ page }) => {
    await openCard(page, reflectionCard);

    const lesson = page.locator("[data-testid='reflection-card-lesson']");
    await expect(lesson).toBeVisible();

    // No free text input
    await expect(page.locator("textarea")).not.toBeVisible();
    await expect(page.locator("input[type='text']")).not.toBeVisible();

    const optionText = reflectionCard.reflectionPrompt!.options[0];

    // Select option
    await lesson.locator(`[data-testid='reflection-option']`, { hasText: optionText }).click();

    // Selected preview appears
    const preview = lesson.locator("[data-testid='selected-reflection-option']");
    await expect(preview).toBeVisible();
    await expect(preview).toContainText(optionText);

    // Supportive feedback text appears (contains confident feedback text)
    await expect(lesson).toContainText("Great. Keep building this speaking habit.");
  });

  test("3. Completed with support works after selecting a fixed option, continue anyway works anytime", async ({ page }) => {
    await openCard(page, reflectionCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    const lesson = shell.locator("[data-testid='reflection-card-lesson']");

    await expect(lesson.locator("[data-testid='complete-reflection-card-btn']")).toBeDisabled();

    // Select option
    const optionText = reflectionCard.reflectionPrompt!.options[0];
    await lesson.locator(`[data-testid='reflection-option']`, { hasText: optionText }).click();

    // Complete button becomes enabled
    const completeBtn = lesson.locator("[data-testid='complete-reflection-card-btn']");
    await expect(completeBtn).toBeEnabled();
    await completeBtn.click();
    await expect(shell).not.toBeVisible();

    const rawVal = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    expect(rawVal).toBeTruthy();
    const parsed = JSON.parse(rawVal!);
    expect(parsed.cards[reflectionCard.id].status).toBe("completed");
  });

  test("4. Continue anyway action bypasses choice selection", async ({ page }) => {
    await openCard(page, reflectionCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    const lesson = shell.locator("[data-testid='reflection-card-lesson']");

    await lesson.locator("[data-testid='continue-btn']").click();

    // Manual close
    await shell.locator("[data-testid='close-lesson-btn']").click();
    await expect(shell).not.toBeVisible();

    const rawVal = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    expect(rawVal).toBeTruthy();
    const parsed = JSON.parse(rawVal!);
    expect(parsed.cards[reflectionCard.id].status).toBe("continued");
  });

  test("5. Malformed reflectionPrompt does not crash", async ({ page }) => {
    await openCard(page, malformedCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    const lesson = shell.locator("[data-testid='reflection-card-lesson']");
    await expect(lesson).toBeVisible();
    await expect(lesson.locator("[data-testid='lesson-card-title']")).toContainText(malformedCard.title);
  });

  test("6. Reflection card does not show forbidden scoring/AI/mental health terms in DOM", async ({ page }) => {
    await openCard(page, reflectionCard);

    const lesson = page.locator("[data-testid='reflection-card-lesson']");
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
      "mood tracking",
      "mental health",
      "anxiety diagnosis",
      "psychological profile",
      "diagnostic",
      "final exam",
      "score",
      "grade",
      "failing",
      "weak",
      "poor",
      "bad",
      "deficient",
      "disorder",
      "struggling"
    ];

    banned.forEach(word => {
      expect(textContent.toLowerCase()).not.toContain(word);
    });
  });

  test("7. Privacy: LocalStorage contains no forbidden private fields", async ({ page }) => {
    await openCard(page, reflectionCard);

    const lesson = page.locator("[data-testid='reflection-card-lesson']");
    const optionText = reflectionCard.reflectionPrompt!.options[0];
    await lesson.locator(`[data-testid='reflection-option']`, { hasText: optionText }).click();

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
      "email",
      "privatenote"
    ];

    bannedKeys.forEach(key => {
      expect(strVal).not.toContain(key);
    });
    expect(strVal).not.toContain("@");
  });

});
