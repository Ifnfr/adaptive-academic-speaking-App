/**
 * Supabase profile adapter helpers.
 *
 * These helpers are intentionally not wired into the runtime yet. They provide
 * owner-scoped profile mapping and persistence only, using Clerk user IDs as
 * profiles.owner_id. No learning-private data belongs in this module.
 */

import type { FonetikSupabaseClient } from "../supabase";

const PROFILES_TABLE = "profiles";

export type SupabaseProfileRow = {
  id: string;
  owner_id: string;
  email: string | null;
  display_name: string | null;
  learner_level: string | null;
  preferred_provider: string | null;
  preferred_mode: string | null;
  avatar_url: string | null;
  bio: string | null;
  public_profile_enabled: boolean | null;
  leaderboard_opt_in: boolean | null;
  preferred_app_language: string | null;
  feedback_language: string | null;
  target_language: string | null;
  created_at: string;
  updated_at: string;
};

export type UserProfile = {
  ownerId: string;
  email: string | null;
  displayName: string;
  learnerLevel: string | null;
  preferredProvider: string | null;
  preferredMode: string | null;
  avatarUrl: string | null;
  bio: string;
  publicProfileEnabled: boolean;
  leaderboardOptIn: boolean;
  preferredAppLanguage: string | null;
  feedbackLanguage: string | null;
  targetLanguage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClerkProfileSeed = {
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
};

export type UserProfilePatch = ClerkProfileSeed & {
  learnerLevel?: string | null;
  preferredProvider?: string | null;
  preferredMode?: string | null;
  bio?: string | null;
  publicProfileEnabled?: boolean;
  leaderboardOptIn?: boolean;
  preferredAppLanguage?: string | null;
  feedbackLanguage?: string | null;
  targetLanguage?: string | null;
};

export type UserProfilePreferencesPatch = Omit<UserProfilePatch, "email">;

export type SupabaseProfileUpsert = {
  owner_id: string;
  email?: string | null;
  display_name?: string | null;
  learner_level?: string | null;
  preferred_provider?: string | null;
  preferred_mode?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  public_profile_enabled?: boolean;
  leaderboard_opt_in?: boolean;
  preferred_app_language?: string | null;
  feedback_language?: string | null;
  target_language?: string | null;
};

export type SupabaseProfileUpdate = Omit<SupabaseProfileUpsert, "owner_id">;

function normalizeNullableString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assignNullableString(
  target: Record<string, unknown>,
  key: string,
  value: string | null | undefined,
): void {
  if (value === undefined) return;
  target[key] = normalizeNullableString(value);
}

function assignBoolean(
  target: Record<string, unknown>,
  key: string,
  value: boolean | undefined,
): void {
  if (typeof value === "boolean") {
    target[key] = value;
  }
}

export function mapSupabaseRowToUserProfile(
  row: SupabaseProfileRow,
): UserProfile {
  return {
    ownerId: row.owner_id,
    email: normalizeNullableString(row.email),
    displayName: normalizeNullableString(row.display_name) ?? "",
    learnerLevel: normalizeNullableString(row.learner_level),
    preferredProvider: normalizeNullableString(row.preferred_provider),
    preferredMode: normalizeNullableString(row.preferred_mode),
    avatarUrl: normalizeNullableString(row.avatar_url),
    bio: normalizeNullableString(row.bio) ?? "",
    publicProfileEnabled: row.public_profile_enabled === true,
    leaderboardOptIn: row.leaderboard_opt_in === true,
    preferredAppLanguage: normalizeNullableString(row.preferred_app_language),
    feedbackLanguage: normalizeNullableString(row.feedback_language),
    targetLanguage: normalizeNullableString(row.target_language),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProfilePatchToSupabaseUpsert(
  ownerId: string,
  patch: UserProfilePatch,
): SupabaseProfileUpsert {
  const row: Record<string, unknown> = { owner_id: ownerId };

  assignNullableString(row, "email", patch.email);
  assignNullableString(row, "display_name", patch.displayName);
  assignNullableString(row, "avatar_url", patch.avatarUrl);
  assignNullableString(row, "bio", patch.bio);
  assignNullableString(row, "learner_level", patch.learnerLevel);
  assignNullableString(row, "preferred_provider", patch.preferredProvider);
  assignNullableString(row, "preferred_mode", patch.preferredMode);
  assignNullableString(
    row,
    "preferred_app_language",
    patch.preferredAppLanguage,
  );
  assignNullableString(row, "feedback_language", patch.feedbackLanguage);
  assignNullableString(row, "target_language", patch.targetLanguage);
  assignBoolean(row, "public_profile_enabled", patch.publicProfileEnabled);
  assignBoolean(row, "leaderboard_opt_in", patch.leaderboardOptIn);

  return row as SupabaseProfileUpsert;
}

export function mapClerkProfileSeedToSupabaseUpsert(
  ownerId: string,
  seed: ClerkProfileSeed,
): SupabaseProfileUpsert {
  return mapProfilePatchToSupabaseUpsert(ownerId, seed);
}

export function mapProfilePreferencesPatchToSupabaseUpdate(
  patch: UserProfilePreferencesPatch,
): SupabaseProfileUpdate {
  const { owner_id: ownerId, ...row } = mapProfilePatchToSupabaseUpsert(
    "__owner_placeholder__",
    patch,
  );
  void ownerId;
  return row;
}

export async function loadSupabaseProfile(
  ownerId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<UserProfile | null> {
  const { data, error } = await supabaseClient
    .from(PROFILES_TABLE)
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? mapSupabaseRowToUserProfile(data as SupabaseProfileRow)
    : null;
}

export async function upsertSupabaseProfile(
  ownerId: string,
  profilePatch: UserProfilePatch,
  supabaseClient: FonetikSupabaseClient,
): Promise<void> {
  const payload = mapProfilePatchToSupabaseUpsert(ownerId, profilePatch);
  const { error } = await supabaseClient
    .from(PROFILES_TABLE)
    .upsert(payload, { onConflict: "owner_id" });

  if (error) {
    throw error;
  }
}

export async function updateSupabaseProfilePreferences(
  ownerId: string,
  patch: UserProfilePreferencesPatch,
  supabaseClient: FonetikSupabaseClient,
): Promise<void> {
  const payload = mapProfilePreferencesPatchToSupabaseUpdate(patch);
  if (Object.keys(payload).length === 0) return;

  const { error } = await supabaseClient
    .from(PROFILES_TABLE)
    .update(payload)
    .eq("owner_id", ownerId);

  if (error) {
    throw error;
  }
}

export async function bootstrapProfile(
  ownerId: string,
  clerkSeed: ClerkProfileSeed,
  supabaseClient: FonetikSupabaseClient,
): Promise<void> {
  const existing = await loadSupabaseProfile(ownerId, supabaseClient);
  const clerkEmail = clerkSeed.email ?? null;
  const clerkAvatar = clerkSeed.avatarUrl ?? null;
  const clerkDisplayName = clerkSeed.displayName ?? "Signed in user";

  if (!existing) {
    const newProfile: UserProfilePatch = {
      email: clerkEmail,
      displayName: clerkDisplayName,
      avatarUrl: clerkAvatar,
      publicProfileEnabled: false,
      leaderboardOptIn: false,
    };
    await upsertSupabaseProfile(ownerId, newProfile, supabaseClient);
  } else {
    const patch: UserProfilePatch = {};
    if (existing.email !== clerkEmail) {
      patch.email = clerkEmail;
    }
    if (existing.avatarUrl !== clerkAvatar) {
      patch.avatarUrl = clerkAvatar;
    }
    if (!existing.displayName) {
      patch.displayName = clerkDisplayName;
    }

    if (Object.keys(patch).length > 0) {
      await upsertSupabaseProfile(ownerId, patch, supabaseClient);
    }
  }
}
