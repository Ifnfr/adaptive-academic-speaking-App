import {
  TutorMemoryProfile,
  TutorMemoryRecommendation,
  TutorMemoryCardType,
} from "./types";
import { phase1Curriculum } from "../learning-path/phase1-curriculum";

// Helper to look up a card type from static curriculum by ID
export function mapCardIdToType(cardId: string): TutorMemoryCardType | null {
  const phase = phase1Curriculum.phases[0];
  if (!phase) return null;
  for (const unit of phase.units) {
    for (const day of unit.days) {
      for (const card of day.cards) {
        if (card.id === cardId) {
          return card.type as TutorMemoryCardType;
        }
      }
    }
  }
  return null;
}

export function getTutorMemoryRecommendation(
  profile: TutorMemoryProfile
): TutorMemoryRecommendation {
  // Decision table implementation

  // 1. Grammar
  if (profile.repeatedFocusCategories.includes("grammar")) {
    return {
      suggestedCardType: "sentence-builder",
      priority: "high",
      category: "grammar",
      safeReason: "Grammar patterns appeared frequently in recent practice",
      safeInstruction: "Arrange the words to build clean grammatical structures.",
      basedOn: ["feedback-summary"],
    };
  }

  // 2. Vocabulary
  if (profile.repeatedFocusCategories.includes("vocabulary")) {
    return {
      suggestedCardType: "guided-word",
      priority: "high",
      category: "vocabulary",
      safeReason: "Vocabulary focus appeared frequently in recent practice",
      safeInstruction: "Practice key speaking vocabulary aloud to build accuracy.",
      basedOn: ["feedback-summary"],
    };
  }

  // 3. Fluency or Clarity
  const fluencyOrClarity = profile.repeatedFocusCategories.find(
    cat => cat === "fluency" || cat === "clarity"
  );
  if (fluencyOrClarity) {
    return {
      suggestedCardType: "micro-speaking",
      priority: "high",
      category: fluencyOrClarity,
      safeReason: "Speaking flow focus appeared frequently in recent practice",
      safeInstruction: "Practice expressing your thoughts smoothly with a brief spoken response.",
      basedOn: ["feedback-summary"],
    };
  }

  // 4. Structure, Coherence, Support, or AcademicTone
  const structureCategory = profile.repeatedFocusCategories.find(
    cat =>
      cat === "structure" ||
      cat === "coherence" ||
      cat === "support" ||
      cat === "academicTone"
  );
  if (structureCategory) {
    return {
      suggestedCardType: "phrase-pattern",
      priority: "high",
      category: structureCategory,
      safeReason: "Structured response focus appeared frequently in recent practice",
      safeInstruction: "Use phrase templates to frame and support your answers.",
      basedOn: ["feedback-summary"],
    };
  }

  // 5. ConfidenceHabit
  if (profile.repeatedFocusCategories.includes("confidenceHabit")) {
    return {
      suggestedCardType: "guided-word",
      priority: "medium",
      category: "confidenceHabit",
      safeReason: "Guided steps can support consistent speaking practice",
      safeInstruction: "Keep building momentum with simple greetings and guided words.",
      basedOn: ["feedback-summary"],
    };
  }

  // 6. TaskCompletion
  if (profile.repeatedFocusCategories.includes("taskCompletion")) {
    return {
      suggestedCardType: "phrase-pattern",
      priority: "medium",
      category: "taskCompletion",
      safeReason: "Prompt completion focus appeared in recent practice",
      safeInstruction: "Focus on structured sentence frames to answer prompts completely.",
      basedOn: ["feedback-summary"],
    };
  }

  // 7. Phase Complete
  if (profile.learningPath.isPhaseComplete) {
    return {
      suggestedCardType: "weekly-checkpoint",
      priority: "low",
      category: null,
      safeReason: "All current cards are complete, so a short review can help",
      safeInstruction: "Review your completed days or try checking in on a weekly checkpoint.",
      basedOn: ["learning-path-progress"],
    };
  }

  // 8. Current Card Continuation
  if (profile.learningPath.currentCardId) {
    const cardType = mapCardIdToType(profile.learningPath.currentCardId) || "guided-word";
    return {
      suggestedCardType: cardType,
      priority: "medium",
      category: null,
      safeReason: "Continue your current Learning Path card",
      safeInstruction: "Proceed with the next step on your confidence timeline.",
      basedOn: ["learning-path-progress"],
    };
  }

  // 9. Default Fallback
  return {
    suggestedCardType: "guided-word",
    priority: "low",
    category: null,
    safeReason: "Start with a simple guided word practice",
    safeInstruction: "Begin your journey by listening and repeating basic words.",
    basedOn: ["learning-path-progress"],
  };
}
