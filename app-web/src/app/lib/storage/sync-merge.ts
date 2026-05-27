/**
 * Pure cloud/local merge planning utilities for fonetik.
 *
 * These helpers describe what a future cloud sync should do without performing
 * any IO. They take in the local snapshot (from localStorage) and a cloud
 * snapshot (from a future Supabase reader) and return:
 *
 *   - A merged local snapshot (what localStorage SHOULD look like after sync)
 *   - Per-domain counts so the UI can show "x local, y cloud, z merged"
 *   - A coarse `status` recommendation: no-op / restore-available / import-available
 *   - A list of human-readable `reasons` that future restore/import UI can show
 *
 * IMPORTANT (TASK-040B constraints):
 *   - This file is pure. No window/localStorage, no fetch, no Supabase, no
 *     Clerk, no environment access. It must run identically in browser and
 *     node test environments.
 *   - It does NOT silently truncate sessions to 20. The caller decides whether
 *     to apply MAX_STORED_SESSIONS clipping.
 *   - It does NOT recalculate XP totals. XP profile/event merge preserves the
 *     XP numbers that come in.
 *   - It does NOT infer deletes from absence. A record present locally but
 *     missing in the cloud is preserved.
 *   - It does NOT invent badges or events.
 */

import type { StoredSessionRecord } from "./types";
import type { VocabItem, VocabUserSentence } from "../vocabulary";
import type { XpProfile, XpEvent, Badge } from "../gamification";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MergeStatus = "no-op" | "restore-available" | "import-available";

export type DomainKey =
  | "sessions"
  | "vocabulary"
  | "xpEvents"
  | "xpProfile"
  | "badges";

export type DomainCounts = {
  local: number;
  cloud: number;
  merged: number;
  added: number;
  updated: number;
};

export type SyncMergeInput = {
  local: {
    sessions: ReadonlyArray<StoredSessionRecord>;
    vocabulary: ReadonlyArray<VocabItem>;
    xpProfile: XpProfile | null;
    xpEvents: ReadonlyArray<XpEvent>;
    badges: ReadonlyArray<Badge>;
  };
  cloud: {
    sessions: ReadonlyArray<StoredSessionRecord>;
    vocabulary: ReadonlyArray<VocabItem>;
    xpProfile: XpProfile | null;
    xpEvents: ReadonlyArray<XpEvent>;
    badges: ReadonlyArray<Badge>;
  };
};

export type SyncMergeReason = {
  domain: DomainKey;
  level: "info" | "warning";
  message: string;
};

export type SyncMergePlan = {
  status: MergeStatus;
  reasons: SyncMergeReason[];
  counts: Record<DomainKey, DomainCounts>;
  merged: {
    sessions: StoredSessionRecord[];
    vocabulary: VocabItem[];
    xpProfile: XpProfile | null;
    xpEvents: XpEvent[];
    badges: Badge[];
  };
};

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function timestampValue(value: unknown): number | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function counts(
  localLen: number,
  cloudLen: number,
  mergedLen: number,
  added: number,
  updated: number,
): DomainCounts {
  return {
    local: localLen,
    cloud: cloudLen,
    merged: mergedLen,
    added,
    updated,
  };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export type SessionMergeResult = {
  merged: StoredSessionRecord[];
  added: number; // cloud rows not seen locally
  updated: number; // currently always 0 — sessions are id-keyed and immutable
};

/**
 * Merge sessions by id. Local rows are preserved exactly (including the `csv`
 * field, which must match byte-for-byte for downstream Copy CSV behavior).
 *
 * Cloud rows whose id already exists locally are dropped — local wins. Sessions
 * are immutable once written, so we never "update" a session here.
 *
 * The merged list is sorted newest-first by `date`, with the original local
 * order preserved within a same-date group, then cloud rows appended in their
 * original order. The utility never applies a length cap; callers decide.
 */
export function mergeSessions(
  local: ReadonlyArray<StoredSessionRecord>,
  cloud: ReadonlyArray<StoredSessionRecord>,
): SessionMergeResult {
  const seen = new Set<string>();
  const ordered: StoredSessionRecord[] = [];

  // Keep local first so we exactly preserve csv strings and any local-only rows.
  for (const row of local) {
    if (!row || typeof row.id !== "string" || row.id.length === 0) continue;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    ordered.push(row);
  }

  let added = 0;
  for (const row of cloud) {
    if (!row || typeof row.id !== "string" || row.id.length === 0) continue;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    ordered.push(row);
    added += 1;
  }

  // Sort newest first by `date`. We keep relative input order as a tiebreaker
  // by using a stable sort and a numeric date proxy.
  const merged = ordered
    .map((row, index) => ({
      row,
      index,
      ts: timestampValue(row.date) ?? -Infinity,
    }))
    .sort((a, b) => {
      if (b.ts !== a.ts) return b.ts - a.ts;
      return a.index - b.index;
    })
    .map((entry) => entry.row);

  return { merged, added, updated: 0 };
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export type VocabMergeResult = {
  merged: VocabItem[];
  added: number;
  updated: number;
};

/**
 * Merge two vocabulary lists by id.
 *
 *   - Same-id conflict: pick whichever side has the newer `updatedAt`. If
 *     either side's timestamp is invalid or missing, prefer local (safe).
 *   - Nested `userSentences` merge by sentence id. Both sides' sentences are
 *     unioned. A sentence id present in only one side is kept as-is.
 *   - A `correction` attaches to the sentence that owns its id. If both sides
 *     have a correction for the same sentence, the newer `checkedAt` wins;
 *     ties prefer the local correction.
 *   - `reuseCount` and `correctUseCount` are taken from whichever item became
 *     the "winner" by updatedAt (no recalculation here).
 *
 * Deletes are NEVER inferred from absence. A vocabulary item present locally
 * but missing from cloud is preserved.
 */
export function mergeVocabulary(
  local: ReadonlyArray<VocabItem>,
  cloud: ReadonlyArray<VocabItem>,
): VocabMergeResult {
  const localById = new Map<string, VocabItem>();
  for (const item of local) {
    if (item && typeof item.id === "string" && item.id.length > 0) {
      localById.set(item.id, item);
    }
  }
  const cloudById = new Map<string, VocabItem>();
  for (const item of cloud) {
    if (item && typeof item.id === "string" && item.id.length > 0) {
      cloudById.set(item.id, item);
    }
  }

  const out: VocabItem[] = [];
  const seen = new Set<string>();
  let added = 0;
  let updated = 0;

  // Walk local first to preserve order for items the user already has.
  for (const localItem of local) {
    if (!localItem || typeof localItem.id !== "string") continue;
    if (seen.has(localItem.id)) continue;
    seen.add(localItem.id);

    const cloudItem = cloudById.get(localItem.id);
    if (!cloudItem) {
      out.push(localItem);
      continue;
    }

    const merged = mergeOneVocabItem(localItem, cloudItem);
    if (merged !== localItem) updated += 1;
    out.push(merged);
  }

  // Append cloud-only items in their original cloud order.
  for (const cloudItem of cloud) {
    if (!cloudItem || typeof cloudItem.id !== "string") continue;
    if (seen.has(cloudItem.id)) continue;
    seen.add(cloudItem.id);
    out.push(cloudItem);
    added += 1;
  }

  return { merged: out, added, updated };
}

function mergeOneVocabItem(local: VocabItem, cloud: VocabItem): VocabItem {
  const localTs = timestampValue(local.updatedAt);
  const cloudTs = timestampValue(cloud.updatedAt);

  // If either timestamp is invalid/missing, prefer local for safety.
  let winner: VocabItem;
  if (localTs === null || cloudTs === null) {
    winner = local;
  } else if (cloudTs > localTs) {
    winner = cloud;
  } else {
    winner = local;
  }

  // Always merge nested user sentences regardless of which side won, so a
  // newer cloud item never silently drops a sentence the local side has.
  const sentences = mergeUserSentences(local.userSentences, cloud.userSentences);

  // If sentences object identity changed compared to the winner, that counts
  // as an update. We also report an update if winner !== local (cloud beat us).
  const sameSentencesAsWinner =
    sentences.length === winner.userSentences.length &&
    sentences.every((s, i) => s === winner.userSentences[i]);

  if (winner === local && sameSentencesAsWinner) {
    return local;
  }

  return {
    ...winner,
    userSentences: sentences,
    // Preserve `version` from winner; createdAt is always taken from the older
    // record (never invent a newer createdAt), but only if both are valid.
    createdAt: pickEarlierIso(local.createdAt, cloud.createdAt) ?? winner.createdAt,
    // updatedAt: keep the winner's; we already used it to choose.
    updatedAt: winner.updatedAt,
    // Keep loser's reuse if larger? No — TASK forbids recalculation. We trust
    // the winner's recorded counts. Recalculation can be added later.
    reuseCount: winner.reuseCount,
    correctUseCount: winner.correctUseCount,
  };
}

function pickEarlierIso(a: string, b: string): string | null {
  const aTs = timestampValue(a);
  const bTs = timestampValue(b);
  if (aTs === null && bTs === null) return null;
  if (aTs === null) return b;
  if (bTs === null) return a;
  return aTs <= bTs ? a : b;
}

function mergeUserSentences(
  local: ReadonlyArray<VocabUserSentence>,
  cloud: ReadonlyArray<VocabUserSentence>,
): VocabUserSentence[] {
  const localById = new Map<string, VocabUserSentence>();
  for (const s of local) {
    if (s && typeof s.id === "string" && s.id.length > 0) {
      localById.set(s.id, s);
    }
  }
  const cloudById = new Map<string, VocabUserSentence>();
  for (const s of cloud) {
    if (s && typeof s.id === "string" && s.id.length > 0) {
      cloudById.set(s.id, s);
    }
  }

  const out: VocabUserSentence[] = [];
  const seen = new Set<string>();

  for (const s of local) {
    if (!s || typeof s.id !== "string") continue;
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const cloudS = cloudById.get(s.id);
    out.push(cloudS ? mergeOneSentence(s, cloudS) : s);
  }
  for (const s of cloud) {
    if (!s || typeof s.id !== "string") continue;
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}

function mergeOneSentence(
  local: VocabUserSentence,
  cloud: VocabUserSentence,
): VocabUserSentence {
  // Pick the correction by newer checkedAt; fall back to local on tie or
  // missing/invalid timestamps.
  const localCorrection = local.correction;
  const cloudCorrection = cloud.correction;

  let correction = localCorrection;
  if (localCorrection && cloudCorrection) {
    const localTs = timestampValue(localCorrection.checkedAt);
    const cloudTs = timestampValue(cloudCorrection.checkedAt);
    if (localTs !== null && cloudTs !== null && cloudTs > localTs) {
      correction = cloudCorrection;
    }
  } else if (!localCorrection && cloudCorrection) {
    correction = cloudCorrection;
  }

  // Sentence base text/createdAt: prefer local (immutable user content).
  return {
    ...local,
    correction,
  };
}

// ---------------------------------------------------------------------------
// XP events
// ---------------------------------------------------------------------------

export type XpEventMergeResult = {
  merged: XpEvent[];
  added: number;
  updated: number; // always 0 — events are immutable
};

/**
 * Merge XP events by composite key `${type}|${sourceId}`. The first event seen
 * for a key wins (local first), so we never duplicate XP awards when cloud
 * mirrors what the local device already credited.
 *
 * Event fields (id, sourceId, sourceKind, localDate, createdAt, xp, reason)
 * are preserved exactly. We never recompute XP amounts.
 */
export function mergeXpEvents(
  local: ReadonlyArray<XpEvent>,
  cloud: ReadonlyArray<XpEvent>,
): XpEventMergeResult {
  const seen = new Set<string>();
  const out: XpEvent[] = [];

  function keyFor(event: XpEvent): string | null {
    if (
      typeof event.type !== "string" ||
      typeof event.sourceId !== "string" ||
      event.sourceId.length === 0
    ) {
      return null;
    }
    return `${event.type}|${event.sourceId}`;
  }

  for (const event of local) {
    if (!event) continue;
    const key = keyFor(event);
    if (key === null) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(event);
  }

  let added = 0;
  for (const event of cloud) {
    if (!event) continue;
    const key = keyFor(event);
    if (key === null) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(event);
    added += 1;
  }

  // Sort newest first by createdAt, falling back to localDate.
  const merged = out
    .map((event, index) => ({
      event,
      index,
      ts:
        timestampValue(event.createdAt) ??
        timestampValue(event.localDate) ??
        -Infinity,
    }))
    .sort((a, b) => {
      if (b.ts !== a.ts) return b.ts - a.ts;
      return a.index - b.index;
    })
    .map((entry) => entry.event);

  return { merged, added, updated: 0 };
}

// ---------------------------------------------------------------------------
// XP profile
// ---------------------------------------------------------------------------

export type XpProfileMergeResult = {
  merged: XpProfile | null;
  /** True if the result equals the cloud profile and not the local one. */
  restoredFromCloud: boolean;
  /** True if local and cloud are both real and disagree on totalXp. */
  conflict: boolean;
};

/**
 * Decide which XP profile to keep.
 *
 *   - If local is real and non-empty (totalXp > 0 or has prior dates), local wins.
 *   - If local is null/default and cloud is real, cloud is offered for restore.
 *   - If both are real and totalXp differs, surface a conflict warning. We do
 *     NOT silently overwrite — caller decides.
 *
 * This function never recalculates XP. It only chooses.
 */
export function mergeXpProfile(
  local: XpProfile | null,
  cloud: XpProfile | null,
): XpProfileMergeResult {
  const localReal = isRealProfile(local);
  const cloudReal = isRealProfile(cloud);

  if (!localReal && !cloudReal) {
    return { merged: local ?? cloud ?? null, restoredFromCloud: false, conflict: false };
  }
  if (!localReal && cloudReal) {
    return { merged: cloud, restoredFromCloud: true, conflict: false };
  }
  if (localReal && !cloudReal) {
    return { merged: local, restoredFromCloud: false, conflict: false };
  }

  // Both real. Local always wins; we only flag the disagreement.
  const conflict = (local!.totalXp ?? 0) !== (cloud!.totalXp ?? 0);
  return { merged: local!, restoredFromCloud: false, conflict };
}

function isRealProfile(profile: XpProfile | null): boolean {
  if (!profile) return false;
  if (typeof profile.totalXp === "number" && profile.totalXp > 0) return true;
  if (typeof profile.pendingDailyXp === "number" && profile.pendingDailyXp > 0) {
    return true;
  }
  if (
    typeof profile.unclaimedPreviousXp === "number" &&
    profile.unclaimedPreviousXp > 0
  ) {
    return true;
  }
  if (
    typeof profile.lastClaimedDate === "string" &&
    profile.lastClaimedDate.length > 0
  ) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export type BadgeMergeResult = {
  merged: Badge[];
  added: number;
  updated: number;
};

/**
 * Merge badges by id. We never invent a badge that didn't already exist on
 * either side. For badges that exist on both sides:
 *
 *   - earned beats locked
 *   - if both earned, keep the earlier earnedAt if available (more conservative)
 */
export function mergeBadges(
  local: ReadonlyArray<Badge>,
  cloud: ReadonlyArray<Badge>,
): BadgeMergeResult {
  const localById = new Map<string, Badge>();
  for (const badge of local) {
    if (badge && typeof badge.id === "string" && badge.id.length > 0) {
      localById.set(badge.id, badge);
    }
  }
  const cloudById = new Map<string, Badge>();
  for (const badge of cloud) {
    if (badge && typeof badge.id === "string" && badge.id.length > 0) {
      cloudById.set(badge.id, badge);
    }
  }

  const out: Badge[] = [];
  const seen = new Set<string>();
  let added = 0;
  let updated = 0;

  for (const badge of local) {
    if (!badge || typeof badge.id !== "string") continue;
    if (seen.has(badge.id)) continue;
    seen.add(badge.id);

    const cloudBadge = cloudById.get(badge.id);
    if (!cloudBadge) {
      out.push(badge);
      continue;
    }
    const merged = mergeOneBadge(badge, cloudBadge);
    if (merged !== badge) updated += 1;
    out.push(merged);
  }

  for (const badge of cloud) {
    if (!badge || typeof badge.id !== "string") continue;
    if (seen.has(badge.id)) continue;
    seen.add(badge.id);
    out.push(badge);
    added += 1;
  }

  return { merged: out, added, updated };
}

function mergeOneBadge(local: Badge, cloud: Badge): Badge {
  const localEarned = local.status === "earned";
  const cloudEarned = cloud.status === "earned";

  if (!cloudEarned && !localEarned) return local;

  if (cloudEarned && !localEarned) {
    return {
      ...local,
      status: "earned",
      earnedAt: cloud.earnedAt ?? local.earnedAt ?? null,
    };
  }

  if (localEarned && !cloudEarned) return local;

  // Both earned: keep the earlier earnedAt if both valid.
  const earlier = pickEarlierIso(local.earnedAt ?? "", cloud.earnedAt ?? "");
  if (earlier === null) {
    return local;
  }
  return {
    ...local,
    earnedAt: earlier,
  };
}

// ---------------------------------------------------------------------------
// Top-level plan
// ---------------------------------------------------------------------------

export function planSyncMerge(input: SyncMergeInput): SyncMergePlan {
  const sessionResult = mergeSessions(input.local.sessions, input.cloud.sessions);
  const vocabResult = mergeVocabulary(
    input.local.vocabulary,
    input.cloud.vocabulary,
  );
  const xpEventsResult = mergeXpEvents(
    input.local.xpEvents,
    input.cloud.xpEvents,
  );
  const xpProfileResult = mergeXpProfile(
    input.local.xpProfile,
    input.cloud.xpProfile,
  );
  const badgeResult = mergeBadges(input.local.badges, input.cloud.badges);

  const sessionsCounts = counts(
    input.local.sessions.length,
    input.cloud.sessions.length,
    sessionResult.merged.length,
    sessionResult.added,
    sessionResult.updated,
  );
  const vocabularyCounts = counts(
    input.local.vocabulary.length,
    input.cloud.vocabulary.length,
    vocabResult.merged.length,
    vocabResult.added,
    vocabResult.updated,
  );
  const xpEventsCounts = counts(
    input.local.xpEvents.length,
    input.cloud.xpEvents.length,
    xpEventsResult.merged.length,
    xpEventsResult.added,
    xpEventsResult.updated,
  );
  const badgesCounts = counts(
    input.local.badges.length,
    input.cloud.badges.length,
    badgeResult.merged.length,
    badgeResult.added,
    badgeResult.updated,
  );
  const xpProfileCounts: DomainCounts = {
    local: input.local.xpProfile ? 1 : 0,
    cloud: input.cloud.xpProfile ? 1 : 0,
    merged: xpProfileResult.merged ? 1 : 0,
    added: xpProfileResult.restoredFromCloud ? 1 : 0,
    updated: xpProfileResult.conflict ? 1 : 0,
  };

  const reasons: SyncMergeReason[] = [];

  if (sessionResult.added > 0) {
    reasons.push({
      domain: "sessions",
      level: "info",
      message: `${sessionResult.added} cloud session(s) available to import.`,
    });
  }
  if (vocabResult.added > 0) {
    reasons.push({
      domain: "vocabulary",
      level: "info",
      message: `${vocabResult.added} cloud vocabulary item(s) available to import.`,
    });
  }
  if (vocabResult.updated > 0) {
    reasons.push({
      domain: "vocabulary",
      level: "info",
      message: `${vocabResult.updated} vocabulary item(s) merged with newer cloud data.`,
    });
  }
  if (xpEventsResult.added > 0) {
    reasons.push({
      domain: "xpEvents",
      level: "info",
      message: `${xpEventsResult.added} cloud XP event(s) available to import.`,
    });
  }
  if (xpProfileResult.restoredFromCloud) {
    reasons.push({
      domain: "xpProfile",
      level: "info",
      message: "Local XP profile is empty. Cloud XP profile is available to restore.",
    });
  }
  if (xpProfileResult.conflict) {
    reasons.push({
      domain: "xpProfile",
      level: "warning",
      message:
        "Local and cloud XP profiles disagree. Local was kept; review before overwriting.",
    });
  }
  if (badgeResult.added > 0) {
    reasons.push({
      domain: "badges",
      level: "info",
      message: `${badgeResult.added} cloud badge(s) available to import.`,
    });
  }
  if (badgeResult.updated > 0) {
    reasons.push({
      domain: "badges",
      level: "info",
      message: `${badgeResult.updated} badge(s) updated from cloud (locked → earned).`,
    });
  }

  // Decide overall status:
  //   - "restore-available" if every local domain is empty and at least one
  //     cloud domain has data.
  //   - "import-available" if cloud brings any new rows or updates.
  //   - "no-op" otherwise.
  const localTotal =
    input.local.sessions.length +
    input.local.vocabulary.length +
    input.local.xpEvents.length +
    input.local.badges.length +
    (input.local.xpProfile ? 1 : 0);

  const cloudTotal =
    input.cloud.sessions.length +
    input.cloud.vocabulary.length +
    input.cloud.xpEvents.length +
    input.cloud.badges.length +
    (input.cloud.xpProfile ? 1 : 0);

  const totalChanges =
    sessionResult.added +
    vocabResult.added +
    vocabResult.updated +
    xpEventsResult.added +
    badgeResult.added +
    badgeResult.updated +
    (xpProfileResult.restoredFromCloud ? 1 : 0) +
    (xpProfileResult.conflict ? 1 : 0);

  let status: MergeStatus;
  if (localTotal === 0 && cloudTotal > 0) {
    status = "restore-available";
  } else if (totalChanges > 0) {
    status = "import-available";
  } else {
    status = "no-op";
  }

  return {
    status,
    reasons,
    counts: {
      sessions: sessionsCounts,
      vocabulary: vocabularyCounts,
      xpEvents: xpEventsCounts,
      xpProfile: xpProfileCounts,
      badges: badgesCounts,
    },
    merged: {
      sessions: sessionResult.merged,
      vocabulary: vocabResult.merged,
      xpProfile: xpProfileResult.merged,
      xpEvents: xpEventsResult.merged,
      badges: badgeResult.merged,
    },
  };
}
