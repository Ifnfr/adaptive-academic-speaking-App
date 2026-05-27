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
// Session types
// ---------------------------------------------------------------------------

/**
 * Shape of a completed session record as stored in localStorage.
 *
 * `page.tsx` defines a stricter `SessionRecord` type with narrow union fields
 * (e.g. `level: Level` instead of `level: string`). Since each union type
 * extends `string`, `SessionRecord` is a subtype of `StoredSessionRecord`.
 *
 * This means:
 *   - page.tsx can pass `SessionRecord[]` to `saveSessions()` without casting.
 *   - page.tsx casts the return of `loadSessions()` to `SessionRecord[]`.
 *     This is safe because the adapter's `isSessionRecord` guard validates the
 *     same field set (typeof checks only) that page.tsx originally used.
 *
 * If either type changes, update the other to match. Fields must stay in sync:
 *   page.tsx SessionRecord  ←→  StoredSessionRecord  ←→  adapter isSessionRecord
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
