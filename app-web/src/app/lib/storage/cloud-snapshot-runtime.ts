"use client";

import {
  createBrowserSupabaseClient,
  isSupabaseConfigured,
  type CreateBrowserSupabaseClientOptions,
  type FonetikSupabaseClient,
} from "../supabase";
import { planSyncMerge, type SyncMergeInput, type SyncMergePlan } from "./sync-merge";
import {
  loadSupabaseSessions,
} from "./supabase-session-adapter";
import { loadSupabaseVocabulary } from "./supabase-vocab-adapter";
import {
  loadSupabaseBadges,
  loadSupabaseXpEvents,
  loadSupabaseXpProfile,
} from "./supabase-gamification-adapter";
import type { SessionCloudAuthState } from "./session-cloud-runtime";
import type { StoredSessionRecord } from "./types";
import type { VocabItem } from "../vocabulary";
import type { Badge, XpEvent, XpProfile } from "../gamification";

export type CloudSnapshotLocalInput = SyncMergeInput["local"];

export type CloudSnapshot = SyncMergeInput["cloud"];

export type CloudSnapshotRuntimeResult =
  | {
      status: "skipped-auth-loading";
      reason: "auth-loading";
    }
  | {
      status: "skipped-signed-out";
      reason: "signed-out";
    }
  | {
      status: "skipped-missing-user";
      reason: "missing-user";
    }
  | {
      status: "skipped-missing-config";
      reason: "supabase-not-configured";
    }
  | {
      status: "skipped-missing-token";
      reason: "missing-token";
    }
  | {
      status: "skipped-missing-client";
      reason: "missing-client";
    }
  | {
      status: "loaded";
      cloud: CloudSnapshot;
      plan: SyncMergePlan;
    }
  | {
      status: "failed";
      reason: "cloud-read-failed";
    };

export type LoadCloudSnapshotPlanOptions = {
  auth: SessionCloudAuthState;
  local: CloudSnapshotLocalInput;
  isConfigured?: () => boolean;
  createClient?: (
    options: CreateBrowserSupabaseClientOptions,
  ) => FonetikSupabaseClient | null;
  loadSessions?: (
    ownerId: string,
    supabaseClient: FonetikSupabaseClient,
  ) => Promise<StoredSessionRecord[]>;
  loadVocabulary?: (
    ownerId: string,
    supabaseClient: FonetikSupabaseClient,
  ) => Promise<VocabItem[]>;
  loadXpProfile?: (
    ownerId: string,
    supabaseClient: FonetikSupabaseClient,
  ) => Promise<XpProfile>;
  loadXpEvents?: (
    ownerId: string,
    supabaseClient: FonetikSupabaseClient,
  ) => Promise<XpEvent[]>;
  loadBadges?: (
    ownerId: string,
    supabaseClient: FonetikSupabaseClient,
  ) => Promise<Badge[]>;
  planMerge?: (input: SyncMergeInput) => SyncMergePlan;
};

/**
 * Loads cloud data into an in-memory snapshot and computes a merge plan against
 * the provided local snapshot. This helper is intentionally non-destructive:
 * it does not write localStorage, mutate React state, save adapters, delete
 * cloud rows, import, or restore anything automatically.
 */
export async function loadCloudSnapshotPlan({
  auth,
  local,
  isConfigured = isSupabaseConfigured,
  createClient = createBrowserSupabaseClient,
  loadSessions = loadSupabaseSessions,
  loadVocabulary = loadSupabaseVocabulary,
  loadXpProfile = loadSupabaseXpProfile,
  loadXpEvents = loadSupabaseXpEvents,
  loadBadges = loadSupabaseBadges,
  planMerge = planSyncMerge,
}: LoadCloudSnapshotPlanOptions): Promise<CloudSnapshotRuntimeResult> {
  if (!auth.isLoaded) {
    return { status: "skipped-auth-loading", reason: "auth-loading" };
  }

  if (!auth.isSignedIn) {
    return { status: "skipped-signed-out", reason: "signed-out" };
  }

  if (!auth.userId) {
    return { status: "skipped-missing-user", reason: "missing-user" };
  }

  if (!auth.getToken) {
    return { status: "skipped-missing-token", reason: "missing-token" };
  }

  if (!isConfigured()) {
    return {
      status: "skipped-missing-config",
      reason: "supabase-not-configured",
    };
  }

  let firstToken: string | null = null;
  try {
    firstToken = await auth.getToken();
  } catch {
    return { status: "skipped-missing-token", reason: "missing-token" };
  }

  if (!firstToken) {
    return { status: "skipped-missing-token", reason: "missing-token" };
  }

  let supabaseClient: FonetikSupabaseClient | null = null;
  try {
    supabaseClient = createClient({
      accessToken: async () => {
        try {
          return (await auth.getToken?.()) ?? firstToken;
        } catch {
          return firstToken;
        }
      },
    });
  } catch {
    return { status: "skipped-missing-client", reason: "missing-client" };
  }

  if (!supabaseClient) {
    return { status: "skipped-missing-client", reason: "missing-client" };
  }

  try {
    const [sessions, vocabulary, xpProfile, xpEvents, badges] =
      await Promise.all([
        loadSessions(auth.userId, supabaseClient),
        loadVocabulary(auth.userId, supabaseClient),
        loadXpProfile(auth.userId, supabaseClient),
        loadXpEvents(auth.userId, supabaseClient),
        loadBadges(auth.userId, supabaseClient),
      ]);

    const cloud: CloudSnapshot = {
      sessions,
      vocabulary,
      xpProfile,
      xpEvents,
      badges,
    };

    return {
      status: "loaded",
      cloud,
      plan: planMerge({ local, cloud }),
    };
  } catch {
    return { status: "failed", reason: "cloud-read-failed" };
  }
}
