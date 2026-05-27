import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  loadSupabaseProfile,
  mapClerkProfileSeedToSupabaseUpsert,
  mapProfilePatchToSupabaseUpsert,
  mapProfilePreferencesPatchToSupabaseUpdate,
  mapSupabaseRowToUserProfile,
  updateSupabaseProfilePreferences,
  upsertSupabaseProfile,
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
  created_at: "2026-05-27T00:00:00.000Z",
  updated_at: "2026-05-27T01:00:00.000Z",
};

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

function createUpdateProfileClientMock(error: Error | null = null) {
  const calls: string[] = [];
  let updateRow: unknown = null;

  const query = {
    eq(column: string, value: string) {
      calls.push(`eq:${column}:${value}`);
      return Promise.resolve({ error });
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
  test("adds profile foundation fields without public profile policies", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "..",
        "supabase",
        "migrations",
        "20260527_005_add_profile_foundation_fields.sql",
      ),
      "utf8",
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
    });
    expect(payload).not.toHaveProperty("public_profile_enabled");
    expect(payload).not.toHaveProperty("leaderboard_opt_in");
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
      },
      mock.client,
    );

    expect(mock.calls).toEqual([
      "from:profiles",
      "update",
      "eq:owner_id:user_clerk_123",
    ]);
    expect(mock.getUpdateRow()).toEqual({
      display_name: "New Name",
      bio: "Short public bio.",
      public_profile_enabled: true,
      leaderboard_opt_in: false,
      preferred_app_language: "en",
      feedback_language: "id",
      target_language: "en",
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
    const mock = createUpdateProfileClientMock(
      new Error("profile update failed"),
    );

    await expect(
      updateSupabaseProfilePreferences(
        "user_clerk_123",
        { publicProfileEnabled: true },
        mock.client,
      ),
    ).rejects.toThrow("profile update failed");
  });
});
