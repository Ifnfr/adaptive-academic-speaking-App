import { RecommendationResult } from "../learning-path/recommendation";
import { TutorMemoryProfile, TutorMemoryRecommendation } from "./types";
import { getTutorMemoryRecommendation } from "./recommend";

export interface TutorAwareRecommendation {
  version: 1;
  sequential: {
    recommendedCardId: string | null;
    isPhaseComplete: boolean;
  };
  tutorMemory: TutorMemoryRecommendation | null;
  advisoryOnly: true;
  lastUpdatedAt: string;
}

export function getSequentialRecommendationSummary(
  lpRecommendation: RecommendationResult
): { recommendedCardId: string | null; isPhaseComplete: boolean } {
  return {
    recommendedCardId: lpRecommendation.recommendedCard ? lpRecommendation.recommendedCard.id : null,
    isPhaseComplete: lpRecommendation.isPhaseComplete,
  };
}

export function getTutorMemoryRecommendationSummary(
  tutorMemoryProfile: TutorMemoryProfile | null
): TutorMemoryRecommendation | null {
  if (!tutorMemoryProfile) {
    return null;
  }
  return getTutorMemoryRecommendation(tutorMemoryProfile);
}

export function buildTutorAwareRecommendation(
  lpRecommendation: RecommendationResult,
  tutorMemoryProfile: TutorMemoryProfile | null,
  nowParam?: string
): TutorAwareRecommendation {
  const sequential = getSequentialRecommendationSummary(lpRecommendation);
  const tutorMemory = getTutorMemoryRecommendationSummary(tutorMemoryProfile);
  const lastUpdatedAt = nowParam || new Date().toISOString();

  // Whitelist-only output construction
  return {
    version: 1,
    sequential,
    tutorMemory,
    advisoryOnly: true,
    lastUpdatedAt,
  };
}
