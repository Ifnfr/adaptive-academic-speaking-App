import { expect, test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { handleLeaderboardGet } from "../src/app/api/leaderboard/route";
import { XP_RULES } from "../src/app/lib/gamification";

// ---------- Shared Mock Data ----------

type MockServiceClient = Parameters<typeof handleLeaderboardGet>[0]["supabase"];

const MOCK_PROFILES = [
  {
    id: "uuid-1",
    owner_id: "user_1",
    display_name: "Alice Smith",
    avatar_url: null,
    leaderboard_opt_in: true,
  },
  {
    id: "uuid-2",
    owner_id: "user_2",
    display_name: "Bob Jones",
    avatar_url: "https://example.com/bob.jpg",
    leaderboard_opt_in: true,
  },
  {
    id: "uuid-3",
    owner_id: "user_3",
    display_name: "Charlie Brown",
    avatar_url: null,
    leaderboard_opt_in: false,
  },
];

const MOCK_XP_PROFILES = [
  { owner_id: "user_1", total_xp: 200 },
  { owner_id: "user_2", total_xp: 100 },
  { owner_id: "user_3", total_xp: 300 },
];

const MOCK_EVENTS = [
  {
    owner_id: "user_1",
    type: "normal_session_completed",
    source_id: "s1",
    xp: 40,
    local_date: "2026-05-29",
  },
  {
    owner_id: "user_1",
    type: "normal_session_completed",
    source_id: "s2",
    xp: 40,
    local_date: "2026-05-28",
  },
  {
    owner_id: "user_2",
    type: "normal_session_completed",
    source_id: "s3",
    xp: 50,
    local_date: "2026-05-29",
  },
  {
    owner_id: "user_3",
    type: "normal_session_completed",
    source_id: "s4",
    xp: 100,
    local_date: "2026-05-29",
  },
];

const MOCK_BADGES = [
  { owner_id: "user_1", status: "earned" },
  { owner_id: "user_1", status: "earned" },
  { owner_id: "user_2", status: "locked" },
];

// ---------- Mock Supabase Client Factory ----------

function createMockClient(overrides?: {
  profiles?: unknown[];
  xp_profiles?: unknown[];
  xp_events?: unknown[];
  badges?: unknown[];
}): { client: MockServiceClient; calls: string[] } {
  const tableData: Record<string, unknown[]> = {
    profiles: overrides?.profiles ?? MOCK_PROFILES,
    xp_profiles: overrides?.xp_profiles ?? MOCK_XP_PROFILES,
    xp_events: overrides?.xp_events ?? MOCK_EVENTS,
    badges: overrides?.badges ?? MOCK_BADGES,
  };
  const calls: string[] = [];

  const client: MockServiceClient = {
    from(table: string) {
      calls.push(`from:${table}`);
      return {
        select(columns: string) {
          calls.push(`select:${table}:${columns}`);
          return Promise.resolve({
            data: tableData[table] || [],
            error: null,
          });
        },
      };
    },
  };

  return { client, calls };
}

// ---------- Tests ----------

test.describe("Leaderboard API Route", () => {
  test("missing period defaults to weekly", async () => {
    const { client } = createMockClient();
    const result = await handleLeaderboardGet({
      period: null,
      currentUserId: null,
      supabase: client,
      currentDateStr: "2026-05-29",
    });

    expect(result.status).toBe(200);
    expect(result.snapshot!.period).toBe("weekly");
  });

  test("invalid period defaults to weekly", async () => {
    const { client } = createMockClient();
    const result = await handleLeaderboardGet({
      period: "biweekly",
      currentUserId: null,
      supabase: client,
      currentDateStr: "2026-05-29",
    });

    expect(result.status).toBe(200);
    expect(result.snapshot!.period).toBe("weekly");
  });

  test("valid period is respected", async () => {
    const { client } = createMockClient();

    const daily = await handleLeaderboardGet({
      period: "daily",
      currentUserId: null,
      supabase: client,
      currentDateStr: "2026-05-29",
    });
    expect(daily.snapshot!.period).toBe("daily");

    // For daily on 2026-05-29, only events from that exact date count.
    // user_1 has 40 XP on 05-29, user_2 has 50 XP on 05-29.
    const alice = daily.snapshot!.leaderboard.find(
      (e) => e.initials === "AS",
    );
    expect(alice?.periodXp).toBe(40);

    const bob = daily.snapshot!.leaderboard.find(
      (e) => e.initials === "BJ",
    );
    expect(bob?.periodXp).toBe(50);
  });

  test("signed-out response is safe", async () => {
    const { client } = createMockClient();
    const result = await handleLeaderboardGet({
      period: "weekly",
      currentUserId: null,
      supabase: client,
      currentDateStr: "2026-05-29",
    });

    expect(result.status).toBe(200);
    expect(result.snapshot!.currentUser.isSignedIn).toBe(false);
    expect(result.snapshot!.currentUser.visibility).toBe("signed-out");
    expect(result.snapshot!.currentUser.periodXp).toBe(0);
    expect(result.snapshot!.currentUser.displayName).toBe("");

    // Serialized output must not contain any owner_id values
    const serialized = JSON.stringify(result.snapshot);
    expect(serialized).not.toContain("user_1");
    expect(serialized).not.toContain("user_2");
    expect(serialized).not.toContain("user_3");
  });

  test("opted-out users hidden from public leaderboard", async () => {
    const { client } = createMockClient();
    const result = await handleLeaderboardGet({
      period: "weekly",
      currentUserId: null,
      supabase: client,
      currentDateStr: "2026-05-29",
    });

    expect(result.status).toBe(200);

    // Charlie (user_3) is opted out — must not appear
    const charlie = result.snapshot!.leaderboard.find((e) =>
      e.displayName.startsWith("Charlie"),
    );
    expect(charlie).toBeUndefined();

    // Alice and Bob are opted in and have XP
    expect(result.snapshot!.leaderboard).toHaveLength(2);
  });

  test("opted-out currentUser gets private status and previewRank", async () => {
    const { client } = createMockClient();
    const result = await handleLeaderboardGet({
      period: "weekly",
      currentUserId: "user_3", // Charlie — opted out, 100 XP
      supabase: client,
      currentDateStr: "2026-05-29",
    });

    expect(result.snapshot!.currentUser.isSignedIn).toBe(true);
    expect(result.snapshot!.currentUser.optedIn).toBe(false);
    expect(result.snapshot!.currentUser.visibility).toBe("private");
    expect(result.snapshot!.currentUser.rank).toBeNull();
    expect(result.snapshot!.currentUser.previewRank).toBe(1); // 100 XP is highest
    expect(result.snapshot!.currentUser.periodXp).toBe(100);

    // Still hidden from public board
    const charlie = result.snapshot!.leaderboard.find((e) =>
      e.displayName.startsWith("Charlie"),
    );
    expect(charlie).toBeUndefined();
  });

  test("response does not include private fields", async () => {
    const { client } = createMockClient();
    const result = await handleLeaderboardGet({
      period: "weekly",
      currentUserId: "user_2",
      supabase: client,
      currentDateStr: "2026-05-29",
    });

    const serialized = JSON.stringify(result.snapshot);

    const forbidden = [
      "email",
      "ownerId",
      "owner_id",
      "sourceId",
      "source_id",
      "transcript",
      "correction",
      "privateNote",
      "private_note",
      "csv",
      "articleUrl",
      "article_url",
      "weakness",
      "localStorage",
      "retryTask",
      "retry_task",
    ];

    for (const field of forbidden) {
      expect(serialized).not.toContain(`"${field}":`);
    }
  });

  test("route does not write or mutate Supabase data", async () => {
    const { client, calls } = createMockClient();
    await handleLeaderboardGet({
      period: "weekly",
      currentUserId: "user_1",
      supabase: client,
      currentDateStr: "2026-05-29",
    });

    // All calls should be read-only (from + select)
    const writeCalls = calls.filter(
      (c) =>
        c.startsWith("insert") ||
        c.startsWith("update") ||
        c.startsWith("upsert") ||
        c.startsWith("delete"),
    );
    expect(writeCalls).toHaveLength(0);

    // Should have queried exactly 4 tables
    const fromCalls = calls.filter((c) => c.startsWith("from:"));
    expect(fromCalls).toHaveLength(4);
    expect(fromCalls).toContain("from:profiles");
    expect(fromCalls).toContain("from:xp_profiles");
    expect(fromCalls).toContain("from:xp_events");
    expect(fromCalls).toContain("from:badges");
  });

  test("route does not change XP rules", async () => {
    const originalRules = JSON.parse(JSON.stringify(XP_RULES));

    const { client } = createMockClient();
    await handleLeaderboardGet({
      period: "weekly",
      currentUserId: "user_1",
      supabase: client,
      currentDateStr: "2026-05-29",
    });

    // XP_RULES must remain exactly the same after the route executes
    expect(JSON.stringify(XP_RULES)).toBe(JSON.stringify(originalRules));
  });

  test("route source sets Cache-Control: no-store on all response paths", () => {
    const routePath = path.resolve(
      process.cwd(),
      "src/app/api/leaderboard/route.ts",
    );
    const source = fs.readFileSync(routePath, "utf-8");

    // The no-store header constant must be defined
    expect(source).toContain('"Cache-Control"');
    expect(source).toContain('"no-store"');
    expect(source).toContain("NO_STORE_HEADERS");

    // Every NextResponse.json call must use NO_STORE_HEADERS
    const responseCount = (source.match(/NextResponse\.json\(/g) || []).length;
    expect(responseCount).toBeGreaterThanOrEqual(3);

    // NO_STORE_HEADERS must appear at least once per response path
    // (plus 1 for the const definition)
    const usageCount = (source.match(/NO_STORE_HEADERS/g) || []).length;
    expect(usageCount).toBeGreaterThanOrEqual(responseCount);
  });
});
