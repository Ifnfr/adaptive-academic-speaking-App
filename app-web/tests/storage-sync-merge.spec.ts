/**
 * Pure unit tests for the cloud/local merge planner.
 *
 * These tests run inside Playwright's test runner but never touch the browser,
 * the network, Supabase, Clerk, env vars, or localStorage. They exercise the
 * pure helpers in src/app/lib/storage/sync-merge.ts directly.
 */

import { expect, test } from "@playwright/test";
import {
  mergeSessions,
  mergeVocabulary,
  mergeXpEvents,
  mergeXpProfile,
  mergeBadges,
  planSyncMerge,
} from "../src/app/lib/storage/sync-merge";
import type { StoredSessionRecord } from "../src/app/lib/storage/types";
import type {
  VocabItem,
  VocabUserSentence,
  VocabSentenceCorrection,
} from "../src/app/lib/vocabulary";
import type { XpEvent, XpProfile, Badge } from "../src/app/lib/gamification";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeSession(
  overrides: Partial<StoredSessionRecord> = {},
): StoredSessionRecord {
  return {
    id: "sess-1",
    date: "2026-01-01",
    level: "Intermediate",
    mode: "Fluency Sprint",
    feedbackType: "Quick",
    sessionType: "Standard",
    provider: "Claude",
    todayTarget: "Practice transitions",
    durationSeconds: 60,
    transcript: "Sample transcript.",
    mainWeakness: "Filler words",
    evidence: "Said 'um' four times.",
    betterPhrase: "I would argue that...",
    retryTask: "Reduce filler words.",
    retryTranscript: "Cleaner retry.",
    csv: 'Date,Level\n2026-01-01,Intermediate',
    ...overrides,
  };
}

function makeCorrection(
  checkedAt: string,
  status: VocabSentenceCorrection["status"] = "natural",
): VocabSentenceCorrection {
  return {
    status,
    explanation: "Correct.",
    correctedSentence: "Improved sentence.",
    collocationTip: "Use with X.",
    retryInstruction: "Repeat.",
    warnings: [],
    checkedAt,
    providerUsed: "Claude",
  };
}

function makeSentence(
  overrides: Partial<VocabUserSentence> = {},
): VocabUserSentence {
  return {
    id: "s-1",
    sentence: "I will target the issue.",
    containsWord: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeVocab(overrides: Partial<VocabItem> = {}): VocabItem {
  return {
    version: 1,
    id: "v-1",
    word: "target",
    meaning: "An objective.",
    partOfSpeech: "noun",
    source: "manual",
    level: "Intermediate",
    status: "practicing",
    example: "Hit the target.",
    collocations: [],
    userSentences: [],
    reuseCount: 0,
    correctUseCount: 0,
    lastPracticedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeProfile(overrides: Partial<XpProfile> = {}): XpProfile {
  return {
    version: 1,
    totalXp: 0,
    pendingDailyXp: 0,
    unclaimedPreviousXp: 0,
    activeDate: "2026-01-01",
    lastClaimedDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeXpEvent(overrides: Partial<XpEvent> = {}): XpEvent {
  return {
    version: 1,
    id: "evt-1",
    type: "normal_session_completed",
    xp: 40,
    localDate: "2026-01-01",
    createdAt: "2026-01-01T00:00:00.000Z",
    sourceId: "sess-1",
    sourceKind: "session",
    reason: "Session completed.",
    ...overrides,
  };
}

function makeBadge(overrides: Partial<Badge> = {}): Badge {
  return {
    version: 1,
    id: "first_session",
    label: "First Session",
    description: "Complete your first session.",
    status: "locked",
    earnedAt: null,
    ...overrides,
  };
}

function emptySnapshot() {
  return {
    sessions: [],
    vocabulary: [],
    xpProfile: null,
    xpEvents: [],
    badges: [],
  } as const;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

test.describe("mergeSessions", () => {
  test("local wins on duplicate ids and csv is preserved exactly", () => {
    const trickyCsv =
      'Date,Level,Note\n"2026-01-01","Intermediate","She said ""ok"", then\nleft."';
    const local = [
      makeSession({ id: "sess-1", date: "2026-01-02", csv: trickyCsv }),
    ];
    const cloud = [
      makeSession({ id: "sess-1", date: "2026-01-01", csv: "WRONG" }),
    ];

    const result = mergeSessions(local, cloud);

    expect(result.merged).toHaveLength(1);
    expect(result.merged[0].id).toBe("sess-1");
    // Byte-for-byte preservation of the local csv.
    expect(result.merged[0].csv).toBe(trickyCsv);
    expect(result.added).toBe(0);
  });

  test("appends cloud-only sessions and sorts newest first", () => {
    const local = [makeSession({ id: "a", date: "2026-01-05" })];
    const cloud = [
      makeSession({ id: "b", date: "2026-01-10" }),
      makeSession({ id: "c", date: "2026-01-01" }),
    ];

    const result = mergeSessions(local, cloud);

    expect(result.merged.map((s) => s.id)).toEqual(["b", "a", "c"]);
    expect(result.added).toBe(2);
  });

  test("does not truncate to 20", () => {
    const local: StoredSessionRecord[] = Array.from({ length: 25 }, (_, i) =>
      makeSession({ id: `local-${i}`, date: `2026-01-${(i + 1).toString().padStart(2, "0")}` }),
    );
    const cloud: StoredSessionRecord[] = [
      makeSession({ id: "cloud-1", date: "2026-02-01" }),
    ];

    const result = mergeSessions(local, cloud);
    expect(result.merged.length).toBe(26);
  });

  test("ignores rows with missing ids", () => {
    const local = [
      makeSession({ id: "ok-1" }),
      { ...makeSession({ id: "" }) },
    ];
    const result = mergeSessions(local, []);
    expect(result.merged.map((s) => s.id)).toEqual(["ok-1"]);
  });
});

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

test.describe("mergeVocabulary", () => {
  test("newer cloud updatedAt wins on same id", () => {
    const local = [
      makeVocab({
        id: "v-1",
        word: "old",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    ];
    const cloud = [
      makeVocab({
        id: "v-1",
        word: "new",
        updatedAt: "2026-01-02T00:00:00.000Z",
      }),
    ];

    const result = mergeVocabulary(local, cloud);
    expect(result.merged).toHaveLength(1);
    expect(result.merged[0].word).toBe("new");
    expect(result.updated).toBe(1);
  });

  test("invalid local timestamp prefers local", () => {
    const local = [makeVocab({ id: "v-1", word: "local", updatedAt: "not-a-date" })];
    const cloud = [
      makeVocab({
        id: "v-1",
        word: "cloud",
        updatedAt: "2030-01-01T00:00:00.000Z",
      }),
    ];

    const result = mergeVocabulary(local, cloud);
    expect(result.merged[0].word).toBe("local");
  });

  test("missing cloud timestamp prefers local", () => {
    const local = [
      makeVocab({
        id: "v-1",
        word: "local",
        updatedAt: "2026-01-02T00:00:00.000Z",
      }),
    ];
    const cloud = [makeVocab({ id: "v-1", word: "cloud", updatedAt: "" })];

    const result = mergeVocabulary(local, cloud);
    expect(result.merged[0].word).toBe("local");
  });

  test("nested user sentences merge by id", () => {
    const local = [
      makeVocab({
        id: "v-1",
        userSentences: [
          makeSentence({ id: "s-local", sentence: "Local sentence" }),
        ],
      }),
    ];
    const cloud = [
      makeVocab({
        id: "v-1",
        // Same updatedAt so neither side "wins" — both sentences should survive.
        userSentences: [
          makeSentence({ id: "s-cloud", sentence: "Cloud sentence" }),
        ],
      }),
    ];

    const result = mergeVocabulary(local, cloud);
    const ids = result.merged[0].userSentences.map((s) => s.id);
    expect(ids).toContain("s-local");
    expect(ids).toContain("s-cloud");
  });

  test("correction prefers newer checkedAt", () => {
    const localCorrection = makeCorrection("2026-01-01T00:00:00.000Z");
    const cloudCorrection = makeCorrection(
      "2026-01-05T00:00:00.000Z",
      "understandable",
    );
    const local = [
      makeVocab({
        id: "v-1",
        userSentences: [
          makeSentence({ id: "s-1", correction: localCorrection }),
        ],
      }),
    ];
    const cloud = [
      makeVocab({
        id: "v-1",
        userSentences: [
          makeSentence({ id: "s-1", correction: cloudCorrection }),
        ],
      }),
    ];

    const result = mergeVocabulary(local, cloud);
    expect(result.merged[0].userSentences[0].correction?.status).toBe(
      "understandable",
    );
  });

  test("cloud-only nested sentence is restored", () => {
    const local = [makeVocab({ id: "v-1", userSentences: [] })];
    const cloud = [
      makeVocab({
        id: "v-1",
        userSentences: [makeSentence({ id: "s-cloud" })],
      }),
    ];

    const result = mergeVocabulary(local, cloud);
    expect(result.merged[0].userSentences.map((s) => s.id)).toContain(
      "s-cloud",
    );
  });

  test("never deletes a local-only item when cloud is missing it", () => {
    const local = [makeVocab({ id: "v-1" }), makeVocab({ id: "v-2" })];
    const cloud = [makeVocab({ id: "v-1" })];

    const result = mergeVocabulary(local, cloud);
    expect(result.merged.map((v) => v.id).sort()).toEqual(["v-1", "v-2"]);
  });
});

// ---------------------------------------------------------------------------
// XP events
// ---------------------------------------------------------------------------

test.describe("mergeXpEvents", () => {
  test("does not duplicate same type + sourceId", () => {
    const local = [
      makeXpEvent({
        id: "evt-local",
        type: "normal_session_completed",
        sourceId: "sess-1",
      }),
    ];
    const cloud = [
      makeXpEvent({
        id: "evt-cloud",
        type: "normal_session_completed",
        sourceId: "sess-1",
      }),
    ];

    const result = mergeXpEvents(local, cloud);
    expect(result.merged).toHaveLength(1);
    expect(result.merged[0].id).toBe("evt-local");
    expect(result.added).toBe(0);
  });

  test("adds cloud event with a new (type,sourceId) pair", () => {
    const local = [
      makeXpEvent({ id: "evt-1", type: "normal_session_completed", sourceId: "sess-1" }),
    ];
    const cloud = [
      makeXpEvent({
        id: "evt-2",
        type: "retry_completed",
        sourceId: "sess-1",
      }),
    ];

    const result = mergeXpEvents(local, cloud);
    expect(result.merged.map((e) => e.id).sort()).toEqual(["evt-1", "evt-2"]);
    expect(result.added).toBe(1);
  });

  test("preserves event fields exactly (no XP recalculation)", () => {
    const cloud = [
      makeXpEvent({
        id: "evt-cloud",
        sourceId: "sess-9",
        xp: 999, // intentionally weird; merge must not normalize
        reason: "Mirrored from cloud",
        sourceKind: "session",
      }),
    ];

    const result = mergeXpEvents([], cloud);
    expect(result.merged[0].xp).toBe(999);
    expect(result.merged[0].reason).toBe("Mirrored from cloud");
    expect(result.merged[0].sourceKind).toBe("session");
  });
});

// ---------------------------------------------------------------------------
// XP profile
// ---------------------------------------------------------------------------

test.describe("mergeXpProfile", () => {
  test("non-empty local wins over cloud", () => {
    const local = makeProfile({ totalXp: 200 });
    const cloud = makeProfile({ totalXp: 50 });

    const result = mergeXpProfile(local, cloud);
    expect(result.merged?.totalXp).toBe(200);
    expect(result.restoredFromCloud).toBe(false);
    expect(result.conflict).toBe(true);
  });

  test("default/empty local restores from cloud", () => {
    const local = makeProfile({ totalXp: 0 });
    const cloud = makeProfile({ totalXp: 75, lastClaimedDate: "2026-01-05" });

    const result = mergeXpProfile(local, cloud);
    expect(result.merged?.totalXp).toBe(75);
    expect(result.restoredFromCloud).toBe(true);
  });

  test("null local + null cloud is a no-op", () => {
    const result = mergeXpProfile(null, null);
    expect(result.merged).toBeNull();
    expect(result.conflict).toBe(false);
    expect(result.restoredFromCloud).toBe(false);
  });

  test("local non-empty + cloud null keeps local", () => {
    const local = makeProfile({ totalXp: 100 });
    const result = mergeXpProfile(local, null);
    expect(result.merged?.totalXp).toBe(100);
    expect(result.restoredFromCloud).toBe(false);
  });

  test("agreeing totals on both real profiles emits no conflict", () => {
    const local = makeProfile({ totalXp: 100 });
    const cloud = makeProfile({ totalXp: 100 });
    const result = mergeXpProfile(local, cloud);
    expect(result.conflict).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

test.describe("mergeBadges", () => {
  test("earned beats locked", () => {
    const local = [makeBadge({ status: "locked", earnedAt: null })];
    const cloud = [
      makeBadge({ status: "earned", earnedAt: "2026-01-02T00:00:00.000Z" }),
    ];

    const result = mergeBadges(local, cloud);
    expect(result.merged[0].status).toBe("earned");
    expect(result.merged[0].earnedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(result.updated).toBe(1);
  });

  test("both earned: prefer earlier earnedAt", () => {
    const local = [
      makeBadge({ status: "earned", earnedAt: "2026-01-10T00:00:00.000Z" }),
    ];
    const cloud = [
      makeBadge({ status: "earned", earnedAt: "2026-01-02T00:00:00.000Z" }),
    ];

    const result = mergeBadges(local, cloud);
    expect(result.merged[0].earnedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  test("does not invent badges", () => {
    const result = mergeBadges([], []);
    expect(result.merged).toEqual([]);
    expect(result.added).toBe(0);
  });

  test("cloud-only badge is added", () => {
    const local: Badge[] = [];
    const cloud = [makeBadge({ id: "streak_3" })];
    const result = mergeBadges(local, cloud);
    expect(result.merged.map((b) => b.id)).toEqual(["streak_3"]);
    expect(result.added).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// planSyncMerge — top-level recommendations
// ---------------------------------------------------------------------------

test.describe("planSyncMerge", () => {
  test("empty cloud + local data = no destructive change, status no-op", () => {
    const plan = planSyncMerge({
      local: {
        sessions: [makeSession({ id: "a" })],
        vocabulary: [makeVocab()],
        xpProfile: makeProfile({ totalXp: 100 }),
        xpEvents: [makeXpEvent()],
        badges: [makeBadge({ status: "earned", earnedAt: "2026-01-01T00:00:00.000Z" })],
      },
      cloud: emptySnapshot(),
    });

    expect(plan.status).toBe("no-op");
    expect(plan.merged.sessions.map((s) => s.id)).toEqual(["a"]);
    expect(plan.merged.vocabulary).toHaveLength(1);
    expect(plan.merged.xpProfile?.totalXp).toBe(100);
    expect(plan.merged.xpEvents).toHaveLength(1);
    expect(plan.merged.badges).toHaveLength(1);
    expect(plan.counts.sessions.local).toBe(1);
    expect(plan.counts.sessions.cloud).toBe(0);
  });

  test("empty local + cloud data = restore-available", () => {
    const plan = planSyncMerge({
      local: emptySnapshot(),
      cloud: {
        sessions: [makeSession({ id: "c" })],
        vocabulary: [makeVocab({ id: "vc" })],
        xpProfile: makeProfile({ totalXp: 250 }),
        xpEvents: [makeXpEvent({ id: "evt-c", sourceId: "sess-c" })],
        badges: [
          makeBadge({
            status: "earned",
            earnedAt: "2026-01-02T00:00:00.000Z",
          }),
        ],
      },
    });

    expect(plan.status).toBe("restore-available");
    expect(plan.merged.sessions).toHaveLength(1);
    expect(plan.merged.xpProfile?.totalXp).toBe(250);
    const xpProfileReason = plan.reasons.find(
      (r) => r.domain === "xpProfile",
    );
    expect(xpProfileReason?.message).toContain("restore");
  });

  test("cloud brings new rows = import-available", () => {
    const plan = planSyncMerge({
      local: {
        sessions: [makeSession({ id: "a" })],
        vocabulary: [],
        xpProfile: makeProfile({ totalXp: 100 }),
        xpEvents: [],
        badges: [],
      },
      cloud: {
        sessions: [makeSession({ id: "b" })],
        vocabulary: [],
        xpProfile: null,
        xpEvents: [],
        badges: [],
      },
    });

    expect(plan.status).toBe("import-available");
    const sessionReason = plan.reasons.find((r) => r.domain === "sessions");
    expect(sessionReason?.message).toContain("1");
  });

  test("conflicting XP profiles raise a warning reason", () => {
    const plan = planSyncMerge({
      local: {
        sessions: [],
        vocabulary: [],
        xpProfile: makeProfile({ totalXp: 100 }),
        xpEvents: [],
        badges: [],
      },
      cloud: {
        sessions: [],
        vocabulary: [],
        xpProfile: makeProfile({ totalXp: 200 }),
        xpEvents: [],
        badges: [],
      },
    });

    const warning = plan.reasons.find(
      (r) => r.domain === "xpProfile" && r.level === "warning",
    );
    expect(warning).toBeTruthy();
    expect(plan.merged.xpProfile?.totalXp).toBe(100); // local always wins on merge
  });

  test("duplicate sessions on both sides dedupe by id", () => {
    const local = [makeSession({ id: "x" }), makeSession({ id: "y" })];
    const cloud = [makeSession({ id: "y" }), makeSession({ id: "z" })];
    const plan = planSyncMerge({
      local: { sessions: local, vocabulary: [], xpProfile: null, xpEvents: [], badges: [] },
      cloud: { sessions: cloud, vocabulary: [], xpProfile: null, xpEvents: [], badges: [] },
    });

    const ids = plan.merged.sessions.map((s) => s.id).sort();
    expect(ids).toEqual(["x", "y", "z"]);
    expect(plan.counts.sessions.added).toBe(1); // only `z` is new
  });

  test("nothing changes when local and cloud are identical", () => {
    const session = makeSession({ id: "same" });
    const plan = planSyncMerge({
      local: {
        sessions: [session],
        vocabulary: [makeVocab()],
        xpProfile: makeProfile({ totalXp: 50 }),
        xpEvents: [makeXpEvent()],
        badges: [makeBadge()],
      },
      cloud: {
        sessions: [session],
        vocabulary: [makeVocab()],
        xpProfile: makeProfile({ totalXp: 50 }),
        xpEvents: [makeXpEvent()],
        badges: [makeBadge()],
      },
    });

    expect(plan.status).toBe("no-op");
    expect(plan.reasons).toHaveLength(0);
  });
});
