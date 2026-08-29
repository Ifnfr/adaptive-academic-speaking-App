import { expect, test } from "@playwright/test";
import {
  DEFERRED_WEEKLY_MISSION_METRIC_TYPES,
  WEEKLY_MISSION_METRIC_TYPES,
  classifyWeeklyMissionDataSufficiency,
  createWeeklyMissionId,
  deriveWeeklyMissionStatus,
  getWeeklyMissionPeriod,
  isWeeklyMissionMetricType,
  validateWeeklyMissionTarget,
} from "../../src/app/lib/weekly-review-missions";

test.describe("Weekly Review mission helpers", () => {
  test("accepts enabled metrics and rejects deferred metrics as active", () => {
    for (const metricType of WEEKLY_MISSION_METRIC_TYPES) {
      expect(isWeeklyMissionMetricType(metricType)).toBe(true);
    }

    for (const metricType of DEFERRED_WEEKLY_MISSION_METRIC_TYPES) {
      expect(isWeeklyMissionMetricType(metricType)).toBe(false);
    }
  });

  test("returns deterministic UTC Monday-Sunday week boundaries", () => {
    const period = getWeeklyMissionPeriod({
      now: new Date("2026-06-18T12:34:56.000Z"),
    });

    expect(period).toEqual({
      weekStart: "2026-06-15",
      weekEnd: "2026-06-21",
      nextReviewAvailableAt: "2026-06-22T00:00:00.000Z",
      timezone: "UTC",
    });
  });

  test("treats timezone as metadata while keeping UTC calculations", () => {
    const period = getWeeklyMissionPeriod({
      now: new Date("2026-06-18T12:34:56.000Z"),
      timezone: "Asia/Jakarta",
    });

    expect(period.weekStart).toBe("2026-06-15");
    expect(period.weekEnd).toBe("2026-06-21");
    expect(period.nextReviewAvailableAt).toBe("2026-06-22T00:00:00.000Z");
    expect(period.timezone).toBe("Asia/Jakarta");
  });

  test("handles Monday and Sunday boundary dates", () => {
    const monday = getWeeklyMissionPeriod({
      now: new Date("2026-06-15T00:00:00.000Z"),
    });
    const sunday = getWeeklyMissionPeriod({
      now: new Date("2026-06-21T23:59:59.999Z"),
    });

    expect(monday.weekStart).toBe("2026-06-15");
    expect(monday.weekEnd).toBe("2026-06-21");
    expect(sunday.weekStart).toBe("2026-06-15");
    expect(sunday.weekEnd).toBe("2026-06-21");
  });

  test("derives completed mission status", () => {
    expect(
      deriveWeeklyMissionStatus({
        currentValue: 10,
        targetValue: 10,
        now: new Date("2026-06-18T00:00:00.000Z"),
        weekEnd: "2026-06-21",
      }),
    ).toBe("completed");
  });

  test("derives not_started, in_progress, expired, and carried_over statuses", () => {
    const now = new Date("2026-06-18T00:00:00.000Z");

    expect(
      deriveWeeklyMissionStatus({ currentValue: 0, targetValue: 5, now, weekEnd: "2026-06-21" }),
    ).toBe("not_started");
    expect(
      deriveWeeklyMissionStatus({ currentValue: 2, targetValue: 5, now, weekEnd: "2026-06-21" }),
    ).toBe("in_progress");
    expect(
      deriveWeeklyMissionStatus({
        currentValue: 2,
        targetValue: 5,
        now: new Date("2026-06-22T00:00:00.000Z"),
        weekEnd: "2026-06-21",
      }),
    ).toBe("expired");
    expect(
      deriveWeeklyMissionStatus({
        currentValue: 2,
        targetValue: 5,
        now: new Date("2026-06-22T00:00:00.000Z"),
        weekEnd: "2026-06-21",
        carriedOver: true,
      }),
    ).toBe("carried_over");
  });

  test("normalizes negative current value and handles invalid target status", () => {
    const now = new Date("2026-06-18T00:00:00.000Z");

    expect(
      deriveWeeklyMissionStatus({ currentValue: -10, targetValue: 5, now, weekEnd: "2026-06-21" }),
    ).toBe("not_started");
    expect(
      deriveWeeklyMissionStatus({ currentValue: 10, targetValue: 0, now, weekEnd: "2026-06-21" }),
    ).toBe("in_progress");
    expect(
      deriveWeeklyMissionStatus({
        currentValue: 10,
        targetValue: -1,
        now: new Date("2026-06-22T00:00:00.000Z"),
        weekEnd: "2026-06-21",
      }),
    ).toBe("expired");
  });

  test("validates and clamps target values for every enabled metric", () => {
    for (const metricType of WEEKLY_MISSION_METRIC_TYPES) {
      const below = validateWeeklyMissionTarget({
        metricType,
        proposedTargetValue: Number.NEGATIVE_INFINITY,
      });
      const valid = validateWeeklyMissionTarget({
        metricType,
        proposedTargetValue: below.min,
      });
      const above = validateWeeklyMissionTarget({
        metricType,
        proposedTargetValue: Number.POSITIVE_INFINITY,
      });

      expect(below.targetValue).toBe(below.min);
      expect(below.wasClamped).toBe(true);
      expect(valid.targetValue).toBe(valid.min);
      expect(valid.wasClamped).toBe(false);
      expect(above.targetValue).toBe(above.min);
      expect(above.wasClamped).toBe(true);
    }
  });

  test("clamps below min, above max, and preserves valid target", () => {
    expect(
      validateWeeklyMissionTarget({
        metricType: "speaking_minutes",
        proposedTargetValue: 1,
      }),
    ).toMatchObject({ targetValue: 15, wasClamped: true, min: 15, max: 180 });

    expect(
      validateWeeklyMissionTarget({
        metricType: "speaking_minutes",
        proposedTargetValue: 999,
      }),
    ).toMatchObject({ targetValue: 180, wasClamped: true, min: 15, max: 180 });

    expect(
      validateWeeklyMissionTarget({
        metricType: "speaking_minutes",
        proposedTargetValue: 60,
      }),
    ).toMatchObject({ targetValue: 60, wasClamped: false, min: 15, max: 180 });
  });

  test("handles invalid target values explicitly", () => {
    for (const proposedTargetValue of [0, -1, Number.NaN, Infinity, -Infinity]) {
      const result = validateWeeklyMissionTarget({
        metricType: "daily_practice_days",
        proposedTargetValue,
      });

      expect(result.targetValue).toBe(1);
      expect(result.wasClamped).toBe(true);
      expect(result.min).toBe(1);
      expect(result.max).toBe(7);
    }
  });

  test("classifies starter data sufficiency for no or trivial activity", () => {
    expect(
      classifyWeeklyMissionDataSufficiency({
        completedPodchatSessions: 0,
        speakingMinutes: 0,
        activeDays: 0,
        vocabularyItemsCollected: 0,
        articlePracticeCompleted: 0,
        repeatedWeaknessCount: 0,
      }),
    ).toBe("starter");

    expect(
      classifyWeeklyMissionDataSufficiency({
        completedPodchatSessions: 0,
        speakingMinutes: 0,
        activeDays: 1,
        vocabularyItemsCollected: 0,
        articlePracticeCompleted: 0,
        repeatedWeaknessCount: 0,
      }),
    ).toBe("starter");
  });

  test("classifies partial and strong data sufficiency", () => {
    expect(
      classifyWeeklyMissionDataSufficiency({
        completedPodchatSessions: 1,
        speakingMinutes: 12,
        activeDays: 2,
        vocabularyItemsCollected: 4,
        articlePracticeCompleted: 0,
        repeatedWeaknessCount: 0,
      }),
    ).toBe("partial");

    expect(
      classifyWeeklyMissionDataSufficiency({
        completedPodchatSessions: 2,
        speakingMinutes: 20,
        activeDays: 2,
        vocabularyItemsCollected: 0,
        articlePracticeCompleted: 0,
        repeatedWeaknessCount: 1,
      }),
    ).toBe("strong");
  });

  test("creates stable mission IDs without exposing owner ID", () => {
    const input = {
      ownerId: "user_secret_123",
      weekStart: "2026-06-15",
      metricType: "speaking_minutes" as const,
      index: 0,
    };

    const first = createWeeklyMissionId(input);
    const second = createWeeklyMissionId(input);
    const differentWeek = createWeeklyMissionId({ ...input, weekStart: "2026-06-22" });
    const differentMetric = createWeeklyMissionId({ ...input, metricType: "podchat_sessions" });
    const differentIndex = createWeeklyMissionId({ ...input, index: 1 });

    expect(first).toBe(second);
    expect(first).not.toBe(differentWeek);
    expect(first).not.toBe(differentMetric);
    expect(first).not.toBe(differentIndex);
    expect(first).not.toContain("user_secret_123");
  });
});
