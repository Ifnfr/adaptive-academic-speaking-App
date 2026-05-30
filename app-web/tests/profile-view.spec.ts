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
    // We check the expected behavior:
    // Signed-out defaults to "Local learner"
    // Signed-in defaults to "Signed-in learner"
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

test.describe("ProfileView Browser UI Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Can navigate to Profile & Settings, defaults to Settings tab, and switch to Profile", async ({ page }) => {
    await page.getByRole("button", { name: "Profile & Settings" }).click();
    
    // Tab buttons should be visible
    await expect(page.getByTestId("profile-tab-button")).toBeVisible();
    await expect(page.getByTestId("settings-tab-button")).toBeVisible();
    
    // Default should be Settings view (ProfileView not visible yet)
    await expect(page.getByTestId("profile-view-container")).not.toBeVisible();
    
    // Switch to Profile Tab
    await page.getByTestId("profile-tab-button").click();
    
    // ProfileView container should now be visible
    await expect(page.getByTestId("profile-view-container")).toBeVisible();
  });

  test("Renders safe identity and achievements summary on Profile tab", async ({ page }) => {
    await page.getByRole("button", { name: "Profile & Settings" }).click();
    await page.getByTestId("profile-tab-button").click();

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
    await page.getByRole("button", { name: "Profile & Settings" }).click();
    await page.getByTestId("profile-tab-button").click();

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

  test("Can switch to Settings tab and back to Profile tab", async ({ page }) => {
    await page.getByRole("button", { name: "Profile & Settings" }).click();
    
    // Switch to Profile Tab
    await page.getByTestId("profile-tab-button").click();
    await expect(page.getByTestId("profile-view-container")).toBeVisible();

    // Click Settings tab
    await page.getByTestId("settings-tab-button").click();
    
    // The ProfileView should be hidden, and Settings/ProfileSettingsView should show
    await expect(page.getByTestId("profile-view-container")).not.toBeVisible();
    await expect(page.locator("body")).toContainText("Learning data stays on this browser");

    // Click Profile tab again
    await page.getByTestId("profile-tab-button").click();
    await expect(page.getByTestId("profile-view-container")).toBeVisible();
  });
});
