import type { ReinforcementScore } from "./reinforcementTypes";
import { calculateReinforcementScores } from "./reinforcementScoring";

export async function selectReinforcementWeakness(
  ownerId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: any,
  options?: { now?: Date }
): Promise<ReinforcementScore | null> {
  if (!supabaseClient) return null;

  try {
    const { data: sessions, error } = await supabaseClient
      .from("pattern_drill_sessions")
      .select("id, owner_id, target_pattern, phase2_accuracy, phase3_pressure_accuracy, pressure_fail_rate, saved_summary, created_at")
      .eq("owner_id", ownerId);

    if (error || !sessions || sessions.length === 0) {
      return null;
    }

    const now = options?.now || new Date();
    const scores = calculateReinforcementScores(sessions, now);

    // Filter to unresolved weaknesses with a score > 0
    const unresolved = scores.filter(s => !s.isResolved && s.score > 0);
    if (unresolved.length === 0) {
      return null;
    }

    // Sort by score descending, then lastPracticedAt descending
    unresolved.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return new Date(b.lastPracticedAt).getTime() - new Date(a.lastPracticedAt).getTime();
    });

    return unresolved[0];
  } catch (err) {
    console.error("Error in selectReinforcementWeakness:", err);
    return null;
  }
}
