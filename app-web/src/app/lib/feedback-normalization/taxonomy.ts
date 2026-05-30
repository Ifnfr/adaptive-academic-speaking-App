import type {
  FeedbackSignalCategory,
  FeedbackTaxonomyEntry,
} from "./types";

export const FEEDBACK_SIGNAL_CATEGORIES = [
  "fluency",
  "clarity",
  "structure",
  "grammar",
  "vocabulary",
  "coherence",
  "support",
  "academicTone",
  "taskCompletion",
  "confidenceHabit",
] as const satisfies readonly FeedbackSignalCategory[];

export const FEEDBACK_TAXONOMY: Record<
  FeedbackSignalCategory,
  FeedbackTaxonomyEntry
> = {
  fluency: {
    category: "fluency",
    label: "Speaking flow",
    shortDescription: "How smoothly the response continues from idea to idea.",
    practiceTarget: "Build a steady speaking rhythm with short, clear turns.",
  },
  clarity: {
    category: "clarity",
    label: "Clear message",
    shortDescription: "How easy the main idea is to understand.",
    practiceTarget: "Make the main point simple and easy to follow.",
  },
  structure: {
    category: "structure",
    label: "Answer shape",
    shortDescription: "How well the response uses an organized beginning, middle, and ending.",
    practiceTarget: "Use a simple pattern: point, reason, example, closing.",
  },
  grammar: {
    category: "grammar",
    label: "Sentence control",
    shortDescription: "How well sentence forms support the intended meaning.",
    practiceTarget: "Practice one reliable sentence pattern at a time.",
  },
  vocabulary: {
    category: "vocabulary",
    label: "Word choice",
    shortDescription: "How well selected words support the speaking task.",
    practiceTarget: "Choose useful words and repeat them in simple phrases.",
  },
  coherence: {
    category: "coherence",
    label: "Connected ideas",
    shortDescription: "How clearly one idea connects to the next.",
    practiceTarget: "Use short links such as because, for example, and so.",
  },
  support: {
    category: "support",
    label: "Reason and example",
    shortDescription: "How well reasons or examples support the main point.",
    practiceTarget: "Add one reason or one example after the main idea.",
  },
  academicTone: {
    category: "academicTone",
    label: "Academic style",
    shortDescription: "How well the response uses calm and appropriate academic phrasing.",
    practiceTarget: "Use polite, precise phrases without overcomplicating the answer.",
  },
  taskCompletion: {
    category: "taskCompletion",
    label: "Task focus",
    shortDescription: "How fully the response follows the practice prompt.",
    practiceTarget: "Answer the prompt directly before adding extra details.",
  },
  confidenceHabit: {
    category: "confidenceHabit",
    label: "Confidence habit",
    shortDescription: "How consistently the learner starts, continues, and finishes practice.",
    practiceTarget: "Start with one sentence, then continue with support.",
  },
};

export function getFeedbackTaxonomyEntry(
  category: FeedbackSignalCategory,
): FeedbackTaxonomyEntry {
  return FEEDBACK_TAXONOMY[category];
}
