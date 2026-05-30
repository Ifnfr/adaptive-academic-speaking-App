// src/app/lib/feedback-normalization/retry-actions.ts
// Pure helper functions to map normalized FeedbackSignal objects to safe retry/practice action recommendations.
// No side-effects, no storage, no UI.

import type {
  FeedbackSignalCategory,
  FeedbackSignalLearnerLevel,
  FeedbackRecommendedAction,
} from "./types";

/**
 * Returns a deterministic recommended action ID.
 */
export function buildRecommendedActionId(
  category: FeedbackSignalCategory,
  learnerLevel: FeedbackSignalLearnerLevel = "Foundation"
): string {
  return `practice-${category}-${learnerLevel}`;
}

/**
 * Returns a safe, supportive instruction string based on category and learner level.
 */
export function getSafeRetryInstruction(
  category: FeedbackSignalCategory,
  learnerLevel: FeedbackSignalLearnerLevel = "Foundation"
): string {
  let baseInstruction = "";
  switch (category) {
    case "fluency":
      baseInstruction = "Try a short timed speaking practice. Focus on keeping a steady rhythm without rushing.";
      break;
    case "clarity":
      baseInstruction = "Try to say one clear sentence. Make the main point simple and easy to follow.";
      break;
    case "structure":
      baseInstruction = "Try to answer with a clear opening, one supporting detail, and a brief closing.";
      break;
    case "grammar":
      baseInstruction = "Try a subject and verb sentence practice. Focus on building a reliable and clear sentence pattern.";
      break;
    case "vocabulary":
      baseInstruction = "Try to replace a repeated word with a simple alternative phrase. Keep it natural.";
      break;
    case "coherence":
      baseInstruction = "Try connecting two ideas with a simple transition word like 'because', 'so', or 'for example'.";
      break;
    case "support":
      baseInstruction = "Try to give one reason and one example to support your main point.";
      break;
    case "academicTone":
      baseInstruction = "Try to make a phrase more formal and concise. Use polite, precise phrasing.";
      break;
    case "taskCompletion":
      baseInstruction = "Try to answer the prompt directly before adding any extra details.";
      break;
    case "confidenceHabit":
      baseInstruction = "Start with one safe, short attempt. Take a small step to build your speaking confidence.";
      break;
    default:
      baseInstruction = "Try a short speaking practice target to build confidence.";
  }

  // Add level-specific encouragement/guidance
  let levelGuidance = "";
  if (learnerLevel === "Foundation" || learnerLevel === "Beginner") {
    levelGuidance = " Take your time and focus on one word or phrase at a time.";
  } else if (learnerLevel === "Intermediate") {
    levelGuidance = " Focus on speaking clearly and connecting your ideas smoothly.";
  } else {
    levelGuidance = " Try to refine your delivery for academic precision.";
  }

  return `${baseInstruction}${levelGuidance}`;
}

/**
 * Returns a human-friendly practice title for the given category.
 */
export function getSafeRetryTitle(category: FeedbackSignalCategory): string {
  switch (category) {
    case "fluency":
      return "Speaking flow practice";
    case "clarity":
      return "Clear message focus";
    case "structure":
      return "Structured speaking practice";
    case "grammar":
      return "Sentence builder practice";
    case "vocabulary":
      return "Word selection focus";
    case "coherence":
      return "Connected ideas practice";
    case "support":
      return "Adding detail practice";
    case "academicTone":
      return "Academic style focus";
    case "taskCompletion":
      return "Prompt focus practice";
    case "confidenceHabit":
      return "Confidence booster practice";
    default:
      return "Speaking practice target";
  }
}

/**
 * Get estimated minutes based on category and learner level.
 */
export function getEstimatedMinutes(
  category: FeedbackSignalCategory,
  learnerLevel: FeedbackSignalLearnerLevel = "Foundation"
): number {
  let baseMinutes = 2;
  if (category === "structure" || category === "support") {
    baseMinutes = 3;
  } else if (category === "confidenceHabit") {
    baseMinutes = 1;
  }

  // Adjust for level
  if (learnerLevel === "Advanced" || learnerLevel === "Expert") {
    return baseMinutes + 1;
  }
  return baseMinutes;
}

/**
 * Maps a category and level directly to a safe FeedbackRecommendedAction.
 */
export function getRetryActionForCategory(
  category: FeedbackSignalCategory,
  learnerLevel?: FeedbackSignalLearnerLevel
): FeedbackRecommendedAction {
  const safeLevel: FeedbackSignalLearnerLevel = learnerLevel ?? "Foundation";
  return {
    id: buildRecommendedActionId(category, safeLevel),
    category,
    learnerLevel: safeLevel,
    title: getSafeRetryTitle(category),
    instruction: getSafeRetryInstruction(category, safeLevel),
    estimatedMinutes: getEstimatedMinutes(category, safeLevel),
  };
}

/**
 * Maps a normalized FeedbackSignal object to a safe FeedbackRecommendedAction recommendation.
 * Strictly uses whitelist properties to avoid leaking transcripts, private notes, or raw user text.
 */
export function getRetryActionForSignal(
  signal: unknown
): FeedbackRecommendedAction {
  // Ensure we have a safe object to work with
  const obj = typeof signal === "object" && signal !== null ? (signal as Record<string, unknown>) : {};
  
  // Extract category with a safe fallback
  let category: FeedbackSignalCategory = "clarity";
  const rawCat = obj["category"];
  const validCategories: FeedbackSignalCategory[] = [
    "fluency",
    "clarity",
    "structure",
    "grammar",
    "vocabulary",
    "coherence",
    "support",
    "academicTone",
    "taskCompletion",
    "confidenceHabit"
  ];
  if (typeof rawCat === "string" && validCategories.includes(rawCat as FeedbackSignalCategory)) {
    category = rawCat as FeedbackSignalCategory;
  }

  // Extract learner level with a safe fallback
  let learnerLevel: FeedbackSignalLearnerLevel = "Foundation";
  const rawLevel = obj["learnerLevel"];
  const validLevels: FeedbackSignalLearnerLevel[] = [
    "Foundation",
    "Beginner",
    "Intermediate",
    "Advanced",
    "Expert"
  ];
  if (typeof rawLevel === "string" && validLevels.includes(rawLevel as FeedbackSignalLearnerLevel)) {
    learnerLevel = rawLevel as FeedbackSignalLearnerLevel;
  }

  // Whitelist-only output generation
  return {
    id: buildRecommendedActionId(category, learnerLevel),
    category,
    learnerLevel,
    title: getSafeRetryTitle(category),
    instruction: getSafeRetryInstruction(category, learnerLevel),
    estimatedMinutes: getEstimatedMinutes(category, learnerLevel),
  };
}
