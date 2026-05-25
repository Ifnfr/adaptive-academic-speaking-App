"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

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

// Human-friendly label for each score key.
const SCORE_LABELS: Record<ScoreKey, string> = {
  fluency: "Fluency",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  coherence: "Coherence",
  argument: "Argument",
  academicTone: "Academic Tone",
};

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

// ---------- Local Speaking Prompt generator ----------
// Pure, deterministic, runs on the client only. No AI call.
// Each level/mode contributes a few task variants; we cycle through them.

type SpeakingPrompt = {
  task: string;
  constraints: string[];
  targetStructure: string;
  timeLimit: string;
};

const FOUNDATION_TASKS = [
  "Describe your morning routine without stopping. Focus on speaking continuously.",
  "Talk about a place you visit often. Just keep talking, even if you repeat yourself.",
  "Describe what is on your desk right now. Aim for steady, uninterrupted speech.",
];

const BEGINNER_TASKS = [
  "Share your opinion on whether students should learn a second language.",
  "Give your view on whether public transport is better than driving.",
  "Share your opinion on whether reading on paper is better than reading on a screen.",
];

const INTERMEDIATE_TASKS = [
  "Take a clear position on whether remote work is better than office work, and explain why.",
  "Take a clear position on whether AI tools should be allowed in schools, and explain why.",
  "Take a clear position on whether cities should ban single-use plastics, and explain why.",
];

const ADVANCED_TASKS = [
  "Defend the claim that universities should require basic statistics for all majors.",
  "Defend the claim that working from home long-term harms early-career professionals.",
  "Defend the claim that social media platforms should be liable for misinformation.",
];

const EXPERT_TASKS = [
  "Argue, with academic rigor, that climate adaptation deserves more public funding than mitigation.",
  "Argue, with academic rigor, that standardized testing should be redesigned rather than abolished.",
  "Argue, with academic rigor, that open-source AI models pose greater systemic risk than closed ones.",
];

function pickTaskByLevel(level: Level, variantIndex: number): string {
  const pool =
    level === "Foundation"
      ? FOUNDATION_TASKS
      : level === "Beginner"
        ? BEGINNER_TASKS
        : level === "Intermediate"
          ? INTERMEDIATE_TASKS
          : level === "Advanced"
            ? ADVANCED_TASKS
            : EXPERT_TASKS;
  return pool[variantIndex % pool.length];
}

function targetStructureForLevel(level: Level): string {
  switch (level) {
    case "Foundation":
      return "Speak continuously. No fixed structure required.";
    case "Beginner":
      return "Opinion → Reason → Example → Closing";
    case "Intermediate":
      return "Position → Reason → Example → Conclusion";
    case "Advanced":
      return "Claim → Evidence → Reasoning → Limitation";
    case "Expert":
      return "Claim → Warrant → Evidence → Limitation → Implication";
  }
}

function timeLimitForLevel(level: Level): string {
  switch (level) {
    case "Foundation":
      return "60-90 seconds";
    case "Beginner":
      return "60 seconds";
    case "Intermediate":
      return "60-90 seconds";
    case "Advanced":
      return "90-120 seconds";
    case "Expert":
      return "2-3 minutes";
  }
}

function constraintsFor(
  level: Level,
  mode: Mode,
  sessionType: SessionType,
  todayTarget: string,
): string[] {
  const out: string[] = [];

  // Mode-driven constraints first so they sit at the top of the list.
  if (mode === "Fluency Sprint") {
    out.push("Keep speaking without long pauses. Fluency over correctness.");
  } else if (mode === "Argument Drill") {
    out.push("Take one clear position and defend it.");
  } else if (mode === "Reading-to-Speaking") {
    out.push(
      "Paste a short excerpt into the transcript area first, then explain or critique it.",
    );
  } else if (mode === "Debate") {
    out.push(
      "State your position clearly so it could be challenged by an opponent later.",
    );
  }

  // Level-specific reminders.
  if (level === "Foundation") {
    out.push("Focus on volume of speech and basic coherence.");
    out.push("Grammar and vocabulary are NOT being evaluated this round.");
  } else if (level === "Beginner") {
    out.push("Use one short example to support your reason.");
  } else if (level === "Intermediate") {
    out.push("Use clear transitions between your reason and your example.");
  } else if (level === "Advanced") {
    out.push("Acknowledge at least one limitation of your own argument.");
  } else if (level === "Expert") {
    out.push("Name your warrant explicitly and address one counter-implication.");
  }

  // Session-type pacing nudge.
  if (sessionType === "Micro") {
    out.push("This is a micro session: keep it short and decisive.");
  } else if (sessionType === "Deep") {
    out.push("This is a deep session: organize your points before speaking.");
  }

  // Carry today's target / previous weakness through if present.
  const trimmedTarget = todayTarget.trim();
  if (trimmedTarget.length > 0) {
    out.push(`Today's focus: ${trimmedTarget}`);
  }

  return out;
}

function buildSpeakingPrompt(
  level: Level,
  mode: Mode,
  sessionType: SessionType,
  todayTarget: string,
  variantIndex: number,
): SpeakingPrompt {
  if (mode === "Diagnostic") {
    return {
      task:
        "Diagnostic baseline. Speak (or paste a combined transcript) covering all three sections in one go: " +
        "(A) a 60-second self-introduction including your learning goal, " +
        "(B) an explanation of one academic concept you recently learned, and " +
        "(C) a short opinion with one reason and one example.",
      constraints: [
        "Cover all three sections A, B, and C in one combined transcript.",
        "No sample answers will be given. Use your own current ability.",
        "Be specific. Mention real concepts, real reasons, real examples.",
        ...(todayTarget.trim().length > 0
          ? [`Today's focus: ${todayTarget.trim()}`]
          : []),
      ],
      targetStructure:
        "A: Self-introduction + goal · B: One concept explanation · C: Opinion + reason + example",
      timeLimit: "About 3-4 minutes total across all three sections",
    };
  }

  return {
    task: pickTaskByLevel(level, variantIndex),
    constraints: constraintsFor(level, mode, sessionType, todayTarget),
    targetStructure: targetStructureForLevel(level),
    timeLimit: timeLimitForLevel(level),
  };
}

// ---------- Local Coach Engine ----------
// Pure, rule-based recommendation built from existing localStorage history.
// No AI call. No external requests. No machine learning. The logic is
// intentionally simple and inspectable so it stays trustworthy as the rest
// of the app grows.

type CoachRecommendation = {
  hasHistory: boolean;
  focus: string;
  recommendedMode: Mode;
  recommendedSessionType: SessionType;
  reason: string;
  nextAction: string;
};

function recommendedSessionTypeForLevel(level: Level): SessionType {
  if (level === "Foundation" || level === "Beginner") return "Micro";
  if (level === "Intermediate") return "Standard";
  return "Deep"; // Advanced, Expert
}

// Map a piece of weakness/retry text to a recommended mode using simple
// keyword groups. Order matters: the first matching group wins so the user
// sees one consistent suggestion.
function pickModeFromText(text: string, level: Level): Mode {
  const t = text.toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));

  if (has("fluency", "pause", "hesitat", "continuity", "stopping", "stop", "filler")) {
    return "Fluency Sprint";
  }
  if (
    has("grammar", "sentence", "structure", "subject", "verb", "tense", "clarity")
  ) {
    // Lower levels still benefit more from continuous speech than from
    // structured argument work, so we keep them on Fluency Sprint.
    if (level === "Foundation" || level === "Beginner") return "Fluency Sprint";
    return "Argument Drill";
  }
  if (
    has("argument", "reasoning", "evidence", "claim", "logic", "assumption", "coherence")
  ) {
    return "Argument Drill";
  }
  if (has("academic tone", "vocabulary", "phrase", "word choice", "formal")) {
    return "Argument Drill";
  }
  return "Fluency Sprint"; // Safe default when no keyword matches.
}

function buildCoachRecommendation(
  sessions: SessionRecord[],
  currentLevel: Level,
): CoachRecommendation {
  const latest = sessions[0];

  // No history: beginner-friendly default.
  if (!latest) {
    return {
      hasHistory: false,
      focus: "Build speaking volume",
      recommendedMode: "Fluency Sprint",
      recommendedSessionType: "Micro",
      reason:
        "No previous session data yet. Start by speaking consistently without over-focusing on accuracy.",
      nextAction:
        "Complete one session to unlock personalized recommendations.",
    };
  }

  // Choose the focus text we'll center the recommendation around. Prefer the
  // explicit retryTask the AI gave on the last session, then fall back to
  // the mainWeakness, then a sensible default.
  const retryTask = latest.retryTask?.trim() ?? "";
  const mainWeakness = latest.mainWeakness?.trim() ?? "";
  const focus =
    retryTask.length > 0
      ? retryTask
      : mainWeakness.length > 0
        ? mainWeakness
        : "Build consistent speaking practice.";

  // Pick mode from the strongest signal we have, falling back to whatever
  // the user practiced last time if no keywords match.
  const sourceText = `${retryTask} ${mainWeakness}`.trim();
  let recommendedMode: Mode = pickModeFromText(sourceText, currentLevel);
  if (sourceText.length === 0) {
    recommendedMode = (latest.mode as Mode) ?? "Fluency Sprint";
  }

  const recommendedSessionType = recommendedSessionTypeForLevel(currentLevel);

  const reason =
    `Based on your last session on ${latest.date}, the main weakness was: "${
      mainWeakness || "(not recorded)"
    }". Working on ${recommendedMode.toLowerCase()} should reinforce the retry task directly.`;

  const nextAction =
    "Click Use Recommendation to load this focus into Session setup, then Start Session.";

  return {
    hasHistory: true,
    focus,
    recommendedMode,
    recommendedSessionType,
    reason,
    nextAction,
  };
}

// ---------- Level metadata + day-streak helpers ----------
// Pure helpers used by the sidebar Current Level card and the Day Streak
// card. No new state, no new storage. Keeps logic small and inspectable.

const LEVEL_PHASE: Record<Level, string> = {
  Foundation: "Phase 1 · Build volume",
  Beginner: "Phase 2 · Simple structure",
  Intermediate: "Phase 3 · Clarity & transitions",
  Advanced: "Phase 4 · Argument defense",
  Expert: "Phase 5 · Academic rigor",
};

function nextLevelHint(level: Level): string | null {
  const idx = LEVELS.indexOf(level);
  const next = LEVELS[idx + 1];
  return next ? `Next up: ${next}` : null;
}

// Parse a YYYY-MM-DD date string from a stored session into a local Date at
// midnight. Returns null on malformed input so the streak calculation never
// throws on legacy or hand-edited storage.
function parseISODateLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function dayDiff(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// Compute a "current day streak" from session history. A streak is a run of
// consecutive calendar days, ending today or yesterday, that have at least
// one stored session each. Returns 0 when there is no history or when the
// most recent session is older than yesterday.
function computeDayStreak(sessions: SessionRecord[]): number {
  if (sessions.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Collect unique session dates (newest sessions first per existing order),
  // dedupe via a Set keyed by ISO string.
  const uniqueDates = new Set<string>();
  for (const s of sessions) {
    if (s.date) uniqueDates.add(s.date);
  }

  // Sort dates descending.
  const dates = Array.from(uniqueDates)
    .map(parseISODateLocal)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime());

  if (dates.length === 0) return 0;

  // The most recent session must be today or yesterday for the streak to be
  // "alive". Anything older breaks the streak.
  const gap = dayDiff(today, dates[0]);
  if (gap > 1) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = dayDiff(dates[i - 1], dates[i]);
    if (diff === 1) streak += 1;
    else if (diff === 0) continue; // Same day, ignore (already deduped, but safe).
    else break;
  }
  return streak;
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
  type View =
    | "active"
    | "session-log"
    | "progress"
    | "weekly-review"
    | "diagnostic"
    | "mental-model"
    | "settings";
  const [view, setView] = useState<View>("active");

  const previousSession = sessions[0] ?? null;
  // Lightweight day-streak derived from session.date strings. No new storage.
  const dayStreak = computeDayStreak(sessions);

  // Local Coach Engine: deterministic, rule-based recommendation derived
  // from session history and the currently selected level. No AI call.
  const coachRecommendation = buildCoachRecommendation(sessions, level);

  const handleUseRecommendation = () => {
    setMode(coachRecommendation.recommendedMode);
    setSessionType(coachRecommendation.recommendedSessionType);
    setTarget(coachRecommendation.focus);
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
        <aside className="lg:w-[252px] lg:flex-shrink-0">
          <div className="flex flex-col gap-4 lg:sticky lg:top-6">
            {/* Brand */}
            <div className={card}>
              <div className="flex flex-col items-start gap-3 p-5">
                {/* Horizontal PNG wordmark. Width-based sizing keeps the
                    aspect ratio intact regardless of the file's pixel
                    dimensions. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/fonetik_logo.png"
                  alt="fonetik logo"
                  className="block h-auto w-full max-w-[220px] object-contain"
                />
                <div>
                  <p className="text-sm font-semibold tracking-tight text-[var(--brand-teal-ink)]">
                    Speak Better
                  </p>
                  <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                    AI-Powered academic speaking practice
                  </p>
                </div>
              </div>
            </div>

            {/* Current level */}
            <div className="overflow-hidden rounded-2xl border border-[var(--brand-teal-ink)] bg-[var(--brand-teal-ink)] text-white shadow-sm">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                  Current Level
                </p>
                <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/80">
                  {sessions.length === 0 ? "Day 1" : `${sessions.length} sessions`}
                </span>
              </div>
              <div className="px-5 py-4">
                <p className="text-2xl font-semibold tracking-tight">{level}</p>
                <p className="mt-1 text-xs text-white/70">
                  {LEVEL_PHASE[level]}
                </p>
                {nextLevelHint(level) && (
                  <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/85">
                    {nextLevelHint(level)}
                  </p>
                )}
                <p className="mt-3 text-[11px] text-white/60">
                  Adjust in Session setup.
                </p>
              </div>
            </div>

            {/* Grouped nav */}
            <nav className={card} aria-label="Sections">
              <SidebarGroup label="Practice">
                <SidebarItem
                  active={view === "active"}
                  onClick={() => setView("active")}
                >
                  Active Session
                </SidebarItem>
                <SidebarItem
                  active={view === "session-log"}
                  onClick={() => setView("session-log")}
                >
                  Session Log
                </SidebarItem>
              </SidebarGroup>

              <SidebarGroup label="Analytics">
                <SidebarItem
                  active={view === "progress"}
                  onClick={() => setView("progress")}
                >
                  Progress
                </SidebarItem>
                <SidebarItem
                  active={view === "weekly-review"}
                  onClick={() => setView("weekly-review")}
                >
                  Weekly Review
                </SidebarItem>
                <SidebarItem
                  active={view === "diagnostic" || (view === "active" && mode === "Diagnostic")}
                  onClick={handleSelectDiagnostic}
                >
                  Diagnostic
                </SidebarItem>
              </SidebarGroup>

              <SidebarGroup label="System">
                <SidebarItem
                  active={view === "mental-model"}
                  onClick={() => setView("mental-model")}
                >
                  Mental Model
                </SidebarItem>
                <SidebarItem
                  active={view === "settings"}
                  onClick={() => setView("settings")}
                >
                  Settings
                </SidebarItem>
              </SidebarGroup>
            </nav>

            {/* Day Streak (motivational, sidebar lower area) */}
            <div className={card}>
              <div className="px-5 py-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-gold)]">
                    Day Streak
                  </p>
                  <span className="text-[10px] uppercase tracking-wide text-[var(--brand-muted)]">
                    Local
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="font-mono text-3xl font-semibold tabular-nums text-[var(--brand-ink)]">
                    {dayStreak}
                  </p>
                  <p className="text-xs text-[var(--brand-ink-soft)]">
                    {dayStreak === 1 ? "day" : "days"}
                  </p>
                </div>
                <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">
                  {dayStreak === 0
                    ? "Complete a session today to start a streak."
                    : "Don't break the chain. Keep practicing daily."}
                </p>
                <p className="mt-3 text-[11px] text-[var(--brand-muted)]">
                  {sessions.length}{" "}
                  {sessions.length === 1 ? "session" : "sessions"} stored
                  locally · max 20
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex min-w-0 flex-1 flex-col gap-6">
          {/* Topbar */}
          <header
            className={`${card} sticky top-2 z-10 flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between`}
          >
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--brand-teal)]">
                fonetik · {viewSubtitle(view)}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--brand-ink)]">
                {viewTitle(view)}
              </h1>
              <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                {view === "active" ? subtitle : viewDescription(view)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-1 text-[11px] text-[var(--brand-ink-soft)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-teal)]" />
                {activeSession ? "Session active" : "Idle"}
              </span>
              <span className="inline-flex items-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-1 text-[11px] text-[var(--brand-ink-soft)]">
                {mode}
              </span>
              <span className="inline-flex items-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-1 text-[11px] text-[var(--brand-ink-soft)]">
                {level}
              </span>
            </div>
          </header>

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
          <section className={card}>
            <div className={cardHeader}>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
                Step 1
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                Session setup
              </h2>
              <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                Pick your mode visibly, set the rest, then start.
              </p>
            </div>
            <div className={cardBody}>
              {/* Mode cards (replaces the old dropdown) */}
              <fieldset>
                <legend className={labelClass}>Mode</legend>
                <div
                  role="radiogroup"
                  aria-label="Practice mode"
                  className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
                >
                  {MODES.map((m) => {
                    const selected = mode === m;
                    const isDiagnostic = m === "Diagnostic";
                    return (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setMode(m)}
                        className={
                          "flex flex-col items-start gap-1 rounded-xl border p-3 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] " +
                          (selected
                            ? "border-[var(--brand-teal)] bg-[var(--brand-teal-soft)]/60 text-[var(--brand-teal-ink)]"
                            : "border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-ink)] hover:border-[var(--brand-border-strong)] hover:bg-[var(--brand-surface)]")
                        }
                      >
                        <span className="font-medium">{m}</span>
                        <span className="text-xs text-[var(--brand-ink-soft)]">
                          {isDiagnostic
                            ? "Baseline assessment"
                            : m === "Fluency Sprint"
                              ? "Speak without stopping"
                              : m === "Argument Drill"
                                ? "Defend a position"
                                : m === "Reading-to-Speaking"
                                  ? "Explain an excerpt"
                                  : "Make a debatable claim"}
                        </span>
                        {isDiagnostic && (
                          <span className="mt-1 inline-flex items-center rounded-full border border-[var(--brand-gold)]/50 bg-[var(--brand-gold-soft)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--brand-ink)]">
                            Assessment
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Other controls */}
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <SelectField
                  label="Level"
                  value={level}
                  options={LEVELS}
                  onChange={(v) => setLevel(v as Level)}
                />
                <SelectField
                  label="Feedback Type"
                  value={feedbackType}
                  options={FEEDBACK_TYPES}
                  onChange={(v) => setFeedbackType(v as FeedbackType)}
                />
                <SelectField
                  label="Session Type"
                  value={sessionType}
                  options={SESSION_TYPES}
                  onChange={(v) => setSessionType(v as SessionType)}
                />
                <SelectField
                  label="AI Provider"
                  value={aiProvider}
                  options={AI_PROVIDERS}
                  onChange={(v) => setAiProvider(v as AIProvider)}
                />

                <div className="sm:col-span-2">
                  <label htmlFor="target" className={labelClass}>
                    Today&apos;s Target
                  </label>
                  <textarea
                    id="target"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    rows={3}
                    placeholder="What do you want to improve in this session?"
                    className={`${inputClass} resize-y`}
                  />
                </div>
              </div>

              <div className="mt-6">
                {!previousSession && (
                  <p className="mb-3 text-xs text-[var(--brand-ink-soft)]">
                    No previous weakness yet. Complete one session to activate
                    weakness repetition.
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleStart}
                  className={`${buttonPrimary} w-full sm:w-auto`}
                >
                  {activeSession ? "Restart Session" : "Start Session"}
                </button>
              </div>
            </div>
          </section>

          {/* Coach + Previous Weakness (only before a session is active) */}
          {!activeSession && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Coach Recommendation */}
              <section
                className={`${card} border-l-4 border-l-[var(--brand-teal)]`}
              >
                <div className={cardHeader}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
                        Coach
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                        Coach Recommendation
                      </h2>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-[var(--brand-muted)]">
                      Local · No AI call
                    </span>
                  </div>
                </div>
                <div className={cardBody}>
                  <p className="mb-4 text-sm text-[var(--brand-ink-soft)]">
                    {coachRecommendation.hasHistory
                      ? "Based on your last session, here is a focused starting point. You can apply it or override anything."
                      : "Complete one session to personalize future recommendations. Until then, here is a beginner-friendly starting point."}
                  </p>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    <SummaryCell
                      label="Focus"
                      value={coachRecommendation.focus}
                      multiline
                    />
                    <SummaryCell
                      label="Mode"
                      value={coachRecommendation.recommendedMode}
                    />
                    <SummaryCell
                      label="Session Type"
                      value={coachRecommendation.recommendedSessionType}
                    />
                    <SummaryCell
                      label="Next Action"
                      value={coachRecommendation.nextAction}
                      multiline
                    />
                    <div className="sm:col-span-2">
                      <SummaryCell
                        label="Reason"
                        value={coachRecommendation.reason}
                        multiline
                      />
                    </div>
                  </dl>
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={handleUseRecommendation}
                      className={buttonSecondary}
                    >
                      Use Recommendation
                    </button>
                  </div>
                </div>
              </section>

              {/* Previous Weakness */}
              {previousSession && (
                <section
                  className={`${card} border-l-4 border-l-[var(--brand-gold)]`}
                >
                  <div className={cardHeader}>
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-gold)]">
                      Spaced repetition
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                      Previous weakness
                    </h2>
                    <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                      From your last session on {previousSession.date}. Leave
                      Today&apos;s Target empty to carry it forward
                      automatically.
                    </p>
                  </div>
                  <div className={cardBody}>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3">
                      <SummaryCell
                        label="Main Weakness"
                        value={previousSession.mainWeakness}
                        multiline
                      />
                      <SummaryCell
                        label="Next Target"
                        value={previousSession.retryTask}
                        multiline
                      />
                    </dl>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Speaking Prompt (local, no AI) */}
          {activeSession && speakingPrompt && !capturedAttempt && (
            <section
              className={`${card} border-l-4 border-l-[var(--brand-teal)]`}
            >
              <div className={cardHeader}>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
                  Step 2
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                  Speaking prompt
                </h2>
              </div>
              <div className={cardBody}>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4">
                  <SummaryCell
                    label="Task"
                    value={speakingPrompt.task}
                    multiline
                  />
                  <div className="flex flex-col gap-1">
                    <dt className={labelClass}>Constraints</dt>
                    <dd>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--brand-ink)]">
                        {speakingPrompt.constraints.map((c, i) => (
                          <li key={i} className="break-words">
                            {c}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                  <SummaryCell
                    label="Target Structure"
                    value={speakingPrompt.targetStructure}
                    multiline
                  />
                  <SummaryCell
                    label="Time Limit"
                    value={speakingPrompt.timeLimit}
                  />
                </dl>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[var(--brand-ink-soft)]">
                    Generated locally from your level, mode, session type, and
                    today&apos;s focus. The AI will not answer the prompt for
                    you.
                  </p>
                  <button
                    type="button"
                    onClick={handleRegeneratePrompt}
                    className={buttonSecondary}
                  >
                    Regenerate Local Prompt
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Speaking Attempt */}
          {activeSession && !capturedAttempt && (
            <section className={card}>
              <div className={cardHeader}>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
                  Step 3
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                  Speaking attempt
                </h2>
              </div>
              <div className={cardBody}>
                {/* Timer */}
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div
                    aria-live="polite"
                    className="font-mono text-5xl tabular-nums text-[var(--brand-ink)]"
                  >
                    {formatTime(elapsedSeconds)}
                  </div>
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    <button
                      type="button"
                      onClick={handleStartTimer}
                      disabled={isTimerRunning}
                      className={buttonSecondary}
                    >
                      Start Timer
                    </button>
                    <button
                      type="button"
                      onClick={handleStopTimer}
                      disabled={!isTimerRunning}
                      className={buttonSecondary}
                    >
                      Stop Timer
                    </button>
                    <button
                      type="button"
                      onClick={handleResetTimer}
                      className={buttonSecondary}
                    >
                      Reset Timer
                    </button>
                  </div>
                </div>

                {/* Speech Input */}
                <div className="mt-6 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-[var(--brand-ink)]">
                        Speech input
                      </h3>
                      <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                        Browser speech-to-text. Audio stays on your device.
                      </p>
                    </div>
                    {speechSupported ? (
                      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                        <button
                          type="button"
                          onClick={handleStartSpeechInput}
                          disabled={isListening}
                          className={buttonSecondary}
                        >
                          Start Speech Input
                        </button>
                        <button
                          type="button"
                          onClick={handleStopSpeechInput}
                          disabled={!isListening}
                          className={buttonSecondary}
                        >
                          Stop Speech Input
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {speechSupported ? (
                    <p
                      aria-live="polite"
                      className="mt-3 text-xs text-[var(--brand-ink-soft)]"
                    >
                      {isListening
                        ? "Listening… speak clearly. Recognized text will be appended below."
                        : "Speech input accuracy depends on your browser and microphone. You can edit the transcript before submitting."}
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-[var(--brand-ink-soft)]">
                      Speech input is not supported in this browser. Please type
                      or paste your transcript manually.
                    </p>
                  )}

                  {speechError && (
                    <p
                      role="alert"
                      className="mt-3 rounded-lg border border-[var(--brand-coral)]/40 bg-[var(--brand-coral-soft)] px-3 py-2 text-xs text-[var(--brand-coral)]"
                    >
                      {speechError}
                    </p>
                  )}
                </div>

                {/* Transcript */}
                <div className="mt-6">
                  <label htmlFor="transcript" className={labelClass}>
                    Transcript
                  </label>
                  <textarea
                    id="transcript"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    rows={8}
                    placeholder="Type or paste what you said during the attempt..."
                    className={`${inputClass} resize-y leading-6`}
                  />
                </div>

                {/* Submit */}
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={handleSubmitAttempt}
                    disabled={!canSubmit}
                    className={`${buttonPrimary} w-full sm:w-auto`}
                  >
                    Submit Attempt
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Captured Attempt + Feedback / Diagnostic */}
          {capturedAttempt && (
            <section className={card}>
              <div className={cardHeader}>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
                  Step 4
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                  Attempt captured
                </h2>
              </div>
              <div className={cardBody}>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  <SummaryCell
                    label="Duration"
                    value={formatTime(capturedAttempt.durationSeconds)}
                  />
                  <SummaryCell
                    label="Words"
                    value={String(
                      capturedAttempt.transcript
                        .split(/\s+/)
                        .filter(Boolean).length,
                    )}
                  />
                  <div className="sm:col-span-2">
                    <SummaryCell
                      label="Transcript preview"
                      value={capturedAttempt.transcript}
                      multiline
                    />
                  </div>
                </dl>

                <div className="mt-6">
                  {isDiagnosticMode ? (
                    <button
                      type="button"
                      onClick={handleRunDiagnostic}
                      disabled={diagnosticLoading}
                      className={`${buttonPrimary} w-full sm:w-auto`}
                    >
                      {diagnosticLoading
                        ? "Running diagnostic..."
                        : "Run Diagnostic"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGetFeedback}
                      disabled={feedbackLoading}
                      className={`${buttonPrimary} w-full sm:w-auto`}
                    >
                      {feedbackLoading
                        ? "Generating feedback..."
                        : "Get AI Feedback"}
                    </button>
                  )}
                </div>

                {feedbackError && (
                  <div
                    role="alert"
                    className="mt-4 rounded-lg border border-[var(--brand-coral)]/50 bg-[var(--brand-coral-soft)] px-4 py-3 text-sm text-[var(--brand-coral)]"
                  >
                    <p>{feedbackError}</p>
                    <p className="mt-1 text-xs opacity-80">
                      You can try again, wait a moment, or switch provider
                      before starting a new session.
                    </p>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={handleGetFeedback}
                        disabled={feedbackLoading}
                        className="rounded-lg border border-[var(--brand-coral)]/60 bg-white px-3 py-1.5 text-xs font-medium text-[var(--brand-coral)] transition-colors hover:bg-[var(--brand-coral-soft)]/60 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {feedbackLoading ? "Trying again..." : "Try Again"}
                      </button>
                    </div>
                  </div>
                )}

                {feedback && (
                  <div className="mt-6 rounded-xl border-l-4 border-[var(--brand-teal)] border-y border-r border-y-[var(--brand-border)] border-r-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5">
                    <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
                      Quick feedback
                    </h3>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4">
                      <SummaryCell
                        label="Main Weakness"
                        value={feedback.mainWeakness}
                        multiline
                      />
                      <SummaryCell
                        label="Evidence"
                        value={feedback.evidence}
                        multiline
                      />
                      <SummaryCell
                        label="Better Phrase"
                        value={feedback.betterPhrase}
                        multiline
                      />
                      <SummaryCell
                        label="Retry Task"
                        value={feedback.retryTask}
                        multiline
                      />
                      <SummaryCell
                        label="Provider Used"
                        value={feedback.providerUsed}
                      />
                    </dl>

                    {activeSession && (
                      <div className="mt-5 border-t border-[var(--brand-border)] pt-4">
                        <p className={labelClass}>Scores</p>
                        <ul className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                          {scoreKeysForLevel(activeSession.level).map((key) => (
                            <li
                              key={key}
                              className="flex items-baseline justify-between text-sm"
                            >
                              <span className="text-[var(--brand-ink-soft)]">
                                {SCORE_LABELS[key]}
                              </span>
                              <span className="font-mono tabular-nums text-[var(--brand-ink)]">
                                {safeScore(feedback.scores?.[key])}/5
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {isDiagnosticMode && diagnosticError && (
                  <div
                    role="alert"
                    className="mt-4 rounded-lg border border-[var(--brand-coral)]/50 bg-[var(--brand-coral-soft)] px-4 py-3 text-sm text-[var(--brand-coral)]"
                  >
                    <p>{diagnosticError}</p>
                    <p className="mt-1 text-xs opacity-80">
                      You can try again, wait a moment, or switch provider.
                    </p>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={handleRunDiagnostic}
                        disabled={diagnosticLoading}
                        className="rounded-lg border border-[var(--brand-coral)]/60 bg-white px-3 py-1.5 text-xs font-medium text-[var(--brand-coral)] transition-colors hover:bg-[var(--brand-coral-soft)]/60 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {diagnosticLoading ? "Trying again..." : "Try Again"}
                      </button>
                    </div>
                  </div>
                )}

                {isDiagnosticMode && diagnosticResult && (
                  <div className="mt-6 rounded-xl border-l-4 border-[var(--brand-teal)] border-y border-r border-y-[var(--brand-border)] border-r-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5">
                    <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
                      Diagnostic result
                    </h3>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                      <SummaryCell
                        label="Recommended Level"
                        value={diagnosticResult.recommendedLevel}
                      />
                      <SummaryCell
                        label="Main Bottleneck"
                        value={diagnosticResult.mainBottleneck}
                        multiline
                      />
                      <div className="sm:col-span-2">
                        <SummaryCell
                          label="Summary"
                          value={diagnosticResult.summary}
                          multiline
                        />
                      </div>
                    </dl>
                    <div className="mt-5 border-t border-[var(--brand-border)] pt-4">
                      <p className={labelClass}>Scores</p>
                      <ul className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                        {(
                          [
                            "fluency",
                            "grammar",
                            "vocabulary",
                            "coherence",
                            "argument",
                            "academicTone",
                          ] as const
                        ).map((key) => (
                          <li
                            key={key}
                            className="flex items-baseline justify-between text-sm"
                          >
                            <span className="text-[var(--brand-ink-soft)]">
                              {SCORE_LABELS[key]}
                            </span>
                            <span className="font-mono tabular-nums text-[var(--brand-ink)]">
                              {diagnosticResult.scores[key]}/5
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-5 border-t border-[var(--brand-border)] pt-4">
                      <p className={labelClass}>7-Day Focus Plan</p>
                      <ol className="list-none space-y-1 text-sm text-[var(--brand-ink)]">
                        {diagnosticResult.sevenDayFocusPlan.map((item, i) => (
                          <li key={i} className="break-words">
                            {item}
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={handleApplyRecommendedLevel}
                        className={buttonSecondary}
                      >
                        Apply Recommended Level
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
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
            <section className={card}>
              <div className={`${cardHeader} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
                    History
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                    Session Log
                  </h2>
                  <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                    {sessions.length === 0
                      ? "No sessions stored yet. Complete one from Active Session to populate this log."
                      : `Showing the ${Math.min(sessions.length, 5)} most recent of ${sessions.length} stored.`}
                  </p>
                </div>
                {sessions.length > 0 && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleCopyLastCsv}
                      className={buttonSecondary}
                    >
                      Copy Last CSV
                    </button>
                    {lastCsvCopied && (
                      <span
                        role="status"
                        className="text-xs font-medium text-[var(--brand-teal-ink)]"
                      >
                        Copied
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className={cardBody}>
                {sessions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-8 text-center">
                    <p className="text-sm text-[var(--brand-ink-soft)]">
                      Your completed sessions will appear here.
                    </p>
                    <button
                      type="button"
                      onClick={() => setView("active")}
                      className={`${buttonSecondary} mt-4`}
                    >
                      Go to Active Session
                    </button>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {sessions.slice(0, 5).map((s) => (
                      <li
                        key={s.id}
                        className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4"
                      >
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-[var(--brand-ink-soft)]">
                          <span className="font-mono text-[var(--brand-ink)]">
                            {s.date}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{s.level}</span>
                          <span aria-hidden="true">·</span>
                          <span>{s.mode}</span>
                        </div>
                        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                          <SummaryCell
                            label="Main Weakness"
                            value={s.mainWeakness}
                            multiline
                          />
                          <SummaryCell
                            label="Next Target"
                            value={s.retryTask}
                            multiline
                          />
                        </dl>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
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
                {sessions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-8 text-center">
                    <p className="text-sm text-[var(--brand-ink-soft)]">
                      Complete at least one session to see progress.
                    </p>
                  </div>
                ) : (
                  <ProgressView sessions={sessions} dayStreak={dayStreak} />
                )}
              </div>
            </section>
          )}

          {/* ===================== Weekly Review (placeholder) ===================== */}
          {view === "weekly-review" && (
            <section className={`${card} opacity-90`}>
              <div className={cardHeader}>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-gold)]">
                  Coming soon
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                  Weekly Review
                </h2>
                <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                  A weekly digest is planned for a future batch. Until then, use
                  Session Log and Progress.
                </p>
              </div>
              <div className={cardBody}>
                <div className="rounded-xl border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-8 text-center text-sm text-[var(--brand-ink-soft)]">
                  Not implemented yet.
                </div>
              </div>
            </section>
          )}

          {/* ===================== Mental Model (placeholder) ===================== */}
          {view === "mental-model" && (
            <section className={`${card} opacity-90`}>
              <div className={cardHeader}>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-gold)]">
                  Coming soon
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                  Mental Model
                </h2>
                <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
                  Notes about your speaking habits will live here in a future
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

type SelectFieldProps = {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
};

function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

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

// ---------- Sidebar helpers ----------

type SidebarGroupProps = {
  label: string;
  children: ReactNode;
};

function SidebarGroup({ label, children }: SidebarGroupProps) {
  return (
    <div className="px-2 py-2">
      <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-muted)]">
        {label}
      </p>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

type SidebarItemProps = {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
};

function SidebarItem({ active = false, onClick, children }: SidebarItemProps) {
  const base =
    "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]";
  const activeClass =
    "bg-[var(--brand-teal-soft)] text-[var(--brand-teal-ink)] font-medium";
  const idleClass =
    "text-[var(--brand-ink-soft)] hover:bg-[var(--brand-surface-2)] hover:text-[var(--brand-ink)]";
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={`${base} ${active ? activeClass : idleClass}`}
      >
        {children}
      </button>
    </li>
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

// ---------- Progress view ----------
// Pure rendering helper. Reads only what is already in `sessions` state and
// draws simple CSS bars for mode counts. No charting libraries.
type ProgressViewProps = {
  sessions: SessionRecord[];
  dayStreak: number;
};

function ProgressView({ sessions, dayStreak }: ProgressViewProps) {
  const total = sessions.length;
  const modeCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.mode] = (acc[s.mode] ?? 0) + 1;
    return acc;
  }, {});
  const levelCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.level] = (acc[s.level] ?? 0) + 1;
    return acc;
  }, {});
  const maxModeCount = Math.max(1, ...Object.values(modeCounts));
  const maxLevelCount = Math.max(1, ...Object.values(levelCounts));

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
          Sessions completed
        </p>
        <p className="font-mono text-3xl font-semibold tabular-nums text-[var(--brand-ink)]">
          {total}
        </p>
        <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
          Stored locally · max 20
        </p>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-gold)]">
          Day Streak
        </p>
        <p className="font-mono text-3xl font-semibold tabular-nums text-[var(--brand-ink)]">
          {dayStreak}
        </p>
        <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">
          {dayStreak === 0
            ? "Practice today to start"
            : "Consecutive practice days"}
        </p>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
          Latest session
        </p>
        <p className="text-sm text-[var(--brand-ink)]">
          {sessions[0]
            ? `${sessions[0].date} · ${sessions[0].mode}`
            : "No data"}
        </p>
      </div>

      <div className="sm:col-span-3">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
          Sessions by mode
        </p>
        <ul className="space-y-2">
          {Object.entries(modeCounts).map(([mode, count]) => (
            <li key={mode} className="flex items-center gap-3 text-sm">
              <span className="w-36 shrink-0 text-[var(--brand-ink)]">
                {mode}
              </span>
              <span
                aria-hidden="true"
                className="h-2 rounded-full bg-[var(--brand-teal)]/70"
                style={{ width: `${(count / maxModeCount) * 60}%` }}
              />
              <span className="ml-auto font-mono text-xs tabular-nums text-[var(--brand-ink-soft)]">
                {count}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="sm:col-span-3">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--brand-muted)]">
          Sessions by level
        </p>
        <ul className="space-y-2">
          {Object.entries(levelCounts).map(([level, count]) => (
            <li key={level} className="flex items-center gap-3 text-sm">
              <span className="w-36 shrink-0 text-[var(--brand-ink)]">
                {level}
              </span>
              <span
                aria-hidden="true"
                className="h-2 rounded-full bg-[var(--brand-gold)]/70"
                style={{ width: `${(count / maxLevelCount) * 60}%` }}
              />
              <span className="ml-auto font-mono text-xs tabular-nums text-[var(--brand-ink-soft)]">
                {count}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
