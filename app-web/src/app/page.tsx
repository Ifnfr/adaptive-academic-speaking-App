"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { MutableRefObject } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { buildLevelUpCheck } from "./lib/level-up";
import { LEVEL_PHASE, nextLevelHint } from "./lib/levels";
import { computeDayStreak } from "./lib/streak";
import {
  addUserSentence,
  buildVocabularyPracticeQueue,
  computeVocabularyStats,
  createVocabItem,
  deleteVocabItem,
  markVocabularyPracticed,
  saveSentenceCorrection,
  updateVocabStatus,
  type VocabItem,
  type VocabSentenceCorrection,
  type VocabLevel,
  type VocabSource,
  type VocabStatus,
} from "./lib/vocabulary";
import {
  awardXpEvent,
  claimXp,
  createDefaultXpProfile,
  createXpEvent,
  getLocalDateString,
  getSpeakerLevelProgress,
  type Badge,
  type XpEvent,
  type XpEventType,
  type XpProfile,
} from "./lib/gamification";
import { ProgressView } from "./components/ProgressView";
import {
  WeeklyReviewView,
  type WeeklyReviewResult,
} from "./components/WeeklyReviewView";
import {
  MentalModelView,
  type MentalModelResult,
} from "./components/MentalModelView";
import { SessionLogView } from "./components/SessionLogView";
import { LeaderboardView } from "./components/LeaderboardView";
import {
  Sidebar,
  type SidebarProps,
  type SidebarView,
} from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { AuthStatus } from "./components/AuthStatus";
import { PodchatView } from "./components/PodchatView";
import type {
  PodchatArticleContext,
  PodchatCommonplaceContextRef,
  PodchatCommonplaceMapContextRef,
} from "./components/PodchatView";
import { VocabularyNotebookView } from "./components/VocabularyNotebookView";
import { CommonplaceView } from "./components/CommonplaceView";
import {
  ArticlePracticeView,
  type ArticlePracticeResult,
} from "./components/ArticlePracticeView";
import { CoverPage } from "./components/CoverPage";
import {
  CloudSyncStatusPanel,
  type CloudImportActionResult,
  type CloudRestoreActionResult,
} from "./components/CloudSyncStatusPanel";
import { storage, type StoredSessionRecord } from "./lib/storage";
import {
  DISABLED_SESSION_CLOUD_AUTH,
  loadCompletedSessionsFromCloud,
  writeCompletedSessionToCloud,
  type SessionCloudAuthState,
} from "./lib/storage/session-cloud-runtime";
import {
  loadCloudSnapshotPlan,
  type CloudSnapshotRuntimeResult,
} from "./lib/storage/cloud-snapshot-runtime";
import type { SyncMergePlan } from "./lib/storage/sync-merge";
import { writeVocabularyChangesToCloud } from "./lib/storage/vocab-cloud-runtime";
import {
  writeXpProfileToCloud,
  writeXpEventsToCloud,
  writeBadgesToCloud,
} from "./lib/storage/gamification-cloud-runtime";
import {
  isSupabaseConfigured,
  createBrowserSupabaseClient,
  createSupabaseAccessTokenProvider,
  getSupabaseAccessToken,
} from "./lib/supabase";
import {
  bootstrapProfile,
  applyProfilePreferencesPatchToProfile,
  loadSupabaseProfile,
  updateSupabaseProfilePreferences,
  type UserProfile,
  type UserProfilePreferencesPatch,
} from "./lib/storage/supabase-profile-adapter";
import { ProfileSettingsView } from "./components/ProfileSettingsView";
import { ProfileView } from "./components/ProfileView";
import {
  DEFAULT_APP_LANGUAGE,
  normalizeAppLanguage,
  normalizeFeedbackLanguage,
  normalizeTargetLanguage,
  useI18n,
  type AppLanguage,
  type Translate,
} from "./lib/i18n";

type ClerkUserType = ReturnType<typeof useUser>["user"];

const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

type Level = "Foundation" | "Beginner" | "Intermediate" | "Advanced" | "Expert";
type Mode =
  | "Fluency Sprint"
  | "Argument Drill"
  | "Reading-to-Speaking"
  | "Debate"
  | "Diagnostic";
type FeedbackType = "Quick" | "Deep";
type SessionType = "Micro" | "Standard" | "Deep";
type AIProvider = "Claude" | "DeepSeek" | "Gemini";
type TtsProvider = "polly" | "elevenlabs";

type VocabularyCorrectionResult = Omit<
  VocabSentenceCorrection,
  "checkedAt" | "providerUsed"
>;

// Full record persisted to localStorage at end of a completed session.
type SessionRecord = {
  id: string;
  date: string;
  level: Level;
  mode: Mode;
  feedbackType: FeedbackType;
  sessionType: SessionType;
  provider: AIProvider;
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

type BadgeDefinition = {
  id: string;
  label: string;
  description: string;
};

const BADGE_DEFINITIONS: Record<string, BadgeDefinition> = {
  first_session: {
    id: "first_session",
    label: "First Session",
    description: "Completed your first normal speaking session.",
  },
  first_retry: {
    id: "first_retry",
    label: "First Retry",
    description: "Completed your first retry attempt.",
  },
  first_diagnostic: {
    id: "first_diagnostic",
    label: "First Diagnostic",
    description: "Completed your first diagnostic assessment.",
  },
  first_weekly_review: {
    id: "first_weekly_review",
    label: "First Weekly Review",
    description: "Generated your first weekly review.",
  },
  first_mental_model: {
    id: "first_mental_model",
    label: "First Mental Model",
    description: "Generated your first mental model session.",
  },
  first_level_up: {
    id: "first_level_up",
    label: "First Level-Up",
    description: "Applied your first level-up recommendation.",
  },
  speaker_level_5: {
    id: "speaker_level_5",
    label: "Structured Speaker",
    description: "Reached Speaker Level 5.",
  },
};

const BADGE_BY_EVENT: Partial<Record<XpEventType, string>> = {
  normal_session_completed: "first_session",
  retry_completed: "first_retry",
  diagnostic_completed: "first_diagnostic",
  weekly_review_completed: "first_weekly_review",
  mental_model_completed: "first_mental_model",
  level_up_applied: "first_level_up",
};

const MAX_STORED_SESSIONS = 20;
const CLOUD_WRITE_SUPPRESSION_RELEASE_MS = 100;

function stableTextKey(text: string): string {
  const trimmed = text.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < trimmed.length; i += 1) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function normalizeArticlePracticeSourceUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.hash = "";

    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
  } catch {
    return trimmed.toLowerCase();
  }
}

function buildArticleSpeakingTarget(result: ArticlePracticeResult): string {
  const vocabularyWords = result.usefulVocabulary
    .map((item) => item.word.trim())
    .filter(Boolean)
    .slice(0, 5);

  return [
    `Article speaking task: ${result.speakingTask.title}`,
    `Source: ${result.sourceTitle} (${result.sourceDomain})`,
    `Instruction: ${result.speakingTask.instruction}`,
    `Target structure: ${result.speakingTask.targetStructure.join(" -> ")}`,
    `Useful vocabulary to try: ${
      vocabularyWords.length > 0 ? vocabularyWords.join(", ") : "none suggested"
    }`,
    `Open the original article if you need to reread it: ${result.sourceUrl}`,
  ].join("\n");
}

function createEarnedBadge(definition: BadgeDefinition): Badge {
  return {
    version: 1,
    id: definition.id,
    label: definition.label,
    description: definition.description,
    status: "earned",
    earnedAt: new Date().toISOString(),
  };
}

function withEarnedBadge(
  badges: ReadonlyArray<Badge>,
  badgeId: string,
): Badge[] {
  const definition = BADGE_DEFINITIONS[badgeId];
  if (!definition || badges.some((badge) => badge.id === badgeId)) {
    return [...badges];
  }
  return [...badges, createEarnedBadge(definition)];
}

// Session load/save delegated to the storage adapter boundary.
// The adapter owns the localStorage key, type guard, and cap logic.
// The cast to SessionRecord[] is safe because the adapter's isSessionRecord
// guard validates the identical field set — SessionRecord (with narrow union
// types like Level, Mode) is a subtype of StoredSessionRecord (with string).
function loadSessions(): SessionRecord[] {
  return storage.loadSessions() as SessionRecord[];
}

function saveSessions(sessions: SessionRecord[]): void {
  storage.saveSessions(sessions);
}

// In-memory cache of the sessions array so getSessionsClient is referentially
// stable between renders unless updateSessions changes it.
const EMPTY_SESSIONS: SessionRecord[] = [];
let sessionsCache: SessionRecord[] = EMPTY_SESSIONS;
let sessionsHydrated = false;
const sessionsListeners = new Set<() => void>();

function notifySessionsListeners(): void {
  for (const listener of sessionsListeners) {
    listener();
  }
}

function subscribeSessions(listener: () => void): () => void {
  // Lazy hydrate from localStorage the first time anyone subscribes (i.e. on
  // first client render), then notify so React re-renders with real data.
  if (!sessionsHydrated && typeof window !== "undefined") {
    sessionsHydrated = true;
    sessionsCache = loadSessions();
    // Defer the first notify so we don't fire while React is still
    // attaching the subscription.
    queueMicrotask(notifySessionsListeners);
  }
  sessionsListeners.add(listener);
  return () => {
    sessionsListeners.delete(listener);
  };
}

function getSessionsClient(): SessionRecord[] {
  return sessionsCache;
}

function getSessionsServer(): SessionRecord[] {
  // Empty array on the server avoids any localStorage access during SSR.
  return EMPTY_SESSIONS;
}

function updateSessions(next: SessionRecord[]): void {
  sessionsCache = next.slice(0, MAX_STORED_SESSIONS);
  sessionsHydrated = true;
  saveSessions(sessionsCache);
  notifySessionsListeners();
}

function replaceSessionsFromCloud(next: SessionRecord[]): void {
  sessionsCache = next.slice(0, MAX_STORED_SESSIONS);
  sessionsHydrated = true;
  notifySessionsListeners();
}

function prependCloudSession(session: SessionRecord): void {
  sessionsCache = [
    session,
    ...sessionsCache.filter((item) => item.id !== session.id),
  ].slice(0, MAX_STORED_SESSIONS);
  sessionsHydrated = true;
  notifySessionsListeners();
}

// Trim long upstream provider errors and strip stack-trace-like noise so the UI
// stays short and readable. Friendly route-level messages (no colon, short)
// pass through as-is.
function sanitizeErrorMessage(raw: string): string {
  if (!raw) return "Something went wrong. Please try again.";
  // Remove JSON-looking blobs, line breaks, and excess whitespace.
  let cleaned = raw.replace(/\s+/g, " ").trim();
  // If the message looks like "Provider API error 4xx: { ... }", keep just the
  // human-readable head so we don't dump JSON into the UI.
  const colonIdx = cleaned.indexOf(":");
  if (colonIdx !== -1 && cleaned.length > 140) {
    cleaned = cleaned.slice(0, colonIdx).trim();
  }
  if (cleaned.length > 200) {
    cleaned = `${cleaned.slice(0, 200)}…`;
  }
  return cleaned;
}

// ---------- Light UI tokens (Tailwind class strings) ----------
// Centralized so every panel reads the same way and we can tweak the look
// in one place. Used as plain string concatenations.
const card =
  "rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm brand-grid";
const cardHeader =
  "rounded-t-2xl border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-4";
const cardBody = "p-6";
const LAST_FONETIK_VIEW_SESSION_KEY = "fonetik:last-view-before-commonplace";
const FONETIK_FALLBACK_VIEW: SidebarView = "active";
const FONETIK_RETURN_VIEWS = new Set<SidebarView>([
  "active",
  "vocabulary",
  "article-practice",
  "session-log",
  "progress",
  "weekly-review",
  "diagnostic",
  "mental-model",
  "settings",
  "leaderboard",
  "learning-path",
  "profile",
]);

const COMMONPLACE_PODCHAT_CONTEXT_SESSION_KEY =
  "fonetik:commonplace-podchat-context";

type StoredCommonplacePodchatContext =
  | PodchatCommonplaceContextRef
  | PodchatCommonplaceMapContextRef;

function normalizeFonetikReturnView(value: string | null): SidebarView {
  if (!value) return FONETIK_FALLBACK_VIEW;
  if (value === "commonplace") return FONETIK_FALLBACK_VIEW;
  return FONETIK_RETURN_VIEWS.has(value as SidebarView)
    ? (value as SidebarView)
    : FONETIK_FALLBACK_VIEW;
}

function readStoredCommonplacePodchatContext():
  | StoredCommonplacePodchatContext
  | null {
  try {
    const raw = window.sessionStorage.getItem(
      COMMONPLACE_PODCHAT_CONTEXT_SESSION_KEY,
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      window.sessionStorage.removeItem(COMMONPLACE_PODCHAT_CONTEXT_SESSION_KEY);
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (record.source === "commonplace" && typeof record.noteId === "string") {
      const noteId = record.noteId.trim();
      if (!noteId) {
        window.sessionStorage.removeItem(COMMONPLACE_PODCHAT_CONTEXT_SESSION_KEY);
        return null;
      }
      const compact = { source: "commonplace" as const, noteId };
      window.sessionStorage.setItem(
        COMMONPLACE_PODCHAT_CONTEXT_SESSION_KEY,
        JSON.stringify(compact),
      );
      return compact;
    }
    if (
      record.source === "commonplace-map" &&
      (record.mapType === "sub" || record.mapType === "main") &&
      typeof record.mapId === "string" &&
      record.mapId.trim()
    ) {
      return {
        source: "commonplace-map",
        mapType: record.mapType,
        mapId: record.mapId.trim(),
      };
    }
    window.sessionStorage.removeItem(COMMONPLACE_PODCHAT_CONTEXT_SESSION_KEY);
    return null;
  } catch {
    return null;
  }
}

function clearStoredCommonplacePodchatContext(): void {
  try {
    window.sessionStorage.removeItem(COMMONPLACE_PODCHAT_CONTEXT_SESSION_KEY);
  } catch {
    // Session storage is optional; direct state handoff remains primary.
  }
}

export default function Home() {
  const sessionCloudAuthRef = useRef<SessionCloudAuthState>(
    DISABLED_SESSION_CLOUD_AUTH,
  );
  const [cloudAuthState, setCloudAuthState] = useState<SessionCloudAuthState>(
    DISABLED_SESSION_CLOUD_AUTH,
  );
  const [cloudSnapshotResult, setCloudSnapshotResult] =
    useState<CloudSnapshotRuntimeResult | null>(null);
  const cloudSnapshotCheckKeyRef = useRef<string | null>(null);
  const sessionHistoryCloudLoadKeyRef = useRef<string | null>(null);
  const commonplacePodchatRestoreRef = useRef(false);
  const suppressCloudWritesRef = useRef(false);
  const bootstrappedUserRef = useRef<string | null>(null);
  const [clerkUser, setClerkUser] = useState<ClerkUserType>(null);
  const [isClerkUserLoaded, setIsClerkUserLoaded] = useState(false);

  const handleUserChange = useCallback((u: ClerkUserType, loaded: boolean) => {
    setClerkUser(u);
    setIsClerkUserLoaded(loaded);
  }, []);

  // --- Landing / Login Cover Page State ---
  const [coverState, setCoverState] = useState<"landing" | "login" | "app">("landing");

  useEffect(() => {
    // Non-production test bypass using gated query parameter
    if (process.env.NODE_ENV !== "production") {
      const urlParams = new URLSearchParams(window.location.search);
      const showCover = urlParams.get("showCover") === "true";
      if (urlParams.get("mockAuth") === "true" && !showCover) {
        setTimeout(() => setCoverState("app"), 0);
      }
    }
  }, []);

  useEffect(() => {
    if (CLERK_ENABLED) {
      if (isClerkUserLoaded) {
        if (clerkUser) {
          setTimeout(() => setCoverState("app"), 0);
        } else {
          // If Clerk is enabled but user is signed out, force cover page
          // (Only allow bypass if explicitly gated in non-production test mode)
          let isTestBypass = false;
          if (process.env.NODE_ENV !== "production") {
            const urlParams = new URLSearchParams(window.location.search);
            const showCover = urlParams.get("showCover") === "true";
            isTestBypass = urlParams.get("mockAuth") === "true" && !showCover;
          }

          if (!isTestBypass) {
            setTimeout(() => setCoverState((prev) => (prev === "app" ? "landing" : prev)), 0);
          }
        }
      }
    }
  }, [clerkUser, isClerkUserLoaded]);

  // --- Owner profile state (Supabase, non-blocking) ---
  const [ownerProfile, setOwnerProfile] = useState<UserProfile | null>(null);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [profileSaveStatus, setProfileSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [appLanguageOverride, setAppLanguageOverride] = useState<{
    userId: string;
    language: AppLanguage;
  } | null>(null);
  const [sessionHistorySaveError, setSessionHistorySaveError] =
    useState<string | null>(null);

  // --- Global Theme Mode Application ---
  useEffect(() => {
    const mode = ownerProfile?.appearanceMode ?? "system";

    function updateTheme() {
      const isDark =
        mode === "dark" ||
        (mode === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", isDark);
    }

    updateTheme();

    if (mode === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", updateTheme);
        return () => mediaQuery.removeEventListener("change", updateTheme);
      } else {
        mediaQuery.addListener(updateTheme);
        return () => mediaQuery.removeListener(updateTheme);
      }
    }
  }, [ownerProfile?.appearanceMode]);

  // --- Session setup form state ---
  const [level, setLevel] = useState<Level>("Intermediate");
  const [mode, setMode] = useState<Mode>("Fluency Sprint");
  const [aiProvider, setAiProvider] = useState<AIProvider>("Claude");
  const [target, setTarget] = useState("");

  // --- Global AI Provider Setting ---
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem("defaultAiProvider");
        if (
          stored === "Claude" ||
          stored === "Gemini" ||
          stored === "DeepSeek"
        ) {
          setAiProvider(stored);
        } else if (stored === "Mock") {
          setAiProvider("Claude");
          window.localStorage.setItem("defaultAiProvider", "Claude");
        }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleDefaultAiProviderChange = (provider: AIProvider) => {
    setAiProvider(provider);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("defaultAiProvider", provider);
    }
  };

  // --- Global TTS Provider Setting ---
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>("polly");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem("defaultTtsProvider");
        if (stored === "polly" || stored === "elevenlabs") {
          setTtsProvider(stored);
        } else if (stored === "Polly") {
          setTtsProvider("polly");
          window.localStorage.setItem("defaultTtsProvider", "polly");
        } else if (stored === "ElevenLabs") {
          setTtsProvider("elevenlabs");
          window.localStorage.setItem("defaultTtsProvider", "elevenlabs");
        } else if (stored) {
          // invalid value, sanitize to polly
          setTtsProvider("polly");
          window.localStorage.setItem("defaultTtsProvider", "polly");
        }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleDefaultTtsProviderChange = (provider: TtsProvider) => {
    setTtsProvider(provider);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("defaultTtsProvider", provider);
    }
  };

  // --- ElevenLabs Model Setting ---
  const [elevenLabsModel, setElevenLabsModel] = useState<"eleven_flash_v2_5" | "eleven_multilingual_v2" | "eleven_v3" | "">("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem("defaultElevenLabsModel");
        if (stored === "eleven_flash_v2_5" || stored === "eleven_multilingual_v2" || stored === "eleven_v3") {
          setElevenLabsModel(stored);
        } else {
          setElevenLabsModel("");
          if (stored !== null) {
            window.localStorage.removeItem("defaultElevenLabsModel");
          }
        }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleDefaultElevenLabsModelChange = (model: "eleven_flash_v2_5" | "eleven_multilingual_v2" | "eleven_v3" | "") => {
    setElevenLabsModel(model);
    if (typeof window !== "undefined") {
      if (model) {
        window.localStorage.setItem("defaultElevenLabsModel", model);
      } else {
        window.localStorage.removeItem("defaultElevenLabsModel");
      }
    }
  };

  // --- Weekly Review Agent state ---
  const [weeklyReviewResult, setWeeklyReviewResult] =
    useState<WeeklyReviewResult | null>(null);
  const [weeklyReviewLoading, setWeeklyReviewLoading] = useState(false);
  const [weeklyReviewError, setWeeklyReviewError] = useState<string | null>(
    null,
  );

  // --- Mental Model Session state ---
  const [mentalModelFocus, setMentalModelFocus] = useState("");
  const [mentalModelResult, setMentalModelResult] =
    useState<MentalModelResult | null>(null);
  const [mentalModelLoading, setMentalModelLoading] = useState(false);
  const [mentalModelError, setMentalModelError] = useState<string | null>(null);

  // --- Article Practice state ---
  const [articleUrl, setArticleUrl] = useState("");
  const [articleInputMode, setArticleInputMode] = useState<"url" | "markdown">(
    "url",
  );
  const [preparedContextMarkdown, setPreparedContextMarkdown] = useState("");
  const [preparedContextMarkdownError, setPreparedContextMarkdownError] =
    useState<string | null>(null);
  const [articleFocus, setArticleFocus] = useState("");
  const [articlePracticeResult, setArticlePracticeResult] =
    useState<ArticlePracticeResult | null>(null);
  const [articlePracticeLoading, setArticlePracticeLoading] = useState(false);
  const [articlePracticeError, setArticlePracticeError] = useState<
    string | null
  >(null);
  const [pendingArticleContext, setPendingArticleContext] =
    useState<PodchatArticleContext | null>(null);
  const [pendingCommonplaceContext, setPendingCommonplaceContext] =
    useState<PodchatCommonplaceContextRef | null>(null);
  const [pendingCommonplaceMapContextRef, setPendingCommonplaceMapContextRef] =
    useState<PodchatCommonplaceMapContextRef | null>(null);

  // --- Gamification state (local, deterministic, no AI) ---
  const [xpProfile, setXpProfile] = useState<XpProfile>(() =>
    createDefaultXpProfile(),
  );
  const [xpEvents, setXpEvents] = useState<XpEvent[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [gamificationReady, setGamificationReady] = useState(false);

  // --- Vocabulary Notebook state (local, deterministic, no AI) ---
  const [vocabularyItems, setVocabularyItems] = useState<VocabItem[]>(() =>
    storage.loadVocabulary(),
  );
  const [vocabFormWord, setVocabFormWord] = useState("");
  const [vocabFormMeaning, setVocabFormMeaning] = useState("");
  const [vocabFormLevel, setVocabFormLevel] = useState<VocabLevel>(level);
  const [vocabFormSource, setVocabFormSource] =
    useState<VocabSource>("manual");
  const [vocabFormExample, setVocabFormExample] = useState("");
  const [vocabFormCollocations, setVocabFormCollocations] = useState("");
  const [selectedVocabItemId, setSelectedVocabItemId] = useState<string | null>(
    null,
  );
  const [vocabularyMode, setVocabularyMode] = useState<
    "recent" | "manage" | "practice"
  >("recent");
  const [vocabPracticeQueueIds, setVocabPracticeQueueIds] = useState<string[]>(
    [],
  );
  const [vocabPracticeIndex, setVocabPracticeIndex] = useState(0);
  const [vocabPracticeCardState, setVocabPracticeCardState] = useState<
    "writing" | "accepted" | "skipped"
  >("writing");
  const [vocabPracticeAcceptedSentenceId, setVocabPracticeAcceptedSentenceId] =
    useState<string | null>(null);
  const [vocabPracticeHintVisible, setVocabPracticeHintVisible] =
    useState(false);
  const [vocabPracticePracticedCount, setVocabPracticePracticedCount] =
    useState(0);
  const [vocabPracticeSkippedCount, setVocabPracticeSkippedCount] = useState(0);
  const [vocabPracticeComplete, setVocabPracticeComplete] = useState(false);
  const [vocabPracticeCompletionXpMessage, setVocabPracticeCompletionXpMessage] =
    useState<string | null>(null);
  const [vocabSentenceDraft, setVocabSentenceDraft] = useState("");
  const [vocabMessage, setVocabMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [vocabularyCorrectionLoadingId, setVocabularyCorrectionLoadingId] =
    useState<string | null>(null);
  const [vocabularyCorrectionError, setVocabularyCorrectionError] = useState<{
    sentenceId: string;
    text: string;
  } | null>(null);

  // --- Session history (localStorage) ---
  // Sessions are an external value (localStorage). We read them via
  // useSyncExternalStore so the initial value is loaded SSR-safely without
  // triggering setState inside useEffect. Writes go through updateSessions,
  // which both persists to localStorage and notifies subscribers.
  const sessions = useSyncExternalStore(
    subscribeSessions,
    getSessionsClient,
    getSessionsServer,
  );
  const [lastCsvCopied, setLastCsvCopied] = useState(false);

  useEffect(() => {
    const loadGamificationTimer = window.setTimeout(() => {
      const loadedProfile = storage.loadXpProfile();
      setXpProfile(loadedProfile);
      setXpEvents(storage.loadXpEvents());
      setBadges(storage.loadBadges());
      storage.saveXpProfile(loadedProfile);
      setGamificationReady(true);
    }, 0);

    return () => window.clearTimeout(loadGamificationTimer);
  }, []);

  useEffect(() => {
    if (!gamificationReady) return;
    storage.saveXpProfile(xpProfile);
    if (suppressCloudWritesRef.current) return;
    void writeXpProfileToCloud({
      auth: sessionCloudAuthRef.current,
      profile: xpProfile,
    });
  }, [gamificationReady, xpProfile]);

  const cloudSnapshotLocalKey = useMemo(
    () =>
      [
        sessions.map((session) => session.id).join("|"),
        vocabularyItems
          .map((item) => `${item.id}:${item.updatedAt}:${item.userSentences.length}`)
          .join("|"),
        xpProfile.updatedAt,
        xpEvents.map((event) => `${event.type}:${event.sourceId}`).join("|"),
        badges.map((badge) => `${badge.id}:${badge.status}:${badge.earnedAt ?? ""}`).join("|"),
      ].join("::"),
    [badges, sessions, vocabularyItems, xpEvents, xpProfile.updatedAt],
  );

  useEffect(() => {
    if (!gamificationReady) return;
    if (!cloudAuthState.isLoaded) return;
    if (!cloudAuthState.isSignedIn || !cloudAuthState.userId) {
      cloudSnapshotCheckKeyRef.current = null;
      return;
    }

    const checkKey = `${cloudAuthState.userId}::${cloudSnapshotLocalKey}`;
    if (cloudSnapshotCheckKeyRef.current === checkKey) return;
    cloudSnapshotCheckKeyRef.current = checkKey;

    let cancelled = false;
    void loadCloudSnapshotPlan({
      auth: cloudAuthState,
      local: {
        sessions,
        vocabulary: vocabularyItems,
        xpProfile,
        xpEvents,
        badges,
      },
    }).then((result) => {
      if (!cancelled) {
        setCloudSnapshotResult(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    badges,
    cloudAuthState,
    cloudSnapshotLocalKey,
    gamificationReady,
    sessions,
    vocabularyItems,
    xpEvents,
    xpProfile,
  ]);

  useEffect(() => {
    if (!cloudAuthState.isLoaded) return;

    if (!cloudAuthState.isSignedIn || !cloudAuthState.userId) {
      sessionHistoryCloudLoadKeyRef.current = null;
      replaceSessionsFromCloud(loadSessions());
      return;
    }

    const loadKey = `cloud:${cloudAuthState.userId}`;
    if (sessionHistoryCloudLoadKeyRef.current === loadKey) return;
    sessionHistoryCloudLoadKeyRef.current = loadKey;

    let cancelled = false;
    void loadCompletedSessionsFromCloud({ auth: cloudAuthState }).then((result) => {
      if (cancelled) return;
      if (result.status === "loaded") {
        replaceSessionsFromCloud(result.sessions as SessionRecord[]);
        setSessionHistorySaveError(null);
        return;
      }
      if (result.status === "failed") {
        setSessionHistorySaveError(
          "Could not load cloud session history. Local fallback remains available.",
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cloudAuthState]);

  // --- Profile Bootstrap Runtime ---
  useEffect(() => {
    if (CLERK_ENABLED && !isClerkUserLoaded) return;
    if (!cloudAuthState.isLoaded) return;
    if (!cloudAuthState.isSignedIn || !cloudAuthState.userId) {
      bootstrappedUserRef.current = null;
      return;
    }
    if (bootstrappedUserRef.current === cloudAuthState.userId) return;
    if (!isSupabaseConfigured()) return;

    let cancelled = false;

    async function runBootstrap() {
      if (!cloudAuthState.userId || !cloudAuthState.getToken) return;
      try {
        const token = await getSupabaseAccessToken(cloudAuthState.getToken);
        if (!token || cancelled) return;

        const supabaseClient = createBrowserSupabaseClient({
          accessToken: createSupabaseAccessTokenProvider(
            cloudAuthState.getToken,
            token,
          ),
        });
        if (!supabaseClient || cancelled) return;

        const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? null;
        const clerkAvatar = clerkUser?.imageUrl ?? null;
        const clerkDisplayName = clerkUser?.fullName ?? clerkUser?.username ?? clerkUser?.primaryEmailAddress?.emailAddress ?? "Signed in user";

        await bootstrapProfile(
          cloudAuthState.userId,
          {
            email: clerkEmail,
            displayName: clerkDisplayName,
            avatarUrl: clerkAvatar,
          },
          supabaseClient,
        );

        if (cancelled) return;
        bootstrappedUserRef.current = cloudAuthState.userId;
      } catch (err) {
        // Bootstrap failure is non-blocking and caught cleanly
        console.error("Profile bootstrap failed:", err);
      }
    }

    void runBootstrap();

    return () => {
      cancelled = true;
    };
  }, [cloudAuthState, clerkUser, isClerkUserLoaded]);

  // --- Owner profile load (after bootstrap, non-blocking) ---
  useEffect(() => {
    if (CLERK_ENABLED && !isClerkUserLoaded) return;
    if (!cloudAuthState.isLoaded) return;
    if (!cloudAuthState.isSignedIn || !cloudAuthState.userId) return;

    let cancelled = false;

    async function runLoadProfile() {
      if (!cloudAuthState.userId || !cloudAuthState.getToken) return;
      try {
        if (process.env.NODE_ENV !== "production") {
          const testWindow = window as typeof window & {
            __MOCK_PROFILE_ADAPTER__?: {
              loadProfile?: (userId: string) => Promise<UserProfile | null>;
              updateProfile?: (userId: string, patch: UserProfilePreferencesPatch) => Promise<void>;
            };
          };
          if (testWindow.__MOCK_PROFILE_ADAPTER__?.loadProfile) {
            const p = await testWindow.__MOCK_PROFILE_ADAPTER__.loadProfile(cloudAuthState.userId);
            if (!cancelled) setOwnerProfile(p);
            return;
          }
        }

        if (!isSupabaseConfigured()) return;

        const token = await getSupabaseAccessToken(cloudAuthState.getToken);
        if (!token || cancelled) return;
        const supabaseClient = createBrowserSupabaseClient({
          accessToken: createSupabaseAccessTokenProvider(
            cloudAuthState.getToken,
            token,
          ),
        });
        if (!supabaseClient || cancelled) return;
        const p = await loadSupabaseProfile(cloudAuthState.userId, supabaseClient);
        if (!cancelled) setOwnerProfile(p);
      } catch {
        if (!cancelled) setProfileLoadError("Could not load profile.");
      }
    }

    void runLoadProfile();

    return () => {
      cancelled = true;
    };
  }, [cloudAuthState, isClerkUserLoaded]);

  // --- Profile save handler ---
  async function handleSaveProfilePreferences(
    patch: UserProfilePreferencesPatch,
  ) {
    if (!cloudAuthState.userId || !cloudAuthState.getToken) return;
    setProfileSaveStatus("saving");
    setProfileSaveError(null);
    try {
      if (process.env.NODE_ENV !== "production") {
        const testWindow = window as typeof window & {
          __MOCK_PROFILE_ADAPTER__?: {
            loadProfile?: (userId: string) => Promise<UserProfile | null>;
            updateProfile?: (userId: string, patch: UserProfilePreferencesPatch) => Promise<void>;
          };
        };
        if (testWindow.__MOCK_PROFILE_ADAPTER__?.updateProfile) {
          await testWindow.__MOCK_PROFILE_ADAPTER__.updateProfile(cloudAuthState.userId, patch);
          setOwnerProfile((prev): UserProfile | null => {
            if (!prev) return prev;
            return applyProfilePreferencesPatchToProfile(prev, patch);
          });
          setProfileSaveStatus("saved");
          return;
        }
      }

      if (!isSupabaseConfigured()) throw new Error("Supabase not configured");

      const token = await getSupabaseAccessToken(cloudAuthState.getToken);
      if (!token) throw new Error("No auth token");
      const supabaseClient = createBrowserSupabaseClient({
        accessToken: createSupabaseAccessTokenProvider(
          cloudAuthState.getToken,
          token,
        ),
      });
      if (!supabaseClient) throw new Error("No Supabase client");
      await updateSupabaseProfilePreferences(
        cloudAuthState.userId,
        patch,
        supabaseClient,
      );
      setOwnerProfile((prev): UserProfile | null => {
        if (!prev) return prev;
        return applyProfilePreferencesPatchToProfile(prev, patch);
      });
      setProfileSaveStatus("saved");
    } catch {
      setProfileSaveStatus("error");
      setProfileSaveError(
        "Save failed. Your local learning data is not affected.",
      );
    }
  }

  const handleConfirmCloudRestore = async (): Promise<CloudRestoreActionResult> => {
    if (
      !cloudSnapshotResult ||
      cloudSnapshotResult.status !== "loaded" ||
      cloudSnapshotResult.plan.status !== "restore-available"
    ) {
      return { status: "failed" };
    }

    if (
      !isEmptyLocalRestoreTarget({
        sessions,
        vocabularyItems,
        xpProfile,
        xpEvents,
        badges,
      })
    ) {
      return { status: "aborted-local-not-empty" };
    }

    const restoredSessions = cloudSnapshotResult.plan.merged.sessions.slice(
      0,
      MAX_STORED_SESSIONS,
    ) as SessionRecord[];
    const restoredVocabulary = cloudSnapshotResult.plan.merged.vocabulary;
    const restoredProfile =
      cloudSnapshotResult.plan.merged.xpProfile ?? createDefaultXpProfile();
    const restoredEvents = cloudSnapshotResult.plan.merged.xpEvents;
    const restoredBadges = cloudSnapshotResult.plan.merged.badges;

    suppressCloudWritesRef.current = true;
    try {
      updateSessions(restoredSessions);
      setVocabularyItems(restoredVocabulary);
      storage.saveVocabulary(restoredVocabulary);
      setXpProfile(restoredProfile);
      const profileSaved = storage.saveXpProfile(restoredProfile);
      setXpEvents(restoredEvents);
      const eventsSaved = storage.saveXpEvents(restoredEvents);
      setBadges(restoredBadges);
      const badgesSaved = storage.saveBadges(restoredBadges);

      if (!profileSaved || !eventsSaved || !badgesSaved) {
        return { status: "failed" };
      }

      return { status: "restored" };
    } catch {
      return { status: "failed" };
    } finally {
      window.setTimeout(() => {
        suppressCloudWritesRef.current = false;
      }, CLOUD_WRITE_SUPPRESSION_RELEASE_MS);
    }
  };

  const handleConfirmCloudImport = async (): Promise<CloudImportActionResult> => {
    if (
      !cloudSnapshotResult ||
      cloudSnapshotResult.status !== "loaded" ||
      cloudSnapshotResult.plan.status !== "import-available"
    ) {
      return { status: "failed" };
    }

    const localSnapshot: LocalSnapshotTarget = {
      sessions,
      vocabularyItems,
      xpProfile,
      xpEvents,
      badges,
    };

    if (
      !isLocalSnapshotCompatibleWithMerged(
        localSnapshot,
        cloudSnapshotResult.plan.merged,
      )
    ) {
      return { status: "aborted-local-changed" };
    }

    suppressCloudWritesRef.current = true;
    try {
      const saved = applyMergedCloudSnapshotToLocal(
        cloudSnapshotResult.plan.merged,
        {
          updateSessions,
          setVocabularyItems,
          setXpProfile,
          setXpEvents,
          setBadges,
        },
      );

      return saved ? { status: "imported" } : { status: "failed" };
    } catch {
      return { status: "failed" };
    } finally {
      window.setTimeout(() => {
        suppressCloudWritesRef.current = false;
      }, CLOUD_WRITE_SUPPRESSION_RELEASE_MS);
    }
  };

  // --- Sidebar navigation view ---
  // Lightweight local view state. No router, no real new routes. The Active
  // Session view shows the full practice flow; other views are anchor-style
  // sub-pages that reuse existing data.
  type View = SidebarView;
  const [view, setView] = useState<View>("active");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const mobileNavPanelRef = useRef<HTMLDivElement | null>(null);
  const handleCloseMobileNav = () => setIsMobileNavOpen(false);
  const handleToggleMobileNav = () =>
    setIsMobileNavOpen((currentIsOpen) => !currentIsOpen);
  const handleSelectView = (nextView: SidebarView) => {
    if (nextView === "commonplace" && view !== "commonplace") {
      window.sessionStorage.setItem(LAST_FONETIK_VIEW_SESSION_KEY, view);
    }
    setView(nextView);
    setIsMobileNavOpen(false);
  };

  const handleBackFromCommonplace = () => {
    const previousView = normalizeFonetikReturnView(
      window.sessionStorage.getItem(LAST_FONETIK_VIEW_SESSION_KEY),
    );
    setView(previousView);
  };

  // Fallback for invalid or old selected view states (e.g. diagnostic, level-up-check)
  useEffect(() => {
    if (view === "diagnostic") {
      const timer = setTimeout(() => {
        setView("active");
      }, 0);
      return () => clearTimeout(timer);
    } else if ((view as string) === "level-up-check") {
      const timer = setTimeout(() => {
        setView("progress");
      }, 0);
      return () => clearTimeout(timer);
    } else if (view === "learning-path") {
      const timer = setTimeout(() => {
        setView("active");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [view]);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return;
    }

    mobileNavPanelRef.current?.focus();
    const previousBodyOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileNavOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileNavOpen]);

  useEffect(() => {
    if (commonplacePodchatRestoreRef.current) return;
    commonplacePodchatRestoreRef.current = true;
    const storedContext = readStoredCommonplacePodchatContext();
    if (!storedContext) return;

    const timer = window.setTimeout(() => {
      if (storedContext.source === "commonplace") {
        setPendingCommonplaceContext(storedContext);
        setPendingCommonplaceMapContextRef(null);
        setPendingArticleContext(null);
        setTarget("Commonplace note discussion");
        setMode("Fluency Sprint");
        setView("active");
        return;
      }

      setPendingCommonplaceMapContextRef(storedContext);
      setPendingCommonplaceContext(null);
      setPendingArticleContext(null);
      setTarget(
        storedContext.mapType === "main"
          ? "Commonplace Main Map discussion"
          : "Commonplace Sub Mind Map discussion",
      );
      setMode("Fluency Sprint");
      setView("active");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const previousSession = sessions[0] ?? null;
  // Lightweight day-streak derived from session.date strings. No new storage.
  const dayStreak = computeDayStreak(sessions);

  const levelUpCheck = buildLevelUpCheck(sessions, level);
  const mentalModelDefaultFocus =
    target.trim() ||
    previousSession?.retryTask?.trim() ||
    previousSession?.mainWeakness?.trim() ||
    "Build a clearer academic speaking response";
  const effectiveMentalModelFocus =
    mentalModelFocus.trim() || mentalModelDefaultFocus;
  const articleFocusPlaceholder =
    target.trim() || "Use the article for academic speaking practice";
  const effectiveArticleFocus = articleFocus.trim() || articleFocusPlaceholder;
  const currentLocalDate = getLocalDateString();
  const speakerProgress = getSpeakerLevelProgress(xpProfile.totalXp);
  const appLanguagePreview =
    appLanguageOverride?.userId === cloudAuthState.userId
      ? appLanguageOverride.language
      : null;
  const appLanguage = cloudAuthState.isSignedIn
    ? appLanguagePreview ?? normalizeAppLanguage(ownerProfile?.preferredAppLanguage)
    : DEFAULT_APP_LANGUAGE;
  const { t: homeT } = useI18n(appLanguage);
  const claimableXp =
    xpProfile.pendingDailyXp + xpProfile.unclaimedPreviousXp;
  const alreadyClaimedToday = xpProfile.lastClaimedDate === currentLocalDate;
  const earnedBadgesCount = badges.filter(
    (badge) => badge.status === "earned",
  ).length;
  const earnedBadgeLabels = badges
    .filter((badge) => badge.status === "earned")
    .map((badge) => badge.label);
  const vocabularyStats = computeVocabularyStats(vocabularyItems);
  const savedVocabularyWords = useMemo(() => {
    const set = new Set<string>();
    for (const item of vocabularyItems) {
      set.add(item.word.trim().toLowerCase());
    }
    return set;
  }, [vocabularyItems]);
  const selectedVocabItem =
    vocabularyItems.find((item) => item.id === selectedVocabItemId) ??
    vocabularyItems[0] ??
    null;
  const vocabPracticeCurrentItem =
    vocabPracticeQueueIds.length > 0 && !vocabPracticeComplete
      ? vocabularyItems.find(
          (item) => item.id === vocabPracticeQueueIds[vocabPracticeIndex],
        ) ?? null
      : null;

  const persistVocabulary = (nextItems: VocabItem[]) => {
    const prevItems = vocabularyItems;
    setVocabularyItems(nextItems);
    storage.saveVocabulary(nextItems);
    void writeVocabularyChangesToCloud({
      auth: sessionCloudAuthRef.current,
      previous: prevItems,
      next: nextItems,
    });
  };

  const handleSaveArticleVocabularyCandidate = (candidate: {
    word: string;
    meaning: string;
    whyUseful: string;
  }) => {
    const trimmedWord = candidate.word.trim().toLowerCase();
    // Duplicate check: case-insensitive, trimmed.
    if (
      vocabularyItems.some(
        (item) => item.word.trim().toLowerCase() === trimmedWord,
      )
    ) {
      return;
    }
    const item = createVocabItem({
      word: candidate.word,
      meaning: candidate.meaning,
      source: "article" as const,
      level: level as VocabLevel,
      example: candidate.whyUseful || "",
      collocations: [],
    });
    const nextItems = [item, ...vocabularyItems];
    persistVocabulary(nextItems);
  };

  const handleAddVocabularyItem = () => {
    const word = vocabFormWord.trim();
    const meaning = vocabFormMeaning.trim();
    if (!word || !meaning) {
      setVocabMessage({
        tone: "error",
        text: "Add both a word and a short meaning first.",
      });
      return;
    }

    const item = createVocabItem({
      word,
      meaning,
      level: vocabFormLevel,
      source: vocabFormSource,
      example: vocabFormExample,
      collocations: vocabFormCollocations
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    });
    const nextItems = [item, ...vocabularyItems];
    persistVocabulary(nextItems);
    setSelectedVocabItemId(item.id);
    setVocabSentenceDraft("");
    setVocabFormWord("");
    setVocabFormMeaning("");
    setVocabFormExample("");
    setVocabFormCollocations("");
    setVocabMessage({
      tone: "success",
      text: "Vocabulary saved. Practice it with one simple sentence.",
    });
  };

  const handleDeleteVocabularyItem = (id: string) => {
    const nextItems = deleteVocabItem(vocabularyItems, id);
    persistVocabulary(nextItems);
    if (selectedVocabItemId === id) {
      setSelectedVocabItemId(nextItems[0]?.id ?? null);
      setVocabSentenceDraft("");
    }
    setVocabularyCorrectionError(null);
    setVocabMessage({ tone: "info", text: "Vocabulary item deleted." });
  };

  const handleUpdateVocabularyStatus = (
    id: string,
    status: VocabStatus,
  ) => {
    const nextItems = updateVocabStatus(vocabularyItems, id, status);
    persistVocabulary(nextItems);
    setVocabMessage({ tone: "success", text: "Vocabulary status updated." });
  };

  const handleSelectVocabularyPracticeItem = (id: string) => {
    setSelectedVocabItemId(id);
    setVocabularyMode("manage");
    setVocabSentenceDraft("");
    setVocabularyCorrectionError(null);
    setVocabMessage({
      tone: "info",
      text: "Write one simple sentence using this word.",
    });
  };

  const resetVocabularyPracticeCard = () => {
    setVocabSentenceDraft("");
    setVocabPracticeCardState("writing");
    setVocabPracticeAcceptedSentenceId(null);
    setVocabPracticeHintVisible(false);
    setVocabularyCorrectionError(null);
  };

  const handleBackToVocabularyHome = () => {
    setVocabularyMode("recent");
    resetVocabularyPracticeCard();
    setVocabPracticeQueueIds([]);
    setVocabPracticeIndex(0);
    setVocabPracticePracticedCount(0);
    setVocabPracticeSkippedCount(0);
    setVocabPracticeComplete(false);
    setVocabPracticeCompletionXpMessage(null);
  };

  const handleViewAllVocabulary = () => {
    setVocabularyMode("manage");
    resetVocabularyPracticeCard();
  };

  const handleStartVocabularyPractice = () => {
    const queueIds = buildVocabularyPracticeQueue(vocabularyItems, { size: 5 });
    if (queueIds.length === 0) {
      setVocabMessage({
        tone: "info",
        text: "No practice cards are available. Add vocabulary or unpause saved items first.",
      });
      return;
    }

    setVocabularyMode("practice");
    setVocabPracticeQueueIds(queueIds);
    setVocabPracticeIndex(0);
    setVocabPracticePracticedCount(0);
    setVocabPracticeSkippedCount(0);
    setVocabPracticeComplete(false);
    setVocabPracticeCompletionXpMessage(null);
    resetVocabularyPracticeCard();
    setVocabMessage({
      tone: "info",
      text: "Active recall started. Write one original sentence for each card.",
    });
  };

  const handleShowVocabularyHint = () => {
    setVocabPracticeHintVisible(true);
  };

  const handleSubmitVocabularyPracticeSentence = () => {
    if (!vocabPracticeCurrentItem) {
      setVocabMessage({
        tone: "error",
        text: "No practice card is active.",
      });
      return;
    }

    const result = addUserSentence(
      vocabularyItems,
      vocabPracticeCurrentItem.id,
      vocabSentenceDraft,
    );
    if (!result.accepted) {
      setVocabMessage({ tone: "error", text: result.reason });
      return;
    }

    persistVocabulary(result.items);
    setSelectedVocabItemId(result.item?.id ?? vocabPracticeCurrentItem.id);
    setVocabSentenceDraft("");
    setVocabularyCorrectionError(null);
    setVocabPracticeCardState("accepted");
    setVocabPracticePracticedCount((count) => count + 1);
    setVocabMessage({ tone: "success", text: result.reason });
    const savedSentence = result.item?.userSentences.at(-1);
    if (result.item && savedSentence) {
      setVocabPracticeAcceptedSentenceId(savedSentence.id);
      awardGamificationEvent(
        "vocab_sentence_submitted",
        `${result.item.id}-${savedSentence.id}`,
        "vocabulary",
        "Submitted a valid vocabulary practice sentence.",
      );
    }
  };

  const handleSkipVocabularyPracticeCard = () => {
    if (!vocabPracticeCurrentItem) return;
    const nextItems = markVocabularyPracticed(
      vocabularyItems,
      vocabPracticeCurrentItem.id,
    );
    persistVocabulary(nextItems);
    setVocabPracticeSkippedCount((count) => count + 1);
    setVocabPracticeCardState("skipped");
    setVocabSentenceDraft("");
    setVocabularyCorrectionError(null);
    setVocabMessage({
      tone: "info",
      text: "Card skipped. No XP or reuse count was added.",
    });
  };

  const handleNextVocabularyPracticeCard = () => {
    const nextIndex = vocabPracticeIndex + 1;
    if (nextIndex >= vocabPracticeQueueIds.length) {
      const completedFullRecallQueue =
        vocabPracticeQueueIds.length === 5 &&
        vocabPracticeSkippedCount === 0 &&
        vocabPracticePracticedCount === 5;

      if (completedFullRecallQueue) {
        const localDate = getLocalDateString();
        const awardResult = awardGamificationEvent(
          "vocab_recall_session_completed",
          `vocab-recall-${localDate}-${stableTextKey(
            vocabPracticeQueueIds.join("|"),
          )}`,
          "vocabulary",
          "Completed a 5-card vocabulary active recall session with no skips.",
        );

        setVocabPracticeCompletionXpMessage(
          awardResult?.allowed
            ? "Recall session XP added."
            : "Session complete. XP already claimed or daily cap reached.",
        );
      } else {
        setVocabPracticeCompletionXpMessage(
          "Session complete. Completion XP requires 5 saved sentences with no skipped cards.",
        );
      }

      setVocabPracticeComplete(true);
      resetVocabularyPracticeCard();
      setVocabMessage({
        tone: "success",
        text: "Active recall session complete.",
      });
      return;
    }

    setVocabPracticeIndex(nextIndex);
    resetVocabularyPracticeCard();
  };

  const handleSubmitVocabularySentence = () => {
    if (!selectedVocabItem) {
      setVocabMessage({
        tone: "error",
        text: "Select a vocabulary item before saving a sentence.",
      });
      return;
    }

    const result = addUserSentence(
      vocabularyItems,
      selectedVocabItem.id,
      vocabSentenceDraft,
    );
    if (result.accepted) {
      persistVocabulary(result.items);
      setSelectedVocabItemId(result.item?.id ?? selectedVocabItem.id);
      setVocabSentenceDraft("");
      setVocabularyCorrectionError(null);
      setVocabMessage({ tone: "success", text: result.reason });
      const savedSentence = result.item?.userSentences.at(-1);
      if (result.item && savedSentence) {
        awardGamificationEvent(
          "vocab_sentence_submitted",
          `${result.item.id}-${savedSentence.id}`,
          "vocabulary",
          "Submitted a valid vocabulary practice sentence.",
        );
      }
      return;
    }

    setVocabMessage({ tone: "error", text: result.reason });
  };

  const handleCheckVocabularySentence = async (
    itemId: string,
    sentenceId: string,
  ) => {
    if (vocabularyCorrectionLoadingId) return;

    const item = vocabularyItems.find((candidate) => candidate.id === itemId);
    const sentence = item?.userSentences.find(
      (candidate) => candidate.id === sentenceId,
    );

    if (!item || !sentence) {
      setVocabularyCorrectionError({
        sentenceId,
        text: "Sentence was not found. Refresh the notebook and try again.",
      });
      return;
    }

    setVocabularyCorrectionLoadingId(sentenceId);
    setVocabularyCorrectionError(null);

    try {
      const res = await fetch("/api/vocabulary-correction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: aiProvider,
          level: item.level,
          targetVocabulary: item.word,
          meaning: item.meaning,
          partOfSpeech: item.partOfSpeech ?? "other",
          userSentence: sentence.sentence,
          feedbackLanguage: normalizeFeedbackLanguage(
            ownerProfile?.feedbackLanguage,
          ),
          targetLanguage: normalizeTargetLanguage(ownerProfile?.targetLanguage),
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | (VocabularyCorrectionResult & { error?: string })
        | { error?: string }
        | null;

      if (!res.ok || !data || ("error" in data && data.error)) {
        const rawMessage =
          (data && "error" in data && data.error) ||
          `Request failed with status ${res.status}.`;
        setVocabularyCorrectionError({
          sentenceId,
          text: sanitizeErrorMessage(rawMessage),
        });
        return;
      }

      const result = data as VocabularyCorrectionResult;
      if (
        !result.status ||
        !result.explanation ||
        !result.correctedSentence ||
        !result.collocationTip ||
        !result.retryInstruction ||
        !Array.isArray(result.warnings)
      ) {
        setVocabularyCorrectionError({
          sentenceId,
          text: "Vocabulary correction response was incomplete. Try again.",
        });
        return;
      }

      const nextItems = saveSentenceCorrection(
        vocabularyItems,
        item.id,
        sentence.id,
        {
          ...result,
          checkedAt: new Date().toISOString(),
          providerUsed: aiProvider,
        },
      );
      persistVocabulary(nextItems);
      setVocabMessage({
        tone: "success",
        text: "Usage checked. Use the feedback to improve your next attempt.",
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Network error while contacting the API.";
      setVocabularyCorrectionError({
        sentenceId,
        text: sanitizeErrorMessage(message),
      });
    } finally {
      setVocabularyCorrectionLoadingId(null);
    }
  };

  const updateBadges = (
    eventType: XpEventType | null,
    profile: XpProfile,
  ) => {
    let nextBadges = [...badges];
    const eventBadgeId = eventType ? BADGE_BY_EVENT[eventType] : undefined;
    if (eventBadgeId) {
      nextBadges = withEarnedBadge(nextBadges, eventBadgeId);
    }
    if (getSpeakerLevelProgress(profile.totalXp).currentLevel.level >= 5) {
      nextBadges = withEarnedBadge(nextBadges, "speaker_level_5");
    }

    if (nextBadges.length !== badges.length) {
      setBadges(nextBadges);
      storage.saveBadges(nextBadges);
      void writeBadgesToCloud({
        auth: sessionCloudAuthRef.current,
        badges: nextBadges,
      });
    }
  };

  const awardGamificationEvent = (
    type: XpEventType,
    sourceId: string,
    sourceKind: XpEvent["sourceKind"],
    reason: string,
  ): { allowed: boolean; reason: string; xpToAward: number } | null => {
    try {
      const candidate = createXpEvent({
        type,
        sourceId,
        sourceKind,
        reason,
      });
      const prevEvents = xpEvents;
      const awarded = awardXpEvent(xpProfile, xpEvents, candidate);
      setXpProfile(awarded.profile);
      setXpEvents(awarded.events);
      storage.saveXpProfile(awarded.profile);
      storage.saveXpEvents(awarded.events);
      void writeXpEventsToCloud({
        auth: sessionCloudAuthRef.current,
        previous: prevEvents,
        next: awarded.events,
      });

      if (awarded.result.allowed) {
        updateBadges(type, awarded.profile);
      }
      return awarded.result;
    } catch {
      // Gamification is optional; it should never block the practice flow.
      return null;
    }
  };

  const handleApplyLevelUp = () => {
    if (levelUpCheck.status !== "Ready" || !levelUpCheck.nextLevel) return;
    const oldLevel = level;
    const nextLevel = levelUpCheck.nextLevel;
    setLevel(levelUpCheck.nextLevel);
    setTarget(
      `Start ${levelUpCheck.nextLevel} practice with clear structure and steady evidence.`,
    );
    setView("active");
    awardGamificationEvent(
      "level_up_applied",
      `${oldLevel}-to-${nextLevel}-${getLocalDateString()}`,
      "level-up",
      "Applied a ready Level-Up Check recommendation.",
    );
  };

  const handleClaimXp = () => {
    const claimed = claimXp(xpProfile, getLocalDateString());
    setXpProfile(claimed.profile);
    storage.saveXpProfile(claimed.profile);
    updateBadges(null, claimed.profile);
  };

  const handlePracticeArticleSpeakingTask = (result: ArticlePracticeResult) => {
    const context: PodchatArticleContext = {
      articleTitle: result.sourceTitle,
      articleBrief: result.articleBrief,
      mainIdea: result.mainIdea,
      keyPoints: result.keyPoints,
      speakingTaskTitle: result.speakingTask.title,
      speakingTaskInstruction: result.speakingTask.instruction,
      targetStructure: result.speakingTask.targetStructure,
      sourceDomain: result.sourceDomain,
    };
    setPendingArticleContext(context);
    setPendingCommonplaceContext(null);
    setTarget(buildArticleSpeakingTarget(result));
    setMode("Reading-to-Speaking");
    setView("active");
  };

  const handleDiscussCommonplaceInPodchat = (
    context: PodchatCommonplaceContextRef,
  ) => {
    setPendingCommonplaceContext(context);
    setPendingArticleContext(null);
    setPendingCommonplaceMapContextRef(null);
    setTarget("Commonplace note discussion");
    setMode("Fluency Sprint");
    setView("active");
  };

  const handleDiscussCommonplaceMapInPodchat = (
    context: PodchatCommonplaceMapContextRef,
  ) => {
    setPendingCommonplaceMapContextRef(context);
    setPendingCommonplaceContext(null);
    setPendingArticleContext(null);
    setTarget(
      context.mapType === "main"
        ? "Commonplace Main Map discussion"
        : "Commonplace Sub Mind Map discussion",
    );
    setMode("Fluency Sprint");
    setView("active");
  };

  const handleRunWeeklyReview = async () => {
    setWeeklyReviewLoading(true);
    setWeeklyReviewError(null);
    setWeeklyReviewResult(null);

    try {
      const res = await fetch("/api/weekly-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          feedbackLanguage: normalizeFeedbackLanguage(
            ownerProfile?.feedbackLanguage,
          ),
          targetLanguage: normalizeTargetLanguage(ownerProfile?.targetLanguage),
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | (WeeklyReviewResult & { error?: string })
        | { error?: string }
        | null;

      if (!res.ok || !data || ("error" in data && data.error)) {
        const rawMessage =
          (data && "error" in data && data.error) ||
          `Request failed with status ${res.status}.`;
        setWeeklyReviewError(sanitizeErrorMessage(rawMessage));
        return;
      }

      const result = data as WeeklyReviewResult;
      if (
        !result.summary ||
        !result.recurringWeakness ||
        !result.bestImprovement ||
        !result.scoreTrend ||
        !result.nextWeekFocus ||
        !Array.isArray(result.recommendedPlan) ||
        result.recommendedPlan.length !== 7 ||
        !Array.isArray(result.warnings)
      ) {
        setWeeklyReviewError("Weekly Review response was incomplete. Try again.");
        return;
      }

      setWeeklyReviewResult(result);
      awardGamificationEvent(
        "weekly_review_completed",
        `weekly-review-${getLocalDateString()}`,
        "weekly-review",
        "Generated a weekly review.",
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Network error while contacting the API.";
      setWeeklyReviewError(sanitizeErrorMessage(message));
    } finally {
      setWeeklyReviewLoading(false);
    }
  };

  const handleGenerateMentalModel = async () => {
    const focus = effectiveMentalModelFocus.trim();
    if (focus.length === 0) return;

    setMentalModelLoading(true);
    setMentalModelError(null);
    setMentalModelResult(null);
    setMentalModelFocus(focus);

    try {
      const res = await fetch("/api/mental-model", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: aiProvider,
          level,
          mode,
          focus,
          latestWeakness: previousSession?.mainWeakness ?? "",
          latestRetryTask: previousSession?.retryTask ?? "",
          feedbackLanguage: normalizeFeedbackLanguage(
            ownerProfile?.feedbackLanguage,
          ),
          targetLanguage: normalizeTargetLanguage(ownerProfile?.targetLanguage),
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | (MentalModelResult & { error?: string })
        | { error?: string }
        | null;

      if (!res.ok || !data || ("error" in data && data.error)) {
        const rawMessage =
          (data && "error" in data && data.error) ||
          `Request failed with status ${res.status}.`;
        setMentalModelError(sanitizeErrorMessage(rawMessage));
        return;
      }

      const result = data as MentalModelResult;
      if (
        !result.coreStandard ||
        !Array.isArray(result.qualityCriteria) ||
        !result.weakPattern ||
        !result.strongPattern ||
        !Array.isArray(result.selfCheckQuestions) ||
        !result.microDrill ||
        !result.referenceModel
      ) {
        setMentalModelError("Mental Model response was incomplete. Try again.");
        return;
      }

      setMentalModelResult(result);
      awardGamificationEvent(
        "mental_model_completed",
        `mental-model-${getLocalDateString()}-${level}-${mode}-${stableTextKey(focus)}`,
        "mental-model",
        "Generated a mental model session.",
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Network error while contacting the API.";
      setMentalModelError(sanitizeErrorMessage(message));
    } finally {
      setMentalModelLoading(false);
    }
  };

  const handleGenerateArticlePractice = async () => {
    const inputMode = articleInputMode;
    const url = articleUrl.trim();
    const markdown = preparedContextMarkdown.trim();
    if (inputMode === "url" && url.length === 0) {
      setArticlePracticeError("Paste an article URL before generating practice.");
      return;
    }
    if (inputMode === "markdown") {
      if (preparedContextMarkdownError) {
        setArticlePracticeError(preparedContextMarkdownError);
        return;
      }
      if (markdown.length === 0) {
        setArticlePracticeError(
          "Paste prepared Article Context Markdown before generating practice.",
        );
        return;
      }
      if (markdown.length > 20_000) {
        setArticlePracticeError(
          "Prepared Markdown must be 20,000 characters or fewer.",
        );
        return;
      }
    }

    const focus = effectiveArticleFocus.trim();
    setArticlePracticeLoading(true);
    setArticlePracticeError(null);
    setArticlePracticeResult(null);
    if (inputMode === "url") {
      setArticleUrl(url);
    }

    try {
      const res = await fetch("/api/article-practice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: aiProvider,
          inputMode,
          ...(inputMode === "url"
            ? { url }
            : { preparedContextMarkdown: markdown }),
          level,
          mode,
          focus,
          feedbackLanguage: normalizeFeedbackLanguage(
            ownerProfile?.feedbackLanguage,
          ),
          targetLanguage: normalizeTargetLanguage(ownerProfile?.targetLanguage),
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | (ArticlePracticeResult & { error?: string })
        | { error?: string }
        | null;

      if (!res.ok || !data || ("error" in data && data.error)) {
        const rawMessage =
          (data && "error" in data && data.error) ||
          `Request failed with status ${res.status}.`;
        setArticlePracticeError(sanitizeErrorMessage(rawMessage));
        return;
      }

      const result = data as ArticlePracticeResult;
      if (
        !result.sourceTitle ||
        !result.sourceUrl ||
        !result.sourceDomain ||
        !result.articleBrief ||
        !result.mainIdea ||
        !Array.isArray(result.keyPoints) ||
        !Array.isArray(result.usefulVocabulary) ||
        !Array.isArray(result.comprehensionChecks) ||
        !result.speakingTask ||
        !result.speakingTask.title ||
        !result.speakingTask.instruction ||
        !Array.isArray(result.speakingTask.targetStructure) ||
        !Array.isArray(result.followUpQuestions) ||
        !Array.isArray(result.warnings)
      ) {
        setArticlePracticeError(
          "Article Practice response was incomplete. Try again.",
        );
        return;
      }

      setArticlePracticeResult(result);

      // Award XP for successful article practice generation.
      // sourceId is deterministic: normalized URL or markdown hash + local date only.
      try {
        const sourceKey =
          inputMode === "url"
            ? stableTextKey(normalizeArticlePracticeSourceUrl(url))
            : stableTextKey(markdown);
        const articleSourceId = [
          "article",
          getLocalDateString(),
          sourceKey,
        ].join("-");
        awardGamificationEvent(
          "article_practice_completed",
          articleSourceId,
          "article-practice",
          "Generated article practice from a valid URL.",
        );
      } catch {
        // XP is optional; never block the result from rendering.
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Network error while contacting the API.";
      setArticlePracticeError(sanitizeErrorMessage(message));
    } finally {
      setArticlePracticeLoading(false);
    }
  };

  const handleCopyLastCsv = async () => {
    const last = sessions[0];
    if (!last) return;
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        await navigator.clipboard.writeText(last.csv);
        setLastCsvCopied(true);
        setTimeout(() => setLastCsvCopied(false), 1500);
      }
    } catch {
      setLastCsvCopied(false);
    }
  };

  const handleSessionHistoryRecord = useCallback((session: StoredSessionRecord) => {
    const sessionRecord = session as SessionRecord;
    const auth = sessionCloudAuthRef.current;
    if (auth.isLoaded && auth.isSignedIn) {
      setSessionHistorySaveError(null);
      void writeCompletedSessionToCloud({
        auth,
        session: sessionRecord,
      }).then((result) => {
        if (result.status === "saved") {
          prependCloudSession(sessionRecord);
          return;
        }
        if (result.status === "skipped") {
          updateSessions([sessionRecord, ...sessionsCache]);
          setSessionHistorySaveError(
            "Session history is using local fallback because cloud history is unavailable.",
          );
          return;
        }
        if (result.status === "failed") {
          setSessionHistorySaveError(
            "Session evaluation finished, but cloud history save failed. Please try another session after checking your connection.",
          );
        }
      });
      return;
    }

    updateSessions([sessionRecord, ...sessionsCache]);
  }, []);

  const sidebarProps: SidebarProps = {
    view,
    level,
    sessionsCount: sessions.length,
    dayStreak,
    levelPhase: LEVEL_PHASE[level],
    nextLevel: nextLevelHint(level),
    speakerLevel: speakerProgress.currentLevel.level,
    speakerLevelName: speakerProgress.currentLevel.name,
    totalXp: xpProfile.totalXp,
    gamificationReady,
    appLanguage,
    onSelectView: handleSelectView,
  };
  const currentViewTitle = viewTitle(view, homeT);

  return (
    <>
      {CLERK_ENABLED && (
        <SessionCloudAuthBridge
          authRef={sessionCloudAuthRef}
          onAuthStateChange={setCloudAuthState}
        />
      )}
      {CLERK_ENABLED && (
        <ClerkUserBridge
          onUserChange={handleUserChange}
        />
      )}

      {coverState !== "app" ? (
        <CoverPage
          CLERK_ENABLED={CLERK_ENABLED}
          onLoginSuccess={() => setCoverState("app")}
        />
      ) : (
        <div
          className={`min-h-screen w-full flex flex-col ${
            view === "commonplace"
              ? "lg:min-h-screen"
              : "lg:h-screen lg:max-h-screen lg:overflow-hidden"
          }`}
        >
          <MobileShellBar
            isOpen={isMobileNavOpen}
            title={currentViewTitle}
            onToggle={handleToggleMobileNav}
          />
          {isMobileNavOpen && (
            <MobileNavigationDrawer
              panelRef={mobileNavPanelRef}
              sidebarProps={sidebarProps}
              onClose={handleCloseMobileNav}
            />
          )}
          <div
            className={`flex w-full flex-col lg:w-full lg:flex-1 lg:flex-row lg:gap-0 lg:px-0 lg:py-0 ${
              view === "commonplace"
                ? "gap-0 px-3 py-3 lg:min-h-screen"
                : "gap-6 px-4 py-6 lg:h-screen lg:overflow-hidden lg:min-h-0"
            }`}
          >
        {/* Sidebar */}
        {view !== "commonplace" && (
          <div className="hidden lg:block">
            <Sidebar {...sidebarProps} />
          </div>
        )}
        {/* Main */}
        <main
          className={`flex min-w-0 flex-1 flex-col ${
            view === "commonplace"
              ? "gap-0 lg:h-screen lg:min-h-0 lg:px-4 lg:py-4"
              : "gap-6 lg:h-full lg:min-h-0 lg:px-8 lg:py-8"
          }`}
        >
          {/* Topbar */}
          {view !== "commonplace" && (
            <Topbar
              subtitle={viewSubtitle(view, homeT)}
              title={viewTitle(view, homeT)}
              description={viewDescription(view, homeT)}
              hasActiveSession={view === "active"}
              mode={mode}
              level={level}
              appLanguage={appLanguage}
              authSlot={
                <>
                  <CloudSnapshotStatusBadge
                    result={
                      cloudAuthState.isSignedIn ? cloudSnapshotResult : null
                    }
                  />
                  <AuthStatus />
                </>
              }
            />
          )}

          <div
            data-testid="main-scroll-container"
            className={`flex-1 min-h-0 ${
              view === "commonplace"
                ? "flex flex-col gap-0 overflow-visible lg:pb-0 lg:pr-0"
                : "block space-y-6 lg:pb-10 lg:pr-1 lg:overflow-y-auto lg:overscroll-contain"
            }`}
          >
          <CloudSyncStatusPanel
            result={cloudAuthState.isSignedIn ? cloudSnapshotResult : null}
            onConfirmRestore={handleConfirmCloudRestore}
            onConfirmImport={handleConfirmCloudImport}
          />
          {sessionHistorySaveError && (
            <p className="app-message app-message-warning">
              {sessionHistorySaveError}
            </p>
          )}

          {/* ===================== Active Session view ===================== */}
          {view === "active" && (
            <PodchatView
              key={`${mode}:${target}:${pendingArticleContext ? "article" : pendingCommonplaceContext ? "commonplace" : pendingCommonplaceMapContextRef ? "commonplace-map" : "generic"}`}
              sessionLevel={level}
              sessionMode={mode}
              sessionProvider={aiProvider}
              todayTarget={target}
              onSessionHistoryRecord={handleSessionHistoryRecord}
              articleContext={pendingArticleContext}
              onClearArticleContext={() => setPendingArticleContext(null)}
              commonplaceContext={pendingCommonplaceContext}
              onClearCommonplaceContext={() => {
                setPendingCommonplaceContext(null);
                clearStoredCommonplacePodchatContext();
              }}
              commonplaceMapContextRef={pendingCommonplaceMapContextRef}
              onClearCommonplaceMapContext={() => {
                setPendingCommonplaceMapContextRef(null);
                clearStoredCommonplacePodchatContext();
              }}
              ttsProvider={ttsProvider}
              elevenLabsModelId={elevenLabsModel}
            />
          )}

          {/* ===================== Vocabulary Notebook view ===================== */}
          {view === "vocabulary" && (
            <VocabularyNotebookView
              mode={vocabularyMode}
              items={vocabularyItems}
              stats={vocabularyStats}
              formWord={vocabFormWord}
              formMeaning={vocabFormMeaning}
              formLevel={vocabFormLevel}
              formSource={vocabFormSource}
              formExample={vocabFormExample}
              formCollocations={vocabFormCollocations}
              selectedItemId={selectedVocabItem?.id ?? null}
              sentenceDraft={vocabSentenceDraft}
              message={vocabMessage}
              correctionLoadingId={vocabularyCorrectionLoadingId}
              correctionError={vocabularyCorrectionError}
              practiceCurrentItem={vocabPracticeCurrentItem}
              practiceQueueLength={vocabPracticeQueueIds.length}
              practiceIndex={vocabPracticeIndex}
              practiceCardState={vocabPracticeCardState}
              practiceHintVisible={vocabPracticeHintVisible}
              practicePracticedCount={vocabPracticePracticedCount}
              practiceSkippedCount={vocabPracticeSkippedCount}
              practiceComplete={vocabPracticeComplete}
              practiceAcceptedSentenceId={vocabPracticeAcceptedSentenceId}
              practiceCompletionXpMessage={vocabPracticeCompletionXpMessage}
              appLanguage={appLanguage}
              onFormWordChange={setVocabFormWord}
              onFormMeaningChange={setVocabFormMeaning}
              onFormLevelChange={setVocabFormLevel}
              onFormSourceChange={setVocabFormSource}
              onFormExampleChange={setVocabFormExample}
              onFormCollocationsChange={setVocabFormCollocations}
              onAddItem={handleAddVocabularyItem}
              onDeleteItem={handleDeleteVocabularyItem}
              onStatusChange={handleUpdateVocabularyStatus}
              onSelectPracticeItem={handleSelectVocabularyPracticeItem}
              onSentenceDraftChange={setVocabSentenceDraft}
              onSubmitSentence={handleSubmitVocabularySentence}
              onCheckSentence={handleCheckVocabularySentence}
              onBackToHome={handleBackToVocabularyHome}
              onViewAll={handleViewAllVocabulary}
              onStartPractice={handleStartVocabularyPractice}
              onShowPracticeHint={handleShowVocabularyHint}
              onSubmitPracticeSentence={handleSubmitVocabularyPracticeSentence}
              onSkipPracticeCard={handleSkipVocabularyPracticeCard}
              onNextPracticeCard={handleNextVocabularyPracticeCard}
            />
          )}

          {/* ===================== Commonplace Library view ===================== */}
          {view === "commonplace" && (
            <CommonplaceView
              ownerId={cloudAuthState.userId}
              isSignedIn={cloudAuthState.isSignedIn}
              getToken={cloudAuthState.getToken}
              supabaseConfigured={isSupabaseConfigured()}
              onBackToFonetik={handleBackFromCommonplace}
              commonplaceCanvasColor={ownerProfile?.commonplaceCanvasColor}
              commonplaceCardColor={ownerProfile?.commonplaceCardColor}
              onDiscussInPodchat={handleDiscussCommonplaceInPodchat}
              onDiscussMapInPodchat={handleDiscussCommonplaceMapInPodchat}
            />
          )}

          {/* ===================== Session Log view ===================== */}
          {view === "session-log" && (
            <SessionLogView
              sessions={sessions}
              lastCsvCopied={lastCsvCopied}
              appLanguage={appLanguage}
              onCopyLastCsv={handleCopyLastCsv}
              onGoToActiveSession={() => setView("active")}
            />
          )}
          {/* ===================== Progress view ===================== */}
          {view === "progress" && (
            <section className={card}>
              <div className={cardHeader}>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
                  {homeT("sidebar.groupAnalytics")}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                  {homeT("topbar.titleProgress")}
                </h2>
                <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                  {homeT("topbar.descProgress")}
                </p>
              </div>
              <div className={cardBody}>
                <ProgressView
                  sessions={sessions}
                  dayStreak={dayStreak}
                  levelUpCheck={levelUpCheck}
                  xpProfile={xpProfile}
                  speakerProgress={speakerProgress}
                  claimableXp={claimableXp}
                  alreadyClaimedToday={alreadyClaimedToday}
                  xpEventsCount={xpEvents.length}
                  badgesCount={earnedBadgesCount}
                  earnedBadgeLabels={earnedBadgeLabels}
                  appLanguage={appLanguage}
                  onApplyNextLevel={handleApplyLevelUp}
                  onClaimXp={handleClaimXp}
                  onSelectView={handleSelectView}
                  xpEvents={xpEvents}
                />
              </div>
            </section>
          )}

          {/* ===================== Weekly Review ===================== */}
          {view === "weekly-review" && (
            <WeeklyReviewView
              provider={aiProvider}
              weeklyReviewResult={weeklyReviewResult}
              weeklyReviewLoading={weeklyReviewLoading}
              weeklyReviewError={weeklyReviewError}
              appLanguage={appLanguage}
              onRunWeeklyReview={handleRunWeeklyReview}
            />
          )}

          {/* ===================== Article Practice ===================== */}
          {view === "article-practice" && (
            <ArticlePracticeView
              articleUrl={articleUrl}
              articleInputMode={articleInputMode}
              preparedContextMarkdown={preparedContextMarkdown}
              preparedContextMarkdownError={preparedContextMarkdownError}
              articleFocus={articleFocus}
              focusPlaceholder={articleFocusPlaceholder}
              provider={aiProvider}
              level={level}
              mode={mode}
              feedbackLanguage={
                normalizeFeedbackLanguage(ownerProfile?.feedbackLanguage) ===
                "id"
                  ? "Indonesian"
                  : "English"
              }
              targetLanguage="English"
              articlePracticeResult={articlePracticeResult}
              articlePracticeLoading={articlePracticeLoading}
              articlePracticeError={articlePracticeError}
              savedVocabularyWords={savedVocabularyWords}
              appLanguage={appLanguage}
              onArticleUrlChange={setArticleUrl}
              onArticleInputModeChange={setArticleInputMode}
              onPreparedContextMarkdownChange={setPreparedContextMarkdown}
              onPreparedContextMarkdownErrorChange={setPreparedContextMarkdownError}
              onArticleFocusChange={setArticleFocus}
              onGenerateArticlePractice={handleGenerateArticlePractice}
              onPracticeSpeakingTask={handlePracticeArticleSpeakingTask}
              onSaveVocabularyCandidate={handleSaveArticleVocabularyCandidate}
            />
          )}

          {/* ===================== Mental Model ===================== */}
          {view === "mental-model" && (
            <MentalModelView
              level={level}
              mode={mode}
              focus={mentalModelFocus}
              focusPlaceholder={mentalModelDefaultFocus}
              mentalModelResult={mentalModelResult}
              mentalModelLoading={mentalModelLoading}
              mentalModelError={mentalModelError}
              appLanguage={appLanguage}
              onFocusChange={setMentalModelFocus}
              onGenerateMentalModel={handleGenerateMentalModel}
            />
          )}

          {/* ===================== Leaderboard ===================== */}
          {view === "leaderboard" && (
            <LeaderboardView
              appLanguage={appLanguage}
              onGoToSettings={() => setView("settings")}
              isSignedIn={cloudAuthState.isSignedIn}
              getToken={cloudAuthState.getToken}
              ownerProfile={ownerProfile}
              xpProfile={xpProfile}
              speakerProgress={speakerProgress}
            />
          )}

          {/* ===================== Profile ===================== */}
          {view === "profile" && (
            <ProfileView
              isSignedIn={cloudAuthState.isSignedIn}
              appLanguage={appLanguage}
              profile={ownerProfile}
              totalXp={xpProfile.totalXp}
              dayStreak={dayStreak}
              totalSessions={sessions.length}
              vocabularyCount={vocabularyItems.length}
              earnedBadgeCount={badges.filter((b) => b.status === "earned").length}
              earnedBadgeLabels={badges.filter((b) => b.status === "earned").map((b) => b.label)}
              sessions={sessions.map((s) => ({ date: s.date, mode: s.mode }))}
            />
          )}



          {/* ===================== Settings ===================== */}
          {view === "settings" && (
            <ProfileSettingsView
              isSignedIn={cloudAuthState.isSignedIn}
              appLanguage={appLanguage}
              profile={ownerProfile}
              profileLoadError={profileLoadError}
              profileSaveStatus={profileSaveStatus}
              profileSaveError={profileSaveError}
              onSavePreferences={handleSaveProfilePreferences}
              onAppLanguageChange={(language) => {
                if (!cloudAuthState.userId) return;
                setAppLanguageOverride({
                  userId: cloudAuthState.userId,
                  language,
                });
              }}
              defaultAiProvider={aiProvider}
              onDefaultAiProviderChange={handleDefaultAiProviderChange}
              defaultTtsProvider={ttsProvider}
              onDefaultTtsProviderChange={handleDefaultTtsProviderChange}
              defaultElevenLabsModel={elevenLabsModel}
              onDefaultElevenLabsModelChange={handleDefaultElevenLabsModelChange}
            />
          )}

          </div>
          {view !== "commonplace" && (
            <footer
              id="system"
              className="mt-4 text-center text-xs text-[var(--brand-muted)] flex-shrink-0"
            >
              fonetik · AI-Powered academic speaking practice · Local-only practice tool
            </footer>
          )}
        </main>
      </div>
    </div>
      )}
    </>
  );
}

// --- Reusable bits kept in the same file ---

type LocalSnapshotTarget = {
  sessions: ReadonlyArray<SessionRecord>;
  vocabularyItems: ReadonlyArray<VocabItem>;
  xpProfile: XpProfile;
  xpEvents: ReadonlyArray<XpEvent>;
  badges: ReadonlyArray<Badge>;
};

function isEmptyLocalRestoreTarget({
  sessions,
  vocabularyItems,
  xpProfile,
  xpEvents,
  badges,
}: LocalSnapshotTarget): boolean {
  return (
    sessions.length === 0 &&
    vocabularyItems.length === 0 &&
    xpEvents.length === 0 &&
    badges.length === 0 &&
    isEmptyXpProfileForRestore(xpProfile)
  );
}

function isEmptyXpProfileForRestore(profile: XpProfile): boolean {
  return (
    profile.totalXp <= 0 &&
    profile.pendingDailyXp <= 0 &&
    profile.unclaimedPreviousXp <= 0 &&
    !profile.lastClaimedDate
  );
}

type LocalSnapshotSetters = {
  updateSessions: (next: SessionRecord[]) => void;
  setVocabularyItems: (next: VocabItem[]) => void;
  setXpProfile: (next: XpProfile) => void;
  setXpEvents: (next: XpEvent[]) => void;
  setBadges: (next: Badge[]) => void;
};

function applyMergedCloudSnapshotToLocal(
  merged: SyncMergePlan["merged"],
  setters: LocalSnapshotSetters,
): boolean {
  const nextSessions = merged.sessions.slice(
    0,
    MAX_STORED_SESSIONS,
  ) as SessionRecord[];
  const nextVocabulary = [...merged.vocabulary];
  const nextProfile = merged.xpProfile ?? createDefaultXpProfile();
  const nextEvents = [...merged.xpEvents];
  const nextBadges = [...merged.badges];

  setters.updateSessions(nextSessions);
  setters.setVocabularyItems(nextVocabulary);
  storage.saveVocabulary(nextVocabulary);
  setters.setXpProfile(nextProfile);
  const profileSaved = storage.saveXpProfile(nextProfile);
  setters.setXpEvents(nextEvents);
  const eventsSaved = storage.saveXpEvents(nextEvents);
  setters.setBadges(nextBadges);
  const badgesSaved = storage.saveBadges(nextBadges);

  return profileSaved && eventsSaved && badgesSaved;
}

function isLocalSnapshotCompatibleWithMerged(
  local: LocalSnapshotTarget,
  merged: SyncMergePlan["merged"],
): boolean {
  return (
    areLocalSessionsPreserved(local.sessions, merged.sessions) &&
    areLocalVocabularyItemsPreserved(
      local.vocabularyItems,
      merged.vocabulary,
    ) &&
    isLocalXpProfilePreserved(local.xpProfile, merged.xpProfile) &&
    areLocalXpEventsPreserved(local.xpEvents, merged.xpEvents) &&
    areLocalBadgesPreserved(local.badges, merged.badges)
  );
}

function areLocalSessionsPreserved(
  local: ReadonlyArray<SessionRecord>,
  merged: ReadonlyArray<{ id: string; csv: string }>,
): boolean {
  const mergedById = new Map(merged.map((session) => [session.id, session]));
  return local.every((session) => {
    const candidate = mergedById.get(session.id);
    return Boolean(candidate && candidate.csv === session.csv);
  });
}

function areLocalVocabularyItemsPreserved(
  local: ReadonlyArray<VocabItem>,
  merged: ReadonlyArray<VocabItem>,
): boolean {
  const mergedById = new Map(merged.map((item) => [item.id, item]));
  return local.every((item) => {
    const candidate = mergedById.get(item.id);
    if (!candidate) return false;

    const localUpdatedAt = Date.parse(item.updatedAt);
    const mergedUpdatedAt = Date.parse(candidate.updatedAt);
    if (
      !Number.isNaN(localUpdatedAt) &&
      !Number.isNaN(mergedUpdatedAt) &&
      localUpdatedAt > mergedUpdatedAt
    ) {
      return false;
    }

    const mergedSentencesById = new Map(
      candidate.userSentences.map((sentence) => [sentence.id, sentence]),
    );
    return item.userSentences.every((sentence) => {
      const mergedSentence = mergedSentencesById.get(sentence.id);
      if (!mergedSentence) return false;
      if (!sentence.correction) return true;
      if (!mergedSentence.correction) return false;

      const localCheckedAt = Date.parse(sentence.correction.checkedAt);
      const mergedCheckedAt = Date.parse(mergedSentence.correction.checkedAt);
      return (
        Number.isNaN(localCheckedAt) ||
        Number.isNaN(mergedCheckedAt) ||
        localCheckedAt <= mergedCheckedAt
      );
    });
  });
}

function isLocalXpProfilePreserved(
  local: XpProfile,
  merged: XpProfile | null,
): boolean {
  if (isEmptyXpProfileForRestore(local)) return true;
  if (!merged) return false;
  return (
    merged.totalXp === local.totalXp &&
    merged.pendingDailyXp === local.pendingDailyXp &&
    merged.unclaimedPreviousXp === local.unclaimedPreviousXp &&
    merged.activeDate === local.activeDate &&
    merged.lastClaimedDate === local.lastClaimedDate
  );
}

function areLocalXpEventsPreserved(
  local: ReadonlyArray<XpEvent>,
  merged: ReadonlyArray<XpEvent>,
): boolean {
  const mergedKeys = new Set(
    merged.map((event) => `${event.type}|${event.sourceId}`),
  );
  return local.every((event) =>
    mergedKeys.has(`${event.type}|${event.sourceId}`),
  );
}

function areLocalBadgesPreserved(
  local: ReadonlyArray<Badge>,
  merged: ReadonlyArray<Badge>,
): boolean {
  const mergedById = new Map(merged.map((badge) => [badge.id, badge]));
  return local.every((badge) => {
    const candidate = mergedById.get(badge.id);
    if (!candidate) return false;
    return badge.status !== "earned" || candidate.status === "earned";
  });
}

type SessionCloudAuthBridgeProps = {
  authRef: MutableRefObject<SessionCloudAuthState>;
  onAuthStateChange: (auth: SessionCloudAuthState) => void;
};

function SessionCloudAuthBridge({
  authRef,
  onAuthStateChange,
}: SessionCloudAuthBridgeProps) {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const lastStateRef = useRef<{ isLoaded: boolean; isSignedIn: boolean; userId: string | null } | null>(null);

  useEffect(() => {
    let nextAuth: SessionCloudAuthState = {
      isLoaded,
      isSignedIn: isSignedIn === true,
      userId: userId ?? null,
      getToken: () => getToken(),
    };

    if (process.env.NODE_ENV !== "production") {
      const testWindow = window as typeof window & {
        __MOCK_AUTH__?: {
          isSignedIn: boolean;
          userId: string;
          email?: string;
          displayName?: string;
        };
      };
      if (testWindow.__MOCK_AUTH__) {
        nextAuth = {
          isLoaded: true,
          isSignedIn: testWindow.__MOCK_AUTH__.isSignedIn,
          userId: testWindow.__MOCK_AUTH__.userId,
          getToken: async () => "mock-token",
        };
      }
    }

    const last = lastStateRef.current;
    if (
      !last ||
      last.isLoaded !== nextAuth.isLoaded ||
      last.isSignedIn !== nextAuth.isSignedIn ||
      last.userId !== nextAuth.userId
    ) {
      lastStateRef.current = {
        isLoaded: nextAuth.isLoaded,
        isSignedIn: nextAuth.isSignedIn,
        userId: nextAuth.userId,
      };
      authRef.current = nextAuth;
      onAuthStateChange(nextAuth);
    }
  }, [authRef, getToken, isLoaded, isSignedIn, onAuthStateChange, userId]);

  useEffect(() => {
    return () => {
      authRef.current = DISABLED_SESSION_CLOUD_AUTH;
      onAuthStateChange(DISABLED_SESSION_CLOUD_AUTH);
    };
  }, [authRef, onAuthStateChange]);

  return null;
}

type ClerkUserBridgeProps = {
  onUserChange: (user: ClerkUserType, isUserLoaded: boolean) => void;
};

function ClerkUserBridge({ onUserChange }: ClerkUserBridgeProps) {
  const clerkUser = useUser();
  const lastUserRef = useRef<{ id: string | null; loaded: boolean } | null>(null);

  useEffect(() => {
    let currentUser: ClerkUserType = null;
    let isLoaded = false;

    if (process.env.NODE_ENV !== "production") {
      const testWindow = window as typeof window & {
        __MOCK_AUTH__?: {
          isSignedIn: boolean;
          userId: string;
          email?: string;
          displayName?: string;
        };
      };
      if (testWindow.__MOCK_AUTH__) {
        currentUser = {
          id: testWindow.__MOCK_AUTH__.userId,
          primaryEmailAddress: { emailAddress: testWindow.__MOCK_AUTH__.email ?? "test@example.com" },
          fullName: testWindow.__MOCK_AUTH__.displayName ?? "Mock User",
        } as unknown as ClerkUserType;
        isLoaded = true;
      }
    }

    if (!currentUser && !isLoaded) {
      currentUser = clerkUser.user;
      isLoaded = clerkUser.isLoaded;
    }

    const currentId = currentUser?.id ?? null;
    const lastId = lastUserRef.current?.id ?? null;
    const lastLoaded = lastUserRef.current?.loaded ?? false;

    if (currentId !== lastId || isLoaded !== lastLoaded) {
      lastUserRef.current = { id: currentId, loaded: isLoaded };
      onUserChange(currentUser, isLoaded);
    }
  }, [clerkUser.user, clerkUser.isLoaded, onUserChange]);
  return null;
}

type CloudSnapshotStatusBadgeProps = {
  result: CloudSnapshotRuntimeResult | null;
};

function CloudSnapshotStatusBadge({ result }: CloudSnapshotStatusBadgeProps) {
  const label = cloudSnapshotStatusLabel(result);
  const tone =
    result?.status === "failed"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : "border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-ink-soft)]";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] ${tone}`}
      title="Read-only cloud status. Local data remains the source of truth."
    >
      {label}
    </span>
  );
}

function cloudSnapshotStatusLabel(
  result: CloudSnapshotRuntimeResult | null,
): string {
  if (!result) return "Local only";

  switch (result.status) {
    case "loaded":
      if (result.plan.status === "restore-available") {
        return "Cloud restore available";
      }
      if (result.plan.status === "import-available") {
        return "Cloud import available";
      }
      return "Cloud backup active";
    case "failed":
      return "Cloud check failed - local data safe";
    case "skipped-auth-loading":
      return "Local only";
    case "skipped-signed-out":
      return "Local only";
    case "skipped-missing-user":
      return "Local only";
    case "skipped-missing-config":
      return "Local only";
    case "skipped-missing-token":
      return "Local only";
    case "skipped-missing-client":
      return "Local only";
    default:
      return "Local only";
  }
}

type MobileShellBarProps = {
  isOpen: boolean;
  title: string;
  onToggle: () => void;
};

function MobileShellBar({ isOpen, title, onToggle }: MobileShellBarProps) {
  return (
    <div
      className="sticky top-0 z-40 flex min-h-[64px] w-full items-center justify-between gap-3 border-b border-[var(--brand-border)] bg-[var(--brand-bg)]/95 px-4 py-2.5 backdrop-blur lg:hidden"
      data-testid="mobile-shell-bar"
    >
      <button
        type="button"
        aria-controls="mobile-navigation-drawer"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 text-sm font-semibold text-[var(--brand-ink)] shadow-sm transition-colors hover:bg-[var(--brand-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
        data-testid="mobile-nav-toggle"
        onClick={onToggle}
      >
        <span
          className="flex h-4 w-4 flex-col justify-center gap-1"
          aria-hidden="true"
        >
          <span className="block h-0.5 w-4 rounded-full bg-current" />
          <span className="block h-0.5 w-4 rounded-full bg-current" />
          <span className="block h-0.5 w-4 rounded-full bg-current" />
        </span>
        Menu
      </button>
      <div className="min-w-0 text-right">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-teal)]">
          fonetik
        </p>
        <p className="truncate text-sm font-semibold text-[var(--brand-ink)]">
          {title}
        </p>
      </div>
    </div>
  );
}

type MobileNavigationDrawerProps = {
  panelRef: MutableRefObject<HTMLDivElement | null>;
  sidebarProps: SidebarProps;
  onClose: () => void;
};

function MobileNavigationDrawer({
  panelRef,
  sidebarProps,
  onClose,
}: MobileNavigationDrawerProps) {
  return (
    <div className="fixed inset-0 z-50 lg:hidden" data-testid="mobile-nav-root">
      <button
        type="button"
        aria-label="Close navigation menu"
        className="absolute inset-0 h-full w-full cursor-default bg-black/45"
        data-testid="mobile-nav-backdrop"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        id="mobile-navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        tabIndex={-1}
        className="relative h-[100svh] w-[min(21rem,calc(100%-2rem))] overflow-y-auto overscroll-contain border-r border-[var(--brand-border)] bg-[var(--brand-bg)] p-3 shadow-2xl focus:outline-none [scrollbar-width:thin]"
        data-testid="mobile-nav-drawer"
      >
        <div className="mb-3 flex min-h-11 items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-[var(--brand-teal)]">
              fonetik
            </p>
            <p className="truncate text-sm font-semibold text-[var(--brand-ink-soft)]">
              Navigation
            </p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 text-sm font-semibold text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <Sidebar {...sidebarProps} />
      </div>
    </div>
  );
}

// ---------- Topbar copy helpers ----------
// Pure functions used by the topbar; defined at module scope so they don't
// rebuild on every render.
function viewTitle(view: string, translate: Translate): string {
  switch (view) {
    case "active":
      return translate("topbar.titleActive");
    case "vocabulary":
      return translate("topbar.titleVocabulary");
    case "commonplace":
      return translate("topbar.titleCommonplace");
    case "article-practice":
      return translate("topbar.titleArticlePractice");
    case "session-log":
      return translate("topbar.titleSessionLog");
    case "progress":
      return translate("topbar.titleProgress");
    case "weekly-review":
      return translate("topbar.titleWeeklyReview");
    case "diagnostic":
      return "Diagnostic";
    case "mental-model":
      return translate("topbar.titleMentalModel");
    case "profile":
      return translate("topbar.titleProfile");
    case "settings":
      return translate("topbar.titleSettings");
    case "leaderboard":
      return translate("topbar.titleLeaderboard");
    case "learning-path":
      return translate("topbar.titleLearningPath");
    default:
      return "fonetik";
  }
}

function viewSubtitle(view: string, translate: Translate): string {
  switch (view) {
    case "active":
      return translate("sidebar.viewActive");
    case "vocabulary":
      return translate("topbar.titleVocabulary");
    case "commonplace":
      return translate("sidebar.viewCommonplace");
    case "article-practice":
      return translate("topbar.titleArticlePractice");
    case "session-log":
      return translate("topbar.titleSessionLog");
    case "progress":
      return translate("topbar.titleProgress");
    case "weekly-review":
      return translate("topbar.titleWeeklyReview");
    case "diagnostic":
      return "Diagnostic";
    case "mental-model":
      return translate("topbar.titleMentalModel");
    case "profile":
      return translate("sidebar.viewProfile");
    case "settings":
      return translate("sidebar.viewSettings");
    case "leaderboard":
      return translate("sidebar.viewLeaderboard");
    case "learning-path":
      return translate("sidebar.viewLearningPath");
    default:
      return "fonetik";
  }
}

function viewDescription(view: string, translate: Translate): string {
  switch (view) {
    case "vocabulary":
      return translate("topbar.descVocabulary");
    case "commonplace":
      return translate("topbar.descCommonplace");
    case "article-practice":
      return translate("topbar.descArticlePractice");
    case "session-log":
      return translate("topbar.descSessionLog");
    case "progress":
      return translate("topbar.descProgress");
    case "weekly-review":
      return translate("topbar.descWeeklyReview");
    case "mental-model":
      return translate("topbar.descMentalModel");
    case "profile":
      return translate("topbar.descProfile");
    case "settings":
      return translate("topbar.descSettings");
    case "leaderboard":
      return translate("topbar.descLeaderboard");
    case "learning-path":
      return translate("topbar.descLearningPath");
    default:
      return "";
  }
}
