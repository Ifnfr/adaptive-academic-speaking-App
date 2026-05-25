type Level = "Foundation" | "Beginner" | "Intermediate" | "Advanced" | "Expert";

type Mode =
  | "Fluency Sprint"
  | "Argument Drill"
  | "Reading-to-Speaking"
  | "Debate"
  | "Diagnostic";

type SessionType = "Micro" | "Standard" | "Deep";

export type SpeakingPrompt = {
  task: string;
  constraints: string[];
  targetStructure: string;
  timeLimit: string;
};

const FOUNDATION_TASKS = [
  "Describe your morning routine without stopping. Focus on speaking continuously.",
  "Talk about a place you visit often. Just keep talking, even if you repeat yourself.",
  "Describe what is on your desk right now. Aim for steady, uninterrupted speech.",
];

const BEGINNER_TASKS = [
  "Share your opinion on whether students should learn a second language.",
  "Give your view on whether public transport is better than driving.",
  "Share your opinion on whether reading on paper is better than reading on a screen.",
];

const INTERMEDIATE_TASKS = [
  "Take a clear position on whether remote work is better than office work, and explain why.",
  "Take a clear position on whether AI tools should be allowed in schools, and explain why.",
  "Take a clear position on whether cities should ban single-use plastics, and explain why.",
];

const ADVANCED_TASKS = [
  "Defend the claim that universities should require basic statistics for all majors.",
  "Defend the claim that working from home long-term harms early-career professionals.",
  "Defend the claim that social media platforms should be liable for misinformation.",
];

const EXPERT_TASKS = [
  "Argue, with academic rigor, that climate adaptation deserves more public funding than mitigation.",
  "Argue, with academic rigor, that standardized testing should be redesigned rather than abolished.",
  "Argue, with academic rigor, that open-source AI models pose greater systemic risk than closed ones.",
];

function pickTaskByLevel(level: Level, variantIndex: number): string {
  const pool =
    level === "Foundation"
      ? FOUNDATION_TASKS
      : level === "Beginner"
        ? BEGINNER_TASKS
        : level === "Intermediate"
          ? INTERMEDIATE_TASKS
          : level === "Advanced"
            ? ADVANCED_TASKS
            : EXPERT_TASKS;
  return pool[variantIndex % pool.length];
}

function targetStructureForLevel(level: Level): string {
  switch (level) {
    case "Foundation":
      return "Speak continuously. No fixed structure required.";
    case "Beginner":
      return "Opinion → Reason → Example → Closing";
    case "Intermediate":
      return "Position → Reason → Example → Conclusion";
    case "Advanced":
      return "Claim → Evidence → Reasoning → Limitation";
    case "Expert":
      return "Claim → Warrant → Evidence → Limitation → Implication";
  }
}

function timeLimitForLevel(level: Level): string {
  switch (level) {
    case "Foundation":
      return "60-90 seconds";
    case "Beginner":
      return "60 seconds";
    case "Intermediate":
      return "60-90 seconds";
    case "Advanced":
      return "90-120 seconds";
    case "Expert":
      return "2-3 minutes";
  }
}

function constraintsFor(
  level: Level,
  mode: Mode,
  sessionType: SessionType,
  todayTarget: string,
): string[] {
  const out: string[] = [];

  if (mode === "Fluency Sprint") {
    out.push("Keep speaking without long pauses. Fluency over correctness.");
  } else if (mode === "Argument Drill") {
    out.push("Take one clear position and defend it.");
  } else if (mode === "Reading-to-Speaking") {
    out.push(
      "Paste a short excerpt into the transcript area first, then explain or critique it.",
    );
  } else if (mode === "Debate") {
    out.push(
      "State your position clearly so it could be challenged by an opponent later.",
    );
  }

  if (level === "Foundation") {
    out.push("Focus on volume of speech and basic coherence.");
    out.push("Grammar and vocabulary are NOT being evaluated this round.");
  } else if (level === "Beginner") {
    out.push("Use one short example to support your reason.");
  } else if (level === "Intermediate") {
    out.push("Use clear transitions between your reason and your example.");
  } else if (level === "Advanced") {
    out.push("Acknowledge at least one limitation of your own argument.");
  } else if (level === "Expert") {
    out.push("Name your warrant explicitly and address one counter-implication.");
  }

  if (sessionType === "Micro") {
    out.push("This is a micro session: keep it short and decisive.");
  } else if (sessionType === "Deep") {
    out.push("This is a deep session: organize your points before speaking.");
  }

  const trimmedTarget = todayTarget.trim();
  if (trimmedTarget.length > 0) {
    out.push(`Today's focus: ${trimmedTarget}`);
  }

  return out;
}

export function buildSpeakingPrompt(
  level: Level,
  mode: Mode,
  sessionType: SessionType,
  todayTarget: string,
  variantIndex: number,
): SpeakingPrompt {
  if (mode === "Diagnostic") {
    return {
      task:
        "Diagnostic baseline. Speak (or paste a combined transcript) covering all three sections in one go: " +
        "(A) a 60-second self-introduction including your learning goal, " +
        "(B) an explanation of one academic concept you recently learned, and " +
        "(C) a short opinion with one reason and one example.",
      constraints: [
        "Cover all three sections A, B, and C in one combined transcript.",
        "No sample answers will be given. Use your own current ability.",
        "Be specific. Mention real concepts, real reasons, real examples.",
        ...(todayTarget.trim().length > 0
          ? [`Today's focus: ${todayTarget.trim()}`]
          : []),
      ],
      targetStructure:
        "A: Self-introduction + goal · B: One concept explanation · C: Opinion + reason + example",
      timeLimit: "About 3-4 minutes total across all three sections",
    };
  }

  return {
    task: pickTaskByLevel(level, variantIndex),
    constraints: constraintsFor(level, mode, sessionType, todayTarget),
    targetStructure: targetStructureForLevel(level),
    timeLimit: timeLimitForLevel(level),
  };
}
