import { phase1Curriculum } from './phase1-curriculum';
import { StoredLearningPathProgress, CardStatus, LearningPathCard } from './types';

export interface RecommendationResult {
  recommendedCard: LearningPathCard | null;
  isPhaseComplete: boolean;
  cardStatuses: Record<string, CardStatus>;
}

export function getFlatCurriculumCards(): LearningPathCard[] {
  const phase = phase1Curriculum.phases[0];
  if (!phase) return [];
  const cards: LearningPathCard[] = [];
  for (const unit of phase.units) {
    for (const day of unit.days) {
      for (const card of day.cards) {
        cards.push(card);
      }
    }
  }
  return cards;
}

export function getRecommendation(progress: StoredLearningPathProgress): RecommendationResult {
  const flatCards = getFlatCurriculumCards();
  const cardStatuses: Record<string, CardStatus> = {};

  if (flatCards.length === 0) {
    return {
      recommendedCard: null,
      isPhaseComplete: true,
      cardStatuses
    };
  }

  // Find the first card that is not marked as 'completed'
  const recommendedCard = flatCards.find(card => {
    const cardProgress = progress.cards[card.id];
    return !cardProgress || cardProgress.status !== 'completed';
  });

  if (!recommendedCard) {
    // All cards in curriculum are completed
    flatCards.forEach(card => {
      cardStatuses[card.id] = 'completed';
    });
    return {
      recommendedCard: null,
      isPhaseComplete: true,
      cardStatuses
    };
  }

  // Compute status for every card in the curriculum
  flatCards.forEach(card => {
    const cardProgress = progress.cards[card.id];
    if (cardProgress && cardProgress.status === 'completed') {
      cardStatuses[card.id] = 'completed';
    } else if (card.id === recommendedCard.id) {
      // If the recommended card has some active progress (viewed/attempted/etc.), mark it as 'current'
      // Otherwise, it is 'recommended'
      if (cardProgress && cardProgress.status !== 'completed') {
        cardStatuses[card.id] = 'current';
      } else {
        cardStatuses[card.id] = 'recommended';
      }
    } else {
      // No hard locks: cards in the active/past days are 'available', cards in future days are 'upcoming'
      if (card.dayNumber <= recommendedCard.dayNumber) {
        cardStatuses[card.id] = 'available';
      } else {
        cardStatuses[card.id] = 'upcoming';
      }
    }
  });

  return {
    recommendedCard,
    isPhaseComplete: false,
    cardStatuses
  };
}
