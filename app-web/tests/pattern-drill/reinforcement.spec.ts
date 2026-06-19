import { expect, test } from "@playwright/test";
import { calculateReinforcementScores } from "../../src/app/lib/drill-session/reinforcement/reinforcementScoring";
import { selectReinforcementWeakness } from "../../src/app/lib/drill-session/reinforcement/reinforcementSelector";

test.describe("Reinforcement Scoring Utility", () => {
  const now = new Date("2026-06-19T12:00:00Z");

  test("calculates score correctly: failures increase, successes decrease", () => {
    // failure: phase2Accuracy < 75%
    // 3 days ago = diff <= 7 days (weight 1.0)
    // 10 days ago = diff 8-30 days (weight 0.5)
    // 40 days ago = diff > 30 days (weight 0.25)
    
    const sessions = [
      {
        target_pattern: "Transition Framing",
        phase2_accuracy: 50, // failure: +10 * 0.25 = +2.5
        created_at: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        target_pattern: "Transition Framing",
        phase2_accuracy: 60, // failure: +10 * 0.5 = +5.0 (total 7.5)
        created_at: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        target_pattern: "Transition Framing",
        phase2_accuracy: 80, // success: -5 * 1.0 = -5.0 (total 2.5)
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      }
    ];

    const scores = calculateReinforcementScores(sessions, now);
    expect(scores.length).toBe(1);
    expect(scores[0].weaknessTitle).toBe("Transition Framing");
    expect(scores[0].score).toBeCloseTo(2.5, 5);
    expect(scores[0].consecutiveSuccessCount).toBe(1);
    expect(scores[0].isResolved).toBe(false);
  });

  test("exit rule: resets to 0 and resolves after 2 consecutive successes", () => {
    const sessions = [
      {
        target_pattern: "Transition Framing",
        phase2_accuracy: 50, // failure
        created_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        target_pattern: "Transition Framing",
        phase2_accuracy: 80, // success 1
        created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        target_pattern: "Transition Framing",
        phase2_accuracy: 90, // success 2 (resolves!)
        created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      }
    ];

    const scores = calculateReinforcementScores(sessions, now);
    expect(scores[0].score).toBe(0);
    expect(scores[0].consecutiveSuccessCount).toBe(2);
    expect(scores[0].isResolved).toBe(true);
  });

  test("failed pressure raises reinforcement score", () => {
    const sessions = [
      {
        target_pattern: "Transition Framing",
        phase2_accuracy: 80, // Phase 2 success
        pressure_fail_rate: 50, // Phase 3 fail rate > 25% (overall failure!)
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      }
    ];

    const scores = calculateReinforcementScores(sessions, now);
    expect(scores[0].score).toBe(10); // weight 1.0 * 10
    expect(scores[0].isResolved).toBe(false);
  });
});

test.describe("Reinforcement Selector", () => {
  const now = new Date("2026-06-19T12:00:00Z");

  test("unresolved weakness wins selectReinforcementWeakness", async () => {
    const sessions = [
      {
        target_pattern: "Weakness A",
        phase2_accuracy: 50, // failure, +10 * 1.0 = 10
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        target_pattern: "Weakness B",
        phase2_accuracy: 60, // failure, +10 * 0.5 = 5
        created_at: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      }
    ];

    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: sessions, error: null }),
        }),
      }),
    };

    const selected = await selectReinforcementWeakness("user-123", mockSupabase, { now });
    expect(selected).not.toBeNull();
    expect(selected?.weaknessTitle).toBe("Weakness A"); // Higher score (10 vs 5)
  });

  test("resolved weakness loses priority in selector", async () => {
    const sessions = [
      {
        target_pattern: "Weakness A",
        phase2_accuracy: 80, // success 1
        created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        target_pattern: "Weakness A",
        phase2_accuracy: 80, // success 2 -> resolved
        created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        target_pattern: "Weakness B",
        phase2_accuracy: 50, // failure
        created_at: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      }
    ];

    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: sessions, error: null }),
        }),
      }),
    };

    const selected = await selectReinforcementWeakness("user-123", mockSupabase, { now });
    expect(selected).not.toBeNull();
    expect(selected?.weaknessTitle).toBe("Weakness B"); // A is resolved, so B wins
  });
});
