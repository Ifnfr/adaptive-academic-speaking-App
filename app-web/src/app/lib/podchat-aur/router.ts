import type { ContextCoverageState, SocraticResponseMode, SocraticRoutingInput } from "./types";

const INDONESIAN_MARKERS = [
  "aku",
  "bagaimana",
  "dalam",
  "dan",
  "dengan",
  "karena",
  "menurut",
  "saya",
  "tidak",
  "untuk",
  "yang",
];

function countTrueCoverage(coverage: ContextCoverageState): number {
  return Object.values(coverage).filter(Boolean).length;
}

function looksIndonesianDominant(text: string): boolean {
  const words = text.toLowerCase().match(/[a-zA-Z]+/g) ?? [];
  if (words.length < 3) return false;
  const markerCount = words.filter((word) => INDONESIAN_MARKERS.includes(word)).length;
  return markerCount >= 2 || markerCount / words.length >= 0.25;
}

function looksUnclearEnglish(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 4) return true;
  const words = trimmed.match(/[a-zA-Z]+/g) ?? [];
  if (words.length < 3) return true;
  const averageWordLength =
    words.reduce((sum, word) => sum + word.length, 0) / Math.max(1, words.length);
  return averageWordLength < 2.5 && trimmed.length < 40;
}

function asksForExplanation(text: string): boolean {
  return /\?/.test(text) || /\b(what does|what do you mean|i don't understand|i do not understand|can you explain|confused|meaning)\b/i.test(text);
}

function makesUnsupportedBroadClaim(text: string): boolean {
  const lower = text.toLowerCase();
  const hasBroadClaim = /\b(always|never|everyone|all people|every country|must|only way|definitely)\b/.test(lower);
  const hasEvidenceSignal = /\b(because|for example|evidence|according to|data|study|article|note)\b/.test(lower);
  return hasBroadClaim && !hasEvidenceSignal;
}

function asksToConclude(text: string): boolean {
  return /\b(conclude|conclusion|summarize|summary|wrap up|finish|final point)\b/i.test(text);
}

export function selectSocraticResponseMode(input: SocraticRoutingInput): SocraticResponseMode {
  const text = input.latestUserText.trim();
  if (looksIndonesianDominant(text) || looksUnclearEnglish(text)) {
    return "language_coach";
  }

  if (
    asksToConclude(text) ||
    countTrueCoverage(input.understandingState.coverageState) >= 4
  ) {
    return "synthesize";
  }

  if (asksForExplanation(text)) {
    return "explain";
  }

  if (makesUnsupportedBroadClaim(text)) {
    return "challenge";
  }

  return "ask";
}
