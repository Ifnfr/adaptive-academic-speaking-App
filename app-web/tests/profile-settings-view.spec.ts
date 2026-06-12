import { test, expect, type Page, type Route } from "@playwright/test";
import {
  buildProfileSettingsPreferencesPatch,
  getProfileLanguagePreferenceState,
} from "../src/app/components/ProfileSettingsView";
import {
  applyProfilePreferencesPatchToProfile,
  mapProfilePreferencesPatchToSupabaseUpdate,
} from "../src/app/lib/storage/supabase-profile-adapter";
import { COMMONPLACE_THEME_COLOR_IDS } from "../src/app/lib/commonplace-theme";
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
  appearanceMode: "system",
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
      appearanceMode: "dark",
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
    expect(keys).toContain("appearance_mode");
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
      appearanceMode: "system",
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
        "appearanceMode",
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
  test.beforeEach(async ({ page }) => {
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (
        url.pathname === "/" &&
        !url.searchParams.has("mockAuth") &&
        route.request().resourceType() === "document"
      ) {
        url.searchParams.set("mockAuth", "true");
        await route.fulfill({
          status: 302,
          headers: { location: url.toString() },
        });
        return;
      }
      await route.continue();
    });
  });

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

async function setupMockSignedInAuthAndProfile(page: Page, initialMode: string = "system") {
  await page.route("**/*", async (route: Route) => {
    const url = new URL(route.request().url());
    if (
      url.pathname === "/" &&
      !url.searchParams.has("mockAuth") &&
      route.request().resourceType() === "document"
    ) {
      url.searchParams.set("mockAuth", "true");
      await route.fulfill({
        status: 302,
        headers: { location: url.toString() },
      });
      return;
    }
    await route.continue();
  });

  await page.addInitScript((modeValue: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const testWindow = window as any;
    testWindow.__MOCK_AUTH__ = {
      isSignedIn: true,
      userId: "test-user-theme-id",
      email: "theme-test@example.com",
      displayName: "Theme Tester",
    };

    let localProfileState = {
      ownerId: "test-user-theme-id",
      email: "theme-test@example.com",
      displayName: "Theme Tester",
      learnerLevel: "Intermediate",
      preferredProvider: "Claude",
      preferredMode: "Fluency Sprint",
      avatarUrl: null,
      bio: "Checking themes",
      publicProfileEnabled: false,
      leaderboardOptIn: false,
      preferredAppLanguage: "en",
      feedbackLanguage: "en",
      targetLanguage: "en",
      commonplaceCanvasColor: "default",
      commonplaceCardColor: "default",
      appearanceMode: modeValue,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    testWindow.__MOCK_PROFILE_ADAPTER__ = {
      async loadProfile() {
        return localProfileState;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async updateProfile(_userId: string, patch: any) {
        testWindow.__LAST_PROFILE_PATCH__ = patch;
        localProfileState = {
          ...localProfileState,
          displayName: patch.displayName === undefined ? localProfileState.displayName : (patch.displayName ?? ""),
          bio: patch.bio === undefined ? localProfileState.bio : (patch.bio ?? ""),
          publicProfileEnabled: patch.publicProfileEnabled ?? localProfileState.publicProfileEnabled,
          leaderboardOptIn: patch.leaderboardOptIn ?? localProfileState.leaderboardOptIn,
          preferredAppLanguage: patch.preferredAppLanguage ?? localProfileState.preferredAppLanguage,
          feedbackLanguage: patch.feedbackLanguage ?? localProfileState.feedbackLanguage,
          commonplaceCanvasColor: patch.commonplaceCanvasColor ?? localProfileState.commonplaceCanvasColor,
          commonplaceCardColor: patch.commonplaceCardColor ?? localProfileState.commonplaceCardColor,
          appearanceMode: patch.appearanceMode ?? localProfileState.appearanceMode,
          updatedAt: new Date().toISOString(),
        };
      }
    };
  }, initialMode);
}

test.describe("Settings view — signed-in appearance mode", () => {
  test("Commonplace palette preview updates independently before save", async ({
    page,
  }) => {
    await setupMockSignedInAuthAndProfile(page, "dark");
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();

    for (const themeId of COMMONPLACE_THEME_COLOR_IDS) {
      await expect(
        page.getByTestId(`settings-commonplace-canvas-color-option-${themeId}`),
      ).toBeVisible();
      await expect(
        page.getByTestId(`settings-commonplace-card-color-option-${themeId}`),
      ).toBeVisible();
    }

    const canvasPreview = page.getByTestId("settings-commonplace-canvas-preview");
    const cardPreview = page.getByTestId("settings-commonplace-card-preview");
    await expect(canvasPreview).toHaveCSS("background-color", "rgb(238, 243, 241)");
    await expect(cardPreview).toHaveCSS("background-color", "rgb(255, 253, 248)");

    await page
      .getByTestId("settings-commonplace-canvas-color-option-ocean")
      .click();
    await expect(canvasPreview).toHaveCSS("background-color", "rgb(12, 74, 110)");
    await expect(cardPreview).toHaveCSS("background-color", "rgb(255, 253, 248)");

    await page
      .getByTestId("settings-commonplace-card-color-option-terracotta")
      .click();
    await expect(canvasPreview).toHaveCSS("background-color", "rgb(12, 74, 110)");
    await expect(cardPreview).toHaveCSS("background-color", "rgb(154, 52, 18)");

    await page.locator("#profile-save-btn").click();
    await expect(page.getByTestId("profile-save-success")).toBeVisible();

    const savedPatch = await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __LAST_PROFILE_PATCH__?: {
          commonplaceCanvasColor?: string;
          commonplaceCardColor?: string;
        };
      };

      return testWindow.__LAST_PROFILE_PATCH__;
    });
    expect(savedPatch).toMatchObject({
      commonplaceCanvasColor: "ocean",
      commonplaceCardColor: "terracotta",
    });
  });

  test("dark theme selection toggles document class to dark", async ({ page }) => {
    await setupMockSignedInAuthAndProfile(page, "light");
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();

    // Verify root does not have dark class initially
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    // Select dark mode in settings
    await page.locator("#profile-appearance-mode-select").selectOption("dark");
    await page.locator("#profile-save-btn").click();

    // Verify save success message
    await expect(page.getByTestId("profile-save-success")).toBeVisible();

    // Verify root gets dark class
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("light theme selection removes dark class", async ({ page }) => {
    await setupMockSignedInAuthAndProfile(page, "dark");
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();

    // Verify root has dark class initially (since initial mode is dark)
    await expect(page.locator("html")).toHaveClass(/dark/);

    // Select light mode in settings
    await page.locator("#profile-appearance-mode-select").selectOption("light");
    await page.locator("#profile-save-btn").click();

    // Verify root removes dark class
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("system theme follows OS prefers-color-scheme setting", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await setupMockSignedInAuthAndProfile(page, "system");
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();

    // Should be dark because prefers-color-scheme is dark
    await expect(page.locator("html")).toHaveClass(/dark/);

    // Change media query to light
    await page.emulateMedia({ colorScheme: "light" });
    // Root should immediately update to light without refresh
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("sidebar current level card uses dark-safe colors in both modes", async ({ page }) => {
    // 1. In Light Mode
    await setupMockSignedInAuthAndProfile(page, "light");
    await page.goto("/");

    const currentLevelCard = page.getByTestId("sidebar-current-level-card");
    await expect(currentLevelCard).toBeVisible();

    let styles = await currentLevelCard.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        backgroundColor: computed.backgroundColor,
        borderColor: computed.borderColor,
        color: computed.color,
      };
    });

    // In light mode, it should be dark forest teal: rgb(19, 78, 74) which is #134e4a
    expect(styles.backgroundColor).toBe("rgb(19, 78, 74)");
    expect(styles.borderColor).toBe("rgb(19, 78, 74)");

    // 2. In Dark Mode
    await setupMockSignedInAuthAndProfile(page, "dark");
    await page.goto("/");

    styles = await currentLevelCard.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        backgroundColor: computed.backgroundColor,
        borderColor: computed.borderColor,
        color: computed.color,
      };
    });

    // In dark mode, it should be dark teal: rgb(17, 51, 47) which is #11332f
    expect(styles.backgroundColor).toBe("rgb(17, 51, 47)");
    expect(styles.borderColor).toBe("rgb(17, 51, 47)");
  });
});
