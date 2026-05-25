type Level = "Foundation" | "Beginner" | "Intermediate" | "Advanced" | "Expert";

type Mode =
  | "Fluency Sprint"
  | "Argument Drill"
  | "Reading-to-Speaking"
  | "Debate"
  | "Diagnostic";

type SessionType = "Micro" | "Standard" | "Deep";

type SessionForCoach = {
  date: string;
  mode: Mode;
  mainWeakness: string;
  retryTask: string;
};

type CoachRecommendation = {
  hasHistory: boolean;
  focus: string;
  recommendedMode: Mode;
  recommendedSessionType: SessionType;
  reason: string;
  nextAction: string;
};

function recommendedSessionTypeForLevel(level: Level): SessionType {
  if (level === "Foundation" || level === "Beginner") return "Micro";
  if (level === "Intermediate") return "Standard";
  return "Deep"; // Advanced, Expert
}

function pickModeFromText(text: string, level: Level): Mode {
  const t = text.toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));

  if (has("fluency", "pause", "hesitat", "continuity", "stopping", "stop", "filler")) {
    return "Fluency Sprint";
  }
  if (
    has("grammar", "sentence", "structure", "subject", "verb", "tense", "clarity")
  ) {
    if (level === "Foundation" || level === "Beginner") return "Fluency Sprint";
    return "Argument Drill";
  }
  if (
    has("argument", "reasoning", "evidence", "claim", "logic", "assumption", "coherence")
  ) {
    return "Argument Drill";
  }
  if (has("academic tone", "vocabulary", "phrase", "word choice", "formal")) {
    return "Argument Drill";
  }
  return "Fluency Sprint";
}

export function buildCoachRecommendation(
  sessions: ReadonlyArray<SessionForCoach>,
  currentLevel: Level,
): CoachRecommendation {
  const latest = sessions[0];

  if (!latest) {
    return {
      hasHistory: false,
      focus: "Build speaking volume",
      recommendedMode: "Fluency Sprint",
      recommendedSessionType: "Micro",
      reason:
        "No previous session data yet. Start by speaking consistently without over-focusing on accuracy.",
      nextAction:
        "Complete one session to unlock personalized recommendations.",
    };
  }

  const retryTask = latest.retryTask?.trim() ?? "";
  const mainWeakness = latest.mainWeakness?.trim() ?? "";
  const focus =
    retryTask.length > 0
      ? retryTask
      : mainWeakness.length > 0
        ? mainWeakness
        : "Build consistent speaking practice.";

  const sourceText = `${retryTask} ${mainWeakness}`.trim();
  let recommendedMode: Mode = pickModeFromText(sourceText, currentLevel);
  if (sourceText.length === 0) {
    recommendedMode = latest.mode ?? "Fluency Sprint";
  }

  const recommendedSessionType = recommendedSessionTypeForLevel(currentLevel);

  const reason =
    `Based on your last session on ${latest.date}, the main weakness was: "${
      mainWeakness || "(not recorded)"
    }". Working on ${recommendedMode.toLowerCase()} should reinforce the retry task directly.`;

  const nextAction =
    "Click Use Recommendation to load this focus into Session setup, then Start Session.";

  return {
    hasHistory: true,
    focus,
    recommendedMode,
    recommendedSessionType,
    reason,
    nextAction,
  };
}
