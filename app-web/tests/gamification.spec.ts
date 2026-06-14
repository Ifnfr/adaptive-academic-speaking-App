import { expect, test } from "@playwright/test";
import {
  BADGE_DEFINITIONS,
  DAILY_XP_CAP,
  SPEAKER_LEVELS,
  XP_RULES,
  awardXpEvent,
  createDefaultXpProfile,
  createXpEvent,
  deriveUnlockedBadges,
  getSpeakerLevelProgress,
  normalizeXpEvents,
  xpEventTypeForPodchatDifficulty,
  type Badge,
  type XpEvent,
} from "../src/app/lib/gamification";

function makeEvent(
  type: keyof typeof XP_RULES,
  sourceId: string,
  localDate = "2026-06-13",
  reason: string = type,
): XpEvent {
  return createXpEvent({
    type,
    sourceId,
    sourceKind:
      type.startsWith("commonplace")
        ? "commonplace"
        : type.startsWith("article")
          ? "article"
          : type.startsWith("daily")
            ? "daily-activity"
            : type.startsWith("vocab")
              ? "vocabulary"
              : "session",
    localDate,
    createdAt: `${localDate}T01:00:00.000Z`,
    reason,
  });
}

function badgeIds(badges: ReadonlyArray<Badge>): string[] {
  return badges.map((badge) => badge.id);
}

function localDateFromUtcOffset(startDate: string, offsetDays: number): string {
  const date = new Date(`${startDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

test.describe("XP-2 gamification reward rules", () => {
  test("uses the approved XP-2 reward values and daily cap", () => {
    expect(DAILY_XP_CAP).toBe(220);
    expect(XP_RULES).toMatchObject({
      podchat_beginner_evaluated: { xp: 30, dailyCap: 10 },
      podchat_intermediate_evaluated: { xp: 50, dailyCap: 10 },
      podchat_advanced_evaluated: { xp: 75, dailyCap: 10 },
      podchat_expert_evaluated: { xp: 100, dailyCap: 10 },
      podchat_context_bonus: { xp: 15, dailyCap: 10 },
      podchat_retry_completed: { xp: 20, dailyCap: 3 },
      article_essay_evaluated: { xp: 60, dailyCap: 5 },
      article_vocab_saved: { xp: 10, dailyCap: 5 },
      vocab_item_added: { xp: 10, dailyCap: 10 },
      vocab_completeness_bonus: { xp: 5, dailyCap: 5 },
      vocab_sentence_submitted: { xp: 15, dailyCap: 10 },
      vocab_correction_saved: { xp: 20, dailyCap: 5 },
      vocab_recall_session_completed: { xp: 40, dailyCap: 2 },
      commonplace_note_created: { xp: 15, dailyCap: 8 },
      commonplace_note_completeness_bonus: { xp: 5, dailyCap: 8 },
      commonplace_map_note_added: { xp: 5, dailyCap: 10 },
      commonplace_map_edge_created: { xp: 10, dailyCap: 10 },
      weekly_review_completed: { xp: 80, dailyCap: 1 },
      daily_meaningful_activity: { xp: 20, dailyCap: 1 },
    });
  });

  test("maps Podchat difficulties to their approved event types", () => {
    expect(xpEventTypeForPodchatDifficulty("Beginner")).toBe(
      "podchat_beginner_evaluated",
    );
    expect(xpEventTypeForPodchatDifficulty("Intermediate")).toBe(
      "podchat_intermediate_evaluated",
    );
    expect(xpEventTypeForPodchatDifficulty("Advanced")).toBe(
      "podchat_advanced_evaluated",
    );
    expect(xpEventTypeForPodchatDifficulty("Expert")).toBe(
      "podchat_expert_evaluated",
    );
  });

  test("prevents duplicate type/source awards", () => {
    const profile = createDefaultXpProfile("2026-06-13");
    const event = makeEvent("article_essay_evaluated", "article-essay-1");
    const first = awardXpEvent(profile, [], event);
    const duplicate = awardXpEvent(first.profile, first.events, event);

    expect(first.result).toMatchObject({ allowed: true, xpToAward: 60 });
    expect(duplicate.result).toMatchObject({ allowed: false, xpToAward: 0 });
    expect(duplicate.events).toHaveLength(1);
  });

  test("enforces per-event caps", () => {
    let profile = createDefaultXpProfile("2026-06-13");
    let events: XpEvent[] = [];

    for (let index = 0; index < 3; index += 1) {
      const awarded = awardXpEvent(
        profile,
        events,
        makeEvent("podchat_retry_completed", `retry-${index}`),
      );
      profile = awarded.profile;
      events = awarded.events;
      expect(awarded.result.allowed).toBe(true);
    }

    const capped = awardXpEvent(
      profile,
      events,
      makeEvent("podchat_retry_completed", "retry-4"),
    );
    expect(capped.result).toMatchObject({ allowed: false, xpToAward: 0 });
  });

  test("caps the final award at the remaining global daily XP", () => {
    const profile = createDefaultXpProfile("2026-06-13");
    const existingEvents = [
      makeEvent("podchat_expert_evaluated", "session-1"),
      makeEvent("article_essay_evaluated", "essay-1"),
      makeEvent("vocab_recall_session_completed", "recall-1"),
    ].map((event) => ({ ...event, xp: XP_RULES[event.type].xp }));

    const awarded = awardXpEvent(
      { ...profile, pendingDailyXp: 200 },
      existingEvents,
      makeEvent("weekly_review_completed", "weekly-1"),
    );

    expect(awarded.result).toMatchObject({
      allowed: true,
      xpToAward: 20,
    });
    expect(awarded.profile.pendingDailyXp).toBe(220);
  });

  test("keeps legacy event strings load-compatible", () => {
    const legacy = normalizeXpEvents([
      {
        version: 1,
        id: "legacy-session",
        type: "normal_session_completed",
        xp: 40,
        localDate: "2026-06-13",
        createdAt: "2026-06-13T01:00:00.000Z",
        sourceId: "session-1",
        sourceKind: "session",
        reason: "Legacy completed session.",
      },
    ]);

    expect(legacy).toHaveLength(1);
    expect(legacy[0]).toMatchObject({
      type: "normal_session_completed",
      xp: 40,
    });
  });
});

test.describe("XP-3 level progression", () => {
  test("uses the approved 10-level thresholds while keeping level names", () => {
    expect(SPEAKER_LEVELS.map((level) => level.requiredXp)).toEqual([
      0, 100, 250, 500, 900, 1500, 2500, 4000, 6500, 10000,
    ]);
    expect(SPEAKER_LEVELS.map((level) => level.name)).toEqual([
      "New Speaker",
      "Practicing Speaker",
      "Developing Speaker",
      "Structured Speaker",
      "Consistent Speaker",
      "Clear Communicator",
      "Analytical Speaker",
      "Confident Speaker",
      "Advanced Communicator",
      "Academic Speaker",
    ]);
  });

  test("calculates next-level progress and max-level behavior", () => {
    expect(getSpeakerLevelProgress(99)).toMatchObject({
      currentLevel: { level: 1, name: "New Speaker", requiredXp: 0 },
      nextLevel: { level: 2, requiredXp: 100 },
      xpIntoLevel: 99,
      xpNeededForNext: 1,
    });
    expect(getSpeakerLevelProgress(100)).toMatchObject({
      currentLevel: { level: 2, name: "Practicing Speaker", requiredXp: 100 },
      nextLevel: { level: 3, requiredXp: 250 },
      xpIntoLevel: 0,
      xpNeededForNext: 150,
    });
    expect(getSpeakerLevelProgress(10000)).toMatchObject({
      currentLevel: { level: 10, name: "Academic Speaker", requiredXp: 10000 },
      nextLevel: null,
      xpNeededForNext: 0,
      progressRatio: 1,
    });
  });
});

test.describe("XP-3 badge criteria", () => {
  const earnedAt = "2026-06-13T02:00:00.000Z";
  const profile = { ...createDefaultXpProfile("2026-06-13"), totalXp: 10000 };

  test("defines the approved XP-3 badge IDs", () => {
    expect(Object.keys(BADGE_DEFINITIONS)).toEqual([
      "first_voice",
      "consistent_speaker_i",
      "consistent_speaker_ii",
      "consistent_speaker_iii",
      "advanced_voice",
      "research_speaker",
      "vocabulary_builder_i",
      "vocabulary_builder_ii",
      "vocabulary_builder_iii",
      "sentence_refiner",
      "recall_runner",
      "first_commonplace",
      "map_thinker",
      "connector",
      "synthesis_builder",
      "three_day_rhythm",
      "seven_day_rhythm",
      "monthly_practice_habit",
      "first_weekly_reflector",
      "reflective_learner",
      "monthly_reviewer",
      "academic_speaker",
      "resilient_learner",
      "connected_thinker",
    ]);
  });

  test("unlocks speaking, consistency, weekly, and mastery badges from XP events", () => {
    const activeDays = Array.from({ length: 30 }, (_, index) =>
      makeEvent(
        "daily_meaningful_activity",
        `daily-${index}`,
        localDateFromUtcOffset("2026-05-15", index),
      ),
    );
    const events = [
      makeEvent("podchat_beginner_evaluated", "session-first"),
      ...Array.from({ length: 10 }, (_, index) =>
        makeEvent("podchat_advanced_evaluated", `advanced-${index}`),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        makeEvent("podchat_context_bonus", `context-${index}`),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        makeEvent(
          "podchat_context_bonus",
          `commonplace-context-${index}`,
          "2026-06-13",
          "Completed an evaluated Commonplace-based Podchat session.",
        ),
      ),
      ...Array.from({ length: 20 }, (_, index) =>
        makeEvent("podchat_retry_completed", `retry-${index}`),
      ),
      ...Array.from({ length: 8 }, (_, index) =>
        makeEvent("weekly_review_completed", `weekly-${index}`),
      ),
      ...activeDays,
    ];

    const badges = deriveUnlockedBadges({
      existingBadges: [],
      events,
      profile,
      today: "2026-06-13",
      earnedAt,
    });

    expect(badgeIds(badges)).toEqual(
      expect.arrayContaining([
        "first_voice",
        "consistent_speaker_i",
        "consistent_speaker_ii",
        "consistent_speaker_iii",
        "advanced_voice",
        "research_speaker",
        "three_day_rhythm",
        "seven_day_rhythm",
        "monthly_practice_habit",
        "first_weekly_reflector",
        "reflective_learner",
        "monthly_reviewer",
        "academic_speaker",
        "resilient_learner",
        "connected_thinker",
      ]),
    );
    expect(badges.every((badge) => badge.earnedAt === earnedAt)).toBe(true);
  });

  test("unlocks vocabulary and Commonplace badges from meaningful saved actions", () => {
    const events = [
      ...Array.from({ length: 60 }, (_, index) =>
        makeEvent("vocab_item_added", `vocab-${index}`),
      ),
      ...Array.from({ length: 40 }, (_, index) =>
        makeEvent("article_vocab_saved", `article-vocab-${index}`),
      ),
      ...Array.from({ length: 25 }, (_, index) =>
        makeEvent("vocab_correction_saved", `correction-${index}`),
      ),
      ...Array.from({ length: 10 }, (_, index) =>
        makeEvent("vocab_recall_session_completed", `recall-${index}`),
      ),
      makeEvent("commonplace_note_created", "note-1"),
      makeEvent("commonplace_map_note_added", "commonplace-sub-map-note-map1-node1-note1"),
      makeEvent("commonplace_map_note_added", "commonplace-sub-map-note-map1-node2-note2"),
      makeEvent("commonplace_map_note_added", "commonplace-main-map-note-main1-node1-note1"),
      makeEvent("commonplace_map_note_added", "commonplace-main-map-note-main1-node2-note2"),
      ...Array.from({ length: 25 }, (_, index) =>
        makeEvent("commonplace_map_edge_created", `commonplace-main-map-edge-main1-edge${index}`),
      ),
    ];

    const badges = deriveUnlockedBadges({
      existingBadges: [],
      events,
      profile: createDefaultXpProfile("2026-06-13"),
      today: "2026-06-13",
      earnedAt,
    });

    expect(badgeIds(badges)).toEqual(
      expect.arrayContaining([
        "vocabulary_builder_i",
        "vocabulary_builder_ii",
        "vocabulary_builder_iii",
        "sentence_refiner",
        "recall_runner",
        "first_commonplace",
        "map_thinker",
        "connector",
        "synthesis_builder",
      ]),
    );
  });

  test("dedupes type/source counts and preserves existing legacy badges", () => {
    const legacyBadge: Badge = {
      version: 1,
      id: "first_session",
      label: "First Session",
      description: "Completed first speaking session.",
      status: "earned",
      earnedAt: "2026-06-01T01:00:00.000Z",
    };
    const duplicate = makeEvent("podchat_beginner_evaluated", "session-1");
    const badges = deriveUnlockedBadges({
      existingBadges: [legacyBadge],
      events: [duplicate, { ...duplicate, id: "duplicate-event" }],
      profile: createDefaultXpProfile("2026-06-13"),
      today: "2026-06-13",
      earnedAt,
    });

    expect(badges).toContainEqual(legacyBadge);
    expect(badgeIds(badges).filter((id) => id === "first_voice")).toHaveLength(1);
    expect(badgeIds(badges)).not.toContain("first_mental_model");
  });
});
