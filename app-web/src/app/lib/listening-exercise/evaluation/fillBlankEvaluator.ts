import { sanitizeText } from "./textSanitizer";
import { levenshteinDistance } from "./levenshteinDistance";

export interface EvaluationResult {
  isCorrect: boolean;
  distance: number;
  matchedText: string;
  typosCount: number;
  typoLimit: number;
}

/**
 * Determines the maximum number of typos (Levenshtein distance) allowed
 * based on the target text length.
 *
 * - length <= 3: 0 typos allowed
 * - length 4-7: 1 typo allowed
 * - length >= 8: 2 typos allowed
 *
 * @param length The length of the target text.
 * @returns The number of allowed typos.
 */
export function getTypoLimit(length: number): number {
  if (length <= 3) return 0;
  if (length <= 7) return 1;
  return 2;
}

/**
 * Evaluates a fill-in-the-blank question attempt.
 * Sanitizes both the user input and the correct answer/accepted variants,
 * then checks if the Levenshtein distance matches within the dynamic typo limits.
 *
 * @param userInput The raw input provided by the learner.
 * @param correctAnswer The primary correct answer.
 * @param acceptedVariants Additional accepted answers (camelCase option).
 * @param accepted_variants Additional accepted answers (snake_case option).
 * @returns EvaluationResult details.
 */
export function evaluateFillBlank(
  userInput: string,
  correctAnswer: string,
  acceptedVariants: string[] = [],
  accepted_variants: string[] = []
): EvaluationResult {
  const sanitizedInput = sanitizeText(userInput);
  
  // Combine both camelCase and snake_case variants, removing duplicates
  const uniqueVariants = Array.from(
    new Set([...acceptedVariants, ...accepted_variants])
  );
  
  const candidates = [correctAnswer, ...uniqueVariants];
  let bestMatch: EvaluationResult | null = null;
  
  for (const candidate of candidates) {
    const sanitizedCandidate = sanitizeText(candidate);
    const dist = levenshteinDistance(sanitizedInput, sanitizedCandidate);
    const limit = getTypoLimit(sanitizedCandidate.length);
    const isCorrect = dist <= limit;
    
    const result: EvaluationResult = {
      isCorrect,
      distance: dist,
      matchedText: candidate,
      typosCount: dist,
      typoLimit: limit
    };
    
    // Choose the best match:
    // 1. Prioritize a correct match.
    // 2. If multiple correct matches, pick the one with the smallest distance.
    // 3. If no correct matches, pick the one with the smallest distance overall.
    if (isCorrect) {
      if (!bestMatch || !bestMatch.isCorrect || dist < bestMatch.distance) {
        bestMatch = result;
      }
    } else {
      if (!bestMatch || (bestMatch.isCorrect === false && dist < bestMatch.distance)) {
        bestMatch = result;
      }
    }
  }
  
  // Fallback to primary answer if candidates list is somehow empty
  return bestMatch || {
    isCorrect: false,
    distance: Infinity,
    matchedText: correctAnswer,
    typosCount: Infinity,
    typoLimit: getTypoLimit(sanitizeText(correctAnswer).length)
  };
}
