import { test, expect } from "@playwright/test";
import { phase2Curriculum } from "../src/app/lib/learning-path/phase2-curriculum";

test.describe("Learning Path - Phase 2 Shell Compatibility & Fallbacks (TASK-052E)", () => {

  const supportedConversationCard = phase2Curriculum.units
    .flatMap(u => u.days.flatMap(d => d.cards))
    .find(c => c.type === "supported-conversation")!;

  const pronunciationAwarenessCard = phase2Curriculum.units
    .flatMap(u => u.days.flatMap(d => d.cards))
    .find(c => c.type === "pronunciation-awareness")!;

  const reflectionCard = phase2Curriculum.units
    .flatMap(u => u.days.flatMap(d => d.cards))
    .find(c => c.type === "reflection-card")!;

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

  test("1. Shell can open a supported-conversation card with fallback rendering", async ({ page }) => {
    // Open the card programmatically using our dev test helper hook
    await page.evaluate((card) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__DEV_TEST_ONLY_OPEN_CARD__(card);
    }, supportedConversationCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    // Verify day metadata and title
    await expect(shell).toContainText(`Day ${supportedConversationCard.dayNumber}`);
    await expect(shell.locator("[data-testid='lesson-card-title']")).toContainText(supportedConversationCard.title);
    await expect(shell.locator("[data-testid='lesson-learner-instruction']")).toContainText(supportedConversationCard.learnerInstruction);
    await expect(shell).toContainText(supportedConversationCard.indonesianExplanation);

    // Verify MVP controls exist
    await expect(shell.locator("[data-testid='supported-conversation-prompt']")).toBeVisible();
    await expect(shell.locator("[data-testid='listen-tutor-prompt-btn']")).toBeVisible();
    await expect(shell.locator("[data-testid='continue-btn']")).toBeVisible();
  });

  test("2. Shell can open a pronunciation-awareness card with fallback rendering", async ({ page }) => {
    await page.evaluate((card) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__DEV_TEST_ONLY_OPEN_CARD__(card);
    }, pronunciationAwarenessCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    await expect(shell).toContainText(`Day ${pronunciationAwarenessCard.dayNumber}`);
    await expect(shell.locator("[data-testid='lesson-card-title']")).toContainText(pronunciationAwarenessCard.title);
    await expect(shell.locator("[data-testid='lesson-learner-instruction']")).toContainText(pronunciationAwarenessCard.learnerInstruction);
    await expect(shell).toContainText(pronunciationAwarenessCard.indonesianExplanation);

    // Verify MVP controls exist
    await expect(shell.locator("[data-testid='pronunciation-focus-sound']")).toBeVisible();
    await expect(shell.locator("[data-testid='listen-pronunciation-model-btn']")).toBeVisible();
    await expect(shell.locator("[data-testid='continue-btn']")).toBeVisible();
  });

  test("3. Shell can open a reflection-card with fallback rendering", async ({ page }) => {
    await page.evaluate((card) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__DEV_TEST_ONLY_OPEN_CARD__(card);
    }, reflectionCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    await expect(shell).toContainText(`Day ${reflectionCard.dayNumber}`);
    await expect(shell.locator("[data-testid='lesson-card-title']")).toContainText(reflectionCard.title);
    await expect(shell.locator("[data-testid='lesson-learner-instruction']")).toContainText(reflectionCard.learnerInstruction);
    await expect(shell).toContainText(reflectionCard.indonesianExplanation);

    // Verify MVP controls exist
    await expect(shell.locator("[data-testid='reflection-question']")).toBeVisible();
    await expect(shell.locator("[data-testid='continue-btn']")).toBeVisible();
  });

  test("4. Fallback view does not mention AI scoring or transcripts in DOM", async ({ page }) => {
    await page.evaluate((card) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__DEV_TEST_ONLY_OPEN_CARD__(card);
    }, supportedConversationCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    const textContent = await shell.innerText();
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
      "final exam",
      "ujian akhir",
      "free speaking"
    ];

    banned.forEach(word => {
      expect(textContent.toLowerCase()).not.toContain(word);
    });
  });

  test("5. Completion controls update progress correctly", async ({ page }) => {
    await page.evaluate((card) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__DEV_TEST_ONLY_OPEN_CARD__(card);
    }, supportedConversationCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await expect(shell).toBeVisible();

    // Click Completed with Support
    await shell.locator("[data-testid='mark-completed-btn']").click();
    await expect(shell).not.toBeVisible();

    // Verify localStorage key and state
    const rawVal = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    expect(rawVal).toBeTruthy();
    const parsed = JSON.parse(rawVal!);
    expect(parsed.cards[supportedConversationCard.id].status).toBe("completed");
  });

  test("6. Privacy: Progress values contain no forbidden fields in localStorage", async ({ page }) => {
    await page.evaluate((card) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__DEV_TEST_ONLY_OPEN_CARD__(card);
    }, supportedConversationCard);

    const shell = page.locator("[data-testid='micro-lesson-shell']");
    await shell.locator("[data-testid='mark-attempted-btn']").click();

    const rawVal = await page.evaluate(() => localStorage.getItem("fonetik:learning-path-progress:v1"));
    expect(rawVal).toBeTruthy();

    const strVal = rawVal!.toLowerCase();
    const bannedKeys = [
      "transcript",
      "speechtotext",
      "audioblob",
      "recordingurl",
      "owner_id",
      "source_id",
      "userid",
      "sessionid",
      "rawpayload",
      "email",
      "ai scoring",
      "pronunciation score",
      "grammar score"
    ];

    bannedKeys.forEach(key => {
      expect(strVal).not.toContain(key);
    });
    expect(strVal).not.toContain("@");
  });

});
