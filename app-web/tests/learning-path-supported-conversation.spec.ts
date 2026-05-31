import { test, expect, Page } from "@playwright/test";
import { phase2Curriculum } from "../src/app/lib/learning-path/phase2-curriculum";

async function openCard(page: Page, card: unknown) {
  await page.evaluate((c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__DEV_TEST_ONLY_OPEN_CARD__(c);
  }, card);
}

test.describe("Learning Path - Supported Conversation MVP Tests (TASK-052H)", () => {

  const conversationCard = phase2Curriculum.units
    .flatMap(u => u.days.flatMap(d => d.cards))
    .find(c => c.type === "supported-conversation")!;

  const malformedCard = {
    id: "malformed-convo-card",
    dayNumber: 19,
    unitId: "asking-and-answering",
    type: "supported-conversation",
    title: "Malformed Card",
    targetPhrases: ["Hello"],
    learnerInstruction: "Speak",
    indonesianExplanation: "Bicara",
    scaffold: "...",
    estimatedMinutes: 2,
    completionRule: "recorded",
    linkedEngine: "supported-conversation",
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

  test("1. Renders supported conversation card without crashing and displays scripted tutor prompt", async ({ page }) => {
    await openCard(page, conversationCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    const lesson = shell.locator("[data-testid='supported-conversation-lesson']");
    await expect(lesson).toBeVisible();

    // Display title & instruction
    await expect(lesson.locator("[data-testid='lesson-card-title']")).toContainText(conversationCard.title);
    
    // Display scripted tutor prompt
    await expect(lesson.locator("[data-testid='supported-conversation-prompt']")).toContainText(
      conversationCard.conversationPrompt!.tutorTurn
    );

    // Display response options
    const optionsBox = lesson.locator("[data-testid='conversation-options-box']");
    await expect(optionsBox).toBeVisible();
    const optionBtns = optionsBox.locator("[data-testid='supported-conversation-option']");
    const count = await optionBtns.count();
    expect(count).toBe(conversationCard.conversationPrompt!.options.length);
  });

  test("2. Selecting option shows response preview, no free text input exists", async ({ page }) => {
    await openCard(page, conversationCard);

    const lesson = page.locator("[data-testid='supported-conversation-lesson']");
    await expect(lesson).toBeVisible();

    // No free text input elements
    await expect(lesson.locator("textarea")).not.toBeVisible();
    await expect(lesson.locator("input[type='text']")).not.toBeVisible();

    // Select first option
    const optionsBox = lesson.locator("[data-testid='conversation-options-box']");
    const firstOption = optionsBox.locator("[data-testid='supported-conversation-option']").first();
    const optText = await firstOption.innerText();
    await firstOption.click();

    // Shows selected response preview
    const preview = lesson.locator("[data-testid='selected-response-preview']");
    await expect(preview).toBeVisible();
    await expect(preview).toContainText(optText);

    // Playback for tutor and response buttons are visible
    await expect(lesson.locator("[data-testid='listen-tutor-prompt-btn']")).toBeVisible();
    await expect(lesson.locator("[data-testid='listen-selected-response-btn']")).toBeVisible();
  });

  test("3. Start speaking, stop attempt, and reset flows", async ({ page }) => {
    await openCard(page, conversationCard);

    const lesson = page.locator("[data-testid='supported-conversation-lesson']");
    await expect(lesson).toBeVisible();

    // Select first option
    await lesson.locator("[data-testid='supported-conversation-option']").first().click();

    // Start speaking
    await lesson.locator("[data-testid='start-supported-speaking-btn']").click();
    await expect(lesson.locator("[data-testid='stop-supported-speaking-btn']")).toBeVisible();

    // Stop attempt
    await lesson.locator("[data-testid='stop-supported-speaking-btn']").click();
    await expect(lesson.locator("[data-testid='retry-supported-speaking-btn']")).toBeVisible();

    // Try again resets state
    await lesson.locator("[data-testid='retry-supported-speaking-btn']").click();
    await expect(lesson.locator("[data-testid='start-supported-speaking-btn']")).toBeVisible();
  });

  test("4. Completed with support works after selecting + recording, continue anyway works anytime", async ({ page }) => {
    await openCard(page, conversationCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    const lesson = shell.locator("[data-testid='supported-conversation-lesson']");

    // Complete button initially disabled
    await expect(lesson.locator("[data-testid='complete-supported-conversation-btn']")).toBeDisabled();

    // Select + start + stop
    await lesson.locator("[data-testid='supported-conversation-option']").first().click();
    await lesson.locator("[data-testid='start-supported-speaking-btn']").click();
    await lesson.locator("[data-testid='stop-supported-speaking-btn']").click();

    // Complete button becomes enabled
    const completeBtn = lesson.locator("[data-testid='complete-supported-conversation-btn']");
    await expect(completeBtn).toBeEnabled();
    await completeBtn.click();
    await expect(shell).not.toBeVisible();

    const rawVal = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    expect(rawVal).toBeTruthy();
    const parsed = JSON.parse(rawVal!);
    expect(parsed.cards[conversationCard.id].status).toBe("completed");
  });

  test("5. Continue anyway action bypasses selection and speaking", async ({ page }) => {
    await openCard(page, conversationCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    const lesson = shell.locator("[data-testid='supported-conversation-lesson']");

    await lesson.locator("[data-testid='continue-btn']").click();

    // Manual close
    await shell.locator("[data-testid='close-lesson-btn']").click();
    await expect(shell).not.toBeVisible();

    const rawVal = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    expect(rawVal).toBeTruthy();
    const parsed = JSON.parse(rawVal!);
    expect(parsed.cards[conversationCard.id].status).toBe("continued");
  });

  test("6. Malformed conversationPrompt does not crash and renders fallback view", async ({ page }) => {
    await openCard(page, malformedCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    const lesson = shell.locator("[data-testid='supported-conversation-lesson']");
    await expect(lesson).toBeVisible();
    await expect(lesson.locator("[data-testid='lesson-card-title']")).toContainText(malformedCard.title);
  });

  test("7. Supported conversation does not show forbidden scoring/AI terms in DOM", async ({ page }) => {
    await openCard(page, conversationCard);

    const lesson = page.locator("[data-testid='supported-conversation-lesson']");
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
      "wrong speaker",
      "bad pronunciation",
      "weak grammar",
      "ai tutor",
      "live conversation",
      "free chat",
      "final exam"
    ];

    banned.forEach(word => {
      expect(textContent.toLowerCase()).not.toContain(word);
    });
  });

  test("8. Privacy: LocalStorage contains no forbidden private fields", async ({ page }) => {
    await openCard(page, conversationCard);

    const lesson = page.locator("[data-testid='supported-conversation-lesson']");
    await lesson.locator("[data-testid='supported-conversation-option']").first().click();
    await lesson.locator("[data-testid='start-supported-speaking-btn']").click();
    await lesson.locator("[data-testid='stop-supported-speaking-btn']").click();

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
