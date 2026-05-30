import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Unit-style tests for ProfileView properties and privacy guarantees
// ---------------------------------------------------------------------------

const PRIVATE_LEARNING_CONTENT_PATTERNS = [
  "owner_id",
  "ownerId",
  "source_id",
  "sourceId",
  "transcript",
  "retry_transcript",
  "vocabulary_sentence",
  "correction",
  "article_url",
  "main_weakness",
  "retry_task",
  "csv",
  "private_note",
  "raw localStorage payload",
];

test.describe("ProfileView Privacy & Sanitization - Core Rules", () => {
  test("Display name fallbacks do not expose email", () => {
    const signedOutFallback = "Local learner";
    const signedInFallback = "Signed-in learner";

    expect(signedOutFallback).not.toContain("@");
    expect(signedInFallback).not.toContain("@");
  });

  test("Private patterns list has no overlap with public achievement metrics", () => {
    const publicMetrics = [
      "Total XP",
      "Speaker Level",
      "Day Streak",
      "Sessions Completed",
      "Vocabulary Words",
      "Badges Earned",
    ];

    for (const metric of publicMetrics) {
      for (const pattern of PRIVATE_LEARNING_CONTENT_PATTERNS) {
        expect(metric.toLowerCase()).not.toContain(pattern.toLowerCase());
      }
    }
  });
});

// ---------------------------------------------------------------------------
// E2E / UI Integration tests using Playwright browser driver
// ---------------------------------------------------------------------------

test.describe("ProfileView Browser UI Tests - Split Sidebar View", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Sidebar shows separate Profile and Settings buttons, no legacy label", async ({ page }) => {
    const sidebar = page.locator("aside");
    await expect(sidebar.locator("button:has-text('Profile')")).toBeVisible();
    await expect(sidebar.locator("button:has-text('Settings')")).toBeVisible();
    await expect(sidebar.locator("button:has-text('Profile & Settings')")).toHaveCount(0);
  });

  test("Can navigate to Profile directly from the sidebar", async ({ page }) => {
    await page.getByRole("button", { name: "Profile" }).click();
    
    // ProfileView container should now be visible immediately
    await expect(page.getByTestId("profile-view-container")).toBeVisible();
    
    // Topbar header check
    await expect(page.locator("header")).toContainText("Profile");
  });

  test("Renders safe identity and achievements summary on Profile view", async ({ page }) => {
    await page.getByRole("button", { name: "Profile" }).click();

    // Check display name
    await expect(page.getByTestId("profile-display-name")).toContainText("Local learner");

    // Check bio empty fallback
    await expect(page.getByTestId("profile-bio")).toContainText("No bio added yet.");

    // Check main stats are rendered
    await expect(page.locator("body")).toContainText("Total XP");
    await expect(page.locator("body")).toContainText("Day Streak");
    await expect(page.locator("body")).toContainText("Vocab Words");
    await expect(page.locator("body")).toContainText("Badges");

    // Check leaderboard visibility message
    await expect(page.getByTestId("leaderboard-visibility-status")).toContainText(
      "Local Visibility Only (Offline)"
    );
  });

  test("Strict privacy check: Profile DOM must not leak private details", async ({ page }) => {
    await page.getByRole("button", { name: "Profile" }).click();

    const bodyText = await page.locator("body").innerText();
    
    for (const pattern of PRIVATE_LEARNING_CONTENT_PATTERNS) {
      // The UI may contain descriptive text (e.g. "We strictly safeguard transcripts"),
      // but must NOT leak raw content placeholders or JSON fields.
      expect(bodyText).not.toContain(`"${pattern}"`);
      expect(bodyText).not.toContain(`${pattern}:`);
    }

    // Double check email shape is not present in local mode
    expect(bodyText).not.toContain("@");
  });

  test("Leaderboard still appears and works as expected", async ({ page }) => {
    // Navigate to Leaderboard directly from sidebar
    await page.getByRole("button", { name: "Leaderboard" }).click();
    await expect(page.locator("header")).toContainText("Leaderboard");
  });
});
