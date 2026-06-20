export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface ScoreThreshold {
  maxScore: number; // Upper bound (inclusive)
  band: string;
}

/**
 * Strict mapping matrix grid converting CEFR Level and Overall Score %
 * to calibrated internal estimated bands.
 */
export const BAND_MATRIX: Record<CEFRLevel, ScoreThreshold[]> = {
  A1: [
    { maxScore: 39, band: "Band 2.0" },
    { maxScore: 69, band: "Band 2.5" },
    { maxScore: 100, band: "Band 3.0" }
  ],
  A2: [
    { maxScore: 29, band: "Band 2.5" },
    { maxScore: 59, band: "Band 3.0" },
    { maxScore: 84, band: "Band 3.5" },
    { maxScore: 100, band: "Band 4.0" }
  ],
  B1: [
    { maxScore: 29, band: "Band 3.5" },
    { maxScore: 54, band: "Band 4.0" },
    { maxScore: 79, band: "Band 4.5" },
    { maxScore: 100, band: "Band 5.0" }
  ],
  B2: [
    { maxScore: 29, band: "Band 4.5" },
    { maxScore: 54, band: "Band 5.0" },
    { maxScore: 79, band: "Band 5.5" },
    { maxScore: 100, band: "Band 6.0" }
  ],
  C1: [
    { maxScore: 29, band: "Band 5.5" },
    { maxScore: 54, band: "Band 6.0" },
    { maxScore: 74, band: "Band 6.5" },
    { maxScore: 89, band: "Band 7.0" },
    { maxScore: 100, band: "Band 7.5" }
  ],
  C2: [
    { maxScore: 29, band: "Band 6.5" },
    { maxScore: 49, band: "Band 7.0" },
    { maxScore: 69, band: "Band 7.5" },
    { maxScore: 89, band: "Band 8.0" },
    { maxScore: 100, band: "Band 8.5+" }
  ]
};

/**
 * Maps a Session CEFR Level and Overall Score % to a calibrated internal band label.
 *
 * @param cefrLevel The CEFR level (A1, A2, B1, B2, C1, C2).
 * @param score The overall score percentage (0-100).
 * @returns The estimated band label string (e.g., "Band 2.0" to "Band 8.5+").
 */
export function mapScoreToBand(cefrLevel: string, score: number): string {
  const normalizedLevel = cefrLevel.trim().toUpperCase() as CEFRLevel;
  const clampedScore = Math.max(0, Math.min(100, score));

  const thresholds = BAND_MATRIX[normalizedLevel];
  if (!thresholds) {
    // Dynamic generic fallback for unknown levels or empty input
    if (clampedScore < 30) return "Band 2.0";
    if (clampedScore < 45) return "Band 3.0";
    if (clampedScore < 60) return "Band 4.0";
    if (clampedScore < 75) return "Band 5.0";
    if (clampedScore < 90) return "Band 6.0";
    return "Band 7.0";
  }

  for (const t of thresholds) {
    if (clampedScore <= t.maxScore) {
      return t.band;
    }
  }

  // Final safety fallback
  return "Band 2.0";
}
