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
]);

const ACTIONABLE_PHRASES = [
  "supporting reasons",
  "counterarguments",
  "one-clause responses",
  "specific examples",
  "sentence endings",
  "hedging phrase",
  "because clause",
  "evidence",
  "compare",
  "contrast",
  "acknowledge opposing view",
];

function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function getWordCount(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

function hasActionablePhrase(text: string): boolean {
  return ACTIONABLE_PHRASES.some((phrase) => text.includes(phrase));
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
    const typedRows = rows as LearnerErrorPatternRow[];
    const now = options?.now || new Date();
    const ownerId = options?.ownerId;

    if (typedRows.length === 0) {
      return {
        status: "empty",
        reason: "No speaking weakness data yet. Complete an evaluated Podchat session first.",
      };
    }

    // 1. Filter rows
    const validRows: LearnerErrorPatternRow[] = [];

    for (const row of typedRows) {
      if (!row || typeof row !== "object") continue;
      if (row.source_kind !== "podchat") continue;
      if (ownerId && row.owner_id !== ownerId) continue;

      const normCategory = normalizeText(row.category);
      const normLabel = normalizeText(row.label);

      // Reject category-only or vague labels
      if (GENERIC_WORDS.has(normCategory) || GENERIC_WORDS.has(normLabel)) {
        continue;
      }

      // Check recency (within 30 days)
      if (!row.created_at) continue;
      const createdAtDate = new Date(row.created_at);
      if (isNaN(createdAtDate.getTime())) continue;

      const diffTime = now.getTime() - createdAtDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      if (diffDays < 0 || diffDays > 30) continue;

      // Check specificity of built candidate description
      const rawDesc = row.practice_focus || row.evidence || row.label;
      const normDesc = normalizeText(rawDesc);
      const wordCount = getWordCount(normDesc);
      const hasAction =
        hasActionablePhrase(normDesc) ||
        hasActionablePhrase(normalizeText(row.label)) ||
        hasActionablePhrase(normalizeText(row.practice_focus)) ||
        hasActionablePhrase(normalizeText(row.evidence));

      if (wordCount < 6 && !hasAction) {
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
        derivedConfidence = 0.8;
      } else if (failureCount === 1 && specificityOk && hasPracticeFocus && hasEvidence) {
        derivedConfidence = 0.65;
      }

      // Filter out candidates that do not meet thresholds
      if (derivedConfidence < 0.65) {
        continue;
      }

      candidates.push({
        title: latestRow.label,
        description: latestRow.practice_focus || latestRow.evidence || latestRow.label,
        category: latestRow.category,
        label: latestRow.label,
        evidence: latestRow.evidence || undefined,
        practiceFocus: latestRow.practice_focus || undefined,
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
