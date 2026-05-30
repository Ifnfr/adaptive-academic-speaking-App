import { StoredLearningPathProgress, LearningPathCompletionRule, StoredCardProgress } from './types';

const STORAGE_KEY = 'fonetik:learning-path-progress:v1';

export function getDefaultProgress(
  pathId = 'beginner-confidence-ladder',
  phaseId = 'confidence-foundation'
): StoredLearningPathProgress {
  return {
    pathId,
    phaseId,
    cards: {},
    lastRecommendedCardId: null,
    lastUpdatedAt: new Date().toISOString()
  };
}

export function loadProgress(
  pathId = 'beginner-confidence-ladder',
  phaseId = 'confidence-foundation'
): StoredLearningPathProgress {
  if (typeof window === 'undefined' || !window.localStorage) {
    return getDefaultProgress(pathId, phaseId);
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getDefaultProgress(pathId, phaseId);
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return getDefaultProgress(pathId, phaseId);
    }
    if (typeof parsed.pathId !== 'string' || typeof parsed.phaseId !== 'string' || !parsed.cards || typeof parsed.cards !== 'object') {
      return getDefaultProgress(pathId, phaseId);
    }

    const sanitizedCards: Record<string, StoredCardProgress> = {};
    for (const cardId in parsed.cards) {
      const cardProgress = parsed.cards[cardId];
      if (cardProgress && typeof cardProgress === 'object' && typeof cardProgress.cardId === 'string') {
        sanitizedCards[cardId] = {
          cardId: cardProgress.cardId,
          status: typeof cardProgress.status === 'string' ? cardProgress.status as LearningPathCompletionRule : 'viewed',
          attemptCount: typeof cardProgress.attemptCount === 'number' ? cardProgress.attemptCount : 0,
          lastUpdatedAt: typeof cardProgress.lastUpdatedAt === 'string' ? cardProgress.lastUpdatedAt : new Date().toISOString()
        };
      }
    }

    return {
      pathId: parsed.pathId,
      phaseId: parsed.phaseId,
      cards: sanitizedCards,
      lastRecommendedCardId: typeof parsed.lastRecommendedCardId === 'string' ? parsed.lastRecommendedCardId : null,
      lastUpdatedAt: typeof parsed.lastUpdatedAt === 'string' ? parsed.lastUpdatedAt : new Date().toISOString()
    };
  } catch {
    return getDefaultProgress(pathId, phaseId);
  }
}

export function saveProgress(progress: StoredLearningPathProgress): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  // Explicitly copy only the safe progress schema fields to guarantee privacy
  const safeProgress: StoredLearningPathProgress = {
    pathId: progress.pathId,
    phaseId: progress.phaseId,
    cards: {},
    lastRecommendedCardId: progress.lastRecommendedCardId,
    lastUpdatedAt: new Date().toISOString()
  };

  for (const cardId in progress.cards) {
    const cardProgress = progress.cards[cardId];
    safeProgress.cards[cardId] = {
      cardId: cardProgress.cardId,
      status: cardProgress.status,
      attemptCount: cardProgress.attemptCount,
      lastUpdatedAt: cardProgress.lastUpdatedAt
    };
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safeProgress));
}

export function updateCardProgress(
  cardId: string,
  status: LearningPathCompletionRule,
  pathId = 'beginner-confidence-ladder',
  phaseId = 'confidence-foundation'
): StoredLearningPathProgress {
  const progress = loadProgress(pathId, phaseId);
  const now = new Date().toISOString();

  if (!progress.cards[cardId]) {
    progress.cards[cardId] = {
      cardId,
      status,
      attemptCount: 0,
      lastUpdatedAt: now
    };
  } else {
    progress.cards[cardId].status = status;
    progress.cards[cardId].lastUpdatedAt = now;
  }

  // Safe increment logic based on attempts/actions
  if (status === 'attempted' || status === 'recorded' || status === 'completed') {
    progress.cards[cardId].attemptCount += 1;
  }

  progress.lastUpdatedAt = now;
  saveProgress(progress);
  return progress;
}

export function incrementCardAttempt(
  cardId: string,
  pathId = 'beginner-confidence-ladder',
  phaseId = 'confidence-foundation'
): StoredLearningPathProgress {
  const progress = loadProgress(pathId, phaseId);
  const now = new Date().toISOString();

  if (!progress.cards[cardId]) {
    progress.cards[cardId] = {
      cardId,
      status: 'viewed',
      attemptCount: 1,
      lastUpdatedAt: now
    };
  } else {
    progress.cards[cardId].attemptCount += 1;
    progress.cards[cardId].lastUpdatedAt = now;
  }

  progress.lastUpdatedAt = now;
  saveProgress(progress);
  return progress;
}

export function resetProgress(
  pathId = 'beginner-confidence-ladder',
  phaseId = 'confidence-foundation'
): StoredLearningPathProgress {
  const defaultProgress = getDefaultProgress(pathId, phaseId);
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultProgress));
  }
  return defaultProgress;
}
