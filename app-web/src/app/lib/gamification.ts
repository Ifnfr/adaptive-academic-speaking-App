export type StorageVersion = 1;
export type LocalDateString = string;
export type ISODateTimeString = string;

export type SpeakerLevelName =
  | "New Speaker"
  | "Practicing Speaker"
  | "Developing Speaker"
  | "Structured Speaker"
  | "Consistent Speaker"
  | "Clear Communicator"
  | "Analytical Speaker"
  | "Confident Speaker"
  | "Advanced Communicator"
  | "Academic Speaker";

export type SpeakerLevelDefinition = {
  level: number;
  name: SpeakerLevelName;
  requiredXp: number;
};

export type XpProfile = {
  version: StorageVersion;
  totalXp: number;
  pendingDailyXp: number;
  unclaimedPreviousXp: number;
  activeDate: LocalDateString;
  lastClaimedDate: LocalDateString | null;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
};

export type XpEventType =
  | "podchat_beginner_evaluated"
  | "podchat_intermediate_evaluated"
  | "podchat_advanced_evaluated"
  | "podchat_expert_evaluated"
  | "podchat_context_bonus"
  | "podchat_retry_completed"
  | "article_essay_evaluated"
  | "article_vocab_saved"
  | "vocab_item_added"
  | "vocab_completeness_bonus"
  | "vocab_sentence_submitted"
  | "vocab_correction_saved"
  | "vocab_recall_session_completed"
  | "commonplace_note_created"
  | "commonplace_note_completeness_bonus"
  | "commonplace_map_note_added"
  | "commonplace_map_edge_created"
  | "weekly_review_completed"
  | "daily_meaningful_activity"
  | "normal_session_completed"
  | "retry_completed"
  | "diagnostic_completed"
  | "mental_model_completed"
  | "level_up_applied"
  | "article_practice_completed"
  | "vocab_reused";

type XpEventSourceKind =
  | "session"
  | "retry"
  | "diagnostic"
  | "weekly-review"
  | "mental-model"
  | "level-up"
  | "article-practice"
  | "article"
  | "vocabulary"
  | "commonplace"
  | "daily-activity";

export type XpEvent = {
  version: StorageVersion;
  id: string;
  type: XpEventType;
  xp: number;
  localDate: LocalDateString;
  createdAt: ISODateTimeString;
  sourceId: string;
  sourceKind: XpEventSourceKind;
  reason: string;
};

export type BadgeStatus = "locked" | "earned";

export type Badge = {
  version: StorageVersion;
  id: string;
  label: string;
  description: string;
  status: BadgeStatus;
  earnedAt: ISODateTimeString | null;
};

export type BadgeDefinition = {
  id: string;
  label: string;
  description: string;
};

export type DeriveUnlockedBadgesInput = {
  existingBadges: ReadonlyArray<Badge>;
  events: ReadonlyArray<XpEvent>;
  profile: XpProfile;
  today?: LocalDateString;
  earnedAt?: ISODateTimeString;
};

export type SpeakerLevelProgress = {
  currentLevel: SpeakerLevelDefinition;
  nextLevel: SpeakerLevelDefinition | null;
  xpIntoLevel: number;
  xpNeededForNext: number;
  progressRatio: number;
};

export type XpAwardCheckResult = {
  allowed: boolean;
  reason: string;
  xpToAward: number;
};

export type XpAwardResult = {
  profile: XpProfile;
  events: XpEvent[];
  result: XpAwardCheckResult;
};

export type XpClaimResult = {
  profile: XpProfile;
  result: {
    claimed: boolean;
    reason: string;
    claimedXp: number;
  };
};

export const XP_PROFILE_STORAGE_KEY = "adaptive-speaking-app:xp-profile";
export const XP_EVENTS_STORAGE_KEY = "adaptive-speaking-app:xp-events";
export const BADGES_STORAGE_KEY = "adaptive-speaking-app:badges";

export const SPEAKER_LEVELS: readonly SpeakerLevelDefinition[] = [
  { level: 1, name: "New Speaker", requiredXp: 0 },
  { level: 2, name: "Practicing Speaker", requiredXp: 100 },
  { level: 3, name: "Developing Speaker", requiredXp: 250 },
  { level: 4, name: "Structured Speaker", requiredXp: 500 },
  { level: 5, name: "Consistent Speaker", requiredXp: 900 },
  { level: 6, name: "Clear Communicator", requiredXp: 1500 },
  { level: 7, name: "Analytical Speaker", requiredXp: 2500 },
  { level: 8, name: "Confident Speaker", requiredXp: 4000 },
  { level: 9, name: "Advanced Communicator", requiredXp: 6500 },
  { level: 10, name: "Academic Speaker", requiredXp: 10000 },
] as const;

export const BADGE_DEFINITIONS: Readonly<Record<string, BadgeDefinition>> = {
  first_voice: {
    id: "first_voice",
    label: "First Voice",
    description: "Completed your first evaluated Podchat session.",
  },
  consistent_speaker_i: {
    id: "consistent_speaker_i",
    label: "Consistent Speaker I",
    description: "Completed meaningful learning activities on 3 active days.",
  },
  consistent_speaker_ii: {
    id: "consistent_speaker_ii",
    label: "Consistent Speaker II",
    description: "Completed meaningful learning activities on 7 active days.",
  },
  consistent_speaker_iii: {
    id: "consistent_speaker_iii",
    label: "Consistent Speaker III",
    description: "Completed meaningful learning activities on 30 active days.",
  },
  advanced_voice: {
    id: "advanced_voice",
    label: "Advanced Voice",
    description: "Completed 10 Advanced or Expert evaluated Podchat sessions.",
  },
  research_speaker: {
    id: "research_speaker",
    label: "Research Speaker",
    description: "Completed 5 evaluated Podchats with article or Commonplace context.",
  },
  vocabulary_builder_i: {
    id: "vocabulary_builder_i",
    label: "Vocabulary Builder I",
    description: "Saved 10 meaningful vocabulary items.",
  },
  vocabulary_builder_ii: {
    id: "vocabulary_builder_ii",
    label: "Vocabulary Builder II",
    description: "Saved 50 meaningful vocabulary items.",
  },
  vocabulary_builder_iii: {
    id: "vocabulary_builder_iii",
    label: "Vocabulary Builder III",
    description: "Saved 100 meaningful vocabulary items.",
  },
  sentence_refiner: {
    id: "sentence_refiner",
    label: "Sentence Refiner",
    description: "Saved 25 vocabulary sentence corrections or revisions.",
  },
  recall_runner: {
    id: "recall_runner",
    label: "Recall Runner",
    description: "Completed 10 five-card vocabulary recall sessions.",
  },
  first_commonplace: {
    id: "first_commonplace",
    label: "First Commonplace",
    description: "Created your first meaningful Commonplace note.",
  },
  map_thinker: {
    id: "map_thinker",
    label: "Map Thinker",
    description: "Saved at least 2 notes in a Sub Mind Map.",
  },
  connector: {
    id: "connector",
    label: "Connector",
    description: "Created 25 meaningful saved Commonplace map connections.",
  },
  synthesis_builder: {
    id: "synthesis_builder",
    label: "Synthesis Builder",
    description: "Built a Main Map with multiple saved notes or mixed map activity.",
  },
  three_day_rhythm: {
    id: "three_day_rhythm",
    label: "Three-Day Rhythm",
    description: "Completed meaningful learning activities on 3 active days.",
  },
  seven_day_rhythm: {
    id: "seven_day_rhythm",
    label: "Seven-Day Rhythm",
    description: "Completed meaningful learning activities on 7 active days.",
  },
  monthly_practice_habit: {
    id: "monthly_practice_habit",
    label: "Monthly Practice Habit",
    description: "Completed meaningful learning activities on 20 days within 30 days.",
  },
  first_weekly_reflector: {
    id: "first_weekly_reflector",
    label: "First Weekly Reflector",
    description: "Completed your first full Weekly Review.",
  },
  reflective_learner: {
    id: "reflective_learner",
    label: "Reflective Learner",
    description: "Completed 4 full Weekly Reviews.",
  },
  monthly_reviewer: {
    id: "monthly_reviewer",
    label: "Monthly Reviewer",
    description: "Completed 8 full Weekly Reviews.",
  },
  academic_speaker: {
    id: "academic_speaker",
    label: "Academic Speaker",
    description: "Reached Speaker Level 10.",
  },
  resilient_learner: {
    id: "resilient_learner",
    label: "Resilient Learner",
    description: "Completed 20 retry or improvement events.",
  },
  connected_thinker: {
    id: "connected_thinker",
    label: "Connected Thinker",
    description: "Completed 5 Commonplace discussions through evaluated Podchat sessions.",
  },
} as const;

export const XP_RULES: Readonly<
  Record<XpEventType, { xp: number; dailyCap: number }>
> = {
  podchat_beginner_evaluated: { xp: 30, dailyCap: 10 },
  podchat_intermediate_evaluated: { xp: 50, dailyCap: 10 },
  podchat_advanced_evaluated: { xp: 75, dailyCap: 10 },
  podchat_expert_evaluated: { xp: 100, dailyCap: 10 },
  podchat_context_bonus: { xp: 15, dailyCap: 10 },
  podchat_retry_completed: { xp: 20, dailyCap: 3 },
  article_essay_evaluated: { xp: 60, dailyCap: 5 },
  article_vocab_saved: { xp: 10, dailyCap: 5 },
  vocab_item_added: { xp: 10, dailyCap: 10 },
  vocab_completeness_bonus: { xp: 5, dailyCap: 5 },
  vocab_sentence_submitted: { xp: 15, dailyCap: 10 },
  vocab_correction_saved: { xp: 20, dailyCap: 5 },
  vocab_recall_session_completed: { xp: 40, dailyCap: 2 },
  commonplace_note_created: { xp: 15, dailyCap: 8 },
  commonplace_note_completeness_bonus: { xp: 5, dailyCap: 8 },
  commonplace_map_note_added: { xp: 5, dailyCap: 10 },
  commonplace_map_edge_created: { xp: 10, dailyCap: 10 },
  weekly_review_completed: { xp: 80, dailyCap: 1 },
  daily_meaningful_activity: { xp: 20, dailyCap: 1 },
  normal_session_completed: { xp: 40, dailyCap: 3 },
  retry_completed: { xp: 15, dailyCap: 3 },
  diagnostic_completed: { xp: 30, dailyCap: 1 },
  mental_model_completed: { xp: 10, dailyCap: 2 },
  level_up_applied: { xp: 25, dailyCap: 1 },
  article_practice_completed: { xp: 25, dailyCap: 3 },
  vocab_reused: { xp: 10, dailyCap: 5 },
} as const;

export const DAILY_XP_CAP = 220;

const STORAGE_VERSION: StorageVersion = 1;
const EVENT_TYPES = Object.keys(XP_RULES) as XpEventType[];
const EVENT_SOURCE_KINDS: readonly XpEventSourceKind[] = [
  "session",
  "retry",
  "diagnostic",
  "weekly-review",
  "mental-model",
  "level-up",
  "article-practice",
  "article",
  "vocabulary",
  "commonplace",
  "daily-activity",
];

export type PodchatXpDifficulty =
  | "Beginner"
  | "Intermediate"
  | "Advanced"
  | "Expert";

export function xpEventTypeForPodchatDifficulty(
  difficulty: PodchatXpDifficulty,
): XpEventType {
  if (difficulty === "Beginner") return "podchat_beginner_evaluated";
  if (difficulty === "Advanced") return "podchat_advanced_evaluated";
  if (difficulty === "Expert") return "podchat_expert_evaluated";
  return "podchat_intermediate_evaluated";
}

export function getLocalDateString(date = new Date()): LocalDateString {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createDefaultXpProfile(
  today: LocalDateString = getLocalDateString(),
): XpProfile {
  const now = new Date().toISOString();
  return {
    version: STORAGE_VERSION,
    totalXp: 0,
    pendingDailyXp: 0,
    unclaimedPreviousXp: 0,
    activeDate: isLocalDateString(today) ? today : getLocalDateString(),
    lastClaimedDate: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeXpProfile(
  value: unknown,
  today: LocalDateString = getLocalDateString(),
): XpProfile {
  const fallback = createDefaultXpProfile(today);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const source = value as Record<string, unknown>;
  const profile: XpProfile = {
    version: STORAGE_VERSION,
    totalXp: normalizeNonNegativeInteger(source.totalXp),
    pendingDailyXp: normalizeNonNegativeInteger(source.pendingDailyXp),
    unclaimedPreviousXp: normalizeNonNegativeInteger(
      source.unclaimedPreviousXp,
    ),
    activeDate: isLocalDateString(source.activeDate)
      ? source.activeDate
      : fallback.activeDate,
    lastClaimedDate: isLocalDateString(source.lastClaimedDate)
      ? source.lastClaimedDate
      : null,
    createdAt: isISODateTimeString(source.createdAt)
      ? source.createdAt
      : fallback.createdAt,
    updatedAt: isISODateTimeString(source.updatedAt)
      ? source.updatedAt
      : fallback.updatedAt,
  };

  return rolloverXpProfile(profile, today);
}

export function normalizeXpEvents(value: unknown): XpEvent[] {
  if (!Array.isArray(value)) return [];

  const events: XpEvent[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const source = item as Record<string, unknown>;
    if (!isXpEventType(source.type)) continue;
    if (!isNonEmptyString(source.id)) continue;
    if (!isNonEmptyString(source.sourceId)) continue;
    if (!isXpEventSourceKind(source.sourceKind)) continue;
    if (!isLocalDateString(source.localDate)) continue;
    if (!isISODateTimeString(source.createdAt)) continue;

    const type = source.type;
    events.push({
      version: STORAGE_VERSION,
      id: source.id.trim(),
      type,
      xp: normalizeEventXp(source.xp, type),
      localDate: source.localDate,
      createdAt: source.createdAt,
      sourceId: source.sourceId.trim(),
      sourceKind: source.sourceKind,
      reason: isNonEmptyString(source.reason) ? source.reason.trim() : type,
    });
  }

  return events;
}

export function computeSpeakerLevel(
  totalXp: number,
): SpeakerLevelDefinition {
  const safeXp = normalizeNonNegativeInteger(totalXp);
  let current = SPEAKER_LEVELS[0];
  for (const level of SPEAKER_LEVELS) {
    if (safeXp >= level.requiredXp) current = level;
    else break;
  }
  return current;
}

export function getNextSpeakerLevel(
  totalXp: number,
): SpeakerLevelDefinition | null {
  const current = computeSpeakerLevel(totalXp);
  return SPEAKER_LEVELS.find((level) => level.level > current.level) ?? null;
}

export function getSpeakerLevelProgress(
  totalXp: number,
): SpeakerLevelProgress {
  const safeXp = normalizeNonNegativeInteger(totalXp);
  const currentLevel = computeSpeakerLevel(safeXp);
  const nextLevel = getNextSpeakerLevel(safeXp);

  if (!nextLevel) {
    return {
      currentLevel,
      nextLevel: null,
      xpIntoLevel: safeXp - currentLevel.requiredXp,
      xpNeededForNext: 0,
      progressRatio: 1,
    };
  }

  const levelSpan = nextLevel.requiredXp - currentLevel.requiredXp;
  const xpIntoLevel = Math.max(0, safeXp - currentLevel.requiredXp);
  const xpNeededForNext = Math.max(0, nextLevel.requiredXp - safeXp);
  const progressRatio = levelSpan <= 0 ? 1 : clamp01(xpIntoLevel / levelSpan);

  return {
    currentLevel,
    nextLevel,
    xpIntoLevel,
    xpNeededForNext,
    progressRatio,
  };
}

export function deriveUnlockedBadges({
  existingBadges,
  events,
  profile,
  today = getLocalDateString(),
  earnedAt = new Date().toISOString(),
}: DeriveUnlockedBadgesInput): Badge[] {
  const normalizedBadges = normalizeBadges(existingBadges);
  const normalizedEvents = dedupeXpEvents(normalizeXpEvents(events));
  const earnedIds = new Set(
    normalizedBadges
      .filter((badge) => badge.status === "earned")
      .map((badge) => badge.id),
  );
  const nextBadges = [...normalizedBadges];

  const counts = buildBadgeEventCounts(normalizedEvents, today);
  const criteria: Record<string, boolean> = {
    first_voice: counts.evaluatedPodchats >= 1,
    consistent_speaker_i: counts.activeDays >= 3,
    consistent_speaker_ii: counts.activeDays >= 7,
    consistent_speaker_iii: counts.activeDays >= 30,
    advanced_voice: counts.advancedPodchats >= 10,
    research_speaker: counts.contextPodchats >= 5,
    vocabulary_builder_i: counts.savedVocabulary >= 10,
    vocabulary_builder_ii: counts.savedVocabulary >= 50,
    vocabulary_builder_iii: counts.savedVocabulary >= 100,
    sentence_refiner: counts.vocabularyCorrections >= 25,
    recall_runner: counts.recallSessions >= 10,
    first_commonplace: counts.commonplaceNotes >= 1,
    map_thinker: counts.hasSubMapWithTwoNotes,
    connector: counts.commonplaceEdges >= 25,
    synthesis_builder: counts.hasMainMapSynthesis,
    three_day_rhythm: counts.activeDays >= 3,
    seven_day_rhythm: counts.activeDays >= 7,
    monthly_practice_habit: counts.activeDaysInLastThirty >= 20,
    first_weekly_reflector: counts.weeklyReviews >= 1,
    reflective_learner: counts.weeklyReviews >= 4,
    monthly_reviewer: counts.weeklyReviews >= 8,
    academic_speaker: getSpeakerLevelProgress(profile.totalXp).currentLevel.level >= 10,
    resilient_learner: counts.retryEvents >= 20,
    connected_thinker: counts.commonplaceContextPodchats >= 5,
  };

  for (const definition of Object.values(BADGE_DEFINITIONS)) {
    if (!criteria[definition.id] || earnedIds.has(definition.id)) continue;
    nextBadges.push(createEarnedBadge(definition, earnedAt));
    earnedIds.add(definition.id);
  }

  return nextBadges;
}

export function rolloverXpProfile(
  profile: XpProfile,
  today: LocalDateString = getLocalDateString(),
): XpProfile {
  const safeToday = isLocalDateString(today) ? today : getLocalDateString();
  const normalized: XpProfile = {
    version: STORAGE_VERSION,
    totalXp: normalizeNonNegativeInteger(profile.totalXp),
    pendingDailyXp: normalizeNonNegativeInteger(profile.pendingDailyXp),
    unclaimedPreviousXp: normalizeNonNegativeInteger(
      profile.unclaimedPreviousXp,
    ),
    activeDate: isLocalDateString(profile.activeDate)
      ? profile.activeDate
      : safeToday,
    lastClaimedDate: isLocalDateString(profile.lastClaimedDate)
      ? profile.lastClaimedDate
      : null,
    createdAt: isISODateTimeString(profile.createdAt)
      ? profile.createdAt
      : new Date().toISOString(),
    updatedAt: isISODateTimeString(profile.updatedAt)
      ? profile.updatedAt
      : new Date().toISOString(),
  };

  if (normalized.activeDate === safeToday) return normalized;

  return {
    ...normalized,
    pendingDailyXp: 0,
    unclaimedPreviousXp:
      normalized.unclaimedPreviousXp + normalized.pendingDailyXp,
    activeDate: safeToday,
    updatedAt: new Date().toISOString(),
  };
}

export function canAwardXpEvent(
  profile: XpProfile,
  events: ReadonlyArray<XpEvent>,
  candidate: XpEvent,
): XpAwardCheckResult {
  const normalizedEvents = normalizeXpEvents(events);
  const today = candidate.localDate;
  const rolledProfile = rolloverXpProfile(profile, today);
  const rule = XP_RULES[candidate.type];

  const duplicate = normalizedEvents.some(
    (event) =>
      event.type === candidate.type && event.sourceId === candidate.sourceId,
  );
  if (duplicate) {
    return {
      allowed: false,
      reason: "This XP event has already been awarded.",
      xpToAward: 0,
    };
  }

  const sameTypeTodayCount = normalizedEvents.filter(
    (event) => event.type === candidate.type && event.localDate === today,
  ).length;
  if (sameTypeTodayCount >= rule.dailyCap) {
    return {
      allowed: false,
      reason: "Daily cap reached for this XP event type.",
      xpToAward: 0,
    };
  }

  const eventXpToday = normalizedEvents
    .filter((event) => event.localDate === today)
    .reduce((sum, event) => sum + event.xp, 0);
  const countedDailyXp = Math.max(eventXpToday, rolledProfile.pendingDailyXp);
  const remainingDailyXp = DAILY_XP_CAP - countedDailyXp;
  if (remainingDailyXp <= 0) {
    return {
      allowed: false,
      reason: "Daily XP cap reached.",
      xpToAward: 0,
    };
  }

  return {
    allowed: true,
    reason:
      remainingDailyXp < rule.xp
        ? "XP awarded with the remaining daily cap."
        : "XP event is eligible.",
    xpToAward: Math.min(rule.xp, remainingDailyXp),
  };
}

export function awardXpEvent(
  profile: XpProfile,
  events: ReadonlyArray<XpEvent>,
  candidate: XpEvent,
): XpAwardResult {
  const rolledProfile = rolloverXpProfile(profile, candidate.localDate);
  const normalizedEvents = normalizeXpEvents(events);
  const result = canAwardXpEvent(rolledProfile, normalizedEvents, candidate);

  if (!result.allowed || result.xpToAward <= 0) {
    return {
      profile: rolledProfile,
      events: normalizedEvents,
      result,
    };
  }

  const awardedEvent: XpEvent = {
    ...candidate,
    version: STORAGE_VERSION,
    xp: result.xpToAward,
  };

  return {
    profile: {
      ...rolledProfile,
      pendingDailyXp: rolledProfile.pendingDailyXp + result.xpToAward,
      updatedAt: new Date().toISOString(),
    },
    events: [...normalizedEvents, awardedEvent],
    result,
  };
}

export function claimXp(
  profile: XpProfile,
  today: LocalDateString = getLocalDateString(),
): XpClaimResult {
  const rolledProfile = rolloverXpProfile(profile, today);
  if (rolledProfile.lastClaimedDate === today) {
    return {
      profile: rolledProfile,
      result: {
        claimed: false,
        reason: "XP has already been claimed today.",
        claimedXp: 0,
      },
    };
  }

  const claimableXp =
    rolledProfile.pendingDailyXp + rolledProfile.unclaimedPreviousXp;
  if (claimableXp <= 0) {
    return {
      profile: rolledProfile,
      result: {
        claimed: false,
        reason: "No XP is available to claim.",
        claimedXp: 0,
      },
    };
  }

  return {
    profile: {
      ...rolledProfile,
      totalXp: rolledProfile.totalXp + claimableXp,
      pendingDailyXp: 0,
      unclaimedPreviousXp: 0,
      lastClaimedDate: today,
      updatedAt: new Date().toISOString(),
    },
    result: {
      claimed: true,
      reason: "XP claimed successfully.",
      claimedXp: claimableXp,
    },
  };
}

export function createXpEvent(input: {
  type: XpEventType;
  sourceId: string;
  sourceKind: XpEvent["sourceKind"];
  reason?: string;
  localDate?: LocalDateString;
  createdAt?: ISODateTimeString;
}): XpEvent {
  const localDate =
    input.localDate && isLocalDateString(input.localDate)
      ? input.localDate
      : getLocalDateString();
  const createdAt =
    input.createdAt && isISODateTimeString(input.createdAt)
      ? input.createdAt
      : new Date().toISOString();
  const sourceId = input.sourceId.trim() || "unknown-source";
  const idParts = [
    input.type,
    sourceId,
    localDate,
    createdAt,
    Math.random().toString(36).slice(2, 8),
  ];

  return {
    version: STORAGE_VERSION,
    id: idParts.map(safeIdPart).join(":"),
    type: input.type,
    xp: XP_RULES[input.type].xp,
    localDate,
    createdAt,
    sourceId,
    sourceKind: input.sourceKind,
    reason: input.reason?.trim() || input.type,
  };
}

export function loadXpProfile(): XpProfile {
  const today = getLocalDateString();
  if (typeof window === "undefined") return createDefaultXpProfile(today);
  try {
    const raw = window.localStorage.getItem(XP_PROFILE_STORAGE_KEY);
    return normalizeXpProfile(raw ? JSON.parse(raw) : null, today);
  } catch {
    return createDefaultXpProfile(today);
  }
}

export function saveXpProfile(profile: XpProfile): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(
      XP_PROFILE_STORAGE_KEY,
      JSON.stringify(normalizeXpProfile(profile)),
    );
    return true;
  } catch {
    return false;
  }
}

export function loadXpEvents(): XpEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(XP_EVENTS_STORAGE_KEY);
    return normalizeXpEvents(raw ? JSON.parse(raw) : null);
  } catch {
    return [];
  }
}

export function saveXpEvents(events: ReadonlyArray<XpEvent>): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(
      XP_EVENTS_STORAGE_KEY,
      JSON.stringify(normalizeXpEvents(events)),
    );
    return true;
  } catch {
    return false;
  }
}

export function loadBadges(): Badge[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BADGES_STORAGE_KEY);
    return normalizeBadges(raw ? JSON.parse(raw) : null);
  } catch {
    return [];
  }
}

export function saveBadges(badges: ReadonlyArray<Badge>): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(
      BADGES_STORAGE_KEY,
      JSON.stringify(normalizeBadges(badges)),
    );
    return true;
  } catch {
    return false;
  }
}

function normalizeBadges(value: unknown): Badge[] {
  if (!Array.isArray(value)) return [];

  const badges: Badge[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const source = item as Record<string, unknown>;
    if (!isNonEmptyString(source.id)) continue;
    if (!isNonEmptyString(source.label)) continue;
    if (!isNonEmptyString(source.description)) continue;
    const status = source.status === "earned" ? "earned" : "locked";

    badges.push({
      version: STORAGE_VERSION,
      id: source.id.trim(),
      label: source.label.trim(),
      description: source.description.trim(),
      status,
      earnedAt:
        status === "earned" && isISODateTimeString(source.earnedAt)
          ? source.earnedAt
          : null,
    });
  }

  return badges;
}

function createEarnedBadge(
  definition: BadgeDefinition,
  earnedAt: ISODateTimeString,
): Badge {
  return {
    version: STORAGE_VERSION,
    id: definition.id,
    label: definition.label,
    description: definition.description,
    status: "earned",
    earnedAt: isISODateTimeString(earnedAt) ? earnedAt : new Date().toISOString(),
  };
}

function dedupeXpEvents(events: ReadonlyArray<XpEvent>): XpEvent[] {
  const seen = new Set<string>();
  const deduped: XpEvent[] = [];
  for (const event of events) {
    const key = `${event.type}:${event.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(event);
  }
  return deduped;
}

function buildBadgeEventCounts(
  events: ReadonlyArray<XpEvent>,
  today: LocalDateString,
): {
  evaluatedPodchats: number;
  advancedPodchats: number;
  contextPodchats: number;
  commonplaceContextPodchats: number;
  retryEvents: number;
  savedVocabulary: number;
  vocabularyCorrections: number;
  recallSessions: number;
  commonplaceNotes: number;
  commonplaceEdges: number;
  weeklyReviews: number;
  activeDays: number;
  activeDaysInLastThirty: number;
  hasSubMapWithTwoNotes: boolean;
  hasMainMapSynthesis: boolean;
} {
  const activeDates = new Set<string>();
  const subMapNotes = new Map<string, number>();
  const mainMapNotes = new Map<string, number>();
  const mainMapEdges = new Map<string, number>();

  let evaluatedPodchats = 0;
  let advancedPodchats = 0;
  let contextPodchats = 0;
  let commonplaceContextPodchats = 0;
  let retryEvents = 0;
  let savedVocabulary = 0;
  let vocabularyCorrections = 0;
  let recallSessions = 0;
  let commonplaceNotes = 0;
  let commonplaceEdges = 0;
  let weeklyReviews = 0;

  for (const event of events) {
    if (isEvaluatedPodchatEvent(event.type)) evaluatedPodchats += 1;
    if (
      event.type === "podchat_advanced_evaluated" ||
      event.type === "podchat_expert_evaluated"
    ) {
      advancedPodchats += 1;
    }
    if (event.type === "podchat_context_bonus") {
      contextPodchats += 1;
      if (isCommonplaceContextEvent(event)) commonplaceContextPodchats += 1;
    }
    if (event.type === "podchat_retry_completed" || event.type === "retry_completed") {
      retryEvents += 1;
    }
    if (event.type === "vocab_item_added" || event.type === "article_vocab_saved") {
      savedVocabulary += 1;
    }
    if (event.type === "vocab_correction_saved") vocabularyCorrections += 1;
    if (event.type === "vocab_recall_session_completed") recallSessions += 1;
    if (event.type === "commonplace_note_created") commonplaceNotes += 1;
    if (event.type === "commonplace_map_edge_created") {
      commonplaceEdges += 1;
      const mainMapKey = parseCommonplaceMapKey(event.sourceId, "main", "edge");
      if (mainMapKey) {
        mainMapEdges.set(mainMapKey, (mainMapEdges.get(mainMapKey) ?? 0) + 1);
      }
    }
    if (event.type === "weekly_review_completed") weeklyReviews += 1;
    if (event.type === "daily_meaningful_activity") activeDates.add(event.localDate);
    if (event.type === "commonplace_map_note_added") {
      const subMapKey = parseCommonplaceMapKey(event.sourceId, "sub", "note");
      if (subMapKey) {
        subMapNotes.set(subMapKey, (subMapNotes.get(subMapKey) ?? 0) + 1);
      }
      const mainMapKey = parseCommonplaceMapKey(event.sourceId, "main", "note");
      if (mainMapKey) {
        mainMapNotes.set(mainMapKey, (mainMapNotes.get(mainMapKey) ?? 0) + 1);
      }
    }
  }

  return {
    evaluatedPodchats,
    advancedPodchats,
    contextPodchats,
    commonplaceContextPodchats,
    retryEvents,
    savedVocabulary,
    vocabularyCorrections,
    recallSessions,
    commonplaceNotes,
    commonplaceEdges,
    weeklyReviews,
    activeDays: activeDates.size,
    activeDaysInLastThirty: countDatesInLastThirtyDays(activeDates, today),
    hasSubMapWithTwoNotes: Array.from(subMapNotes.values()).some(
      (count) => count >= 2,
    ),
    hasMainMapSynthesis: Array.from(mainMapNotes.entries()).some(
      ([mapKey, noteCount]) =>
        noteCount >= 2 || (noteCount >= 1 && (mainMapEdges.get(mapKey) ?? 0) >= 1),
    ),
  };
}

function isEvaluatedPodchatEvent(type: XpEventType): boolean {
  return (
    type === "podchat_beginner_evaluated" ||
    type === "podchat_intermediate_evaluated" ||
    type === "podchat_advanced_evaluated" ||
    type === "podchat_expert_evaluated" ||
    type === "normal_session_completed"
  );
}

function isCommonplaceContextEvent(event: XpEvent): boolean {
  const sourceId = event.sourceId.toLowerCase();
  const reason = event.reason.toLowerCase();
  return sourceId.includes("commonplace") || reason.includes("commonplace");
}

function parseCommonplaceMapKey(
  sourceId: string,
  mapType: "sub" | "main",
  itemType: "note" | "edge",
): string | null {
  const prefix = `commonplace-${mapType}-map-${itemType}-`;
  if (!sourceId.startsWith(prefix)) return null;
  const rest = sourceId.slice(prefix.length);
  const firstSegment = rest.split("-")[0]?.trim();
  return firstSegment || mapType;
}

function countDatesInLastThirtyDays(
  activeDates: ReadonlySet<string>,
  today: LocalDateString,
): number {
  const todayTime = new Date(`${today}T00:00:00`).getTime();
  if (Number.isNaN(todayTime)) return 0;
  const windowStart = todayTime - 29 * 24 * 60 * 60 * 1000;
  let count = 0;
  for (const activeDate of activeDates) {
    const activeTime = new Date(`${activeDate}T00:00:00`).getTime();
    if (!Number.isNaN(activeTime) && activeTime >= windowStart && activeTime <= todayTime) {
      count += 1;
    }
  }
  return count;
}

function normalizeNonNegativeInteger(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.floor(numeric);
}

function normalizeEventXp(value: unknown, type: XpEventType): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return XP_RULES[type].xp;
  return Math.min(Math.floor(numeric), XP_RULES[type].xp);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isLocalDateString(value: unknown): value is LocalDateString {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
  );
}

function isISODateTimeString(value: unknown): value is ISODateTimeString {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isXpEventType(value: unknown): value is XpEventType {
  return typeof value === "string" && EVENT_TYPES.includes(value as XpEventType);
}

function isXpEventSourceKind(value: unknown): value is XpEventSourceKind {
  return (
    typeof value === "string" &&
    EVENT_SOURCE_KINDS.includes(value as XpEventSourceKind)
  );
}

function safeIdPart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}
