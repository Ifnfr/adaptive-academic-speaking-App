type Level = "Foundation" | "Beginner" | "Intermediate" | "Advanced" | "Expert";

const LEVELS: readonly Level[] = [
  "Foundation",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
];

export const LEVEL_PHASE: Record<Level, string> = {
  Foundation: "Phase 1 · Build volume",
  Beginner: "Phase 2 · Simple structure",
  Intermediate: "Phase 3 · Clarity & transitions",
  Advanced: "Phase 4 · Argument defense",
  Expert: "Phase 5 · Academic rigor",
};

export function nextLevelHint(level: Level): string | null {
  const idx = LEVELS.indexOf(level);
  const next = LEVELS[idx + 1];
  return next ? `Next up: ${next}` : null;
}
