import { expect, test } from "@playwright/test";
import {
  writeXpProfileToCloud,
  writeXpEventsToCloud,
  writeBadgesToCloud,
  loadGamificationFromCloud,
} from "../src/app/lib/storage/gamification-cloud-runtime";
import type { XpProfile, XpEvent, Badge } from "../src/app/lib/gamification";
import type { SessionCloudAuthState } from "../src/app/lib/storage/session-cloud-runtime";
import type { FonetikSupabaseClient, CreateBrowserSupabaseClientOptions } from "../src/app/lib/supabase";

const testProfile: XpProfile = {
  version: 1,
  totalXp: 180,
  pendingDailyXp: 40,
  unclaimedPreviousXp: 0,
  activeDate: "2026-05-27",
  lastClaimedDate: "2026-05-26",
  createdAt: "2026-05-26T00:00:00Z",
  updatedAt: "2026-05-27T01:00:00Z",
};

const testEvent: XpEvent = {
  version: 1,
  id: "xp-123",
  type: "normal_session_completed",
  xp: 40,
  localDate: "2026-05-27",
  createdAt: "2026-05-27T01:00:00Z",
  sourceId: "session-456",
  sourceKind: "session",
  reason: "Completed session.",
};

const testBadge: Badge = {
  version: 1,
  id: "first_session",
  label: "First Session",
  description: "Completed first speaking session.",
  status: "earned",
  earnedAt: "2026-05-27T01:00:00Z",
};

const signedInAuth: SessionCloudAuthState = {
  isLoaded: true,
  isSignedIn: true,
  userId: "user_clerk_123",
  getToken: async () => "clerk-token",
};

function createMocks() {
  const upsertedProfiles: XpProfile[] = [];
  const upsertedEvents: XpEvent[][] = [];
  const upsertedBadges: Badge[][] = [];

  return {
    upsertedProfiles,
    upsertedEvents,
    upsertedBadges,
    upsertProfile: async (ownerId: string, profile: XpProfile) => {
      upsertedProfiles.push(profile);
    },
    upsertEvents: async (ownerId: string, events: ReadonlyArray<XpEvent>) => {
      upsertedEvents.push([...events]);
    },
    upsertBadges: async (ownerId: string, badges: ReadonlyArray<Badge>) => {
      upsertedBadges.push([...badges]);
    },
  };
}

test.describe("Gamification Cloud Runtime skip checks", () => {
  test("skips profile write when auth loading", async () => {
    const mocks = createMocks();
    const result = await writeXpProfileToCloud({
      auth: { isLoaded: false, isSignedIn: false, userId: null, getToken: null },
      profile: testProfile,
      isConfigured: () => true,
      createClient: () => ({}) as unknown as FonetikSupabaseClient,
      ...mocks,
    });

    expect(result).toEqual({ status: "skipped", reason: "auth-loading" });
    expect(mocks.upsertedProfiles).toHaveLength(0);
  });

  test("skips events write when signed out", async () => {
    const mocks = createMocks();
    const result = await writeXpEventsToCloud({
      auth: { isLoaded: true, isSignedIn: false, userId: null, getToken: null },
      previous: [],
      next: [testEvent],
      isConfigured: () => true,
      createClient: () => ({}) as unknown as FonetikSupabaseClient,
      ...mocks,
    });

    expect(result).toEqual({ status: "skipped", reason: "signed-out" });
    expect(mocks.upsertedEvents).toHaveLength(0);
  });

  test("skips badges write when supabase not configured", async () => {
    const mocks = createMocks();
    const result = await writeBadgesToCloud({
      auth: signedInAuth,
      badges: [testBadge],
      isConfigured: () => false,
      createClient: () => ({}) as unknown as FonetikSupabaseClient,
      ...mocks,
    });

    expect(result).toEqual({ status: "skipped", reason: "supabase-not-configured" });
    expect(mocks.upsertedBadges).toHaveLength(0);
  });
});

test.describe("Gamification Cloud Runtime operations", () => {
  test("upserts profile successfully", async () => {
    const mocks = createMocks();
    const result = await writeXpProfileToCloud({
      auth: signedInAuth,
      profile: testProfile,
      isConfigured: () => true,
      createClient: () => ({}) as unknown as FonetikSupabaseClient,
      ...mocks,
    });

    expect(result).toEqual({ status: "saved" });
    expect(mocks.upsertedProfiles).toEqual([testProfile]);
  });

  test("detects new events and upserts only new ones", async () => {
    const mocks = createMocks();
    const secondEvent = { ...testEvent, id: "xp-456" };
    const result = await writeXpEventsToCloud({
      auth: signedInAuth,
      previous: [testEvent],
      next: [testEvent, secondEvent],
      isConfigured: () => true,
      createClient: () => ({}) as unknown as FonetikSupabaseClient,
      ...mocks,
    });

    expect(result).toEqual({ status: "saved" });
    expect(mocks.upsertedEvents).toHaveLength(1);
    expect(mocks.upsertedEvents[0]).toEqual([secondEvent]);
  });

  test("does not call upsert when no new events are added", async () => {
    const mocks = createMocks();
    const result = await writeXpEventsToCloud({
      auth: signedInAuth,
      previous: [testEvent],
      next: [testEvent],
      isConfigured: () => true,
      createClient: () => ({}) as unknown as FonetikSupabaseClient,
      ...mocks,
    });

    expect(result).toEqual({ status: "saved" });
    expect(mocks.upsertedEvents).toHaveLength(0);
  });

  test("upserts badges successfully", async () => {
    const mocks = createMocks();
    const result = await writeBadgesToCloud({
      auth: signedInAuth,
      badges: [testBadge],
      isConfigured: () => true,
      createClient: () => ({}) as unknown as FonetikSupabaseClient,
      ...mocks,
    });

    expect(result).toEqual({ status: "saved" });
    expect(mocks.upsertedBadges).toEqual([[testBadge]]);
  });

  test("returns failed status safely when a write fails", async () => {
    const mocks = createMocks();
    const failingUpsert = async () => {
      throw new Error("profile write failed");
    };
    const result = await writeXpProfileToCloud({
      auth: signedInAuth,
      profile: testProfile,
      isConfigured: () => true,
      createClient: () => ({}) as unknown as FonetikSupabaseClient,
      ...mocks,
      upsertProfile: failingUpsert,
    });

    expect(result).toEqual({ status: "failed", reason: "write-failed" });
  });
});

test.describe("Gamification Cloud Runtime read operations", () => {
  test("loads gamification data from Supabase successfully", async () => {
    let loadProfileCalls = 0;
    let loadEventsCalls = 0;
    let loadBadgesCalls = 0;
    let createClientOptions: CreateBrowserSupabaseClientOptions | null = null;
    const dummyClient = { marker: "supabase-client" } as unknown as FonetikSupabaseClient;

    const result = await loadGamificationFromCloud({
      auth: signedInAuth,
      isConfigured: () => true,
      createClient: (options) => {
        createClientOptions = options;
        return dummyClient;
      },
      loadXpProfile: async (ownerId, client) => {
        expect(ownerId).toBe("user_clerk_123");
        expect(client).toBe(dummyClient);
        loadProfileCalls++;
        return testProfile;
      },
      loadXpEvents: async (ownerId, client) => {
        expect(ownerId).toBe("user_clerk_123");
        expect(client).toBe(dummyClient);
        loadEventsCalls++;
        return [testEvent];
      },
      loadBadges: async (ownerId, client) => {
        expect(ownerId).toBe("user_clerk_123");
        expect(client).toBe(dummyClient);
        loadBadgesCalls++;
        return [testBadge];
      },
    });

    expect(result).toEqual({
      status: "loaded",
      profile: testProfile,
      events: [testEvent],
      badges: [testBadge],
    });
    expect(loadProfileCalls).toBe(1);
    expect(loadEventsCalls).toBe(1);
    expect(loadBadgesCalls).toBe(1);

    const token = await (createClientOptions as CreateBrowserSupabaseClientOptions | null)?.accessToken?.();
    expect(token).toBe("clerk-token");
  });

  test("skips loading when signed out", async () => {
    const result = await loadGamificationFromCloud({
      auth: { isLoaded: true, isSignedIn: false, userId: null, getToken: null },
      isConfigured: () => true,
      createClient: () => {
        throw new Error("client should not be created");
      },
    });

    expect(result).toEqual({ status: "skipped", reason: "signed-out" });
  });

  test("returns failed status safely when a load fails", async () => {
    const dummyClient = { marker: "supabase-client" } as unknown as FonetikSupabaseClient;

    const result = await loadGamificationFromCloud({
      auth: signedInAuth,
      isConfigured: () => true,
      createClient: () => dummyClient,
      loadXpProfile: async () => {
        throw new Error("load profile failed");
      },
    });

    expect(result).toEqual({ status: "failed", reason: "read-failed" });
  });

  test("uses the correct Supabase JWT template token provider in writes", async () => {
    let createClientOptions: CreateBrowserSupabaseClientOptions | null = null;
    const dummyClient = { marker: "supabase-client" } as unknown as FonetikSupabaseClient;

    const result = await writeXpProfileToCloud({
      auth: signedInAuth,
      profile: testProfile,
      isConfigured: () => true,
      createClient: (options) => {
        createClientOptions = options;
        return dummyClient;
      },
      upsertProfile: async () => {},
    });

    expect(result).toEqual({ status: "saved" });
    const token = await (createClientOptions as CreateBrowserSupabaseClientOptions | null)?.accessToken?.();
    expect(token).toBe("clerk-token");
  });
});
