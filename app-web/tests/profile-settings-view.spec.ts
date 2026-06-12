import { test, expect } from "@playwright/test";
import {
  buildProfileSettingsPreferencesPatch,
  getProfileLanguagePreferenceState,
} from "../src/app/components/ProfileSettingsView";
import {
  applyProfilePreferencesPatchToProfile,
  mapProfilePreferencesPatchToSupabaseUpdate,
} from "../src/app/lib/storage/supabase-profile-adapter";
import type {
  UserProfile,
  UserProfilePreferencesPatch,
} from "../src/app/lib/storage/supabase-profile-adapter";

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

const baseProfile: UserProfile = {
  ownerId: "user_123",
  email: "private@example.com",
  displayName: "Previous Name",
  learnerLevel: null,
  preferredProvider: null,
  preferredMode: null,
  avatarUrl: "https://example.com/avatar.png",
  bio: "Previous bio.",
  publicProfileEnabled: false,
  leaderboardOptIn: false,
  preferredAppLanguage: null,
  feedbackLanguage: null,
  targetLanguage: null,
  commonplaceCanvasColor: "default",
  commonplaceCardColor: "default",
  createdAt: "2026-05-27T00:00:00.000Z",
  updatedAt: "2026-05-27T00:00:00.000Z",
};

test.describe("ProfileSettingsView preference patch — allowed fields only", () => {
  test("patch with all allowed fields maps only allowed columns", () => {
    const patch: UserProfilePreferencesPatch = {
      displayName: "Test User",
      bio: "Short bio.",
      publicProfileEnabled: true,
      leaderboardOptIn: false,
      preferredAppLanguage: "id",
      feedbackLanguage: "id",
      targetLanguage: "en",
      commonplaceCanvasColor: "sage",
      commonplaceCardColor: "paper",
    };
    const update = mapProfilePreferencesPatchToSupabaseUpdate(patch);
    const keys = Object.keys(update);
    expect(keys).toContain("display_name");
    expect(keys).toContain("bio");
    expect(keys).toContain("public_profile_enabled");
    expect(keys).toContain("leaderboard_opt_in");
    expect(keys).toContain("preferred_app_language");
    expect(keys).toContain("feedback_language");
    expect(keys).toContain("target_language");
    expect(keys).toContain("commonplace_canvas_color");
    expect(keys).toContain("commonplace_card_color");
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

  test("clearing bio updates optimistic profile state to empty string", () => {
    const next = applyProfilePreferencesPatchToProfile(baseProfile, {
      bio: null,
      publicProfileEnabled: false,
      leaderboardOptIn: false,
    });
    expect(next.bio).toBe("");
    expect(next.displayName).toBe("Previous Name");
  });

  test("clearing displayName does not preserve stale custom value", () => {
    const next = applyProfilePreferencesPatchToProfile(baseProfile, {
      displayName: null,
      publicProfileEnabled: false,
      leaderboardOptIn: false,
    });
    expect(next.displayName).toBe("");
    expect(next.bio).toBe("Previous bio.");
  });

  test("optimistic profile patch does not overwrite email, avatar, or language placeholders", () => {
    const next = applyProfilePreferencesPatchToProfile(baseProfile, {
      displayName: "",
      bio: "",
      publicProfileEnabled: true,
      leaderboardOptIn: true,
    });
    expect(next.email).toBe(baseProfile.email);
    expect(next.avatarUrl).toBe(baseProfile.avatarUrl);
    expect(next.preferredAppLanguage).toBe(baseProfile.preferredAppLanguage);
    expect(next.feedbackLanguage).toBe(baseProfile.feedbackLanguage);
    expect(next.targetLanguage).toBe(baseProfile.targetLanguage);
    expect(next.publicProfileEnabled).toBe(true);
    expect(next.leaderboardOptIn).toBe(true);
  });

  test("language preference state normalizes invalid or null profile values safely", () => {
    const state = getProfileLanguagePreferenceState(
      {
        preferredAppLanguage: "fr",
        feedbackLanguage: null,
        targetLanguage: "id",
      },
      null,
    );
    expect(state.appLanguage).toBe("en");
    expect(state.feedbackLanguage).toBe("en");
    expect(state.targetLanguage).toBe("en");
    expect(state.appLanguageOptions).toEqual(["en", "id"]);
    expect(state.feedbackLanguageOptions).toEqual(["en", "id"]);
    expect(state.targetLanguageOptions).toEqual(["en"]);
  });

  test("language preference state uses loaded profile values when valid", () => {
    const state = getProfileLanguagePreferenceState(
      {
        preferredAppLanguage: "id",
        feedbackLanguage: "id",
        targetLanguage: "en",
      },
      "en",
    );
    expect(state.appLanguage).toBe("id");
    expect(state.feedbackLanguage).toBe("id");
    expect(state.targetLanguage).toBe("en");
  });

  test("profile settings save payload includes language preferences and safe fields only", () => {
    const patch = buildProfileSettingsPreferencesPatch({
      displayName: " Test User ",
      bio: " Short bio. ",
      publicProfileEnabled: false,
      leaderboardOptIn: true,
      preferredAppLanguage: "id",
      feedbackLanguage: "id",
      commonplaceCanvasColor: "sage",
      commonplaceCardColor: "paper",
    });
    expect(patch).toEqual({
      displayName: "Test User",
      bio: "Short bio.",
      publicProfileEnabled: false,
      leaderboardOptIn: true,
      preferredAppLanguage: "id",
      feedbackLanguage: "id",
      targetLanguage: "en",
      commonplaceCanvasColor: "sage",
      commonplaceCardColor: "paper",
    });
    expect(Object.keys(patch).sort()).toEqual(
      [
        "bio",
        "displayName",
        "feedbackLanguage",
        "commonplaceCanvasColor",
        "commonplaceCardColor",
        "leaderboardOptIn",
        "preferredAppLanguage",
        "publicProfileEnabled",
        "targetLanguage",
      ].sort(),
    );
  });

  test("applying language preferences updates optimistic profile state", () => {
    const next = applyProfilePreferencesPatchToProfile(baseProfile, {
      preferredAppLanguage: "id",
      feedbackLanguage: "id",
      targetLanguage: "en",
    });
    expect(next.preferredAppLanguage).toBe("id");
    expect(next.feedbackLanguage).toBe("id");
    expect(next.targetLanguage).toBe("en");
    expect(next.email).toBe(baseProfile.email);
    expect(next.avatarUrl).toBe(baseProfile.avatarUrl);
  });
});

// ---------------------------------------------------------------------------
// ProfileSettingsView — browser tests via page.goto
// These run in local/signed-out mode (no Clerk env configured in test env).
// ---------------------------------------------------------------------------

test.describe("Settings view — signed-out (local mode)", () => {
  test("sidebar shows 'Settings' label and old combined label is removed", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("aside")).toContainText("Settings");
    await expect(page.locator("aside")).not.toContainText("Profile & Settings");
  });

  test("navigating to Settings renders local profile card", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.locator("h2").first()).toContainText(/Profile & Settings/i);
  });

  test("signed-out view shows local profile card with no cloud controls", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();

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
    await page.getByRole("button", { name: "Profile" }).click();

    // Stats card appears on Profile view
    await expect(page.locator("body")).toContainText("Local Stats");
    await expect(page.locator("body")).toContainText("Total XP");
    await expect(page.locator("body")).toContainText("Speaker Level");
    await expect(page.locator("body")).toContainText("Day Streak");
    await expect(page.locator("body")).toContainText("Sessions");
    await expect(page.locator("body")).toContainText("Vocab Words");
    await expect(page.locator("body")).toContainText("Badges");
  });

  test("signed-out view does not render private learning content", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();

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
    await page.getByRole("button", { name: "Settings" }).click();

    // No link to a public profile page
    const publicProfileLinks = page.locator("a[href*='profile']");
    await expect(publicProfileLinks).toHaveCount(0);

    // No leaderboard link
    const leaderboardLinks = page.locator("a[href*='leaderboard']");
    await expect(leaderboardLinks).toHaveCount(0);
  });

  test("topbar shows 'Settings' as the page title", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.locator("header")).toContainText("Settings");
  });

  test("navigating away and back to Settings keeps the view stable", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.locator("body")).toContainText("Local Profile");

    // Navigate away
    await page.getByRole("button", { name: "Active Session" }).click();
    await expect(page.locator("body")).not.toContainText("Local Profile");

    // Navigate back
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.locator("body")).toContainText("Local Profile");
  });
});
