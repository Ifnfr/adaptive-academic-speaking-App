import type { DrillSessionState } from "./types";

const SYNONYMS: Record<string, string[]> = {
  because: ["as", "since", "for", "because"],
  therefore: ["so", "consequently", "thus", "hence", "result", "therefore"],
  although: ["though", "even", "while", "but", "yet", "although"],
  however: ["but", "yet", "nevertheless", "nonetheless", "contrast", "however"],
  whereas: ["while", "but", "contrast", "whereas"],
  consequently: ["so", "therefore", "thus", "result", "consequently"],
  besides: ["also", "furthermore", "moreover", "addition", "besides"],
  moreover: ["also", "furthermore", "besides", "addition", "moreover"],
  furthermore: ["also", "moreover", "besides", "addition", "furthermore"],
};

export function getConcreteTokens(steps: string[]): string[] {
  const slotRegex = /^\[[a-zA-Z0-9_\s-]+\]$/;
  return steps
    .map((step) => step.trim().toLowerCase())
    .filter((step) => step.length > 0 && !slotRegex.test(step))
    .flatMap((step) => step.split(/[^a-zA-Z0-9'-]+/))
    .filter((word) => word.length >= 2);
}

export function isRelatedToPattern(fragment: string, steps: string[]): boolean {
  const concreteTokens = getConcreteTokens(steps);
  if (concreteTokens.length === 0) return true;

  const lowerFragment = fragment.toLowerCase();
  return concreteTokens.some((token) => {
    if (lowerFragment.includes(token)) return true;
    const syns = SYNONYMS[token];
    if (syns) {
      return syns.some((syn) => lowerFragment.includes(syn));
    }
    return false;
  });
}

export function validateSpokenModelFragment(fragment: string, steps: string[]): boolean {
  if (typeof fragment !== "string") return false;
  const trimmed = fragment.trim();
  if (trimmed.length === 0 || trimmed.length > 120) return false;

  if (/[\r\n]/.test(trimmed)) return false;

  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 12) return false;

  const rawText = trimmed.replace(/[.!?]+$/, "");
  if (/[.!?]/.test(rawText)) return false;

  if (!isRelatedToPattern(trimmed, steps)) return false;

  return true;
}

export function validateSessionInputKeys(body: unknown, allowedKeys: string[]): boolean {
  if (!body || typeof body !== "object") return false;
  const keys = Object.keys(body);
  return !keys.some((k) => !allowedKeys.includes(k));
}

export function containsOwnerOrInternalFields(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const blacklisted = ["ownerId", "owner_id", "userId", "user_id", "apiKey", "api_key", "provider"];
  return Object.keys(body).some((k) => blacklisted.includes(k));
}

export function isValidDrillSessionState(state: unknown): state is DrillSessionState {
  if (!state || typeof state !== "object") return false;
  const s = state as Record<string, unknown>;
  if (typeof s.sessionId !== "string" || s.sessionId.trim().length === 0) return false;
  const phase = s.currentPhase;
  if (phase !== 0 && phase !== 1 && phase !== 2 && phase !== 3 && phase !== "complete") return false;
  if (s.briefContent !== null && typeof s.briefContent !== "object") return false;
  if (!Array.isArray(s.phase1Results) || !Array.isArray(s.phase2Results) || !Array.isArray(s.phase3Results)) return false;
  if (s.entryPhase !== null && s.entryPhase !== 1 && s.entryPhase !== 3) return false;
  return true;
}
