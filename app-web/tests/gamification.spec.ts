import { expect, test } from "@playwright/test";
import {
  DAILY_XP_CAP,
  XP_RULES,
  awardXpEvent,
  createDefaultXpProfile,
  createXpEvent,
  normalizeXpEvents,
  xpEventTypeForPodchatDifficulty,
  type XpEvent,
} from "../src/app/lib/gamification";

function makeEvent(
  type: keyof typeof XP_RULES,
  sourceId: string,
  localDate = "2026-06-13",
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
  });
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
