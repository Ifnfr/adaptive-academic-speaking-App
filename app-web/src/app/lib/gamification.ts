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
  | "normal_session_completed"
  | "retry_completed"
  | "diagnostic_completed"
  | "weekly_review_completed"
  | "mental_model_completed"
  | "level_up_applied"
  | "article_practice_completed"
  | "vocab_sentence_submitted"
  | "vocab_recall_session_completed"
  | "vocab_reused";

type XpEventSourceKind =
  | "session"
  | "retry"
  | "diagnostic"
  | "weekly-review"
  | "mental-model"
  | "level-up"
  | "article-practice"
  | "vocabulary";

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
  { level: 2, name: "Practicing Speaker", requiredXp: 120 },
  { level: 3, name: "Developing Speaker", requiredXp: 300 },
  { level: 4, name: "Structured Speaker", requiredXp: 650 },
  { level: 5, name: "Consistent Speaker", requiredXp: 1200 },
  { level: 6, name: "Clear Communicator", requiredXp: 2200 },
  { level: 7, name: "Analytical Speaker", requiredXp: 4000 },
  { level: 8, name: "Confident Speaker", requiredXp: 7000 },
  { level: 9, name: "Advanced Communicator", requiredXp: 12000 },
  { level: 10, name: "Academic Speaker", requiredXp: 20000 },
] as const;

export const XP_RULES: Readonly<
  Record<XpEventType, { xp: number; dailyCap: number }>
> = {
  normal_session_completed: { xp: 40, dailyCap: 3 },
  retry_completed: { xp: 15, dailyCap: 3 },
  diagnostic_completed: { xp: 30, dailyCap: 1 },
  weekly_review_completed: { xp: 35, dailyCap: 1 },
  mental_model_completed: { xp: 10, dailyCap: 2 },
  level_up_applied: { xp: 25, dailyCap: 1 },
  article_practice_completed: { xp: 25, dailyCap: 3 },
  vocab_sentence_submitted: { xp: 5, dailyCap: 10 },
  vocab_recall_session_completed: { xp: 20, dailyCap: 2 },
  vocab_reused: { xp: 10, dailyCap: 5 },
} as const;

export const DAILY_XP_CAP = 150;

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
  "vocabulary",
];

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
