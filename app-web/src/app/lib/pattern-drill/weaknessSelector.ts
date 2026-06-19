export type LearnerErrorPatternRow = {
  id: string;
  owner_id: string;
  source_kind: string;
  source_id: string;
  category: string;
  label: string;
  evidence?: string | null;
  correction?: string | null;
  practice_focus?: string | null;
  created_at: string;
  confidence?: number | null;
};

export type WeaknessDetails = {
  title: string;
  description: string;
  category: string;
  label: string;
  evidence?: string;
  practiceFocus?: string;
  failureCount: number;
  lastSeenAt: string;
  derivedConfidence: number;
};

export type WeaknessSelectorResult = {
  status: "found" | "insufficient" | "empty" | "error";
  weakness?: WeaknessDetails;
  reason?: string;
  recommendedAction?: string;
};

const GENERIC_WORDS = new Set([
  "grammar",
  "fluency",
  "vocabulary",
  "pronunciation",
  "clarity",
  "general",
  "weakness",
  "practice more",
  "needs improvement",
  "speaking issue",
  "communication",
  "language",
  "accuracy",
]);

const ACTIONABLE_PHRASES = [
  "although",
  "supporting reasons",
  "counterarguments",
  "one-clause responses",
  "specific examples",
  "sentence endings",
  "hedging phrase",
  "because clause",
  "reason",
  "opinion",
  "preposition",
  "prepositions",
  "verbs",
  "verb",
  "examples",
  "evidence",
  "compare",
  "contrast",
  "acknowledge opposing view",
  "acknowledge a counterpoint",
];

const RECENCY_WINDOW_DAYS = 30;
const MIN_SINGLE_CONFIDENCE = 0.65;
const MIN_REPEATED_CONFIDENCE = 0.8;
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 320;
const MAX_FIELD_LENGTH = 500;

function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function cleanBoundedText(text: string | null | undefined, maxLength: number): string {
  if (!text) return "";
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function getWordCount(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

function hasActionablePhrase(text: string): boolean {
  return ACTIONABLE_PHRASES.some((phrase) => text.includes(phrase));
}

function isGenericText(text: string): boolean {
  if (!text) return true;
  if (GENERIC_WORDS.has(text)) return true;
  if (getWordCount(text) <= 2) {
    return Array.from(GENERIC_WORDS).some((word) => text.includes(word));
  }
  return false;
}

function isSafeShortString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_FIELD_LENGTH;
}

function parseRow(row: unknown): LearnerErrorPatternRow | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const record = row as Record<string, unknown>;
  if (!isSafeShortString(record.id)) return null;
  if (!isSafeShortString(record.owner_id)) return null;
  if (!isSafeShortString(record.source_kind)) return null;
  if (!isSafeShortString(record.source_id)) return null;
  if (!isSafeShortString(record.category)) return null;
  if (!isSafeShortString(record.label)) return null;
  if (!isSafeShortString(record.created_at)) return null;

  const evidence = typeof record.evidence === "string" ? record.evidence : null;
  const correction = typeof record.correction === "string" ? record.correction : null;
  const practiceFocus = typeof record.practice_focus === "string" ? record.practice_focus : null;
  const confidence = typeof record.confidence === "number" && Number.isFinite(record.confidence)
    ? record.confidence
    : null;

  return {
    id: record.id,
    owner_id: record.owner_id,
    source_kind: record.source_kind,
    source_id: record.source_id,
    category: record.category,
    label: record.label,
    evidence,
    correction,
    practice_focus: practiceFocus,
    created_at: record.created_at,
    confidence,
  };
}

export function selectLatestWeakness(
  rows: unknown,
  options?: { now?: Date; ownerId?: string }
): WeaknessSelectorResult {
  if (!Array.isArray(rows)) {
    return {
      status: "error",
      reason: "Could not load weakness data. Try again later.",
    };
  }

  try {
    const typedRows = rows.map(parseRow).filter((row): row is LearnerErrorPatternRow => row !== null);
    const now = options?.now || new Date();
    const ownerId = options?.ownerId;

    if (rows.length === 0) {
      return {
        status: "empty",
        reason: "No speaking weakness data yet. Complete an evaluated Podchat session first.",
      };
    }

    if (typedRows.length === 0) {
      return {
        status: "insufficient",
        reason: "Your recent feedback is not specific enough for a useful Pattern Brief yet. Complete more Podchat sessions so Fonetik can detect a repeated pattern.",
      };
    }

    // 1. Filter rows
    const podchatRows = typedRows.filter((row) => {
      if (row.source_kind !== "podchat") return false;
      if (ownerId && row.owner_id !== ownerId) return false;
      return true;
    });

    if (podchatRows.length === 0) {
      return {
        status: "empty",
        reason: "No speaking weakness data yet. Complete an evaluated Podchat session first.",
      };
    }

    const validRows: LearnerErrorPatternRow[] = [];

    for (const row of podchatRows) {
      const normCategory = normalizeText(row.category);
      const normLabel = normalizeText(row.label);
      const normEvidence = normalizeText(row.evidence);
      const normPracticeFocus = normalizeText(row.practice_focus);
      const combinedText = normalizeText(`${row.label} ${row.evidence || ""} ${row.practice_focus || ""}`);

      // Reject category-only or vague labels
      if (isGenericText(normCategory) || isGenericText(normLabel)) {
        continue;
      }

      // Check recency (within 30 days)
      if (!row.created_at) continue;
      const createdAtDate = new Date(row.created_at);
      if (isNaN(createdAtDate.getTime())) continue;

      const diffTime = now.getTime() - createdAtDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      if (diffDays < 0 || diffDays > RECENCY_WINDOW_DAYS) continue;

      // Check specificity of built candidate description
      const rawDesc = row.practice_focus || row.evidence || row.label;
      const normDesc = normalizeText(rawDesc);
      const wordCount = getWordCount(normDesc);
      const labelWordCount = getWordCount(normLabel);
      const hasAction =
        hasActionablePhrase(normDesc) ||
        hasActionablePhrase(normLabel) ||
        hasActionablePhrase(normPracticeFocus) ||
        hasActionablePhrase(normEvidence);

      if (wordCount < 6 && labelWordCount < 3 && !hasAction) {
        continue;
      }

      if (!hasAction && getWordCount(combinedText) < 10) {
        continue;
      }

      validRows.push(row);
    }

    if (validRows.length === 0) {
      return {
        status: "insufficient",
        reason: "Your recent feedback is not specific enough for a useful Pattern Brief yet. Complete more Podchat sessions so Fonetik can detect a repeated pattern.",
      };
    }

    // 2. Group by normalized category + label
    const groups: Record<
      string,
      {
        rows: LearnerErrorPatternRow[];
        latestRow: LearnerErrorPatternRow;
      }
    > = {};

    for (const row of validRows) {
      const key = `${normalizeText(row.category)}||${normalizeText(row.label)}`;
      if (!groups[key]) {
        groups[key] = { rows: [], latestRow: row };
      }
      groups[key].rows.push(row);

      const currentLatestTime = new Date(groups[key].latestRow.created_at).getTime();
      const rowTime = new Date(row.created_at).getTime();
      if (rowTime > currentLatestTime) {
        groups[key].latestRow = row;
      }
    }

    // 3. Compute derived confidence and build display candidates
    const candidates: WeaknessDetails[] = [];

    for (const key of Object.keys(groups)) {
      const { rows: groupRows, latestRow } = groups[key];
      const failureCount = groupRows.length;

      // Derive confidence
      let derivedConfidence = 0.4;
      const rawDesc = latestRow.practice_focus || latestRow.evidence || latestRow.label;
      const normDesc = normalizeText(rawDesc);
      const specificityOk =
        getWordCount(normDesc) >= 6 ||
        hasActionablePhrase(normDesc) ||
        hasActionablePhrase(normalizeText(latestRow.label)) ||
        hasActionablePhrase(normalizeText(latestRow.practice_focus)) ||
        hasActionablePhrase(normalizeText(latestRow.evidence));

      const hasPracticeFocus = latestRow.practice_focus && latestRow.practice_focus.trim().length > 0;
      const hasEvidence = latestRow.evidence && latestRow.evidence.trim().length > 0;

      if (failureCount >= 2 && specificityOk && (hasPracticeFocus || hasEvidence)) {
        derivedConfidence = MIN_REPEATED_CONFIDENCE;
      } else if (failureCount === 1 && specificityOk && hasPracticeFocus && hasEvidence) {
        derivedConfidence = MIN_SINGLE_CONFIDENCE;
      }

      if (typeof latestRow.confidence === "number") {
        if (latestRow.confidence < 0.5) {
          derivedConfidence = Math.min(derivedConfidence, 0.5);
        } else if (latestRow.confidence >= 0.75 && derivedConfidence >= MIN_SINGLE_CONFIDENCE) {
          derivedConfidence = Math.max(derivedConfidence, latestRow.confidence);
        }
      }

      // Filter out candidates that do not meet thresholds
      if (derivedConfidence < MIN_SINGLE_CONFIDENCE) {
        continue;
      }

      candidates.push({
        title: cleanBoundedText(latestRow.label, MAX_TITLE_LENGTH),
        description: cleanBoundedText(latestRow.practice_focus || latestRow.evidence || latestRow.label, MAX_DESCRIPTION_LENGTH),
        category: cleanBoundedText(latestRow.category, MAX_TITLE_LENGTH),
        label: cleanBoundedText(latestRow.label, MAX_TITLE_LENGTH),
        evidence: cleanBoundedText(latestRow.evidence, MAX_DESCRIPTION_LENGTH) || undefined,
        practiceFocus: cleanBoundedText(latestRow.practice_focus, MAX_DESCRIPTION_LENGTH) || undefined,
        failureCount,
        lastSeenAt: latestRow.created_at,
        derivedConfidence,
      });
    }

    if (candidates.length === 0) {
      return {
        status: "insufficient",
        reason: "Your recent feedback is not specific enough for a useful Pattern Brief yet. Complete more Podchat sessions so Fonetik can detect a repeated pattern.",
      };
    }

    // 4. Tie-break sorting
    candidates.sort((a, b) => {
      // 1. Higher confidence
      if (b.derivedConfidence !== a.derivedConfidence) {
        return b.derivedConfidence - a.derivedConfidence;
      }
      // 2. Higher failure count
      if (b.failureCount !== a.failureCount) {
        return b.failureCount - a.failureCount;
      }
      // 3. Newer created_at
      const timeA = new Date(a.lastSeenAt).getTime();
      const timeB = new Date(b.lastSeenAt).getTime();
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      // 4. Completeness (has practiceFocus, then has evidence)
      const compA = (a.practiceFocus ? 2 : 0) + (a.evidence ? 1 : 0);
      const compB = (b.practiceFocus ? 2 : 0) + (b.evidence ? 1 : 0);
      return compB - compA;
    });

    return {
      status: "found",
      weakness: candidates[0],
    };
  } catch {
    return {
      status: "error",
      reason: "Could not load weakness data. Try again later.",
    };
  }
}
