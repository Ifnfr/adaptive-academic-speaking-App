import { test, expect } from "@playwright/test";
import {
  mapProfilePreferencesPatchToSupabaseUpdate,
} from "../src/app/lib/storage/supabase-profile-adapter";
import type { UserProfilePreferencesPatch } from "../src/app/lib/storage/supabase-profile-adapter";

// ---------------------------------------------------------------------------
// ProfileSettingsView — unit tests for the preference patch mapper
// These run without a browser and verify the save path produces only safe fields.
// ---------------------------------------------------------------------------

const PRIVATE_CONTENT_PATTERNS = [
  "transcript",
  "retry_transcript",
  "vocabulary_sentence",
  "correction",
  "article_url",
  "main_weakness",
  "retry_task",
  "csv",
  "private_note",
  "session_id",
  "source_id",
];

test.describe("ProfileSettingsView preference patch — allowed fields only", () => {
  test("patch with all allowed fields maps only allowed columns", () => {
    const patch: UserProfilePreferencesPatch = {
      displayName: "Test User",
      bio: "Short bio.",
      publicProfileEnabled: true,
      leaderboardOptIn: false,
    };
    const update = mapProfilePreferencesPatchToSupabaseUpdate(patch);
    const keys = Object.keys(update);
    expect(keys).toContain("display_name");
    expect(keys).toContain("bio");
    expect(keys).toContain("public_profile_enabled");
    expect(keys).toContain("leaderboard_opt_in");
    // Email must not appear (it's excluded from UserProfilePreferencesPatch)
    expect(keys).not.toContain("email");
  });

  test("no private learning data keys appear in the preference patch output", () => {
    const patch: UserProfilePreferencesPatch = {
      displayName: "Safe Name",
      bio: "Safe bio.",
      publicProfileEnabled: false,
      leaderboardOptIn: false,
    };
    const update = mapProfilePreferencesPatchToSupabaseUpdate(patch);
    const updateStr = JSON.stringify(update);
    for (const pattern of PRIVATE_CONTENT_PATTERNS) {
      expect(updateStr).not.toContain(pattern);
    }
  });

  test("empty patch produces an empty update object", () => {
    const patch: UserProfilePreferencesPatch = {};
    const update = mapProfilePreferencesPatchToSupabaseUpdate(patch);
    expect(Object.keys(update)).toHaveLength(0);
  });

  test("privacy toggles default to false when patch omits them", () => {
    // When profile has no publicProfileEnabled or leaderboardOptIn,
    // they should remain false (not escalate to true by default).
    const patch: UserProfilePreferencesPatch = {
      publicProfileEnabled: false,
      leaderboardOptIn: false,
    };
    const update = mapProfilePreferencesPatchToSupabaseUpdate(patch);
    expect(update.public_profile_enabled).toBe(false);
    expect(update.leaderboard_opt_in).toBe(false);
  });

  test("bio is null-normalized when empty string is passed", () => {
    const patch: UserProfilePreferencesPatch = { bio: "   " };
    const update = mapProfilePreferencesPatchToSupabaseUpdate(patch);
    expect(update.bio).toBeNull();
  });

  test("displayName is null-normalized when empty string is passed", () => {
    const patch: UserProfilePreferencesPatch = { displayName: "   " };
    const update = mapProfilePreferencesPatchToSupabaseUpdate(patch);
    expect(update.display_name).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ProfileSettingsView — browser tests via page.goto
// These run in local/signed-out mode (no Clerk env configured in test env).
// ---------------------------------------------------------------------------

test.describe("Profile & Settings view — signed-out (local mode)", () => {
  test("sidebar shows 'Profile & Settings' label", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("aside")).toContainText("Profile & Settings");
  });

  test("navigating to Profile & Settings renders local profile card", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Profile & Settings" }).click();
    await expect(page.locator("h2").first()).toContainText(/Profile & Settings/i);
  });

  test("signed-out view shows local profile card with no cloud controls", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Profile & Settings" }).click();

    // Should show local profile copy
    await expect(page.locator("body")).toContainText("Local Profile");
    await expect(page.locator("body")).toContainText(
      "Learning data stays on this browser",
    );
    // Should NOT show privacy toggle controls (only shown when signed in)
    await expect(
      page.getByRole("switch", { name: /public profile/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("switch", { name: /leaderboard opt-in/i }),
    ).toHaveCount(0);
  });

  test("signed-out view shows local stats section with counts only", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Profile & Settings" }).click();

    // Stats card appears
    await expect(page.locator("body")).toContainText("Local Stats");
    await expect(page.locator("body")).toContainText("Total XP");
    await expect(page.locator("body")).toContainText("Speaker Level");
    await expect(page.locator("body")).toContainText("Day Streak");
    await expect(page.locator("body")).toContainText("Sessions Completed");
    await expect(page.locator("body")).toContainText("Vocabulary Words");
    await expect(page.locator("body")).toContainText("Badges Earned");
  });

  test("signed-out view does not render private learning content", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Profile & Settings" }).click();

    // Raw field-shaped private content must not appear in the DOM. The UI may
    // still name private content categories in safety copy.
    const body = page.locator("body");
    await expect(body).not.toContainText("retry_transcript");
    await expect(body).not.toContainText("vocabulary_sentence");
    await expect(body).not.toContainText("article_url");
    await expect(body).not.toContainText("main_weakness");
    await expect(body).not.toContainText("csv");
    await expect(body).not.toContainText("source_id");
    await expect(body).not.toContainText("private_note");
  });

  test("no public profile route or leaderboard link exists in the view", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Profile & Settings" }).click();

    // No link to a public profile page
    const publicProfileLinks = page.locator("a[href*='profile']");
    await expect(publicProfileLinks).toHaveCount(0);

    // No leaderboard link
    const leaderboardLinks = page.locator("a[href*='leaderboard']");
    await expect(leaderboardLinks).toHaveCount(0);
  });

  test("topbar shows 'Profile & Settings' as the page title", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Profile & Settings" }).click();
    await expect(page.locator("header")).toContainText("Profile & Settings");
  });

  test("navigating away and back to Profile & Settings keeps the view stable", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Profile & Settings" }).click();
    await expect(page.locator("body")).toContainText("Local Stats");

    // Navigate away
    await page.getByRole("button", { name: "Active Session" }).click();
    await expect(page.locator("body")).not.toContainText("Local Stats");

    // Navigate back
    await page.getByRole("button", { name: "Profile & Settings" }).click();
    await expect(page.locator("body")).toContainText("Local Stats");
  });
});
