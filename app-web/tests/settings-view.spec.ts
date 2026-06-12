import { test, expect } from "@playwright/test";
import type { AppLanguage, TargetLanguage } from "../src/app/lib/i18n";
import {
  buildProfileSettingsPreferencesPatch,
  getProfileLanguagePreferenceState,
} from "../src/app/components/SettingsView";

// ---------------------------------------------------------------------------
// Unit tests for SettingsView helpers
// ---------------------------------------------------------------------------

test.describe("SettingsView helper functions", () => {
  test("buildProfileSettingsPreferencesPatch trims and normalizes empty display name & bio to null", () => {
    const patch = buildProfileSettingsPreferencesPatch({
      displayName: "  ",
      bio: "  \n  ",
      publicProfileEnabled: true,
      leaderboardOptIn: false,
      preferredAppLanguage: "id",
      feedbackLanguage: "id",
    });

    expect(patch.displayName).toBeNull();
    expect(patch.bio).toBeNull();
    expect(patch.publicProfileEnabled).toBe(true);
    expect(patch.leaderboardOptIn).toBe(false);
    expect(patch.preferredAppLanguage).toBe("id");
    expect(patch.feedbackLanguage).toBe("id");
    expect(patch.targetLanguage).toBe("en");
    expect(patch.commonplaceCanvasColor).toBe("default");
    expect(patch.commonplaceCardColor).toBe("default");
    expect(patch.appearanceMode).toBe("system");
  });

  test("getProfileLanguagePreferenceState normalizes invalid values to defaults", () => {
    const state = getProfileLanguagePreferenceState(
      {
        preferredAppLanguage: "fr" as unknown as AppLanguage, // invalid
        feedbackLanguage: null,
        targetLanguage: "id" as unknown as TargetLanguage, // invalid
      },
      "id",
    );

    expect(state.appLanguage).toBe("en");
    expect(state.feedbackLanguage).toBe("en");
    expect(state.targetLanguage).toBe("en");
  });
});

// ---------------------------------------------------------------------------
// E2E UI tests for SettingsView tab
// ---------------------------------------------------------------------------

test.describe("SettingsView Browser UI integration - Split Sidebar View", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Settings view renders local profile details and options", async ({ page }) => {
    await page.getByRole("button", { name: "Settings" }).click();

    // Verify Settings page elements
    await expect(page.locator("header")).toContainText("Settings");
    await expect(page.locator("body")).toContainText("You are using fonetik in local mode.");
    await expect(page.locator("body")).toContainText("Learning data stays on this browser");

    // Local Stats Card should not be visible in Settings anymore (moved to Profile)
    await expect(page.locator("body")).not.toContainText("Local Stats");
  });

  test("Privacy: Settings view DOM must not contain private learning content placeholders", async ({ page }) => {
    await page.getByRole("button", { name: "Settings" }).click();

    const bodyText = await page.locator("body").innerText();
    const forbidden = [
      "retry_transcript",
      "vocabulary_sentence",
      "article_url",
      "main_weakness",
      "csv",
      "source_id",
      "private_note",
    ];

    for (const pattern of forbidden) {
      expect(bodyText).not.toContain(`"${pattern}"`);
      expect(bodyText).not.toContain(`${pattern}:`);
    }

    // Email character @ should not exist in local mode
    expect(bodyText).not.toContain("@");
  });
});
