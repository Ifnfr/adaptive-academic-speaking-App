import type { ReinforcementScore, DbSessionLike } from "./reinforcementTypes";

export function extractWeaknessInfo(session: DbSessionLike): { title: string; description: string } {
  const summary = session.saved_summary || {};
  
  let title = summary.weaknessLabel;
  if (!title && summary.weaknessUpdate) {
    title = summary.weaknessUpdate.label;
  }
  if (!title) {
    title = session.target_pattern || session.targetPattern || "Generic Drill";
  }

  let description = summary.weaknessDescription;
  if (!description && summary.weaknessUpdate) {
    description = summary.weaknessUpdate.practiceFocus;
  }
  if (!description) {
    description = session.target_pattern || session.targetPattern || "Generic Drill";
  }

  return { title, description };
}

export function calculateReinforcementScores(sessions: DbSessionLike[], now: Date = new Date()): ReinforcementScore[] {
  // Group sessions by weakness title
  const groups: Record<string, DbSessionLike[]> = {};
  for (const session of sessions) {
    const { title } = extractWeaknessInfo(session);
    if (!groups[title]) {
      groups[title] = [];
    }
    groups[title].push(session);
  }

  const scores: ReinforcementScore[] = [];

  for (const [title, groupSessions] of Object.entries(groups)) {
    // Sort sessions in the group from oldest to newest
    const sortedSessions = [...groupSessions].sort((a, b) => {
      const timeA = new Date(a.created_at || a.timestamp || a.createdAt || 0).getTime();
      const timeB = new Date(b.created_at || b.timestamp || b.createdAt || 0).getTime();
      return timeA - timeB;
    });

    let score = 0;
    let consecutiveSuccessCount = 0;
    let isResolved = false;
    let lastPracticedAt = new Date(0).toISOString();
    let weaknessDescription = "";

    for (const session of sortedSessions) {
      const { description } = extractWeaknessInfo(session);
      weaknessDescription = description;

      const createdAtStr = session.created_at || session.timestamp || session.createdAt;
      const createdAtDate = createdAtStr ? new Date(createdAtStr) : new Date();
      if (createdAtDate.getTime() > new Date(lastPracticedAt).getTime()) {
        lastPracticedAt = createdAtDate.toISOString();
      }

      const diffTime = now.getTime() - createdAtDate.getTime();
      const diffDays = Math.max(0, diffTime / (1000 * 60 * 60 * 24));
      
      let weight = 0.25;
      if (diffDays <= 7) {
        weight = 1.0;
      } else if (diffDays <= 30) {
        weight = 0.5;
      }

      const phase2Accuracy = typeof session.phase2_accuracy === "number" 
        ? session.phase2_accuracy 
        : (typeof session.phase2Accuracy === "number" ? session.phase2Accuracy : 0);
        
      const pressureFailRate = typeof session.pressure_fail_rate === "number" 
        ? session.pressure_fail_rate 
        : (typeof session.pressureFailRate === "number" ? session.pressureFailRate : null);

      const isSuccess = phase2Accuracy >= 75 && (pressureFailRate === null || pressureFailRate === undefined || pressureFailRate <= 25);

      if (isSuccess) {
        consecutiveSuccessCount++;
        score = Math.max(0, score - 5 * weight);
        if (consecutiveSuccessCount >= 2) {
          score = 0;
          isResolved = true;
        }
      } else {
        consecutiveSuccessCount = 0;
        score = score + 10 * weight;
        isResolved = false;
      }
    }

    scores.push({
      weaknessTitle: title,
      weaknessDescription,
      score,
      consecutiveSuccessCount,
      isResolved,
      lastPracticedAt,
    });
  }

  return scores;
}
