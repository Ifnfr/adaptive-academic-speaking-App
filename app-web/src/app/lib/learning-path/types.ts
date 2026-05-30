export type LearningPathCardType =
  | 'guided-word'
  | 'phrase-pattern'
  | 'sentence-builder'
  | 'micro-speaking'
  | 'weekly-checkpoint';

export type LearningPathCompletionRule =
  | 'viewed'
  | 'attempted'
  | 'recorded'
  | 'continued'
  | 'completed';

export type CardStatus = 'locked' | 'available' | 'completed';

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

export interface LearningPathProgress {
  userId: string;
  pathId: string;
  currentDay: number;
  completedCardIds: string[];
  cardStatuses: Record<string, CardStatus>;
  lastUpdatedAt: string;
}
