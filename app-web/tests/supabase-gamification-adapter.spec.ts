import { expect, test } from "@playwright/test";
import {
  mapStoredProfileToSupabaseInsert,
  mapStoredEventToSupabaseInsert,
  mapStoredBadgeToSupabaseInsert,
  mapSupabaseRowToStoredProfile,
  mapSupabaseRowToStoredEvent,
  mapSupabaseRowToStoredBadge,
  upsertXpProfileRow,
  upsertXpEventRows,
  upsertBadgeRows,
  type SupabaseXpProfileRow,
  type SupabaseXpEventRow,
  type SupabaseBadgeRow,
} from "../src/app/lib/storage/supabase-gamification-adapter";
import type { XpProfile, XpEvent, Badge } from "../src/app/lib/gamification";
import type { FonetikSupabaseClient } from "../src/app/lib/supabase";

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

function createMockSupabaseClient(responses: Record<string, { error: Error | null }>) {
  const calls: string[] = [];
  const query = {
    upsert(rows: unknown, options: unknown) {
      calls.push(`upsert:${JSON.stringify(rows)}:${JSON.stringify(options)}`);
      return Promise.resolve(responses[calls[calls.length - 2]] || { error: null });
    },
    then(onfulfilled: (value: { error: Error | null }) => unknown) {
      const res = responses[calls[calls.length - 1]] || { error: null };
      return Promise.resolve(res).then(onfulfilled);
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

test.describe("Supabase gamification mappers", () => {
  test("maps XpProfile to Supabase insert structure", () => {
    const insert = mapStoredProfileToSupabaseInsert("user_123", testProfile);

    expect(insert).toEqual({
      owner_id: "user_123",
      total_xp: 180,
      pending_daily_xp: 40,
      unclaimed_previous_xp: 0,
      active_date: "2026-05-27",
      last_claimed_date: "2026-05-26",
      created_at: "2026-05-26T00:00:00Z",
      updated_at: "2026-05-27T01:00:00Z",
    });
  });

  test("maps XpEvent to Supabase insert structure", () => {
    const insert = mapStoredEventToSupabaseInsert("user_123", testEvent);

    expect(insert).toEqual({
      owner_id: "user_123",
      client_id: "xp-123",
      type: "normal_session_completed",
      xp: 40,
      local_date: "2026-05-27",
      source_id: "session-456",
      source_kind: "session",
      reason: "Completed session.",
      created_at: "2026-05-27T01:00:00Z",
    });
  });

  test("maps Badge to Supabase insert structure", () => {
    const insert = mapStoredBadgeToSupabaseInsert("user_123", testBadge);

    expect(insert).toEqual({
      owner_id: "user_123",
      badge_id: "first_session",
      label: "First Session",
      description: "Completed first speaking session.",
      status: "earned",
      earned_at: "2026-05-27T01:00:00Z",
    });
  });

  test("maps Supabase rows back to stored objects", () => {
    const rowProfile: SupabaseXpProfileRow = {
      owner_id: "user_123",
      total_xp: 180,
      pending_daily_xp: 40,
      unclaimed_previous_xp: 0,
      active_date: "2026-05-27",
      last_claimed_date: "2026-05-26",
      created_at: "2026-05-26T00:00:00Z",
      updated_at: "2026-05-27T01:00:00Z",
    };

    const rowEvent: SupabaseXpEventRow = {
      id: "db-event-uuid",
      owner_id: "user_123",
      client_id: "xp-123",
      type: "normal_session_completed",
      xp: 40,
      local_date: "2026-05-27",
      source_id: "session-456",
      source_kind: "session",
      reason: "Completed session.",
      created_at: "2026-05-27T01:00:00Z",
    };

    const rowBadge: SupabaseBadgeRow = {
      id: "db-badge-uuid",
      owner_id: "user_123",
      badge_id: "first_session",
      label: "First Session",
      description: "Completed first speaking session.",
      status: "earned",
      earned_at: "2026-05-27T01:00:00Z",
      created_at: "2026-05-27T01:00:00Z",
      updated_at: "2026-05-27T01:00:00Z",
    };

    expect(mapSupabaseRowToStoredProfile(rowProfile)).toEqual(testProfile);
    expect(mapSupabaseRowToStoredEvent(rowEvent)).toEqual(testEvent);
    expect(mapSupabaseRowToStoredBadge(rowBadge)).toEqual(testBadge);
  });
});

test.describe("Supabase adapter operations", () => {
  test("upsertXpProfileRow executes correct query", async () => {
    const mock = createMockSupabaseClient({});

    await upsertXpProfileRow("user_123", testProfile, mock.client);

    expect(mock.calls).toEqual([
      "from:xp_profiles",
      `upsert:${JSON.stringify(mapStoredProfileToSupabaseInsert("user_123", testProfile))}:${JSON.stringify({ onConflict: "owner_id" })}`,
    ]);
  });

  test("upsertXpEventRows executes correct query", async () => {
    const mock = createMockSupabaseClient({});

    await upsertXpEventRows("user_123", [testEvent], mock.client);

    expect(mock.calls).toEqual([
      "from:xp_events",
      `upsert:${JSON.stringify([mapStoredEventToSupabaseInsert("user_123", testEvent)])}:${JSON.stringify({ onConflict: "owner_id,type,source_id" })}`,
    ]);
  });

  test("upsertBadgeRows executes correct query", async () => {
    const mock = createMockSupabaseClient({});

    await upsertBadgeRows("user_123", [testBadge], mock.client);

    expect(mock.calls).toEqual([
      "from:badges",
      `upsert:${JSON.stringify([mapStoredBadgeToSupabaseInsert("user_123", testBadge)])}:${JSON.stringify({ onConflict: "owner_id,badge_id" })}`,
    ]);
  });
});
