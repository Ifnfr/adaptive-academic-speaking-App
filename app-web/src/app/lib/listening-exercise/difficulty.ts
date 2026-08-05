export type ListeningDifficulty = "easy" | "medium" | "hard";

export const DEFAULT_LISTENING_DIFFICULTY: ListeningDifficulty = "medium";

export const LISTENING_DIFFICULTY_STORAGE_KEY = "listeningDifficulty";

export const LISTENING_DIFFICULTY_OPTIONS: Array<{
  value: ListeningDifficulty;
  label: string;
  description: string;
}> = [
  {
    value: "easy",
    label: "Easy",
    description:
      "Basic, high-frequency everyday vocabulary only (CEFR A1–A2). Short simple sentences, no idioms or jargon.",
  },
  {
    value: "medium",
    label: "Medium",
    description:
      "Broader everyday vocabulary plus common topic-related words (CEFR B1–B2). Moderate sentence complexity, occasional idioms.",
  },
  {
    value: "hard",
    label: "Hard",
    description:
      "Wide vocabulary including abstract, academic, and technical terms (CEFR C1). Complex sentence structures and idiomatic expressions.",
  },
];

export function normalizeListeningDifficulty(value: unknown): ListeningDifficulty {
  return value === "easy" || value === "hard"
    ? value
    : DEFAULT_LISTENING_DIFFICULTY;
}

export function loadListeningDifficulty(): ListeningDifficulty {
  if (typeof window === "undefined") return DEFAULT_LISTENING_DIFFICULTY;
  return normalizeListeningDifficulty(
    window.localStorage.getItem(LISTENING_DIFFICULTY_STORAGE_KEY)
  );
}

export function saveListeningDifficulty(value: ListeningDifficulty): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LISTENING_DIFFICULTY_STORAGE_KEY, value);
}
