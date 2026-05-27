import { expect, test } from "@playwright/test";
import {
  loadCloudSnapshotPlan,
  type CloudSnapshotLocalInput,
} from "../src/app/lib/storage/cloud-snapshot-runtime";
import type { SessionCloudAuthState } from "../src/app/lib/storage/session-cloud-runtime";
import type { StoredSessionRecord } from "../src/app/lib/storage";
import type { FonetikSupabaseClient } from "../src/app/lib/supabase";
import type { Badge, XpEvent, XpProfile } from "../src/app/lib/gamification";
import type { VocabItem } from "../src/app/lib/vocabulary";

const emptyLocal: CloudSnapshotLocalInput = {
  sessions: [],
  vocabulary: [],
  xpProfile: null,
  xpEvents: [],
  badges: [],
};

const signedInAuth: SessionCloudAuthState = {
  isLoaded: true,
  isSignedIn: true,
  userId: "user_clerk_123",
  getToken: async () => "clerk-token",
};

const session: StoredSessionRecord = {
  id: "session-1",
  date: "2026-05-27",
  level: "Intermediate",
  mode: "Fluency Sprint",
  feedbackType: "Quick",
  sessionType: "Standard",
  provider: "Claude",
  todayTarget: "Speak clearly.",
  durationSeconds: 90,
  transcript: "A short transcript.",
  mainWeakness: "Needs structure.",
  evidence: "The answer drifted.",
  betterPhrase: "My main point is that the policy is useful.",
  retryTask: "Try one structured answer.",
  retryTranscript: "My main point is that the policy is useful.",
  csv: "Date,Level\n2026-05-27,Intermediate",
};

const vocabItem: VocabItem = {
  version: 1,
  id: "vocab-1",
  word: "coherent",
  meaning: "Clear and logical.",
  partOfSpeech: "adj",
  source: "manual",
  level: "Intermediate",
  status: "new",
  example: "",
  collocations: [],
  userSentences: [],
  reuseCount: 0,
  correctUseCount: 0,
  lastPracticedAt: null,
  createdAt: "2026-05-27T00:00:00Z",
  updatedAt: "2026-05-27T00:00:00Z",
};

const xpProfile: XpProfile = {
  version: 1,
  totalXp: 40,
  pendingDailyXp: 40,
  unclaimedPreviousXp: 0,
  activeDate: "2026-05-27",
  lastClaimedDate: null,
  createdAt: "2026-05-27T00:00:00Z",
  updatedAt: "2026-05-27T00:10:00Z",
};

const xpEvent: XpEvent = {
  version: 1,
  id: "xp-1",
  type: "normal_session_completed",
  xp: 40,
  localDate: "2026-05-27",
  createdAt: "2026-05-27T00:10:00Z",
  sourceId: "session-1",
  sourceKind: "session",
  reason: "Completed a normal speaking session.",
};

const badge: Badge = {
  version: 1,
  id: "first_session",
  label: "First Session",
  description: "Completed your first normal speaking session.",
  status: "earned",
  earnedAt: "2026-05-27T00:10:00Z",
};

function createDeps() {
  const calls: string[] = [];
  const client = { mock: "client" } as unknown as FonetikSupabaseClient;

  return {
    calls,
    client,
    isConfigured: () => {
      calls.push("isConfigured");
      return true;
    },
    createClient: () => {
      calls.push("createClient");
      return client;
    },
    loadSessions: async (ownerId: string, supabaseClient: FonetikSupabaseClient) => {
      calls.push(`loadSessions:${ownerId}:${supabaseClient === client}`);
      return [session];
    },
    loadVocabulary: async (ownerId: string, supabaseClient: FonetikSupabaseClient) => {
      calls.push(`loadVocabulary:${ownerId}:${supabaseClient === client}`);
      return [vocabItem];
    },
    loadXpProfile: async (ownerId: string, supabaseClient: FonetikSupabaseClient) => {
      calls.push(`loadXpProfile:${ownerId}:${supabaseClient === client}`);
      return xpProfile;
    },
    loadXpEvents: async (ownerId: string, supabaseClient: FonetikSupabaseClient) => {
      calls.push(`loadXpEvents:${ownerId}:${supabaseClient === client}`);
      return [xpEvent];
    },
    loadBadges: async (ownerId: string, supabaseClient: FonetikSupabaseClient) => {
      calls.push(`loadBadges:${ownerId}:${supabaseClient === client}`);
      return [badge];
    },
  };
}

test.describe("cloud snapshot runtime skip states", () => {
  test("skips while auth is loading", async () => {
    const deps = createDeps();

    const result = await loadCloudSnapshotPlan({
      auth: { isLoaded: false, isSignedIn: false, userId: null, getToken: null },
      local: emptyLocal,
      ...deps,
    });

    expect(result).toEqual({
      status: "skipped-auth-loading",
      reason: "auth-loading",
    });
    expect(deps.calls).toEqual([]);
  });

  test("skips signed-out users", async () => {
    const deps = createDeps();

    const result = await loadCloudSnapshotPlan({
      auth: { isLoaded: true, isSignedIn: false, userId: null, getToken: null },
      local: emptyLocal,
      ...deps,
    });

    expect(result).toEqual({
      status: "skipped-signed-out",
      reason: "signed-out",
    });
    expect(deps.calls).toEqual([]);
  });

  test("skips when Supabase config is missing", async () => {
    const deps = createDeps();

    const result = await loadCloudSnapshotPlan({
      auth: signedInAuth,
      local: emptyLocal,
      ...deps,
      isConfigured: () => {
        deps.calls.push("isConfigured");
        return false;
      },
    });

    expect(result).toEqual({
      status: "skipped-missing-config",
      reason: "supabase-not-configured",
    });
    expect(deps.calls).toEqual(["isConfigured"]);
  });

  test("skips when Clerk token is missing", async () => {
    const deps = createDeps();

    const result = await loadCloudSnapshotPlan({
      auth: { ...signedInAuth, getToken: async () => null },
      local: emptyLocal,
      ...deps,
    });

    expect(result).toEqual({
      status: "skipped-missing-token",
      reason: "missing-token",
    });
    expect(deps.calls).toEqual(["isConfigured"]);
  });
});

test.describe("cloud snapshot runtime load behavior", () => {
  test("loads cloud snapshot with all read helpers and returns merge plan", async () => {
    const deps = createDeps();
    let planCalled = false;

    const result = await loadCloudSnapshotPlan({
      auth: signedInAuth,
      local: emptyLocal,
      ...deps,
      planMerge: (input) => {
        planCalled = true;
        expect(input.local).toBe(emptyLocal);
        expect(input.cloud).toEqual({
          sessions: [session],
          vocabulary: [vocabItem],
          xpProfile,
          xpEvents: [xpEvent],
          badges: [badge],
        });
        return {
          status: "restore-available",
          reasons: [],
          counts: {
            sessions: { local: 0, cloud: 1, merged: 1, added: 1, updated: 0 },
            vocabulary: { local: 0, cloud: 1, merged: 1, added: 1, updated: 0 },
            xpProfile: { local: 0, cloud: 1, merged: 1, added: 1, updated: 0 },
            xpEvents: { local: 0, cloud: 1, merged: 1, added: 1, updated: 0 },
            badges: { local: 0, cloud: 1, merged: 1, added: 1, updated: 0 },
          },
          merged: {
            sessions: [session],
            vocabulary: [vocabItem],
            xpProfile,
            xpEvents: [xpEvent],
            badges: [badge],
          },
        };
      },
    });

    expect(planCalled).toBe(true);
    expect(result.status).toBe("loaded");
    expect(result).toEqual(
      expect.objectContaining({
        status: "loaded",
        cloud: {
          sessions: [session],
          vocabulary: [vocabItem],
          xpProfile,
          xpEvents: [xpEvent],
          badges: [badge],
        },
        plan: expect.objectContaining({ status: "restore-available" }),
      }),
    );
    expect(deps.calls).toEqual(
      expect.arrayContaining([
        "isConfigured",
        "createClient",
        "loadSessions:user_clerk_123:true",
        "loadVocabulary:user_clerk_123:true",
        "loadXpProfile:user_clerk_123:true",
        "loadXpEvents:user_clerk_123:true",
        "loadBadges:user_clerk_123:true",
      ]),
    );
  });

  test("uses planSyncMerge by default", async () => {
    const deps = createDeps();

    const result = await loadCloudSnapshotPlan({
      auth: signedInAuth,
      local: emptyLocal,
      ...deps,
    });

    expect(result.status).toBe("loaded");
    if (result.status === "loaded") {
      expect(result.plan.status).toBe("restore-available");
      expect(result.plan.merged.sessions).toEqual([session]);
      expect(result.plan.merged.vocabulary).toEqual([vocabItem]);
      expect(result.plan.merged.xpProfile).toEqual(xpProfile);
      expect(result.plan.merged.xpEvents).toEqual([xpEvent]);
      expect(result.plan.merged.badges).toEqual([badge]);
    }
  });

  test("returns failed safely when a cloud read helper fails", async () => {
    const deps = createDeps();

    const result = await loadCloudSnapshotPlan({
      auth: signedInAuth,
      local: emptyLocal,
      ...deps,
      loadVocabulary: async () => {
        throw new Error("read failed");
      },
    });

    expect(result).toEqual({
      status: "failed",
      reason: "cloud-read-failed",
    });
  });

  test("does not call localStorage or write helpers", async () => {
    const deps = createDeps();
    const writes: string[] = [];
    const originalLocalStorage = globalThis.localStorage;

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error("localStorage getItem should not be called");
        },
        setItem: () => {
          writes.push("setItem");
          throw new Error("localStorage setItem should not be called");
        },
        removeItem: () => {
          writes.push("removeItem");
          throw new Error("localStorage removeItem should not be called");
        },
      },
    });

    try {
      const result = await loadCloudSnapshotPlan({
        auth: signedInAuth,
        local: emptyLocal,
        ...deps,
      });

      expect(result.status).toBe("loaded");
      expect(writes).toEqual([]);
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });
});
