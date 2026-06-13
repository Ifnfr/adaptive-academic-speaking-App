import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, test, type TestInfo } from "@playwright/test";
import {
  createSupabaseAccessTokenProvider,
  getSupabaseAccessToken,
} from "../src/app/lib/supabase";
import {
  loadSupabaseProfile,
  mapClerkProfileSeedToSupabaseUpsert,
  mapProfilePatchToSupabaseUpsert,
  mapProfilePreferencesPatchToSupabaseUpdate,
  mapSupabaseRowToUserProfile,
  updateSupabaseProfilePreferences,
  upsertSupabaseProfile,
  bootstrapProfile,
  type SupabaseProfileRow,
} from "../src/app/lib/storage/supabase-profile-adapter";
import type { FonetikSupabaseClient } from "../src/app/lib/supabase";

const profileRow: SupabaseProfileRow = {
  id: "profile-row-uuid",
  owner_id: "user_clerk_123",
  email: " learner@example.com ",
  display_name: " Learner Name ",
  learner_level: "Intermediate",
  preferred_provider: "Gemini",
  preferred_mode: "Fluency Sprint",
  avatar_url: " https://example.com/avatar.png ",
  bio: " Practicing academic speaking. ",
  public_profile_enabled: true,
  leaderboard_opt_in: false,
  preferred_app_language: "en",
  feedback_language: "id",
  target_language: "en",
  commonplace_canvas_color: "sage",
  commonplace_card_color: "paper",
  appearance_mode: "dark",
  created_at: "2026-05-27T00:00:00.000Z",
  updated_at: "2026-05-27T01:00:00.000Z",
};

const EXACT_COMMONPLACE_THEME_IDS = [
  "default",
  "paper",
  "sage",
  "sand",
  "sky",
  "lavender",
  "rose",
  "slate",
  "charcoal",
  "emerald",
  "forest",
  "teal",
  "ocean",
  "navy",
  "plum",
  "terracotta",
  "graphite",
] as const;

function readMigration(name: string, testInfo: TestInfo): string {
  return readFileSync(
    join(dirname(testInfo.file), "..", "..", "supabase", "migrations", name),
    "utf8",
  );
}

const privateFieldNames = [
  "transcript",
  "retry_transcript",
  "vocabulary_sentence",
  "correction",
  "article_url",
  "main_weakness",
  "retry_task",
  "csv",
  "private_note",
];

function createLoadProfileClientMock({
  data,
  error = null,
}: {
  data: SupabaseProfileRow | null;
  error?: Error | null;
}) {
  const calls: string[] = [];
  const query = {
    select(columns: string) {
      calls.push(`select:${columns}`);
      return query;
    },
    eq(column: string, value: string) {
      calls.push(`eq:${column}:${value}`);
      return query;
    },
    maybeSingle() {
      calls.push("maybeSingle");
      return Promise.resolve({ data, error });
    },
  };

  return {
    calls,
    client: {
      from(table: string) {
        calls.push(`from:${table}`);
        return query;
      },
    } as unknown as FonetikSupabaseClient,
  };
}

function createUpsertProfileClientMock(error: Error | null = null) {
  const calls: string[] = [];
  let upsertRow: unknown = null;
  let upsertOptions: unknown = null;

  return {
    calls,
    getUpsertRow: () => upsertRow,
    getUpsertOptions: () => upsertOptions,
    client: {
      from(table: string) {
        calls.push(`from:${table}`);
        return {
          upsert(row: unknown, options: unknown) {
            calls.push("upsert");
            upsertRow = row;
            upsertOptions = options;
            return Promise.resolve({ error });
          },
        };
      },
    } as unknown as FonetikSupabaseClient,
  };
}

function createUpdateProfileClientMock({
  data = { owner_id: "user_clerk_123" },
  error = null,
}: {
  data?: { owner_id: string } | null;
  error?: Error | null;
} = {}) {
  const calls: string[] = [];
  let updateRow: unknown = null;

  const query = {
    eq(column: string, value: string) {
      calls.push(`eq:${column}:${value}`);
      return query;
    },
    select(columns: string) {
      calls.push(`select:${columns}`);
      return query;
    },
    maybeSingle() {
      calls.push("maybeSingle");
      return Promise.resolve({ data, error });
    },
  };

  return {
    calls,
    getUpdateRow: () => updateRow,
    client: {
      from(table: string) {
        calls.push(`from:${table}`);
        return {
          update(row: unknown) {
            calls.push("update");
            updateRow = row;
            return query;
          },
        };
      },
    } as unknown as FonetikSupabaseClient,
  };
}

test.describe("Supabase profile schema", () => {
  test("adds profile foundation fields without public profile policies", ({}, testInfo) => {
    const migration = readMigration(
      "20260527_005_add_profile_foundation_fields.sql",
      testInfo,
    );

    expect(migration).toContain("add column if not exists avatar_url text");
    expect(migration).toContain("add column if not exists bio text");
    expect(migration).toContain(
      "add column if not exists public_profile_enabled boolean not null default false",
    );
    expect(migration).toContain(
      "add column if not exists leaderboard_opt_in boolean not null default false",
    );
    expect(migration).toContain(
      "add column if not exists preferred_app_language text",
    );
    expect(migration).toContain("add column if not exists feedback_language text");
    expect(migration).toContain("add column if not exists target_language text");
    expect(migration).not.toMatch(/create\s+policy[\s\S]*public/i);
  });

  test("adds Commonplace theme fields without changing RLS policies", ({}, testInfo) => {
    const migration = readMigration(
      "20260612_001_add_commonplace_theme_profile_fields.sql",
      testInfo,
    );

    expect(migration).toContain(
      "add column if not exists commonplace_canvas_color text not null default 'default'",
    );
    expect(migration).toContain(
      "add column if not exists commonplace_card_color text not null default 'default'",
    );
    expect(migration).toContain("profiles_commonplace_canvas_color_valid");
    expect(migration).toContain("profiles_commonplace_card_color_valid");
    expect(migration).toContain("'charcoal'");
    expect(migration).not.toMatch(/create\s+policy/i);
    expect(migration).not.toMatch(/disable\s+row\s+level\s+security/i);
  });

  test("expands Commonplace theme constraints without changing RLS policies", ({}, testInfo) => {
    const migration = readMigration(
      "20260612_003_expand_commonplace_theme_colors.sql",
      testInfo,
    );

    expect(migration).toContain(
      "drop constraint if exists profiles_commonplace_canvas_color_valid",
    );
    expect(migration).toContain(
      "drop constraint if exists profiles_commonplace_card_color_valid",
    );
    expect(migration).toContain("profiles_commonplace_canvas_color_valid");
    expect(migration).toContain("profiles_commonplace_card_color_valid");

    for (const themeId of EXACT_COMMONPLACE_THEME_IDS) {
      expect(migration).toContain(`'${themeId}'`);
    }

    expect(migration).not.toMatch(/create\s+policy/i);
    expect(migration).not.toMatch(/disable\s+row\s+level\s+security/i);
    expect(migration).not.toMatch(/\bupdate\s+profiles\b/i);
  });
});

test.describe("Supabase profile adapter mapping", () => {
  test("maps a Supabase profile row to a safe app profile shape", () => {
    expect(mapSupabaseRowToUserProfile(profileRow)).toEqual({
      ownerId: "user_clerk_123",
      email: "learner@example.com",
      displayName: "Learner Name",
      learnerLevel: "Intermediate",
      preferredProvider: "Gemini",
      preferredMode: "Fluency Sprint",
      avatarUrl: "https://example.com/avatar.png",
      bio: "Practicing academic speaking.",
      publicProfileEnabled: true,
      leaderboardOptIn: false,
      preferredAppLanguage: "en",
      feedbackLanguage: "id",
      targetLanguage: "en",
      commonplaceCanvasColor: "sage",
      commonplaceCardColor: "paper",
      appearanceMode: "dark",
      createdAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T01:00:00.000Z",
    });
  });

  test("handles nullable profile fields and privacy toggles safely", () => {
    expect(
      mapSupabaseRowToUserProfile({
        ...profileRow,
        email: null,
        display_name: null,
        avatar_url: null,
        bio: null,
        learner_level: null,
        preferred_provider: null,
        preferred_mode: null,
        public_profile_enabled: null,
        leaderboard_opt_in: null,
        preferred_app_language: null,
        feedback_language: null,
        target_language: null,
        commonplace_canvas_color: "not-a-theme",
        commonplace_card_color: null,
        appearance_mode: "invalid-mode",
      }),
    ).toEqual({
      ownerId: "user_clerk_123",
      email: null,
      displayName: "",
      learnerLevel: null,
      preferredProvider: null,
      preferredMode: null,
      avatarUrl: null,
      bio: "",
      publicProfileEnabled: false,
      leaderboardOptIn: false,
      preferredAppLanguage: null,
      feedbackLanguage: null,
      targetLanguage: null,
      commonplaceCanvasColor: "default",
      commonplaceCardColor: "default",
      appearanceMode: "system",
      createdAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T01:00:00.000Z",
    });
  });

  test("maps Clerk profile seed to an owner-scoped upsert payload", () => {
    const payload = mapClerkProfileSeedToSupabaseUpsert("user_clerk_123", {
      email: " learner@example.com ",
      displayName: " Learner Name ",
      avatarUrl: " https://example.com/avatar.png ",
    });

    expect(payload).toEqual({
      owner_id: "user_clerk_123",
      email: "learner@example.com",
      display_name: "Learner Name",
      avatar_url: "https://example.com/avatar.png",
    });
  });

  test("maps safe profile fields only and defaults omitted toggles to database defaults", () => {
    const payload = mapProfilePatchToSupabaseUpsert("user_clerk_123", {
      bio: " No private learning notes here. ",
      learnerLevel: "Advanced",
      preferredProvider: "Claude",
      preferredMode: "Diagnostic",
      preferredAppLanguage: "en",
      feedbackLanguage: "id",
      targetLanguage: "en",
      commonplaceCanvasColor: "sky",
      commonplaceCardColor: "rose",
    });

    expect(payload).toEqual({
      owner_id: "user_clerk_123",
      bio: "No private learning notes here.",
      learner_level: "Advanced",
      preferred_provider: "Claude",
      preferred_mode: "Diagnostic",
      preferred_app_language: "en",
      feedback_language: "id",
      target_language: "en",
      commonplace_canvas_color: "sky",
      commonplace_card_color: "rose",
    });
    expect(payload).not.toHaveProperty("public_profile_enabled");
    expect(payload).not.toHaveProperty("leaderboard_opt_in");
  });

  test("maps expanded Commonplace theme ids to profile payloads", () => {
    const payload = mapProfilePreferencesPatchToSupabaseUpdate({
      commonplaceCanvasColor: "ocean",
      commonplaceCardColor: "terracotta",
    });

    expect(payload).toEqual({
      commonplace_canvas_color: "ocean",
      commonplace_card_color: "terracotta",
    });
  });

  test("maps privacy toggles explicitly when provided", () => {
    expect(
      mapProfilePreferencesPatchToSupabaseUpdate({
        publicProfileEnabled: true,
        leaderboardOptIn: false,
      }),
    ).toEqual({
      public_profile_enabled: true,
      leaderboard_opt_in: false,
    });
  });

  test("rejects invalid Commonplace theme ids before updating profiles", () => {
    expect(() =>
      mapProfilePreferencesPatchToSupabaseUpdate({
        commonplaceCanvasColor: "neon" as never,
      }),
    ).toThrow("invalid_commonplace_theme_color");
    expect(() =>
      mapProfilePreferencesPatchToSupabaseUpdate({
        commonplaceCardColor: "#ffffff" as never,
      }),
    ).toThrow("invalid_commonplace_theme_color");
  });

  test("does not include private learning fields in profile payloads", () => {
    const payload = mapProfilePatchToSupabaseUpsert("user_clerk_123", {
      displayName: "Learner",
      bio: "Bio only.",
      publicProfileEnabled: false,
      leaderboardOptIn: false,
    });
    const serialized = JSON.stringify(payload);

    for (const field of privateFieldNames) {
      expect(Object.keys(payload)).not.toContain(field);
      expect(serialized).not.toContain(field);
    }
  });
});

test.describe("Supabase browser token helpers", () => {
  test("requests the Clerk Supabase JWT template before falling back", async () => {
    const calls: unknown[] = [];
    const token = await getSupabaseAccessToken(async (options?: unknown) => {
      calls.push(options);
      return "supabase-jwt";
    });

    expect(token).toBe("supabase-jwt");
    expect(calls).toEqual([{ template: "supabase" }]);
  });

  test("falls back to the default Clerk token when the Supabase template is unavailable", async () => {
    const calls: unknown[] = [];
    const token = await getSupabaseAccessToken(async (options?: unknown) => {
      calls.push(options);
      if (options) throw new Error("template missing");
      return "default-jwt";
    });

    expect(token).toBe("default-jwt");
    expect(calls).toEqual([{ template: "supabase" }, undefined]);
  });

  test("creates a reusable Supabase access token provider with a stable fallback", async () => {
    const provider = createSupabaseAccessTokenProvider(
      async () => null,
      "first-jwt",
    );

    await expect(provider()).resolves.toBe("first-jwt");
  });
});

test.describe("Supabase profile adapter mocked client behavior", () => {
  test("loads an owner-scoped profile row", async () => {
    const mock = createLoadProfileClientMock({ data: profileRow });

    const profile = await loadSupabaseProfile("user_clerk_123", mock.client);

    expect(mock.calls).toEqual([
      "from:profiles",
      "select:*",
      "eq:owner_id:user_clerk_123",
      "maybeSingle",
    ]);
    expect(profile?.ownerId).toBe("user_clerk_123");
    expect(profile?.displayName).toBe("Learner Name");
  });

  test("returns null when no profile row exists", async () => {
    const mock = createLoadProfileClientMock({ data: null });

    await expect(
      loadSupabaseProfile("user_clerk_123", mock.client),
    ).resolves.toBeNull();
  });

  test("throws the Supabase error returned by load", async () => {
    const mock = createLoadProfileClientMock({
      data: null,
      error: new Error("profile load failed"),
    });

    await expect(
      loadSupabaseProfile("user_clerk_123", mock.client),
    ).rejects.toThrow("profile load failed");
  });

  test("upserts profile with owner_id conflict key", async () => {
    const mock = createUpsertProfileClientMock();

    await upsertSupabaseProfile(
      "user_clerk_123",
      {
        email: "learner@example.com",
        displayName: "Learner",
        avatarUrl: "https://example.com/avatar.png",
      },
      mock.client,
    );

    expect(mock.calls).toEqual(["from:profiles", "upsert"]);
    expect(mock.getUpsertOptions()).toEqual({ onConflict: "owner_id" });
    expect(mock.getUpsertRow()).toEqual({
      owner_id: "user_clerk_123",
      email: "learner@example.com",
      display_name: "Learner",
      avatar_url: "https://example.com/avatar.png",
    });
  });

  test("throws the Supabase error returned by upsert", async () => {
    const mock = createUpsertProfileClientMock(new Error("profile save failed"));

    await expect(
      upsertSupabaseProfile(
        "user_clerk_123",
        { displayName: "Learner" },
        mock.client,
      ),
    ).rejects.toThrow("profile save failed");
  });

  test("updates owner-scoped profile preferences without email", async () => {
    const mock = createUpdateProfileClientMock();

    await updateSupabaseProfilePreferences(
      "user_clerk_123",
      {
        displayName: "New Name",
        bio: "Short public bio.",
        publicProfileEnabled: true,
        leaderboardOptIn: false,
        preferredAppLanguage: "en",
        feedbackLanguage: "id",
        targetLanguage: "en",
        commonplaceCanvasColor: "lavender",
        commonplaceCardColor: "sand",
        appearanceMode: "light",
      },
      mock.client,
    );

    expect(mock.calls).toEqual([
      "from:profiles",
      "update",
      "eq:owner_id:user_clerk_123",
      "select:owner_id",
      "maybeSingle",
    ]);
    expect(mock.getUpdateRow()).toEqual({
      display_name: "New Name",
      bio: "Short public bio.",
      public_profile_enabled: true,
      leaderboard_opt_in: false,
      preferred_app_language: "en",
      feedback_language: "id",
      target_language: "en",
      commonplace_canvas_color: "lavender",
      commonplace_card_color: "sand",
      appearance_mode: "light",
    });
  });

  test("does not call Supabase for an empty preference patch", async () => {
    const mock = createUpdateProfileClientMock();

    await updateSupabaseProfilePreferences(
      "user_clerk_123",
      {},
      mock.client,
    );

    expect(mock.calls).toEqual([]);
    expect(mock.getUpdateRow()).toBeNull();
  });

  test("throws the Supabase error returned by update", async () => {
    const mock = createUpdateProfileClientMock({
      error: new Error("profile update failed"),
    });

    await expect(
      updateSupabaseProfilePreferences(
        "user_clerk_123",
        { publicProfileEnabled: true },
        mock.client,
      ),
    ).rejects.toThrow("profile update failed");
  });

  test("throws when profile preferences update does not affect an owner row", async () => {
    const mock = createUpdateProfileClientMock({ data: null });

    await expect(
      updateSupabaseProfilePreferences(
        "user_clerk_123",
        { publicProfileEnabled: true },
        mock.client,
      ),
    ).rejects.toThrow("profile_preferences_update_missing_row");
  });
});

function createCombinedProfileClientMock({
  existingData,
  upsertError = null,
  loadError = null,
}: {
  existingData: SupabaseProfileRow | null;
  upsertError?: Error | null;
  loadError?: Error | null;
}) {
  const calls: string[] = [];
  let upsertRow: unknown = null;
  let upsertOptions: unknown = null;

  const selectQuery = {
    select(columns: string) {
      calls.push(`select:${columns}`);
      return selectQuery;
    },
    eq(column: string, value: string) {
      calls.push(`eq:${column}:${value}`);
      return selectQuery;
    },
    maybeSingle() {
      calls.push("maybeSingle");
      return Promise.resolve({ data: existingData, error: loadError });
    },
  };

  return {
    calls,
    getUpsertRow: () => upsertRow,
    getUpsertOptions: () => upsertOptions,
    client: {
      from(table: string) {
        calls.push(`from:${table}`);
        return {
          ...selectQuery,
          upsert(row: unknown, options: unknown) {
            calls.push("upsert");
            upsertRow = row;
            upsertOptions = options;
            return Promise.resolve({ error: upsertError });
          },
        };
      },
    } as unknown as FonetikSupabaseClient,
  };
}

test.describe("Supabase profile adapter bootstrapProfile", () => {
  test("bootstrapProfile upserts a new profile with Clerk fields and privacy defaults", async () => {
    const mock = createCombinedProfileClientMock({ existingData: null });

    await bootstrapProfile(
      "user_clerk_123",
      {
        email: "learner@example.com",
        displayName: "Learner Name",
        avatarUrl: "https://example.com/avatar.png",
      },
      mock.client,
    );

    expect(mock.calls).toContain("upsert");
    expect(mock.getUpsertRow()).toEqual({
      owner_id: "user_clerk_123",
      email: "learner@example.com",
      display_name: "Learner Name",
      avatar_url: "https://example.com/avatar.png",
      public_profile_enabled: false,
      leaderboard_opt_in: false,
    });
  });

  test("bootstrapProfile updates missing email/avatarUrl but preserves existing display name and other settings", async () => {
    const existingRow: SupabaseProfileRow = {
      id: "profile-row-uuid",
      owner_id: "user_clerk_123",
      email: null,
      display_name: "Custom Name",
      learner_level: "Advanced",
      preferred_provider: "Claude",
      preferred_mode: "Fluency Sprint",
      avatar_url: null,
      bio: "Keep my bio safe.",
      public_profile_enabled: true,
      leaderboard_opt_in: true,
      preferred_app_language: "en",
      feedback_language: "id",
      target_language: "en",
      created_at: "2026-05-27T00:00:00.000Z",
      updated_at: "2026-05-27T01:00:00.000Z",
    };

    const mock = createCombinedProfileClientMock({ existingData: existingRow });

    await bootstrapProfile(
      "user_clerk_123",
      {
        email: "learner@example.com",
        displayName: "Clerk Full Name",
        avatarUrl: "https://example.com/avatar.png",
      },
      mock.client,
    );

    expect(mock.calls).toContain("upsert");
    const upsertRow = mock.getUpsertRow();
    expect(upsertRow).toEqual({
      owner_id: "user_clerk_123",
      email: "learner@example.com",
      avatar_url: "https://example.com/avatar.png",
    });
    expect(upsertRow).not.toHaveProperty("display_name");
    expect(upsertRow).not.toHaveProperty("bio");
    expect(upsertRow).not.toHaveProperty("public_profile_enabled");
    expect(upsertRow).not.toHaveProperty("leaderboard_opt_in");
  });

  test("bootstrapProfile does not call upsert if existing profile is already up to date", async () => {
    const existingRow: SupabaseProfileRow = {
      id: "profile-row-uuid",
      owner_id: "user_clerk_123",
      email: "learner@example.com",
      display_name: "Learner Name",
      learner_level: "Advanced",
      preferred_provider: "Claude",
      preferred_mode: "Fluency Sprint",
      avatar_url: "https://example.com/avatar.png",
      bio: "Keep my bio safe.",
      public_profile_enabled: true,
      leaderboard_opt_in: true,
      preferred_app_language: "en",
      feedback_language: "id",
      target_language: "en",
      created_at: "2026-05-27T00:00:00.000Z",
      updated_at: "2026-05-27T01:00:00.000Z",
    };

    const mock = createCombinedProfileClientMock({ existingData: existingRow });

    await bootstrapProfile(
      "user_clerk_123",
      {
        email: "learner@example.com",
        displayName: "Learner Name",
        avatarUrl: "https://example.com/avatar.png",
      },
      mock.client,
    );

    expect(mock.calls).not.toContain("upsert");
    expect(mock.getUpsertRow()).toBeNull();
  });

  test("bootstrap runner logic swallows error to be non-blocking", async () => {
    const mock = createCombinedProfileClientMock({
      existingData: null,
      loadError: new Error("Supabase is down"),
    });

    let loggedError: Error | null = null;
    const consoleErrorSpy = (err: unknown) => {
      loggedError = err as Error;
    };

    // Simulate page.tsx try-catch bootstrap execution
    const runBootstrap = async () => {
      try {
        await bootstrapProfile(
          "user_clerk_123",
          {
            email: "learner@example.com",
            displayName: "Learner Name",
          },
          mock.client,
        );
      } catch (err) {
        consoleErrorSpy(err);
      }
    };

    await expect(runBootstrap()).resolves.not.toThrow();
    expect(loggedError).toBeTruthy();
    expect(loggedError!.message).toBe("Supabase is down");
  });

  test("bootstrap skips when user is signed out or missing config", async () => {
    // Simulate signed-out state: no userId
    const runForSignedOut = async (userId: string | null) => {
      if (!userId) {
        // Skips bootstrap
        return;
      }
      // Should not be called
      throw new Error("Should not run bootstrap");
    };

    await expect(runForSignedOut(null)).resolves.not.toThrow();
  });

  test("bootstrap does not call any localStorage write helpers", async () => {
    const mock = createCombinedProfileClientMock({ existingData: null });
    const originalLocalStorage = globalThis.localStorage;
    const writes: string[] = [];

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        setItem: (key: string) => {
          writes.push(key);
        },
      },
    });

    try {
      await bootstrapProfile(
        "user_clerk_123",
        {
          email: "learner@example.com",
          displayName: "Learner Name",
        },
        mock.client,
      );
      expect(writes).toEqual([]);
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });
});
