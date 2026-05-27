export type VocabStatus =
  | "new"
  | "practicing"
  | "active"
  | "mastered"
  | "paused";

export type VocabSource = "manual" | "article" | "feedback" | "mental-model";

export type VocabLevel =
  | "Foundation"
  | "Beginner"
  | "Intermediate"
  | "Advanced"
  | "Expert";

export type VocabPartOfSpeech =
  | "noun"
  | "verb"
  | "adj"
  | "adv"
  | "prep"
  | "phrase"
  | "phrasal verb"
  | "idiom"
  | "other";

export type VocabCorrectionStatus =
  | "natural"
  | "understandable"
  | "awkward"
  | "incorrect";

export type VocabSentenceCorrection = {
  status: VocabCorrectionStatus;
  explanation: string;
  correctedSentence: string;
  collocationTip: string;
  retryInstruction: string;
  targetUsageRole?: string;
  warnings: string[];
  checkedAt: string;
  providerUsed: string;
};

export type VocabUserSentence = {
  id: string;
  sentence: string;
  containsWord: boolean;
  createdAt: string;
  correction?: VocabSentenceCorrection;
};

export type VocabItem = {
  version: 1;
  id: string;
  word: string;
  meaning: string;
  partOfSpeech?: VocabPartOfSpeech;
  source: VocabSource;
  level: VocabLevel;
  status: VocabStatus;
  example: string;
  collocations: string[];
  userSentences: VocabUserSentence[];
  reuseCount: number;
  correctUseCount: number;
  lastPracticedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VocabStats = {
  totalCount: number;
  byStatus: Record<VocabStatus, number>;
  bySource: Record<VocabSource, number>;
  totalReuseCount: number;
  practicedItemCount: number;
  unusedItemCount: number;
};

export type CreateVocabItemInput = {
  word: string;
  meaning: string;
  partOfSpeech?: VocabPartOfSpeech;
  source?: VocabSource;
  level?: VocabLevel;
  status?: VocabStatus;
  example?: string;
  collocations?: string[];
};

export type UpdateVocabItemPatch = Partial<{
  word: string;
  meaning: string;
  partOfSpeech: VocabPartOfSpeech;
  source: VocabSource;
  level: VocabLevel;
  status: VocabStatus;
  example: string;
  collocations: string[];
}>;

export type AddUserSentenceResult = {
  items: VocabItem[];
  accepted: boolean;
  reason: string;
  item: VocabItem | null;
};

export type SaveSentenceCorrectionInput = {
  status: VocabCorrectionStatus;
  explanation: string;
  correctedSentence: string;
  collocationTip: string;
  retryInstruction: string;
  targetUsageRole?: string;
  warnings?: string[];
  checkedAt?: string;
  providerUsed: string;
};

export type VocabularyPracticeQueueOptions = {
  size?: number;
  now?: Date;
};

export const VOCABULARY_STORAGE_KEY = "adaptive-speaking-app:vocabulary";

const STORAGE_VERSION = 1;
const MAX_USER_SENTENCES_PER_ITEM = 20;

const VOCAB_STATUSES: readonly VocabStatus[] = [
  "new",
  "practicing",
  "active",
  "mastered",
  "paused",
];

const VOCAB_SOURCES: readonly VocabSource[] = [
  "manual",
  "article",
  "feedback",
  "mental-model",
];

const VOCAB_LEVELS: readonly VocabLevel[] = [
  "Foundation",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
];

const VOCAB_PARTS_OF_SPEECH: readonly VocabPartOfSpeech[] = [
  "noun",
  "verb",
  "adj",
  "adv",
  "prep",
  "phrase",
  "phrasal verb",
  "idiom",
  "other",
];

const VOCAB_CORRECTION_STATUSES: readonly VocabCorrectionStatus[] = [
  "natural",
  "understandable",
  "awkward",
  "incorrect",
];

export function normalizeVocabulary(value: unknown): VocabItem[] {
  if (!Array.isArray(value)) return [];

  const items: VocabItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;

    const source = item as Record<string, unknown>;
    if (!isNonEmptyString(source.id)) continue;
    if (!isNonEmptyString(source.word)) continue;
    if (!isNonEmptyString(source.meaning)) continue;

    const createdAt = isIsoDateTimeString(source.createdAt)
      ? source.createdAt
      : new Date().toISOString();
    const updatedAt = isIsoDateTimeString(source.updatedAt)
      ? source.updatedAt
      : createdAt;

    items.push({
      version: STORAGE_VERSION,
      id: source.id.trim(),
      word: source.word.trim(),
      meaning: source.meaning.trim(),
      partOfSpeech: normalizePartOfSpeech(source.partOfSpeech),
      source: isVocabSource(source.source) ? source.source : "manual",
      level: isVocabLevel(source.level) ? source.level : "Foundation",
      status: isVocabStatus(source.status) ? source.status : "new",
      example: typeof source.example === "string" ? source.example.trim() : "",
      collocations: normalizeStringList(source.collocations),
      userSentences: normalizeUserSentences(source.userSentences),
      reuseCount: normalizeNonNegativeInteger(source.reuseCount),
      correctUseCount: normalizeNonNegativeInteger(source.correctUseCount),
      lastPracticedAt: isIsoDateTimeString(source.lastPracticedAt)
        ? source.lastPracticedAt
        : null,
      createdAt,
      updatedAt,
    });
  }

  return items;
}

export function loadVocabulary(): VocabItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(VOCABULARY_STORAGE_KEY);
    return normalizeVocabulary(raw ? JSON.parse(raw) : null);
  } catch {
    return [];
  }
}

export function saveVocabulary(items: ReadonlyArray<VocabItem>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      VOCABULARY_STORAGE_KEY,
      JSON.stringify(normalizeVocabulary(items)),
    );
  } catch {
    // Storage may be unavailable or full. Vocabulary should never break the app.
  }
}

export function createVocabItem(input: CreateVocabItemInput): VocabItem {
  const now = new Date().toISOString();
  return {
    version: STORAGE_VERSION,
    id: createLocalId("vocab"),
    word: input.word.trim(),
    meaning: input.meaning.trim(),
    partOfSpeech: normalizePartOfSpeech(input.partOfSpeech),
    source: input.source && isVocabSource(input.source) ? input.source : "manual",
    level: input.level && isVocabLevel(input.level) ? input.level : "Foundation",
    status: input.status && isVocabStatus(input.status) ? input.status : "new",
    example: input.example?.trim() ?? "",
    collocations: normalizeStringList(input.collocations),
    userSentences: [],
    reuseCount: 0,
    correctUseCount: 0,
    lastPracticedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateVocabItem(
  items: ReadonlyArray<VocabItem>,
  id: string,
  patch: UpdateVocabItemPatch,
): VocabItem[] {
  const safeId = id.trim();
  return normalizeVocabulary(items).map((item) => {
    if (item.id !== safeId) return item;

    return {
      ...item,
      word:
        typeof patch.word === "string" && patch.word.trim().length > 0
          ? patch.word.trim()
          : item.word,
      meaning:
        typeof patch.meaning === "string" && patch.meaning.trim().length > 0
          ? patch.meaning.trim()
          : item.meaning,
      source:
        patch.source && isVocabSource(patch.source) ? patch.source : item.source,
      level: patch.level && isVocabLevel(patch.level) ? patch.level : item.level,
      partOfSpeech:
        patch.partOfSpeech && isVocabPartOfSpeech(patch.partOfSpeech)
          ? patch.partOfSpeech
          : item.partOfSpeech,
      status:
        patch.status && isVocabStatus(patch.status) ? patch.status : item.status,
      example:
        typeof patch.example === "string" ? patch.example.trim() : item.example,
      collocations: Array.isArray(patch.collocations)
        ? normalizeStringList(patch.collocations)
        : item.collocations,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function deleteVocabItem(
  items: ReadonlyArray<VocabItem>,
  id: string,
): VocabItem[] {
  const safeId = id.trim();
  return normalizeVocabulary(items).filter((item) => item.id !== safeId);
}

export function updateVocabStatus(
  items: ReadonlyArray<VocabItem>,
  id: string,
  status: VocabStatus,
): VocabItem[] {
  if (!isVocabStatus(status)) return normalizeVocabulary(items);
  return updateVocabItem(items, id, { status });
}

export function markVocabularyPracticed(
  items: ReadonlyArray<VocabItem>,
  id: string,
  practicedAt: string = new Date().toISOString(),
): VocabItem[] {
  const safeId = id.trim();
  const safePracticedAt = isIsoDateTimeString(practicedAt)
    ? practicedAt
    : new Date().toISOString();

  return normalizeVocabulary(items).map((item) => {
    if (item.id !== safeId) return item;
    return {
      ...item,
      lastPracticedAt: safePracticedAt,
    };
  });
}

export function containsVocabWord(text: string, word: string): boolean {
  const normalizedText = normalizeSpacing(text).toLowerCase();
  const normalizedWord = normalizeSpacing(word).toLowerCase();
  if (!normalizedText || !normalizedWord) return false;

  if (normalizedWord.includes(" ")) {
    return normalizedText.includes(normalizedWord);
  }

  const pattern = new RegExp(`\\b${escapeRegExp(normalizedWord)}\\b`, "i");
  return pattern.test(normalizedText);
}

export function buildVocabularyPracticeQueue(
  items: ReadonlyArray<VocabItem>,
  options: VocabularyPracticeQueueOptions = {},
): string[] {
  const size = normalizeQueueSize(options.size);
  if (size <= 0) return [];

  const now = options.now instanceof Date ? options.now : new Date();
  const nowTime = Number.isNaN(now.getTime()) ? Date.now() : now.getTime();
  const eligibleItems = normalizeVocabulary(items).filter(
    (item) => item.status !== "paused",
  );

  const nonMasteredItems = eligibleItems.filter(
    (item) => item.status !== "mastered",
  );
  const masteredItems = eligibleItems.filter(
    (item) => item.status === "mastered",
  );
  const queuePool =
    nonMasteredItems.length >= size
      ? nonMasteredItems
      : [...nonMasteredItems, ...masteredItems];

  return queuePool
    .map((item, index) => ({
      item,
      index,
      score: scoreVocabularyForPractice(item, nowTime),
    }))
    .sort(comparePracticeQueueItems)
    .slice(0, size)
    .map(({ item }) => item.id);
}

export function addUserSentence(
  items: ReadonlyArray<VocabItem>,
  id: string,
  sentence: string,
): AddUserSentenceResult {
  const normalizedItems = normalizeVocabulary(items);
  const safeId = id.trim();
  const trimmedSentence = sentence.trim();
  const item = normalizedItems.find((candidate) => candidate.id === safeId);

  if (!item) {
    return {
      items: normalizedItems,
      accepted: false,
      reason: "Vocabulary item was not found.",
      item: null,
    };
  }

  if (trimmedSentence.length === 0) {
    return {
      items: normalizedItems,
      accepted: false,
      reason: "Write a sentence before saving.",
      item,
    };
  }

  if (!containsVocabWord(trimmedSentence, item.word)) {
    return {
      items: normalizedItems,
      accepted: false,
      reason: "Use the vocabulary word in your sentence first.",
      item,
    };
  }

  const now = new Date().toISOString();
  const userSentence: VocabUserSentence = {
    id: createLocalId("sentence"),
    sentence: trimmedSentence,
    containsWord: true,
    createdAt: now,
  };
  let updatedItem: VocabItem | null = null;
  const updatedItems = normalizedItems.map((candidate) => {
    if (candidate.id !== safeId) return candidate;

    updatedItem = {
      ...candidate,
      status: candidate.status === "new" ? "practicing" : candidate.status,
      userSentences: [...candidate.userSentences, userSentence].slice(
        -MAX_USER_SENTENCES_PER_ITEM,
      ),
      reuseCount: candidate.reuseCount + 1,
      lastPracticedAt: now,
      updatedAt: now,
    };
    return updatedItem;
  });

  return {
    items: updatedItems,
    accepted: true,
    reason: "Sentence saved.",
    item: updatedItem,
  };
}

export function saveSentenceCorrection(
  items: ReadonlyArray<VocabItem>,
  itemId: string,
  sentenceId: string,
  correction: SaveSentenceCorrectionInput,
): VocabItem[] {
  const normalizedItems = normalizeVocabulary(items);
  const safeItemId = itemId.trim();
  const safeSentenceId = sentenceId.trim();
  const normalizedCorrection = normalizeCorrection({
    ...correction,
    checkedAt: correction.checkedAt ?? new Date().toISOString(),
  });

  if (!normalizedCorrection) return normalizedItems;

  return normalizedItems.map((item) => {
    if (item.id !== safeItemId) return item;

    let foundSentence = false;
    const userSentences = item.userSentences.map((sentence) => {
      if (sentence.id !== safeSentenceId) return sentence;

      foundSentence = true;
      return {
        ...sentence,
        correction: normalizedCorrection,
      };
    });

    if (!foundSentence) return item;

    return {
      ...item,
      userSentences,
      correctUseCount: userSentences.filter((sentence) =>
        isSuccessfulCorrection(sentence.correction?.status),
      ).length,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function computeVocabularyStats(
  items: ReadonlyArray<VocabItem>,
): VocabStats {
  const normalizedItems = normalizeVocabulary(items);
  const byStatus = createStatusCounts();
  const bySource = createSourceCounts();
  let totalReuseCount = 0;
  let practicedItemCount = 0;
  let unusedItemCount = 0;

  for (const item of normalizedItems) {
    byStatus[item.status] += 1;
    bySource[item.source] += 1;
    totalReuseCount += item.reuseCount;
    if (item.reuseCount > 0 || item.userSentences.length > 0) {
      practicedItemCount += 1;
    } else {
      unusedItemCount += 1;
    }
  }

  return {
    totalCount: normalizedItems.length,
    byStatus,
    bySource,
    totalReuseCount,
    practicedItemCount,
    unusedItemCount,
  };
}

function normalizeUserSentences(value: unknown): VocabUserSentence[] {
  if (!Array.isArray(value)) return [];

  const sentences: VocabUserSentence[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const source = item as Record<string, unknown>;
    if (!isNonEmptyString(source.id)) continue;
    if (!isNonEmptyString(source.sentence)) continue;

    sentences.push({
      id: source.id.trim(),
      sentence: source.sentence.trim(),
      containsWord: source.containsWord === true,
      createdAt: isIsoDateTimeString(source.createdAt)
        ? source.createdAt
        : new Date().toISOString(),
      correction: normalizeCorrection(source.correction),
    });
  }

  return sentences.slice(-MAX_USER_SENTENCES_PER_ITEM);
}

function normalizeCorrection(value: unknown): VocabSentenceCorrection | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  if (!isVocabCorrectionStatus(source.status)) return undefined;
  if (!isNonEmptyString(source.explanation)) return undefined;
  if (!isNonEmptyString(source.correctedSentence)) return undefined;
  if (!isNonEmptyString(source.collocationTip)) return undefined;
  if (!isNonEmptyString(source.retryInstruction)) return undefined;
  if (!isIsoDateTimeString(source.checkedAt)) return undefined;
  if (!isNonEmptyString(source.providerUsed)) return undefined;

  return {
    status: source.status,
    explanation: source.explanation.trim(),
    correctedSentence: source.correctedSentence.trim(),
    collocationTip: source.collocationTip.trim(),
    retryInstruction: source.retryInstruction.trim(),
    targetUsageRole: isNonEmptyString(source.targetUsageRole)
      ? source.targetUsageRole.trim()
      : undefined,
    warnings: normalizeStringList(source.warnings),
    checkedAt: source.checkedAt,
    providerUsed: source.providerUsed.trim(),
  };
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function createStatusCounts(): Record<VocabStatus, number> {
  return {
    new: 0,
    practicing: 0,
    active: 0,
    mastered: 0,
    paused: 0,
  };
}

function createSourceCounts(): Record<VocabSource, number> {
  return {
    manual: 0,
    article: 0,
    feedback: 0,
    "mental-model": 0,
  };
}

type PracticeQueueCandidate = {
  item: VocabItem;
  index: number;
  score: number;
};

function scoreVocabularyForPractice(item: VocabItem, nowTime: number): number {
  const reuseCount = Math.max(0, item.reuseCount);
  const correctUseCount = Math.max(0, item.correctUseCount);
  let score = 0;

  if (item.status === "new") {
    score += 40;
  } else if (item.status === "practicing") {
    score += 30;
  } else if (item.status === "active") {
    score += 10;
  } else if (item.status === "mastered") {
    score -= 30;
  }

  score += (10 - Math.min(reuseCount, 10)) * 8;
  score += (5 - Math.min(correctUseCount, 5)) * 10;

  const lastPracticedTime = dateTimeValue(item.lastPracticedAt);
  if (lastPracticedTime === null) {
    score += 35;
  } else {
    const daysSincePractice = Math.max(
      0,
      Math.floor((nowTime - lastPracticedTime) / 86_400_000),
    );
    score += Math.min(30, daysSincePractice * 2);
  }

  if (item.source === "article" && reuseCount < 2) {
    score += 12;
  }

  score -= reuseCount * 3;
  score -= correctUseCount * 5;

  return score;
}

function comparePracticeQueueItems(
  a: PracticeQueueCandidate,
  b: PracticeQueueCandidate,
): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.item.reuseCount !== b.item.reuseCount) {
    return a.item.reuseCount - b.item.reuseCount;
  }
  if (a.item.correctUseCount !== b.item.correctUseCount) {
    return a.item.correctUseCount - b.item.correctUseCount;
  }

  const aLastPracticed = dateTimeValue(a.item.lastPracticedAt) ?? 0;
  const bLastPracticed = dateTimeValue(b.item.lastPracticedAt) ?? 0;
  if (aLastPracticed !== bLastPracticed) {
    return aLastPracticed - bLastPracticed;
  }

  const aCreatedAt = dateTimeValue(a.item.createdAt) ?? 0;
  const bCreatedAt = dateTimeValue(b.item.createdAt) ?? 0;
  if (aCreatedAt !== bCreatedAt) {
    return bCreatedAt - aCreatedAt;
  }

  const wordComparison = a.item.word.localeCompare(b.item.word);
  if (wordComparison !== 0) return wordComparison;
  return a.index - b.index;
}

function normalizeQueueSize(value: unknown): number {
  if (value === undefined) return 5;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.floor(numeric);
}

function dateTimeValue(value: string | null | undefined): number | null {
  if (!value) return null;
  const numeric = Date.parse(value);
  return Number.isNaN(numeric) ? null : numeric;
}

function createLocalId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeSpacing(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeNonNegativeInteger(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.floor(numeric);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDateTimeString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isVocabStatus(value: unknown): value is VocabStatus {
  return (
    typeof value === "string" &&
    VOCAB_STATUSES.includes(value as VocabStatus)
  );
}

function isVocabSource(value: unknown): value is VocabSource {
  return (
    typeof value === "string" && VOCAB_SOURCES.includes(value as VocabSource)
  );
}

function isVocabLevel(value: unknown): value is VocabLevel {
  return typeof value === "string" && VOCAB_LEVELS.includes(value as VocabLevel);
}

function isVocabPartOfSpeech(value: unknown): value is VocabPartOfSpeech {
  return (
    typeof value === "string" &&
    VOCAB_PARTS_OF_SPEECH.includes(value as VocabPartOfSpeech)
  );
}

function normalizePartOfSpeech(value: unknown): VocabPartOfSpeech {
  if (typeof value !== "string") return "other";
  const normalized = value.trim().toLowerCase();
  return isVocabPartOfSpeech(normalized) ? normalized : "other";
}

function isVocabCorrectionStatus(
  value: unknown,
): value is VocabCorrectionStatus {
  return (
    typeof value === "string" &&
    VOCAB_CORRECTION_STATUSES.includes(value as VocabCorrectionStatus)
  );
}

function isSuccessfulCorrection(
  status: VocabCorrectionStatus | undefined,
): boolean {
  return status === "natural" || status === "understandable";
}
