"use client";

import {
  createBrowserSupabaseClient,
  isSupabaseConfigured,
  type CreateBrowserSupabaseClientOptions,
  type FonetikSupabaseClient,
} from "../supabase";
import {
  upsertXpProfileRow,
  upsertXpEventRows,
  upsertBadgeRows,
} from "./supabase-gamification-adapter";
import type { XpProfile, XpEvent, Badge } from "../gamification";
import type { SessionCloudAuthState, SessionCloudWriteResult } from "./session-cloud-runtime";

export type WriteXpProfileToCloudOptions = {
  auth: SessionCloudAuthState;
  profile: XpProfile;
  isConfigured?: () => boolean;
  createClient?: (
    options: CreateBrowserSupabaseClientOptions,
  ) => FonetikSupabaseClient | null;
  upsertProfile?: (
    ownerId: string,
    profile: XpProfile,
    supabaseClient: FonetikSupabaseClient,
  ) => Promise<void>;
};

export type WriteXpEventsToCloudOptions = {
  auth: SessionCloudAuthState;
  previous: ReadonlyArray<XpEvent>;
  next: ReadonlyArray<XpEvent>;
  isConfigured?: () => boolean;
  createClient?: (
    options: CreateBrowserSupabaseClientOptions,
  ) => FonetikSupabaseClient | null;
  upsertEvents?: (
    ownerId: string,
    events: ReadonlyArray<XpEvent>,
    supabaseClient: FonetikSupabaseClient,
  ) => Promise<void>;
};

export type WriteBadgesToCloudOptions = {
  auth: SessionCloudAuthState;
  badges: ReadonlyArray<Badge>;
  isConfigured?: () => boolean;
  createClient?: (
    options: CreateBrowserSupabaseClientOptions,
  ) => FonetikSupabaseClient | null;
  upsertBadges?: (
    ownerId: string,
    badges: ReadonlyArray<Badge>,
    supabaseClient: FonetikSupabaseClient,
  ) => Promise<void>;
};

async function getSupabaseClient(
  auth: SessionCloudAuthState,
  isConfigured: () => boolean,
  createClient: (options: CreateBrowserSupabaseClientOptions) => FonetikSupabaseClient | null,
): Promise<FonetikSupabaseClient | null> {
  if (!auth.isLoaded || !auth.isSignedIn || !auth.userId || !auth.getToken) {
    return null;
  }
  if (!isConfigured()) {
    return null;
  }
  try {
    const token = await auth.getToken();
    if (!token) return null;

    return createClient({
      accessToken: async () => {
        try {
          return (await auth.getToken?.()) ?? token;
        } catch {
          return token;
        }
      },
    });
  } catch {
    return null;
  }
}

export async function writeXpProfileToCloud({
  auth,
  profile,
  isConfigured = isSupabaseConfigured,
  createClient = createBrowserSupabaseClient,
  upsertProfile = upsertXpProfileRow,
}: WriteXpProfileToCloudOptions): Promise<SessionCloudWriteResult> {
  if (!auth.isLoaded) return { status: "skipped", reason: "auth-loading" };
  if (!auth.isSignedIn) return { status: "skipped", reason: "signed-out" };
  if (!auth.userId) return { status: "skipped", reason: "missing-user" };
  if (!auth.getToken) return { status: "skipped", reason: "missing-token" };
  if (!isConfigured()) return { status: "skipped", reason: "supabase-not-configured" };

  const client = await getSupabaseClient(auth, isConfigured, createClient);
  if (!client) return { status: "skipped", reason: "missing-client" };

  try {
    await upsertProfile(auth.userId, profile, client);
    return { status: "saved" };
  } catch {
    return { status: "failed", reason: "write-failed" };
  }
}

export async function writeXpEventsToCloud({
  auth,
  previous,
  next,
  isConfigured = isSupabaseConfigured,
  createClient = createBrowserSupabaseClient,
  upsertEvents = upsertXpEventRows,
}: WriteXpEventsToCloudOptions): Promise<SessionCloudWriteResult> {
  if (!auth.isLoaded) return { status: "skipped", reason: "auth-loading" };
  if (!auth.isSignedIn) return { status: "skipped", reason: "signed-out" };
  if (!auth.userId) return { status: "skipped", reason: "missing-user" };
  if (!auth.getToken) return { status: "skipped", reason: "missing-token" };
  if (!isConfigured()) return { status: "skipped", reason: "supabase-not-configured" };

  const client = await getSupabaseClient(auth, isConfigured, createClient);
  if (!client) return { status: "skipped", reason: "missing-client" };

  const previousIds = new Set(previous.map((e) => e.id));
  const newEvents = next.filter((e) => !previousIds.has(e.id));

  if (newEvents.length === 0) {
    return { status: "saved" };
  }

  try {
    await upsertEvents(auth.userId, newEvents, client);
    return { status: "saved" };
  } catch {
    return { status: "failed", reason: "write-failed" };
  }
}

export async function writeBadgesToCloud({
  auth,
  badges,
  isConfigured = isSupabaseConfigured,
  createClient = createBrowserSupabaseClient,
  upsertBadges = upsertBadgeRows,
}: WriteBadgesToCloudOptions): Promise<SessionCloudWriteResult> {
  if (!auth.isLoaded) return { status: "skipped", reason: "auth-loading" };
  if (!auth.isSignedIn) return { status: "skipped", reason: "signed-out" };
  if (!auth.userId) return { status: "skipped", reason: "missing-user" };
  if (!auth.getToken) return { status: "skipped", reason: "missing-token" };
  if (!isConfigured()) return { status: "skipped", reason: "supabase-not-configured" };

  const client = await getSupabaseClient(auth, isConfigured, createClient);
  if (!client) return { status: "skipped", reason: "missing-client" };

  try {
    await upsertBadges(auth.userId, badges, client);
    return { status: "saved" };
  } catch {
    return { status: "failed", reason: "write-failed" };
  }
}
