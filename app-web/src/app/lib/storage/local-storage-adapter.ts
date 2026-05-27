/**
 * LocalStorageAdapter — delegates to existing localStorage helpers.
 *
 * This adapter preserves ALL existing behavior:
 *   - Same localStorage keys
 *   - Same normalization and fallback logic
 *   - Same cap behavior (MAX_STORED_SESSIONS = 20)
 *   - Same data shape and version fields
 *
 * It does NOT introduce any new behavior, side effects, or network calls.
 */

import {
  loadVocabulary,
  saveVocabulary,
} from "../vocabulary";

import type { VocabItem } from "../vocabulary";

import {
  loadXpProfile,
  saveXpProfile,
  loadXpEvents,
  saveXpEvents,
  loadBadges,
  saveBadges,
} from "../gamification";

import type { XpProfile, XpEvent, Badge } from "../gamification";

import type { StorageAdapter, StoredSessionRecord } from "./types";

// ---------------------------------------------------------------------------
// Session storage constants — must match page.tsx exactly.
// ---------------------------------------------------------------------------

const SESSIONS_STORAGE_KEY = "adaptive-speaking-app:sessions";
const MAX_STORED_SESSIONS = 20;

// ---------------------------------------------------------------------------
// Session helpers (standalone, matching page.tsx logic)
// ---------------------------------------------------------------------------

/**
 * Type guard for session records. Mirrors `isSessionRecord` in page.tsx.
 * Validates that a value has all required string and number fields.
 */
function isSessionRecord(value: unknown): value is StoredSessionRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.date === "string" &&
    typeof r.level === "string" &&
    typeof r.mode === "string" &&
    typeof r.feedbackType === "string" &&
    typeof r.sessionType === "string" &&
    typeof r.provider === "string" &&
    typeof r.todayTarget === "string" &&
    typeof r.durationSeconds === "number" &&
    typeof r.transcript === "string" &&
    typeof r.mainWeakness === "string" &&
    typeof r.evidence === "string" &&
    typeof r.betterPhrase === "string" &&
    typeof r.retryTask === "string" &&
    typeof r.retryTranscript === "string" &&
    typeof r.csv === "string"
  );
}

function loadSessionsFromLocalStorage(): StoredSessionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSessionRecord).slice(0, MAX_STORED_SESSIONS);
  } catch {
    return [];
  }
}

function saveSessionsToLocalStorage(sessions: StoredSessionRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SESSIONS_STORAGE_KEY,
      JSON.stringify(sessions.slice(0, MAX_STORED_SESSIONS)),
    );
  } catch {
    // Quota exceeded or storage unavailable; skip silently.
  }
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

/**
 * Creates a `StorageAdapter` backed entirely by browser `localStorage`.
 *
 * Session operations use the same key, cap, and validation as page.tsx.
 * Vocabulary and gamification operations delegate to the canonical helpers
 * in `vocabulary.ts` and `gamification.ts`.
 */
export function createLocalStorageAdapter(): StorageAdapter {
  return {
    // -- Sessions -----------------------------------------------------------
    loadSessions(): StoredSessionRecord[] {
      return loadSessionsFromLocalStorage();
    },

    saveSessions(sessions: StoredSessionRecord[]): void {
      saveSessionsToLocalStorage(sessions);
    },

    // -- Vocabulary ---------------------------------------------------------
    loadVocabulary(): VocabItem[] {
      return loadVocabulary();
    },

    saveVocabulary(items: ReadonlyArray<VocabItem>): void {
      saveVocabulary(items);
    },

    // -- Gamification -------------------------------------------------------
    loadXpProfile(): XpProfile {
      return loadXpProfile();
    },

    saveXpProfile(profile: XpProfile): boolean {
      return saveXpProfile(profile);
    },

    loadXpEvents(): XpEvent[] {
      return loadXpEvents();
    },

    saveXpEvents(events: ReadonlyArray<XpEvent>): boolean {
      return saveXpEvents(events);
    },

    loadBadges(): Badge[] {
      return loadBadges();
    },

    saveBadges(badges: ReadonlyArray<Badge>): boolean {
      return saveBadges(badges);
    },
  };
}
