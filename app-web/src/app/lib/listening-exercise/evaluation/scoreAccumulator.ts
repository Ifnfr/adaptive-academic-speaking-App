export interface SectionScoreInput {
  correctCount: number;
  totalCount: number;
}

/**
 * Calculates a pool-based session scoring percentage.
 * Formula: (Total Correct Across All Sections / Total Questions Across All Sections) * 100
 *
 * It clamps input counts to non-negative values and returns 0 if total questions
 * across all sections is 0 or less.
 *
 * @param sections An array of section score inputs.
 * @returns The aggregated score percentage (0-100), rounded to the nearest integer.
 */
export function calculateSessionScore(sections: SectionScoreInput[]): number {
  let totalCorrect = 0;
  let totalQuestions = 0;

  for (const section of sections) {
    const correct = Math.max(0, section.correctCount);
    const total = Math.max(0, section.totalCount);
    
    // Ensure correctCount does not exceed totalCount for each section
    totalCorrect += Math.min(correct, total);
    totalQuestions += total;
  }

  if (totalQuestions <= 0) {
    return 0;
  }

  return Math.round((totalCorrect / totalQuestions) * 100);
}
