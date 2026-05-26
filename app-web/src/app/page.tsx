"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { buildLevelUpCheck } from "./lib/level-up";
import { LEVEL_PHASE, nextLevelHint } from "./lib/levels";
import { buildCoachRecommendation } from "./lib/coach";
import { computeDayStreak } from "./lib/streak";
import {
  buildSpeakingPrompt,
  type SpeakingPrompt,
} from "./lib/speaking-prompt";
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
import { Sidebar, type SidebarView } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { SessionSetup } from "./components/SessionSetup";
import { CoachPanels } from "./components/CoachPanels";
import { SpeakingPromptCard } from "./components/SpeakingPromptCard";
import { SpeakingAttemptCard } from "./components/SpeakingAttemptCard";
import { AttemptResultPanels } from "./components/AttemptResultPanels";

// ----- Minimal Web Speech API types -----
// The Web Speech API isn't in lib.dom.d.ts in all TS versions, so we define
// just enough surface to use it safely without `any`.
type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResult = {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
  length: number;
};
type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResult;
};
type SpeechRecognitionEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};
type SpeechRecognitionErrorEvent = { error: string; message?: string };

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

// Both Chromium-based browsers and Safari expose webkitSpeechRecognition;
// some Edge builds also expose the unprefixed name.
function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Option lists kept as plain string arrays so they are easy to edit later.
const LEVELS = ["Foundation", "Beginner", "Intermediate", "Advanced", "Expert"] as const;
const MODES = ["Fluency Sprint", "Argument Drill", "Reading-to-Speaking", "Debate", "Diagnostic"] as const;
const FEEDBACK_TYPES = ["Quick", "Deep"] as const;
const SESSION_TYPES = ["Micro", "Standard", "Deep"] as const;
const AI_PROVIDERS = ["Claude", "DeepSeek", "Gemini"] as const;

type Level = (typeof LEVELS)[number];
type Mode = (typeof MODES)[number];
type FeedbackType = (typeof FEEDBACK_TYPES)[number];
type SessionType = (typeof SESSION_TYPES)[number];
type AIProvider = (typeof AI_PROVIDERS)[number];

// Snapshot of the form values at the moment Start Session is pressed.
// Keeping it as a single object makes the Active Session panel easy to render.
type SessionSetup = {
  level: Level;
  mode: Mode;
  feedbackType: FeedbackType;
  sessionType: SessionType;
  aiProvider: AIProvider;
  target: string;
  // True only when the target was auto-filled from the previous session's
  // retry task because the user left Today's Target blank.
  autoFilledFromPrevious: boolean;
};

type CapturedAttempt = {
  transcript: string;
  durationSeconds: number;
};

type FeedbackResult = {
  mainWeakness: string;
  evidence: string;
  betterPhrase: string;
  retryTask: string;
  providerUsed: string;
  scores: FeedbackScores;
};

type DiagnosticScoresShape = {
  fluency: number;
  grammar: number;
  vocabulary: number;
  coherence: number;
  argument: number;
  academicTone: number;
};

type DiagnosticResult = {
  recommendedLevel: Level;
  mainBottleneck: string;
  summary: string;
  scores: DiagnosticScoresShape;
  sevenDayFocusPlan: string[];
};

type WeeklyReviewSessionSummary = {
  date: string;
  level: Level;
  mode: Mode;
  durationSeconds: number;
  mainWeakness: string;
  evidence: string;
  retryTask: string;
  csv: string;
};

// Score dimensions per level. Order in arrays matches CSV column order.
const FOUNDATION_SCORE_KEYS = ["fluency", "coherence"] as const;
const BEGINNER_SCORE_KEYS = ["fluency", "grammar", "coherence"] as const;
const ADVANCED_SCORE_KEYS = [
  "fluency",
  "grammar",
  "vocabulary",
  "coherence",
  "argument",
  "academicTone",
] as const;

type ScoreKey =
  | (typeof FOUNDATION_SCORE_KEYS)[number]
  | (typeof BEGINNER_SCORE_KEYS)[number]
  | (typeof ADVANCED_SCORE_KEYS)[number];

// Scores arrive as a partial map keyed by dimension name. The frontend uses
// a permissive shape so it can accept any of the three level shapes; the
// API has already normalized values to integers in [1, 5].
type FeedbackScores = Partial<Record<ScoreKey, number>>;

function scoreKeysForLevel(level: Level): readonly ScoreKey[] {
  if (level === "Foundation") return FOUNDATION_SCORE_KEYS;
  if (level === "Beginner") return BEGINNER_SCORE_KEYS;
  return ADVANCED_SCORE_KEYS;
}

// Clamp to 1-5 integer with a 3 fallback. Mirrors the server-side logic so
// stored history stays consistent if a record predates a backend change.
function safeScore(value: unknown): number {
  const FALLBACK = 3;
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n)) return FALLBACK;
  const r = Math.round(n);
  if (r < 1) return 1;
  if (r > 5) return 5;
  return r;
}

type CapturedRetry = {
  transcript: string;
};

type SessionSummary = {
  csv: string;
};

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

const SESSIONS_STORAGE_KEY = "adaptive-speaking-app:sessions";
const MAX_STORED_SESSIONS = 20;

// Type guard: defensive against shape drift or hand-edited storage.
function isSessionRecord(value: unknown): value is SessionRecord {
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

function loadSessions(): SessionRecord[] {
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

function saveSessions(sessions: SessionRecord[]): void {
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

// ---------- External stores for useSyncExternalStore ----------
// These keep page.tsx lint-clean: instead of calling setState inside
// useEffect to load values from window APIs, we expose subscribe + getter
// functions and let React subscribe through useSyncExternalStore.

const subscribeNoop = () => () => {};

function getSpeechSupportedClient(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

function getSpeechSupportedServer(): boolean {
  // SSR has no Web Speech API. Treat as unsupported on the server so the
  // initial markup matches what we'd render before hydration would change.
  return false;
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

function generateSessionId(): string {
  // crypto.randomUUID is available in modern browsers; fall back to a
  // timestamp-plus-random combo for environments without it.
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// CSV cell escaping per RFC 4180: wrap in quotes and double any inner quotes
// when the value contains a comma, quote, or newline.
function csvEscape(value: string): string {
  const needsQuoting = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

function csvRow(cells: string[]): string {
  return cells.map(csvEscape).join(",");
}

function todayISODate(): string {
  // Local date in YYYY-MM-DD so the CSV reflects the user's day.
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCsv(
  level: Level,
  mode: Mode,
  feedback: FeedbackResult,
): string {
  const date = todayISODate();
  const scores = feedback.scores ?? {};
  const fluency = String(safeScore(scores.fluency));
  const grammar = String(safeScore(scores.grammar));
  const vocabulary = String(safeScore(scores.vocabulary));
  const coherence = String(safeScore(scores.coherence));
  const argument = String(safeScore(scores.argument));
  const academicTone = String(safeScore(scores.academicTone));

  if (level === "Foundation") {
    const header = [
      "Date",
      "Level",
      "Mode",
      "Fluency",
      "Coherence",
      "Main_Weakness",
      "Evidence",
      "Next_Target",
    ];
    const row = [
      date,
      level,
      mode,
      fluency,
      coherence,
      feedback.mainWeakness,
      feedback.evidence,
      feedback.retryTask,
    ];
    return `${csvRow(header)}\n${csvRow(row)}`;
  }

  if (level === "Beginner") {
    const header = [
      "Date",
      "Level",
      "Mode",
      "Fluency",
      "Grammar",
      "Coherence",
      "Main_Weakness",
      "Evidence",
      "Next_Target",
    ];
    const row = [
      date,
      level,
      mode,
      fluency,
      grammar,
      coherence,
      feedback.mainWeakness,
      feedback.evidence,
      feedback.retryTask,
    ];
    return `${csvRow(header)}\n${csvRow(row)}`;
  }

  // Intermediate, Advanced, Expert
  const header = [
    "Date",
    "Level",
    "Mode",
    "Fluency",
    "Grammar",
    "Vocabulary",
    "Coherence",
    "Argument",
    "AcademicTone",
    "Main_Weakness",
    "Evidence",
    "Next_Target",
  ];
  const row = [
    date,
    level,
    mode,
    fluency,
    grammar,
    vocabulary,
    coherence,
    argument,
    academicTone,
    feedback.mainWeakness,
    feedback.evidence,
    feedback.retryTask,
  ];
  return `${csvRow(header)}\n${csvRow(row)}`;
}

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${mm}:${ss}`;
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
const labelClass =
  "mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]";
const inputClass =
  "w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-2 text-sm text-[var(--brand-ink)] placeholder:text-[var(--brand-muted)] focus:border-[var(--brand-teal)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-teal)]";
const buttonPrimary =
  "rounded-lg bg-[var(--brand-teal)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-teal-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] focus:ring-offset-2 focus:ring-offset-[var(--brand-bg)] disabled:cursor-not-allowed disabled:bg-[var(--brand-border-strong)] disabled:text-[var(--brand-muted)]";
const buttonSecondary =
  "rounded-lg border border-[var(--brand-border-strong)] bg-[var(--brand-surface)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] disabled:cursor-not-allowed disabled:opacity-50";

export default function Home() {
  // --- Session setup form state ---
  const [level, setLevel] = useState<Level>("Intermediate");
  const [mode, setMode] = useState<Mode>("Fluency Sprint");
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("Quick");
  const [sessionType, setSessionType] = useState<SessionType>("Standard");
  const [aiProvider, setAiProvider] = useState<AIProvider>("Claude");
  const [target, setTarget] = useState("");

  // --- Active session state ---
  const [activeSession, setActiveSession] = useState<SessionSetup | null>(null);

  // --- Speaking prompt (local, no AI) ---
  const [speakingPrompt, setSpeakingPrompt] = useState<SpeakingPrompt | null>(
    null,
  );
  const [promptVariantIndex, setPromptVariantIndex] = useState(0);

  // --- Speaking attempt state ---
  const [transcript, setTranscript] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Speech-to-text (browser only) ---
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Detect browser support via useSyncExternalStore. The value is read on the
  // client at hydration time and is stable for the lifetime of the page, so
  // the subscribe function is a no-op. This is SSR-safe and lint-clean
  // (no setState inside useEffect).
  const speechSupported = useSyncExternalStore(
    subscribeNoop,
    getSpeechSupportedClient,
    getSpeechSupportedServer,
  );

  // Make sure any active recognition is torn down on unmount.
  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.onstart = null;
          rec.onend = null;
          rec.onerror = null;
          rec.onresult = null;
          rec.abort();
        } catch {
          // Ignore: instance was already cleaned up.
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  // --- Captured attempt (after Submit) ---
  const [capturedAttempt, setCapturedAttempt] = useState<CapturedAttempt | null>(
    null,
  );

  // --- AI feedback state ---
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // --- Diagnostic mode state ---
  const [diagnosticResult, setDiagnosticResult] =
    useState<DiagnosticResult | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

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

  // --- Retry loop state ---
  const [retryTranscript, setRetryTranscript] = useState("");
  const [capturedRetry, setCapturedRetry] = useState<CapturedRetry | null>(null);

  // --- End session / CSV state ---
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(
    null,
  );
  const [csvCopied, setCsvCopied] = useState(false);

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

  // --- Sidebar navigation view ---
  // Lightweight local view state. No router, no real new routes. The Active
  // Session view shows the full practice flow; other views are anchor-style
  // sub-pages that reuse existing data.
  type View = SidebarView;
  const [view, setView] = useState<View>("active");

  const previousSession = sessions[0] ?? null;
  // Lightweight day-streak derived from session.date strings. No new storage.
  const dayStreak = computeDayStreak(sessions);

  // Local Coach Engine: deterministic, rule-based recommendation derived
  // from session history and the currently selected level. No AI call.
  const coachRecommendation = buildCoachRecommendation(sessions, level);
  const levelUpCheck = buildLevelUpCheck(sessions, level);
  const mentalModelDefaultFocus =
    target.trim() ||
    previousSession?.retryTask?.trim() ||
    previousSession?.mainWeakness?.trim() ||
    "Build a clearer academic speaking response";
  const effectiveMentalModelFocus =
    mentalModelFocus.trim() || mentalModelDefaultFocus;

  const handleUseRecommendation = () => {
    setMode(coachRecommendation.recommendedMode);
    setSessionType(coachRecommendation.recommendedSessionType);
    setTarget(coachRecommendation.focus);
  };

  const handleApplyLevelUp = () => {
    if (levelUpCheck.status !== "Ready" || !levelUpCheck.nextLevel) return;
    setLevel(levelUpCheck.nextLevel);
    setTarget(
      `Start ${levelUpCheck.nextLevel} practice with clear structure and steady evidence.`,
    );
    setView("active");
  };

  // Timer effect: only one interval at a time, cleaned up on unmount or when paused.
  useEffect(() => {
    if (!isTimerRunning) return;

    intervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isTimerRunning]);

  const handleStart = () => {
    const userTypedTarget = target.trim();
    const fallbackTarget = previousSession?.retryTask?.trim() ?? "";
    const shouldAutoFill =
      userTypedTarget.length === 0 && fallbackTarget.length > 0;
    const finalTarget = shouldAutoFill ? fallbackTarget : target;

    setActiveSession({
      level,
      mode,
      feedbackType,
      sessionType,
      aiProvider,
      target: finalTarget,
      autoFilledFromPrevious: shouldAutoFill,
    });
    // Generate the local speaking prompt for this session. No AI call.
    setPromptVariantIndex(0);
    setSpeakingPrompt(
      buildSpeakingPrompt(level, mode, sessionType, finalTarget, 0),
    );
    // Reset attempt-related state so a fresh session starts clean.
    setTranscript("");
    setElapsedSeconds(0);
    setIsTimerRunning(false);
    setCapturedAttempt(null);
    setFeedback(null);
    setFeedbackError(null);
    setFeedbackLoading(false);
    setRetryTranscript("");
    setCapturedRetry(null);
    setSessionSummary(null);
    setCsvCopied(false);
    // Speech-to-text: stop any active session before starting a new one.
    stopRecognitionInstance();
    setSpeechError(null);
    // Diagnostic mode: reset the standalone diagnostic result/error.
    setDiagnosticResult(null);
    setDiagnosticError(null);
    setDiagnosticLoading(false);
    // Note: sessions history is intentionally NOT cleared on restart.
  };

  const handleStartTimer = () => setIsTimerRunning(true);
  const handleStopTimer = () => setIsTimerRunning(false);
  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setElapsedSeconds(0);
  };

  const handleRegeneratePrompt = () => {
    if (!activeSession) return;
    // Cycle through the next variant. The pool has 3 entries per level so
    // pressing Regenerate repeatedly walks through them then loops back.
    const nextIndex = promptVariantIndex + 1;
    setPromptVariantIndex(nextIndex);
    setSpeakingPrompt(
      buildSpeakingPrompt(
        activeSession.level,
        activeSession.mode,
        activeSession.sessionType,
        activeSession.target,
        nextIndex,
      ),
    );
    // Note: transcript and timer are intentionally NOT touched here.
  };

  // --- Speech input handlers ---
  const stopRecognitionInstance = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      // Ignore: nothing was running.
    }
  };

  const handleStartSpeechInput = () => {
    if (isListening) return;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      return;
    }

    setSpeechError(null);

    // Tear down any previous instance first to avoid duplicates.
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore.
      }
      recognitionRef.current = null;
    }

    const recognition = new Ctor();
    recognition.lang =
      typeof navigator !== "undefined" && navigator.language
        ? navigator.language
        : "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      const code = event.error || "unknown";
      const message =
        code === "not-allowed" || code === "service-not-allowed"
          ? "Microphone access was denied. Allow it in the browser address bar to use speech input."
          : code === "no-speech"
            ? "No speech detected. Try speaking again."
            : code === "audio-capture"
              ? "No microphone detected. Check your input device."
              : `Speech input error: ${code}`;
      setSpeechError(message);
    };
    recognition.onresult = (event) => {
      // Append only final segments. Interim results are noisy and the spec
      // already disables them.
      let appended = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          appended += result[0].transcript;
        }
      }
      const cleaned = appended.trim();
      if (cleaned.length === 0) return;
      setTranscript((prev) => {
        if (prev.length === 0) return cleaned;
        // Preserve a trailing newline if the user already added one,
        // otherwise join with a single space.
        const sep = /\s$/.test(prev) ? "" : " ";
        return `${prev}${sep}${cleaned}`;
      });
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      setIsListening(false);
      recognitionRef.current = null;
      const message =
        err instanceof Error ? err.message : "Could not start speech input.";
      setSpeechError(message);
    }
  };

  const handleStopSpeechInput = () => {
    stopRecognitionInstance();
  };

  const trimmedTranscript = transcript.trim();
  const canSubmit = trimmedTranscript.length > 0 && capturedAttempt === null;

  const handleSubmitAttempt = () => {
    if (!canSubmit) return;
    setIsTimerRunning(false);
    stopRecognitionInstance();
    setCapturedAttempt({
      transcript: trimmedTranscript,
      durationSeconds: elapsedSeconds,
    });
    setFeedback(null);
    setFeedbackError(null);
  };

  const handleGetFeedback = async () => {
    if (!activeSession || !capturedAttempt) return;
    setFeedbackLoading(true);
    setFeedbackError(null);
    setFeedback(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          level: activeSession.level,
          mode: activeSession.mode,
          feedbackType: activeSession.feedbackType,
          sessionType: activeSession.sessionType,
          provider: activeSession.aiProvider,
          todayTarget: activeSession.target,
          transcript: capturedAttempt.transcript,
          durationSeconds: capturedAttempt.durationSeconds,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | (FeedbackResult & { error?: string })
        | { error?: string }
        | null;

      if (!res.ok || !data || ("error" in data && data.error)) {
        const rawMessage =
          (data && "error" in data && data.error) ||
          `Request failed with status ${res.status}.`;
        setFeedbackError(sanitizeErrorMessage(rawMessage));
        return;
      }

      const result = data as FeedbackResult;
      if (
        !result.mainWeakness ||
        !result.evidence ||
        !result.betterPhrase ||
        !result.retryTask ||
        !result.providerUsed
      ) {
        setFeedbackError("Feedback response was incomplete. Try again.");
        return;
      }

      // Defensive normalization: even though the server clamps, we guard
      // against an older route or a hand-tested response shape.
      const rawScores =
        result.scores && typeof result.scores === "object" ? result.scores : {};
      const safeScores: FeedbackScores = {};
      for (const key of scoreKeysForLevel(activeSession.level)) {
        safeScores[key] = safeScore(
          (rawScores as Record<string, unknown>)[key],
        );
      }
      setFeedback({ ...result, scores: safeScores });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Network error while contacting the API.";
      setFeedbackError(sanitizeErrorMessage(message));
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleRunDiagnostic = async () => {
    if (!activeSession || !capturedAttempt) return;
    setDiagnosticLoading(true);
    setDiagnosticError(null);
    setDiagnosticResult(null);

    try {
      const res = await fetch("/api/diagnostic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: activeSession.aiProvider,
          transcript: capturedAttempt.transcript,
          durationSeconds: capturedAttempt.durationSeconds,
          currentLevel: activeSession.level,
          todayTarget: activeSession.target,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | (DiagnosticResult & { error?: string })
        | { error?: string }
        | null;

      if (!res.ok || !data || ("error" in data && data.error)) {
        const rawMessage =
          (data && "error" in data && data.error) ||
          `Request failed with status ${res.status}.`;
        setDiagnosticError(sanitizeErrorMessage(rawMessage));
        return;
      }

      const result = data as DiagnosticResult;
      if (
        !result.recommendedLevel ||
        !result.mainBottleneck ||
        !result.summary ||
        !Array.isArray(result.sevenDayFocusPlan)
      ) {
        setDiagnosticError("Diagnostic response was incomplete. Try again.");
        return;
      }
      setDiagnosticResult(result);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Network error while contacting the API.";
      setDiagnosticError(sanitizeErrorMessage(message));
    } finally {
      setDiagnosticLoading(false);
    }
  };

  const handleRunWeeklyReview = async () => {
    if (sessions.length < 4) return;
    setWeeklyReviewLoading(true);
    setWeeklyReviewError(null);
    setWeeklyReviewResult(null);

    const sessionSummaries: WeeklyReviewSessionSummary[] = sessions
      .slice(0, 7)
      .map((session) => ({
        date: session.date,
        level: session.level,
        mode: session.mode,
        durationSeconds: session.durationSeconds,
        mainWeakness: session.mainWeakness,
        evidence: session.evidence,
        retryTask: session.retryTask,
        csv: session.csv,
      }));

    try {
      const res = await fetch("/api/weekly-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: aiProvider,
          sessions: sessionSummaries,
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

  const handleApplyRecommendedLevel = () => {
    if (!diagnosticResult) return;
    setLevel(diagnosticResult.recommendedLevel);
    setTarget(diagnosticResult.mainBottleneck);
  };

  // Selecting "Diagnostic" from the sidebar pre-selects the diagnostic mode
  // and routes the user back to the active practice view so they can run it.
  const handleSelectDiagnostic = () => {
    setMode("Diagnostic");
    setView("active");
  };

  const trimmedRetryTranscript = retryTranscript.trim();
  const canSubmitRetry =
    trimmedRetryTranscript.length > 0 && capturedRetry === null;

  const handleSubmitRetry = () => {
    if (!canSubmitRetry) return;
    setCapturedRetry({ transcript: trimmedRetryTranscript });
  };

  const handleEndSession = () => {
    if (!activeSession || !feedback || !capturedAttempt || !capturedRetry) {
      return;
    }
    const csv = buildCsv(activeSession.level, activeSession.mode, feedback);
    setSessionSummary({ csv });
    setCsvCopied(false);

    // Persist the completed session at the front of the history.
    const record: SessionRecord = {
      id: generateSessionId(),
      date: todayISODate(),
      level: activeSession.level,
      mode: activeSession.mode,
      feedbackType: activeSession.feedbackType,
      sessionType: activeSession.sessionType,
      provider: activeSession.aiProvider,
      todayTarget: activeSession.target,
      durationSeconds: capturedAttempt.durationSeconds,
      transcript: capturedAttempt.transcript,
      mainWeakness: feedback.mainWeakness,
      evidence: feedback.evidence,
      betterPhrase: feedback.betterPhrase,
      retryTask: feedback.retryTask,
      retryTranscript: capturedRetry.transcript,
      csv,
    };
    // Persist + notify subscribers via the external store helper.
    const next = [record, ...sessions].slice(0, MAX_STORED_SESSIONS);
    updateSessions(next);
  };

  const handleCopyCsv = async () => {
    if (!sessionSummary) return;
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        await navigator.clipboard.writeText(sessionSummary.csv);
        setCsvCopied(true);
        // Reset the "Copied" hint after a short moment.
        setTimeout(() => setCsvCopied(false), 1500);
      }
    } catch {
      // Stay silent; the CSV is still visible in the code block for manual copy.
      setCsvCopied(false);
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

  const isDiagnosticMode = activeSession?.mode === "Diagnostic";
  const subtitle = activeSession
    ? isDiagnosticMode
      ? "Complete the diagnostic transcript, then run baseline assessment."
      : "Session in progress. Work the prompt, then submit your transcript for AI feedback."
    : "Configure a session, choose a mode, and start practicing.";

  return (
    <div className="min-h-screen w-full">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:gap-8 lg:px-8 lg:py-10">
        {/* Sidebar */}
        <Sidebar
          view={view}
          level={level}
          mode={mode}
          sessionsCount={sessions.length}
          dayStreak={dayStreak}
          levelPhase={LEVEL_PHASE[level]}
          nextLevel={nextLevelHint(level)}
          onSelectView={setView}
          onSelectDiagnostic={handleSelectDiagnostic}
        />
        {/* Main */}
        <main className="flex min-w-0 flex-1 flex-col gap-6">
          {/* Topbar */}
          <Topbar
            subtitle={viewSubtitle(view)}
            title={viewTitle(view)}
            description={view === "active" ? subtitle : viewDescription(view)}
            hasActiveSession={Boolean(activeSession)}
            mode={mode}
            level={level}
          />

          {/* ===================== Active Session view ===================== */}
          {view === "active" && (
            <>

          {/* Active Session Hero (only when active) */}
          {activeSession && (
            <section className={`${card} overflow-hidden border-l-4 border-l-[var(--brand-teal)]`}>
              <div className={cardHeader}>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
                  Active session
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                  {activeSession.mode} · {activeSession.level}
                </h2>
              </div>
              <div className={`${cardBody} grid grid-cols-2 gap-4 sm:grid-cols-4`}>
                <SummaryCell label="Level" value={activeSession.level} />
                <SummaryCell label="Mode" value={activeSession.mode} />
                <SummaryCell
                  label="Session Type"
                  value={activeSession.sessionType}
                />
                <SummaryCell
                  label="Duration"
                  value={formatTime(elapsedSeconds)}
                  mono
                />
              </div>
              <div className="px-6 pb-6">
                <SummaryCell
                  label="Today's Target"
                  value={
                    activeSession.target.trim().length > 0
                      ? activeSession.target
                      : "—"
                  }
                  multiline
                />
                {activeSession.autoFilledFromPrevious && (
                  <p className="mt-3 rounded-lg border border-[var(--brand-gold)]/40 bg-[var(--brand-gold-soft)] px-3 py-2 text-xs text-[var(--brand-ink)]">
                    Today we target:{" "}
                    <span className="font-medium">{activeSession.target}</span>
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Session Setup (hidden visually demoted while active but kept for restart) */}
          <SessionSetup
            level={level}
            mode={mode}
            feedbackType={feedbackType}
            sessionType={sessionType}
            aiProvider={aiProvider}
            target={target}
            hasActiveSession={Boolean(activeSession)}
            hasPreviousSession={Boolean(previousSession)}
            levels={LEVELS}
            modes={MODES}
            feedbackTypes={FEEDBACK_TYPES}
            sessionTypes={SESSION_TYPES}
            aiProviders={AI_PROVIDERS}
            onLevelChange={(value) => setLevel(value as Level)}
            onModeChange={(value) => setMode(value as Mode)}
            onFeedbackTypeChange={(value) => setFeedbackType(value as FeedbackType)}
            onSessionTypeChange={(value) => setSessionType(value as SessionType)}
            onAiProviderChange={(value) => setAiProvider(value as AIProvider)}
            onTargetChange={setTarget}
            onStartSession={handleStart}
          />
          {/* Coach + Previous Weakness (only before a session is active) */}
          {!activeSession && (
            <CoachPanels
              coachRecommendation={coachRecommendation}
              previousSession={previousSession}
              onUseRecommendation={handleUseRecommendation}
            />
          )}

          {/* Speaking Prompt (local, no AI) */}
          {activeSession && speakingPrompt && !capturedAttempt && (
            <SpeakingPromptCard
              speakingPrompt={speakingPrompt}
              onRegeneratePrompt={handleRegeneratePrompt}
            />
          )}

          {/* Speaking Attempt */}
          {activeSession && !capturedAttempt && (
            <SpeakingAttemptCard
              transcript={transcript}
              displayTime={formatTime(elapsedSeconds)}
              isTimerRunning={isTimerRunning}
              speechSupported={speechSupported}
              isListening={isListening}
              speechError={speechError}
              canSubmit={canSubmit}
              onTranscriptChange={setTranscript}
              onStartTimer={handleStartTimer}
              onStopTimer={handleStopTimer}
              onResetTimer={handleResetTimer}
              onStartSpeechInput={handleStartSpeechInput}
              onStopSpeechInput={handleStopSpeechInput}
              onSubmitAttempt={handleSubmitAttempt}
            />
          )}

          {/* Captured Attempt + Feedback / Diagnostic */}
          {capturedAttempt && (
            <AttemptResultPanels
              capturedAttempt={capturedAttempt}
              activeLevel={activeSession?.level ?? null}
              isDiagnosticMode={isDiagnosticMode}
              feedback={feedback}
              feedbackLoading={feedbackLoading}
              feedbackError={feedbackError}
              diagnosticResult={diagnosticResult}
              diagnosticLoading={diagnosticLoading}
              diagnosticError={diagnosticError}
              onGetFeedback={handleGetFeedback}
              onRunDiagnostic={handleRunDiagnostic}
              onApplyRecommendedLevel={handleApplyRecommendedLevel}
            />
          )}
          {/* Retry Attempt */}
          {feedback && !capturedRetry && !isDiagnosticMode && (
            <section className={card}>
              <div className={cardHeader}>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
                  Step 5
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                  Retry attempt
                </h2>
              </div>
              <div className={cardBody}>
                <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3">
                  <p className={labelClass}>Retry task</p>
                  <p className="whitespace-pre-wrap break-words text-sm text-[var(--brand-ink)]">
                    {feedback.retryTask}
                  </p>
                </div>

                <div className="mt-5">
                  <label htmlFor="retry-transcript" className={labelClass}>
                    Retry transcript
                  </label>
                  <textarea
                    id="retry-transcript"
                    value={retryTranscript}
                    onChange={(e) => setRetryTranscript(e.target.value)}
                    rows={8}
                    placeholder="Type or paste your retry attempt here..."
                    className={`${inputClass} resize-y leading-6`}
                  />
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={handleSubmitRetry}
                    disabled={!canSubmitRetry}
                    className={`${buttonPrimary} w-full sm:w-auto`}
                  >
                    Submit Retry
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Retry Captured */}
          {capturedRetry && !isDiagnosticMode && (
            <section className={card}>
              <div className={cardHeader}>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
                  Step 6
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                  Retry captured
                </h2>
              </div>
              <div className={cardBody}>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4">
                  <SummaryCell
                    label="Retry transcript preview"
                    value={capturedRetry.transcript}
                    multiline
                  />
                </dl>
                <p className="mt-5 rounded-lg border border-[var(--brand-gold)]/40 bg-[var(--brand-gold-soft)] px-4 py-3 text-sm text-[var(--brand-ink)]">
                  Retry saved. You can now end the session.
                </p>
                {!sessionSummary && (
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={handleEndSession}
                      className={`${buttonPrimary} w-full sm:w-auto`}
                    >
                      End Session
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Session Summary */}
          {sessionSummary && !isDiagnosticMode && (
            <section className={card}>
              <div className={cardHeader}>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
                  Step 7
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                  Session summary
                </h2>
                <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                  CSV row generated. Score columns use AI-generated 1-5 values
                  (with safe fallback to 3 when missing).
                </p>
              </div>
              <div className={cardBody}>
                <pre className="overflow-x-auto rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 font-mono text-xs leading-6 text-[var(--brand-ink)]">
                  {sessionSummary.csv}
                </pre>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopyCsv}
                    className={buttonSecondary}
                  >
                    Copy CSV
                  </button>
                  {csvCopied && (
                    <span
                      role="status"
                      className="text-xs font-medium text-[var(--brand-teal-ink)]"
                    >
                      Copied to clipboard
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}

            </>
          )}

          {/* ===================== Session Log view ===================== */}
          {view === "session-log" && (
            <SessionLogView
              sessions={sessions}
              lastCsvCopied={lastCsvCopied}
              onCopyLastCsv={handleCopyLastCsv}
              onGoToActiveSession={() => setView("active")}
            />
          )}
          {/* ===================== Progress view ===================== */}
          {view === "progress" && (
            <section className={card}>
              <div className={cardHeader}>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
                  Analytics
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                  Progress
                </h2>
                <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                  Simple counts based on the sessions stored in your browser.
                </p>
              </div>
              <div className={cardBody}>
                <ProgressView
                  sessions={sessions}
                  dayStreak={dayStreak}
                  levelUpCheck={levelUpCheck}
                  onApplyNextLevel={handleApplyLevelUp}
                />
              </div>
            </section>
          )}

          {/* ===================== Weekly Review ===================== */}
          {view === "weekly-review" && (
            <WeeklyReviewView
              sessionsCount={sessions.length}
              provider={aiProvider}
              weeklyReviewResult={weeklyReviewResult}
              weeklyReviewLoading={weeklyReviewLoading}
              weeklyReviewError={weeklyReviewError}
              onRunWeeklyReview={handleRunWeeklyReview}
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
              onFocusChange={setMentalModelFocus}
              onGenerateMentalModel={handleGenerateMentalModel}
            />
          )}

          {/* ===================== Settings (placeholder) ===================== */}
          {view === "settings" && (
            <section className={`${card} opacity-90`}>
              <div className={cardHeader}>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-gold)]">
                  Coming soon
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                  Settings
                </h2>
                <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                  Provider keys are configured in{" "}
                  <code className="rounded bg-[var(--brand-surface-2)] px-1 py-0.5 font-mono text-xs">
                    .env.local
                  </code>
                  . A UI for non-secret preferences is planned for a future
                  batch.
                </p>
              </div>
              <div className={cardBody}>
                <div className="rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-8 text-center text-sm text-[var(--brand-ink-soft)]">
                  Not implemented yet.
                </div>
              </div>
            </section>
          )}

          <footer
            id="system"
            className="mt-2 text-center text-xs text-[var(--brand-muted)]"
          >
            fonetik · AI-Powered academic speaking practice · Local-only practice tool
          </footer>
        </main>
      </div>
    </div>
  );
}

// --- Reusable bits kept in the same file ---

type SummaryCellProps = {
  label: string;
  value: string;
  multiline?: boolean;
  mono?: boolean;
};

function SummaryCell({
  label,
  value,
  multiline = false,
  mono = false,
}: SummaryCellProps) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]">
        {label}
      </dt>
      <dd
        className={
          (multiline
            ? "whitespace-pre-wrap break-words text-sm text-[var(--brand-ink)]"
            : "text-sm text-[var(--brand-ink)]") +
          (mono ? " font-mono tabular-nums" : "")
        }
      >
        {value}
      </dd>
    </div>
  );
}

// ---------- Topbar copy helpers ----------
// Pure functions used by the topbar; defined at module scope so they don't
// rebuild on every render.
function viewTitle(view: string): string {
  switch (view) {
    case "active":
      return "Active Practice";
    case "session-log":
      return "Session Log";
    case "progress":
      return "Progress";
    case "weekly-review":
      return "Weekly Review";
    case "diagnostic":
      return "Diagnostic";
    case "mental-model":
      return "Mental Model";
    case "settings":
      return "Settings";
    default:
      return "fonetik";
  }
}

function viewSubtitle(view: string): string {
  switch (view) {
    case "active":
      return "Active Session";
    case "session-log":
      return "Session Log";
    case "progress":
      return "Progress";
    case "weekly-review":
      return "Weekly Review";
    case "diagnostic":
      return "Diagnostic";
    case "mental-model":
      return "Mental Model";
    case "settings":
      return "Settings";
    default:
      return "fonetik";
  }
}

function viewDescription(view: string): string {
  switch (view) {
    case "session-log":
      return "Review your most recent practice sessions.";
    case "progress":
      return "Lightweight overview based on stored session history.";
    case "weekly-review":
      return "Reserved for a future batch.";
    case "mental-model":
      return "Reserved for a future batch.";
    case "settings":
      return "Reserved for a future batch.";
    default:
      return "";
  }
}
