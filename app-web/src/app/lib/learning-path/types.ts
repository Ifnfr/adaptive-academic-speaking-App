export type LearningPathCardType =
  | 'guided-word'
  | 'phrase-pattern'
  | 'sentence-builder'
  | 'micro-speaking'
  | 'weekly-checkpoint'
  | 'supported-conversation'
  | 'pronunciation-awareness'
  | 'reflection-card';

export type LearningPathCompletionRule =
  | 'viewed'
  | 'attempted'
  | 'recorded'
  | 'continued'
  | 'completed';

export type CardStatus = 'completed' | 'current' | 'recommended' | 'available' | 'upcoming';

export interface LearningPathCard {
  id: string;
  dayNumber: number;
  unitId: string;
  type: LearningPathCardType;
  title: string;
  targetPhrases: string[];
  learnerInstruction: string;
  indonesianExplanation: string;
  scaffold: string;
  cta: string;
  estimatedMinutes: number;
  completionRule: LearningPathCompletionRule;
  linkedEngine: string;
  mobileLayoutHint: 'compact' | 'standard' | 'scrollable';
  // Phase 2 optional metadata
  pronunciationFocus?: {
    pairs: Array<{ wordA: string; wordB: string; correct: 'A' | 'B' }>;
    instruction: string;
  };
  conversationPrompt?: {
    tutorTurn: string;
    options: Array<{ id: string; text: string; nextPrompt?: string }>;
  };
  reflectionPrompt?: {
    question: string;
    options: string[];
  };
}

export interface LearningPathDay {
  dayNumber: number;
  unitId: string;
  title: string;
  cards: LearningPathCard[];
}

export interface LearningPathUnit {
  id: string;
  phaseId: string;
  title: string;
  description: string;
  unitNumber: number;
  days: LearningPathDay[];
}

export interface LearningPathPhase {
  id: string;
  pathId: string;
  title: string;
  description: string;
  durationDays: number;
  units: LearningPathUnit[];
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  estimatedDurationDays: number;
  phases: LearningPathPhase[];
}

export interface StoredCardProgress {
  cardId: string;
  status: LearningPathCompletionRule;
  attemptCount: number;
  lastUpdatedAt: string;
}

export interface StoredLearningPathProgress {
  pathId: string;
  phaseId: string;
  cards: Record<string, StoredCardProgress>;
  lastRecommendedCardId: string | null;
  lastUpdatedAt: string;
}

