import type { SupabaseClient } from "@supabase/supabase-js";

export const SUB_SKILLS = [
  "gist",
  "detail",
  "inference",
  "speaker-attitude",
  "paraphrase-recognition",
] as const;

export type SubSkill = (typeof SUB_SKILLS)[number];

export const MIN_SAMPLE_SIZE = 8;

export interface SubSkillMetric {
  subSkill: SubSkill;
  count: number;
  correctCount: number;
  accuracy: number; // correctCount / count, 0 if count is 0
  eligible: boolean; // true when count >= MIN_SAMPLE_SIZE
}

export async function computeSubSkillMetrics(
  supabase: SupabaseClient,
  ownerId: string
): Promise<SubSkillMetric[]> {
  try {
    // Note: this aggregates ALL-TIME attempts with no session/date windowing, as an intentional simplification given limited historical data as of this feature's launch — revisit with a rolling window (similar to Word Builder's 20-session window) if stale weakness signals become an issue once more usage history accumulates.
    const { data, error } = await supabase
      .from("listening_exercise_question_attempts")
      .select("sub_skill, is_correct")
      .eq("owner_id", ownerId)
      .not("sub_skill", "is", null);

    if (error) {
      console.error("computeSubSkillMetrics: failed to fetch attempts", error);
      return SUB_SKILLS.map((subSkill) => ({
        subSkill,
        count: 0,
        correctCount: 0,
        accuracy: 0,
        eligible: false,
      }));
    }

    const counts = new Map<SubSkill, number>();
    const correctCounts = new Map<SubSkill, number>();

    for (const subSkill of SUB_SKILLS) {
      counts.set(subSkill, 0);
      correctCounts.set(subSkill, 0);
    }

    if (data) {
      for (const row of data) {
        const subSkill = row.sub_skill as SubSkill;
        if (counts.has(subSkill)) {
          counts.set(subSkill, counts.get(subSkill)! + 1);
          if (row.is_correct) {
            correctCounts.set(subSkill, correctCounts.get(subSkill)! + 1);
          }
        }
      }
    }

    return SUB_SKILLS.map((subSkill) => {
      const count = counts.get(subSkill) || 0;
      const correctCount = correctCounts.get(subSkill) || 0;
      const accuracy = count > 0 ? correctCount / count : 0;
      const eligible = count >= MIN_SAMPLE_SIZE;

      return {
        subSkill,
        count,
        correctCount,
        accuracy,
        eligible,
      };
    });
  } catch (err) {
    console.error("computeSubSkillMetrics: unexpected error", err);
    return SUB_SKILLS.map((subSkill) => ({
      subSkill,
      count: 0,
      correctCount: 0,
      accuracy: 0,
      eligible: false,
    }));
  }
}

export async function getWeakestEligibleSubSkill(
  supabase: SupabaseClient,
  ownerId: string
): Promise<SubSkill | null> {
  const metrics = await computeSubSkillMetrics(supabase, ownerId);
  const eligibleMetrics = metrics.filter((m) => m.eligible);

  if (eligibleMetrics.length === 0) {
    return null;
  }

  eligibleMetrics.sort((a, b) => {
    if (a.accuracy !== b.accuracy) {
      return a.accuracy - b.accuracy;
    }
    if (a.count !== b.count) {
      return b.count - a.count;
    }
    return 0;
  });

  return eligibleMetrics[0].subSkill;
}
