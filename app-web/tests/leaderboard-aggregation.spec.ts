import { expect, test } from "@playwright/test";
import {
  normalizeLeaderboardPeriod,
  getLeaderboardPeriodBounds,
  buildLeaderboardSnapshot,
  type LeaderboardProfileInput,
  type LeaderboardEventInput,
} from "../src/app/lib/leaderboard/leaderboard-aggregation";

test.describe("Leaderboard Period Normalization & Bounds", () => {
  test("normalizes invalid or missing periods to weekly", () => {
    expect(normalizeLeaderboardPeriod(null)).toBe("weekly");
    expect(normalizeLeaderboardPeriod(undefined)).toBe("weekly");
    expect(normalizeLeaderboardPeriod("invalid-period")).toBe("weekly");
    expect(normalizeLeaderboardPeriod("DAILY")).toBe("daily");
    expect(normalizeLeaderboardPeriod("weekly")).toBe("weekly");
    expect(normalizeLeaderboardPeriod("monthly")).toBe("monthly");
    expect(normalizeLeaderboardPeriod("all-time")).toBe("all-time");
  });

  test("calculates daily bounds", () => {
    const bounds = getLeaderboardPeriodBounds("daily", "2026-05-29");
    expect(bounds).toEqual({ startDate: "2026-05-29", endDate: "2026-05-29" });
  });

  test("calculates weekly bounds (Monday to Sunday)", () => {
    // 2026-05-29 is a Friday. Monday is 2026-05-26, Sunday is 2026-06-01?
    // Wait, let's verify: May 2026:
    // 29 is Friday
    // 28 Thursday, 27 Wednesday, 26 Tuesday, 25 Monday.
    // Sunday is 31st.
    // Let's test the bounds for 2026-05-29:
    const bounds = getLeaderboardPeriodBounds("weekly", "2026-05-29");
    expect(bounds).toEqual({ startDate: "2026-05-25", endDate: "2026-05-31" });
  });

  test("calculates monthly bounds (first to last day of month)", () => {
    const bounds = getLeaderboardPeriodBounds("monthly", "2026-05-29");
    expect(bounds).toEqual({ startDate: "2026-05-01", endDate: "2026-05-31" });
  });

  test("all-time bounds has no date filter", () => {
    const bounds = getLeaderboardPeriodBounds("all-time", "2026-05-29");
    expect(bounds).toEqual({ startDate: null, endDate: null });
  });

  test("throws error on invalid date string", () => {
    expect(() => getLeaderboardPeriodBounds("weekly", "invalid-date")).toThrow();
  });
});

test.describe("Leaderboard Aggregation Core", () => {
  const mockProfiles: LeaderboardProfileInput[] = [
    { ownerId: "user_1", id: "uuid-1", displayName: "Alice Smith", leaderboardOptIn: true, learnerLevel: "Advanced", totalXp: 200 },
    { ownerId: "user_2", id: "uuid-2", displayName: "Bob Jones", leaderboardOptIn: true, learnerLevel: "Beginner", totalXp: 100 },
    { ownerId: "user_3", id: "uuid-3", displayName: "Charlie Brown", leaderboardOptIn: false, learnerLevel: "Intermediate", totalXp: 300 },
    { ownerId: "user_4", id: "uuid-4", displayName: null, leaderboardOptIn: true, learnerLevel: "Foundation", totalXp: 50 }, // empty name
    { ownerId: "user_5", id: "uuid-5", displayName: "Zero XP User", leaderboardOptIn: true, learnerLevel: "Foundation", totalXp: 0 },
  ];

  const mockEvents: LeaderboardEventInput[] = [
    // Alice (user_1) - 80 XP
    { ownerId: "user_1", type: "normal_session_completed", xp: 40, localDate: "2026-05-29", sourceId: "session-1" },
    { ownerId: "user_1", type: "normal_session_completed", xp: 40, localDate: "2026-05-28", sourceId: "session-2" },
    
    // Bob (user_2) - 50 XP
    { ownerId: "user_2", type: "normal_session_completed", xp: 40, localDate: "2026-05-29", sourceId: "session-3" },
    { ownerId: "user_2", type: "vocab_sentence_submitted", xp: 10, localDate: "2026-05-29", sourceId: "vocab-1" },
    
    // Charlie (user_3) - 100 XP (opted out)
    { ownerId: "user_3", type: "normal_session_completed", xp: 100, localDate: "2026-05-29", sourceId: "session-4" },
    
    // Anonymous user (user_4) - 40 XP
    { ownerId: "user_4", type: "normal_session_completed", xp: 40, localDate: "2026-05-29", sourceId: "session-5" },
  ];

  test("includes only opted-in users and excludes zero-XP users from public board", () => {
    const snapshot = buildLeaderboardSnapshot({
      period: "weekly",
      currentDateStr: "2026-05-29",
      profiles: mockProfiles,
      events: mockEvents,
    });

    expect(snapshot.leaderboard).toHaveLength(3); // Alice, Bob, and user_4. Charlie (opted-out) and user_5 (zero-XP) are excluded.
    
    const charliePresent = snapshot.leaderboard.some((u) => u.displayName.startsWith("Charlie"));
    expect(charliePresent).toBe(false);

    const zeroXpUserPresent = snapshot.leaderboard.some((u) => u.displayName === "Zero XP User");
    expect(zeroXpUserPresent).toBe(false);
  });

  test("anonymizes displayName and generates stable initials/monikers", () => {
    const snapshot = buildLeaderboardSnapshot({
      period: "weekly",
      currentDateStr: "2026-05-29",
      profiles: mockProfiles,
      events: mockEvents,
    });

    // Alice Smith becomes Alice S. with initials AS
    const alice = snapshot.leaderboard.find((u) => u.initials === "AS")!;
    expect(alice).toBeTruthy();
    expect(alice.displayName).toBe("Alice S.");

    // user_4 has no name, becomes Speaker #UID (ends in uuid-4 -> UID-4)
    const anonymousUser = snapshot.leaderboard.find((u) => u.displayName.startsWith("Speaker #"))!;
    expect(anonymousUser).toBeTruthy();
    expect(anonymousUser.displayName).toBe("Speaker #ID-4"); // "uuid-4" slice(-4) is "id-4" -> ID-4
    expect(anonymousUser.initials).toBe("S");
  });

  test("filters date bounds correctly for daily/weekly/monthly", () => {
    // Only Alice has events across multiple dates
    // 2026-05-29: 40 XP
    // 2026-05-28: 40 XP
    
    const dailySnapshot = buildLeaderboardSnapshot({
      period: "daily",
      currentDateStr: "2026-05-29",
      profiles: mockProfiles,
      events: mockEvents,
    });
    const aliceDaily = dailySnapshot.leaderboard.find((u) => u.initials === "AS")!;
    expect(aliceDaily.periodXp).toBe(40);

    const weeklySnapshot = buildLeaderboardSnapshot({
      period: "weekly",
      currentDateStr: "2026-05-29",
      profiles: mockProfiles,
      events: mockEvents,
    });
    const aliceWeekly = weeklySnapshot.leaderboard.find((u) => u.initials === "AS")!;
    expect(aliceWeekly.periodXp).toBe(80);
  });

  test("ignores duplicate (owner_id, type, source_id) events to prevent double counting", () => {
    const eventsWithDuplicates = [
      ...mockEvents,
      { ownerId: "user_1", type: "normal_session_completed", xp: 40, localDate: "2026-05-29", sourceId: "session-1" }, // duplicate of event 1
    ];

    const snapshot = buildLeaderboardSnapshot({
      period: "weekly",
      currentDateStr: "2026-05-29",
      profiles: mockProfiles,
      events: eventsWithDuplicates,
    });

    const alice = snapshot.leaderboard.find((u) => u.initials === "AS")!;
    expect(alice.periodXp).toBe(80); // Stays 80 (not 120)
  });

  test("ignores invalid XP event type, xp <= 0, and missing sourceId", () => {
    const invalidEvents = [
      { ownerId: "user_1", type: "invalid_type", xp: 50, localDate: "2026-05-29", sourceId: "session-9" }, // invalid type
      { ownerId: "user_1", type: "normal_session_completed", xp: 0, localDate: "2026-05-29", sourceId: "session-10" }, // xp = 0
      { ownerId: "user_1", type: "normal_session_completed", xp: -20, localDate: "2026-05-29", sourceId: "session-11" }, // xp < 0
      { ownerId: "user_1", type: "normal_session_completed", xp: 40, localDate: "2026-05-29", sourceId: null }, // missing sourceId
    ];

    const snapshot = buildLeaderboardSnapshot({
      period: "weekly",
      currentDateStr: "2026-05-29",
      profiles: mockProfiles,
      events: [...mockEvents, ...invalidEvents],
    });

    const alice = snapshot.leaderboard.find((u) => u.initials === "AS")!;
    expect(alice.periodXp).toBe(80); // Stays 80
  });

  test("accepts XP-2 event types in period aggregation", () => {
    const snapshot = buildLeaderboardSnapshot({
      period: "daily",
      currentDateStr: "2026-05-29",
      profiles: mockProfiles,
      events: [
        {
          ownerId: "user_1",
          type: "podchat_intermediate_evaluated",
          xp: 50,
          localDate: "2026-05-29",
          sourceId: "podchat-session-1",
        },
        {
          ownerId: "user_1",
          type: "podchat_context_bonus",
          xp: 15,
          localDate: "2026-05-29",
          sourceId: "podchat-context-1",
        },
        {
          ownerId: "user_2",
          type: "commonplace_map_edge_created",
          xp: 10,
          localDate: "2026-05-29",
          sourceId: "edge-1",
        },
      ],
    });

    const alice = snapshot.leaderboard.find((u) => u.initials === "AS")!;
    const bob = snapshot.leaderboard.find((u) => u.initials === "BJ")!;
    expect(alice.periodXp).toBe(65);
    expect(bob.periodXp).toBe(10);
  });

  test("ranks users using standard competition ranking (1, 2, 2, 4...)", () => {
    // Modify Bob's events so Bob has 80 XP, matching Alice
    const eventsWithTie = [
      ...mockEvents,
      { ownerId: "user_2", type: "normal_session_completed", xp: 30, localDate: "2026-05-29", sourceId: "session-abc" }, // Bob gets +30 = 80 total
    ];

    const snapshot = buildLeaderboardSnapshot({
      period: "weekly",
      currentDateStr: "2026-05-29",
      profiles: mockProfiles,
      events: eventsWithTie,
    });

    // Alice: 80 XP (rank 1), Bob: 80 XP (rank 1), Anonymous user_4: 40 XP (rank 3)
    const alice = snapshot.leaderboard.find((u) => u.initials === "AS")!;
    const bob = snapshot.leaderboard.find((u) => u.initials === "BJ")!;
    const anonymous = snapshot.leaderboard.find((u) => u.displayName === "Speaker #ID-4")!;

    expect(alice.rank).toBe(1);
    expect(bob.rank).toBe(1);
    expect(anonymous.rank).toBe(3);
  });

  test("returns correct status/rank for signed-in opted-in currentUser", () => {
    const snapshot = buildLeaderboardSnapshot({
      period: "weekly",
      currentDateStr: "2026-05-29",
      profiles: mockProfiles,
      events: mockEvents,
      currentUserId: "user_2", // Bob (opted in, 50 XP, rank 2)
    });

    expect(snapshot.currentUser).toEqual({
      isSignedIn: true,
      optedIn: true,
      visibility: "public",
      rank: 2,
      previewRank: 2,
      periodXp: 50,
      displayName: "Bob Jones",
      avatarUrl: null,
      initials: "BJ",
      level: {
        number: 1, // default calculation
        name: "New Speaker",
      },
    });
  });

  test("returns preview rank and private status for signed-in opted-out currentUser", () => {
    const snapshot = buildLeaderboardSnapshot({
      period: "weekly",
      currentDateStr: "2026-05-29",
      profiles: mockProfiles,
      events: mockEvents,
      currentUserId: "user_3", // Charlie (opted out, 100 XP)
    });

    // Charlie has 100 XP. If he were opted-in, he would be rank 1 (above Alice who has 80).
    expect(snapshot.currentUser).toEqual({
      isSignedIn: true,
      optedIn: false,
      visibility: "private",
      rank: null, // Hidden from public rankings
      previewRank: 1, // Would be 1st
      periodXp: 100,
      displayName: "Charlie Brown",
      avatarUrl: null,
      initials: "CB",
      level: {
        number: 3,
        name: "Developing Speaker",
      },
    });
  });

  test("handles signed-out currentUser safely", () => {
    const snapshot = buildLeaderboardSnapshot({
      period: "weekly",
      currentDateStr: "2026-05-29",
      profiles: mockProfiles,
      events: mockEvents,
      currentUserId: null, // Signed out
    });

    expect(snapshot.currentUser).toEqual({
      isSignedIn: false,
      optedIn: false,
      visibility: "signed-out",
      rank: -1,
      previewRank: -1,
      periodXp: 0,
      displayName: "",
      avatarUrl: null,
      initials: "S",
      level: {
        number: 1,
        name: "New Speaker",
      },
    });
  });

  test("sanitizes all output: no email, ownerId, sourceId, raw events, transcripts, or private notes", () => {
    const snapshot = buildLeaderboardSnapshot({
      period: "weekly",
      currentDateStr: "2026-05-29",
      profiles: mockProfiles,
      events: mockEvents,
      currentUserId: "user_2",
    });

    const serialized = JSON.stringify(snapshot);

    const forbiddenFields = [
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
    ];

    for (const field of forbiddenFields) {
      expect(serialized).not.toContain(`"${field}":`);
    }

    // Double check each public entry contains only allowed keys
    for (const entry of snapshot.leaderboard) {
      const keys = Object.keys(entry);
      expect(keys.sort()).toEqual([
        "avatarUrl",
        "badgeCount",
        "displayName",
        "initials",
        "level",
        "periodXp",
        "rank",
      ]);
    }
  });

  test("aggregates by profile totalXp for all-time period", () => {
    const snapshot = buildLeaderboardSnapshot({
      period: "all-time",
      currentDateStr: "2026-05-29",
      profiles: mockProfiles,
      events: mockEvents,
      currentUserId: "user_2",
    });

    // Alice: totalXp 200 (rank 1), Bob: totalXp 100 (rank 2), user_4: totalXp 50 (rank 3)
    // Charlie (totalXp 300) is opted out. user_5 (totalXp 0) is excluded.
    expect(snapshot.leaderboard).toHaveLength(3);

    const alice = snapshot.leaderboard.find((u) => u.initials === "AS")!;
    const bob = snapshot.leaderboard.find((u) => u.initials === "BJ")!;
    const anonymous = snapshot.leaderboard.find((u) => u.displayName === "Speaker #ID-4")!;

    expect(alice.rank).toBe(1);
    expect(alice.periodXp).toBe(200);

    expect(bob.rank).toBe(2);
    expect(bob.periodXp).toBe(100);

    expect(anonymous.rank).toBe(3);
    expect(anonymous.periodXp).toBe(50);

    // currentUser standing check
    expect(snapshot.currentUser.periodXp).toBe(100); // Bob's total XP
    expect(snapshot.currentUser.rank).toBe(2);
  });
});
