/**
 * Storage adapter type definitions for fonetik.
 *
 * These interfaces define the persistence boundary for the app's data domains.
 * The active implementation is `LocalStorageAdapter` (delegates to existing
 * localStorage helpers). A future `SupabaseAdapter` will implement the same
 * interfaces for cloud persistence.
 *
 * IMPORTANT:
 *   - Do not import Supabase or network libraries here.
 *   - Do not change localStorage keys or schemas.
 *   - Do not change XP rules, caps, or badge logic.
 */

import type { VocabItem } from "../vocabulary";
import type { XpProfile, XpEvent, Badge } from "../gamification";

// ---------------------------------------------------------------------------
// Session types (mirrored from page.tsx to avoid circular imports)
// ---------------------------------------------------------------------------

/**
 * Shape of a completed session record as stored in localStorage.
 *
 * This type mirrors `SessionRecord` defined in `page.tsx`. It is intentionally
 * duplicated here so the storage adapter boundary can be imported without
 * pulling in the full page component. If the canonical definition in page.tsx
 * changes, update this type to match.
 */
export type StoredSessionRecord = {
  id: string;
  date: string;
  level: string;
  mode: string;
  feedbackType: string;
  sessionType: string;
  provider: string;
  todayTarget: string;
  durationSeconds: number;
  transcript: string;
  mainWeakness: string;
  evidence: string;
  betterPhrase: string;
  retryTask: string;
  retryTranscript: string;
  csv: string;
};

// ---------------------------------------------------------------------------
// Store interfaces
// ---------------------------------------------------------------------------

/** Persistence operations for speaking session history. */
export interface SessionStore {
  /** Load all stored sessions (most recent first). */
  loadSessions(): StoredSessionRecord[];

  /** Replace the entire sessions list and persist. */
  saveSessions(sessions: StoredSessionRecord[]): void;
}

/** Persistence operations for the vocabulary notebook. */
export interface VocabularyStore {
  /** Load all vocabulary items from storage. */
  loadVocabulary(): VocabItem[];

  /** Replace the entire vocabulary list and persist. */
  saveVocabulary(items: ReadonlyArray<VocabItem>): void;
}

/** Persistence operations for gamification (XP, events, badges). */
export interface GamificationStore {
  /** Load the user's XP profile. */
  loadXpProfile(): XpProfile;

  /** Persist the XP profile. */
  saveXpProfile(profile: XpProfile): boolean;

  /** Load all XP events. */
  loadXpEvents(): XpEvent[];

  /** Persist the XP events list. */
  saveXpEvents(events: ReadonlyArray<XpEvent>): boolean;

  /** Load all badges. */
  loadBadges(): Badge[];

  /** Persist the badges list. */
  saveBadges(badges: ReadonlyArray<Badge>): boolean;
}

// ---------------------------------------------------------------------------
// Combined adapter interface
// ---------------------------------------------------------------------------

/**
 * Full storage adapter combining all persistence domains.
 *
 * Implementations:
 *   - `LocalStorageAdapter` (active) — browser localStorage via existing helpers
 *   - Future: `SupabaseAdapter` — Supabase Postgres via RLS-scoped queries
 */
export interface StorageAdapter
  extends SessionStore,
    VocabularyStore,
    GamificationStore {}
