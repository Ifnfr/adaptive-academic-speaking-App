type Level = "Foundation" | "Beginner" | "Intermediate" | "Advanced" | "Expert";

type ScoreKey =
  | "fluency"
  | "grammar"
  | "vocabulary"
  | "coherence"
  | "argument"
  | "academicTone";

type SessionForLevelUp = {
  level: Level;
  csv: string;
};

export type LevelUpStatus =
  | "Ready"
  | "Almost ready"
  | "Not ready yet"
  | "Max level reached";

type LevelUpRequirement = {
  key: ScoreKey;
  threshold: number;
};

type ParsedCsvScores = Partial<Record<ScoreKey, number>>;

export type LevelUpCheckResult = {
  currentLevel: Level;
  nextLevel: Level | null;
  status: LevelUpStatus;
  evidence: string[];
  missingRequirements: string[];
  recommendedNextAction: string;
  averages: Partial<Record<ScoreKey, number>>;
  requiredSessionCount: number;
  validSessionCount: number;
};

const SCORE_LABELS: Record<ScoreKey, string> = {
  fluency: "Fluency",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  coherence: "Coherence",
  argument: "Argument",
  academicTone: "Academic Tone",
};

const LEVEL_UP_RULES: Partial<
  Record<
    Level,
    {
      nextLevel: Level;
      requiredSessions: number;
      requirements: LevelUpRequirement[];
    }
  >
> = {
  Foundation: {
    nextLevel: "Beginner",
    requiredSessions: 3,
    requirements: [
      { key: "fluency", threshold: 3 },
      { key: "coherence", threshold: 3 },
    ],
  },
  Beginner: {
    nextLevel: "Intermediate",
    requiredSessions: 3,
    requirements: [
      { key: "fluency", threshold: 3 },
      { key: "grammar", threshold: 3 },
      { key: "coherence", threshold: 3 },
    ],
  },
  Intermediate: {
    nextLevel: "Advanced",
    requiredSessions: 4,
    requirements: [
      { key: "fluency", threshold: 3.5 },
      { key: "grammar", threshold: 3 },
      { key: "vocabulary", threshold: 3 },
      { key: "coherence", threshold: 3.5 },
      { key: "argument", threshold: 3 },
      { key: "academicTone", threshold: 3 },
    ],
  },
  Advanced: {
    nextLevel: "Expert",
    requiredSessions: 5,
    requirements: [
      { key: "fluency", threshold: 4 },
      { key: "grammar", threshold: 4 },
      { key: "vocabulary", threshold: 4 },
      { key: "coherence", threshold: 4 },
      { key: "argument", threshold: 4 },
      { key: "academicTone", threshold: 4 },
    ],
  },
};

function parseCsvLine(line: string): string[] | null {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(cell);
      cell = "";
      continue;
    }

    cell += char;
  }

  if (inQuotes) return null;
  cells.push(cell);
  return cells;
}

function csvLogicalRows(csv: string): string[] | null {
  const rows: string[] = [];
  let row = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"') {
      row += char;
      if (inQuotes && next === '"') {
        row += next;
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (row.trim().length > 0) rows.push(row);
      row = "";
      if (char === "\r" && next === "\n") i += 1;
      continue;
    }

    row += char;
  }

  if (inQuotes) return null;
  if (row.trim().length > 0) rows.push(row);
  return rows;
}

function scoreKeyFromHeader(header: string): ScoreKey | null {
  const normalized = header.replace(/[\s_]/g, "").toLowerCase();
  switch (normalized) {
    case "fluency":
      return "fluency";
    case "grammar":
      return "grammar";
    case "vocabulary":
      return "vocabulary";
    case "coherence":
      return "coherence";
    case "argument":
      return "argument";
    case "academictone":
      return "academicTone";
    default:
      return null;
  }
}

function parseSessionCsvScores(csv: string): ParsedCsvScores | null {
  const rows = csvLogicalRows(csv);
  if (!rows || rows.length < 2) return null;

  const header = parseCsvLine(rows[0]);
  const values = parseCsvLine(rows[1]);
  if (!header || !values) return null;

  const scores: ParsedCsvScores = {};
  for (let i = 0; i < header.length; i++) {
    const key = scoreKeyFromHeader(header[i]);
    if (!key) continue;

    const value = Number(values[i]);
    if (Number.isFinite(value)) {
      scores[key] = value;
    }
  }

  return scores;
}

function hasRequiredScores(
  scores: ParsedCsvScores,
  requirements: LevelUpRequirement[],
): boolean {
  return requirements.every((req) => typeof scores[req.key] === "number");
}

function averageScore(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatScore(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

export function buildLevelUpCheck(
  sessions: ReadonlyArray<SessionForLevelUp>,
  currentLevel: Level,
): LevelUpCheckResult {
  if (currentLevel === "Expert") {
    return {
      currentLevel,
      nextLevel: null,
      status: "Max level reached",
      evidence: ["Expert is the highest level in the current fonetik ladder."],
      missingRequirements: [],
      recommendedNextAction:
        "Focus next on: maintain consistency with advanced academic practice and harder prompts.",
      averages: {},
      requiredSessionCount: 0,
      validSessionCount: 0,
    };
  }

  const rule = LEVEL_UP_RULES[currentLevel];
  if (!rule) {
    return {
      currentLevel,
      nextLevel: null,
      status: "Not ready yet",
      evidence: [],
      missingRequirements: ["No level-up rule is configured for this level."],
      recommendedNextAction: "Focus next on: complete more sessions at this level.",
      averages: {},
      requiredSessionCount: 0,
      validSessionCount: 0,
    };
  }

  const validScores = sessions
    .filter((session) => session.level === currentLevel)
    .map((session) => parseSessionCsvScores(session.csv))
    .filter((scores): scores is ParsedCsvScores =>
      scores !== null && hasRequiredScores(scores, rule.requirements),
    );

  const recentScores = validScores.slice(0, rule.requiredSessions);
  const validSessionCount = recentScores.length;

  if (validSessionCount < rule.requiredSessions) {
    return {
      currentLevel,
      nextLevel: rule.nextLevel,
      status: "Not ready yet",
      evidence: [
        `${validSessionCount}/${rule.requiredSessions} valid ${currentLevel} sessions found.`,
      ],
      missingRequirements: [
        `Complete ${rule.requiredSessions - validSessionCount} more valid ${currentLevel} session${
          rule.requiredSessions - validSessionCount === 1 ? "" : "s"
        }.`,
      ],
      recommendedNextAction: "Complete more sessions at this level first.",
      averages: {},
      requiredSessionCount: rule.requiredSessions,
      validSessionCount,
    };
  }

  const averages: Partial<Record<ScoreKey, number>> = {};
  for (const req of rule.requirements) {
    averages[req.key] = averageScore(
      recentScores
        .map((scores) => scores[req.key])
        .filter((value): value is number => typeof value === "number"),
    );
  }

  const missingRequirements = rule.requirements
    .filter((req) => (averages[req.key] ?? 0) < req.threshold)
    .map(
      (req) =>
        `${SCORE_LABELS[req.key]} average ${formatScore(
          averages[req.key] ?? 0,
        )}/${req.threshold}`,
    );

  const closeEnough = rule.requirements.every(
    (req) => (averages[req.key] ?? 0) >= req.threshold - 0.3,
  );
  const status: LevelUpStatus =
    missingRequirements.length === 0
      ? "Ready"
      : closeEnough
        ? "Almost ready"
        : "Not ready yet";

  const evidence = [
    `Used latest ${rule.requiredSessions} valid ${currentLevel} sessions.`,
    ...rule.requirements.map(
      (req) =>
        `${SCORE_LABELS[req.key]} average: ${formatScore(
          averages[req.key] ?? 0,
        )} (needed ${req.threshold})`,
    ),
  ];

  const recommendedNextAction =
    status === "Ready"
      ? "You are ready to move up."
      : status === "Almost ready"
        ? `You are close, but need more stable scores. Focus next on: ${missingRequirements
            .map((item) => item.split(" average")[0])
            .join(", ")}.`
        : `Focus next on: ${missingRequirements
            .map((item) => item.split(" average")[0])
            .join(", ")}.`;

  return {
    currentLevel,
    nextLevel: rule.nextLevel,
    status,
    evidence,
    missingRequirements,
    recommendedNextAction,
    averages,
    requiredSessionCount: rule.requiredSessions,
    validSessionCount,
  };
}
