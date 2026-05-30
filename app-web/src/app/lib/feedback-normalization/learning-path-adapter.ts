// src/app/lib/feedback-normalization/learning-path-adapter.ts
// Pure adapter that converts safe FeedbackSignalSummary objects into future Learning Path recommendation hints.
// No side-effects, no storage, no UI.

import type {
  FeedbackSignalCategory,
  FeedbackSignalSummary,
} from "./types";

export type LearningPathRecommendationHint = {
  category: FeedbackSignalCategory;
  suggestedCardType:
    | "guided-word"
    | "phrase-pattern"
    | "sentence-builder"
    | "micro-speaking"
    | "weekly-checkpoint";
  priority: "low" | "medium" | "high";
  safeReason: string;
  safeInstruction: string;
};

/**
 * Maps a feedback category to the recommended Learning Path card type.
 */
export function mapFeedbackCategoryToCardType(
  category: FeedbackSignalCategory
): "guided-word" | "phrase-pattern" | "sentence-builder" | "micro-speaking" | "weekly-checkpoint" {
  switch (category) {
    case "fluency":
    case "clarity":
      return "micro-speaking";
    case "structure":
    case "coherence":
    case "support":
    case "academicTone":
      return "phrase-pattern";
    case "grammar":
      return "sentence-builder";
    case "vocabulary":
      return "guided-word";
    case "taskCompletion":
      return "weekly-checkpoint";
    case "confidenceHabit":
      return "guided-word";
    default:
      return "micro-speaking";
  }
}

/**
 * Returns the priority based on count.
 */
export function getPriorityFromCount(count: number): "low" | "medium" | "high" {
  if (count >= 3) return "high";
  if (count === 2) return "medium";
  return "low";
}

/**
 * Returns a safe Learning Path hint for a single category and its count.
 */
export function getLearningPathHintForCategory(
  category: FeedbackSignalCategory,
  count: number = 0
): LearningPathRecommendationHint {
  const suggestedCardType = mapFeedbackCategoryToCardType(category);
  const priority = getPriorityFromCount(count);

  let safeReason = "";
  let safeInstruction = "";

  switch (category) {
    case "fluency":
      safeReason = "Practice speaking to improve your general speaking flow.";
      safeInstruction = "Try a short speaking attempt with focus on maintaining a steady rhythm.";
      break;
    case "clarity":
      safeReason = "Practice speaking clearly and keeping your main points easy to follow.";
      safeInstruction = "Try expressing a single point in one simple, clear sentence.";
      break;
    case "structure":
      safeReason = "Practice structured speaking responses to help organize your ideas.";
      safeInstruction = "Try practice exercises that guide you through an opening, reason, and closing.";
      break;
    case "grammar":
      safeReason = "Build confidence with common and useful sentence structures.";
      safeInstruction = "Try combining words into complete subject-and-verb sentence structures.";
      break;
    case "vocabulary":
      safeReason = "Expand and practice vocabulary words in academic contexts.";
      safeInstruction = "Practice repeating selected vocabulary words inside daily academic phrases.";
      break;
    case "coherence":
      safeReason = "Practice transitions to link ideas smoothly.";
      safeInstruction = "Focus on connecting your ideas with basic words like 'so', 'because', or 'and'.";
      break;
    case "support":
      safeReason = "Practice adding reasons and examples to support your points.";
      safeInstruction = "Focus on adding a simple reason or a brief example directly after your main idea.";
      break;
    case "academicTone":
      safeReason = "Practice using polite, clear, and academic speaking phrasing.";
      safeInstruction = "Focus on precise, formal vocabulary selections inside structured phrases.";
      break;
    case "taskCompletion":
      safeReason = "Practice completing academic speaking prompts fully.";
      safeInstruction = "Focus on answering the main prompt directly before adding additional details.";
      break;
    case "confidenceHabit":
      safeReason = "Build a consistent speaking practice habit with simple steps.";
      safeInstruction = "Start with a short vocabulary practice to ease into your speaking routine.";
      break;
    default:
      safeReason = "Try one small speaking focus to build confidence.";
      safeInstruction = "Focus on taking small speaking steps during your next daily practice.";
  }

  return {
    category,
    suggestedCardType,
    priority,
    safeReason,
    safeInstruction,
  };
}

/**
 * Returns a list of safe Learning Path hints sorted by the top categories in the summary.
 * Does not mutate the input summary.
 */
export function getLearningPathHintsFromSummary(
  summary: FeedbackSignalSummary
): LearningPathRecommendationHint[] {
  if (!summary.topCategories || summary.topCategories.length === 0) {
    return [];
  }

  return summary.topCategories.map((category) => {
    const count = summary.countsByCategory[category] ?? 0;
    return getLearningPathHintForCategory(category, count);
  });
}

/**
 * Returns the primary (highest priority) Learning Path hint from the summary, or null if none.
 */
export function getPrimaryLearningPathHint(
  summary: FeedbackSignalSummary
): LearningPathRecommendationHint | null {
  if (!summary.topCategories || summary.topCategories.length === 0) {
    return null;
  }

  const primaryCategory = summary.topCategories[0];
  const count = summary.countsByCategory[primaryCategory] ?? 0;
  return getLearningPathHintForCategory(primaryCategory, count);
}
