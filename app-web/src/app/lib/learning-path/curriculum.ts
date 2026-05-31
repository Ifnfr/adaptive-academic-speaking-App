import { phase1Curriculum } from './phase1-curriculum';
import { phase2Curriculum } from './phase2-curriculum';
import { LearningPath, LearningPathCard, LearningPathPhase, LearningPathDay } from './types';

// Re-export phase-specific curriculum objects
export { phase1Curriculum } from './phase1-curriculum';
export { phase2Curriculum } from './phase2-curriculum';

// Aggregated Learning Path Curriculum
export const allLearningPathCurriculum: LearningPath = {
  id: phase1Curriculum.id,
  title: phase1Curriculum.title,
  description: phase1Curriculum.description,
  estimatedDurationDays: phase1Curriculum.estimatedDurationDays + phase2Curriculum.durationDays,
  phases: [
    phase1Curriculum.phases[0],
    phase2Curriculum
  ]
};

/**
 * Returns all cards from all phases, sorted by day number.
 * Outputs are cloned to prevent direct mutation of the source curriculum.
 */
export function getAllLearningPathCards(): LearningPathCard[] {
  const cards: LearningPathCard[] = [];
  for (const phase of allLearningPathCurriculum.phases) {
    for (const unit of phase.units) {
      for (const day of unit.days) {
        for (const card of day.cards) {
          cards.push(JSON.parse(JSON.stringify(card)));
        }
      }
    }
  }
  return cards.sort((a, b) => a.dayNumber - b.dayNumber);
}

/**
 * Retrieves a phase by its identifier.
 * Returns a cloned copy of the phase to prevent mutation of the source.
 */
export function getLearningPathPhaseById(phaseId: string): LearningPathPhase | null {
  const phase = allLearningPathCurriculum.phases.find(p => p.id === phaseId);
  if (!phase) return null;
  return JSON.parse(JSON.stringify(phase));
}

/**
 * Retrieves a specific curriculum day by its day number (1-indexed).
 * Returns a cloned copy of the day to prevent mutation of the source.
 */
export function getLearningPathDayByNumber(dayNumber: number): LearningPathDay | null {
  for (const phase of allLearningPathCurriculum.phases) {
    for (const unit of phase.units) {
      const day = unit.days.find(d => d.dayNumber === dayNumber);
      if (day) {
        return JSON.parse(JSON.stringify(day));
      }
    }
  }
  return null;
}

/**
 * Retrieves all cards belonging to a specific phase, sorted by day number.
 * Returns cloned copies of cards to prevent mutation of the source.
 */
export function getLearningPathCardsByPhase(phaseId: string): LearningPathCard[] {
  const phase = allLearningPathCurriculum.phases.find(p => p.id === phaseId);
  if (!phase) return [];
  const cards: LearningPathCard[] = [];
  for (const unit of phase.units) {
    for (const day of unit.days) {
      for (const card of day.cards) {
        cards.push(JSON.parse(JSON.stringify(card)));
      }
    }
  }
  return cards.sort((a, b) => a.dayNumber - b.dayNumber);
}
