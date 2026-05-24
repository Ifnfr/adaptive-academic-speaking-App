"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

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

  const previousSession = sessions[0] ?? null;

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
      setSpeechError(
        "Speech input is not supported in this browser. Please type or paste your transcript manually.",
      );
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

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12 sm:py-16">
        {/* Header */}
        <header className="flex flex-col gap-2 text-center sm:text-left">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Adaptive Academic Speaking App
          </h1>
          <p className="text-sm text-neutral-400 sm:text-base">
            AI-powered deliberate speaking practice.
          </p>
        </header>

        {/* Setup panel */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm sm:p-8">
          <StepHeader step={1} title="Session setup" />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <SelectField
              label="Level"
              value={level}
              options={LEVELS}
              onChange={(v) => setLevel(v as Level)}
            />
            <SelectField
              label="Mode"
              value={mode}
              options={MODES}
              onChange={(v) => setMode(v as Mode)}
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
            <div className="sm:col-span-2">
              <SelectField
                label="AI Provider"
                value={aiProvider}
                options={AI_PROVIDERS}
                onChange={(v) => setAiProvider(v as AIProvider)}
              />
            </div>

            {/* Today's Target */}
            <div className="sm:col-span-2">
              <label
                htmlFor="target"
                className="mb-2 block text-sm font-medium text-neutral-300"
              >
                Today&apos;s Target
              </label>
              <textarea
                id="target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                rows={4}
                placeholder="What do you want to improve in this session?"
                className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
              />
            </div>
          </div>

          {/* Start button */}
          <div className="mt-8">
            {!previousSession && (
              <p className="mb-4 text-xs text-neutral-500">
                No previous weakness yet. Complete one session to activate
                weakness repetition.
              </p>
            )}
            <button
              type="button"
              onClick={handleStart}
              className="w-full rounded-lg bg-neutral-100 px-4 py-3 text-base font-medium text-neutral-900 transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 focus:ring-offset-neutral-950"
            >
              {activeSession ? "Restart Session" : "Start Session"}
            </button>
          </div>
        </section>

        {/* Previous Weakness (Spaced Repetition reminder) */}
        {previousSession && (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm sm:p-8">
            <h2 className="mb-4 text-lg font-medium text-neutral-200">
              Previous weakness
            </h2>
            <p className="mb-4 text-xs text-neutral-500">
              From your last session on {previousSession.date}. Leave Today&apos;s
              Target empty to carry this forward automatically.
            </p>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <SummaryRow
                label="Main Weakness"
                value={previousSession.mainWeakness}
                multiline
              />
              <SummaryRow
                label="Next Target"
                value={previousSession.retryTask}
                multiline
              />
            </dl>
          </section>
        )}

        {/* Coach Recommendation (local, no AI) */}
        {!activeSession && (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm sm:p-8">
            <div className="mb-4 flex items-baseline gap-3">
              <h2 className="text-lg font-medium text-neutral-200">
                Coach recommendation
              </h2>
              <span className="text-xs uppercase tracking-wide text-neutral-500">
                Local · No AI call
              </span>
            </div>

            {coachRecommendation.hasHistory ? (
              <p className="mb-4 text-sm text-neutral-300">
                Based on your last session, here is a focused starting point.
                You can apply it or override anything in Session setup.
              </p>
            ) : (
              <p className="mb-4 text-sm text-neutral-300">
                Complete one session to personalize future recommendations.
                Until then, here is a beginner-friendly starting point.
              </p>
            )}

            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <SummaryRow
                label="Recommended focus"
                value={coachRecommendation.focus}
                multiline
              />
              <SummaryRow
                label="Recommended Mode"
                value={coachRecommendation.recommendedMode}
              />
              <SummaryRow
                label="Recommended Session Type"
                value={coachRecommendation.recommendedSessionType}
              />
              <SummaryRow
                label="Next Action"
                value={coachRecommendation.nextAction}
                multiline
              />
              <div className="sm:col-span-2">
                <SummaryRow
                  label="Why this matters"
                  value={coachRecommendation.reason}
                  multiline
                />
              </div>
            </dl>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleUseRecommendation}
                className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 transition-colors hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-500"
              >
                Use Recommendation
              </button>
            </div>
          </section>
        )}

        {/* Active Session Summary */}
        {activeSession && (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm sm:p-8">
            <StepHeader step={2} title="Active session" />
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <SummaryRow label="Level" value={activeSession.level} />
              <SummaryRow label="Mode" value={activeSession.mode} />
              <SummaryRow
                label="Feedback Type"
                value={activeSession.feedbackType}
              />
              <SummaryRow
                label="Session Type"
                value={activeSession.sessionType}
              />
              <SummaryRow
                label="AI Provider"
                value={activeSession.aiProvider}
              />
              <div className="sm:col-span-2">
                <SummaryRow
                  label="Today's Target"
                  value={
                    activeSession.target.trim().length > 0
                      ? activeSession.target
                      : "—"
                  }
                  multiline
                />
              </div>
            </dl>
            {activeSession.autoFilledFromPrevious && (
              <p className="mt-4 rounded-lg border border-dashed border-neutral-700 bg-neutral-950/60 px-4 py-3 text-sm text-neutral-300">
                Today we target:{" "}
                <span className="font-medium text-neutral-100">
                  {activeSession.target}
                </span>
              </p>
            )}
          </section>
        )}

        {/* Speaking Prompt (local, no AI) */}
        {activeSession && speakingPrompt && !capturedAttempt && (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm sm:p-8">
            <StepHeader step={3} title="Speaking prompt" />

            <dl className="grid grid-cols-1 gap-x-8 gap-y-4">
              <SummaryRow label="Task" value={speakingPrompt.task} multiline />

              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Constraints
                </dt>
                <dd>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-100">
                    {speakingPrompt.constraints.map((c, i) => (
                      <li key={i} className="break-words">
                        {c}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>

              <SummaryRow
                label="Target Structure"
                value={speakingPrompt.targetStructure}
                multiline
              />
              <SummaryRow
                label="Time Limit"
                value={speakingPrompt.timeLimit}
              />
            </dl>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-neutral-500">
                Generated locally from your level, mode, session type, and
                today&apos;s focus. The AI will not answer the prompt for you.
              </p>
              <button
                type="button"
                onClick={handleRegeneratePrompt}
                className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 transition-colors hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-500"
              >
                Regenerate Local Prompt
              </button>
            </div>
          </section>
        )}

        {/* Speaking Attempt */}
        {activeSession && !capturedAttempt && (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm sm:p-8">
            <StepHeader step={4} title="Speaking attempt" />

            {/* Timer */}
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div
                aria-live="polite"
                className="font-mono text-5xl tabular-nums text-neutral-100"
              >
                {formatTime(elapsedSeconds)}
              </div>
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={handleStartTimer}
                  disabled={isTimerRunning}
                  className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                >
                  Start Timer
                </button>
                <button
                  type="button"
                  onClick={handleStopTimer}
                  disabled={!isTimerRunning}
                  className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                >
                  Stop Timer
                </button>
                <button
                  type="button"
                  onClick={handleResetTimer}
                  className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 transition-colors hover:bg-neutral-700 sm:flex-none"
                >
                  Reset Timer
                </button>
              </div>
            </div>

            {/* Speech Input */}
            <div className="mt-8 rounded-xl border border-neutral-800 bg-neutral-950/40 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-medium text-neutral-200">
                    Speech input
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    Browser speech-to-text. Audio stays on your device.
                  </p>
                </div>
                {speechSupported ? (
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    <button
                      type="button"
                      onClick={handleStartSpeechInput}
                      disabled={isListening}
                      className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                    >
                      Start Speech Input
                    </button>
                    <button
                      type="button"
                      onClick={handleStopSpeechInput}
                      disabled={!isListening}
                      className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                    >
                      Stop Speech Input
                    </button>
                  </div>
                ) : null}
              </div>

              {speechSupported ? (
                <p
                  aria-live="polite"
                  className="mt-3 text-xs text-neutral-400"
                >
                  {isListening
                    ? "Listening… speak clearly. Recognized text will be appended below."
                    : "Speech input accuracy depends on your browser and microphone. You can edit the transcript before submitting."}
                </p>
              ) : (
                <p className="mt-3 text-xs text-neutral-400">
                  Speech input is not supported in this browser. Please type or
                  paste your transcript manually.
                </p>
              )}

              {speechError && (
                <p
                  role="alert"
                  className="mt-3 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-200"
                >
                  {speechError}
                </p>
              )}
            </div>

            {/* Transcript */}
            <div className="mt-6">
              <label
                htmlFor="transcript"
                className="mb-2 block text-sm font-medium text-neutral-300"
              >
                Transcript
              </label>
              <textarea
                id="transcript"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={8}
                placeholder="Type or paste what you said during the attempt..."
                className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm leading-6 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
              />
            </div>

            {/* Submit */}
            <div className="mt-6">
              <button
                type="button"
                onClick={handleSubmitAttempt}
                disabled={!canSubmit}
                className="w-full rounded-lg bg-neutral-100 px-4 py-3 text-base font-medium text-neutral-900 transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 focus:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
              >
                Submit Attempt
              </button>
            </div>
          </section>
        )}

        {/* Captured Attempt */}
        {capturedAttempt && (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm sm:p-8">
            <StepHeader step={5} title="Attempt captured" />
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <SummaryRow
                label="Duration"
                value={formatTime(capturedAttempt.durationSeconds)}
              />
              <SummaryRow
                label="Words"
                value={String(
                  capturedAttempt.transcript.split(/\s+/).filter(Boolean).length,
                )}
              />
              <div className="sm:col-span-2">
                <SummaryRow
                  label="Transcript preview"
                  value={capturedAttempt.transcript}
                  multiline
                />
              </div>
            </dl>
            <div className="mt-6">
              {activeSession?.mode === "Diagnostic" ? (
                <button
                  type="button"
                  onClick={handleRunDiagnostic}
                  disabled={diagnosticLoading}
                  className="w-full rounded-lg bg-neutral-100 px-4 py-3 text-base font-medium text-neutral-900 transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 focus:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
                >
                  {diagnosticLoading ? "Running diagnostic..." : "Run Diagnostic"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGetFeedback}
                  disabled={feedbackLoading}
                  className="w-full rounded-lg bg-neutral-100 px-4 py-3 text-base font-medium text-neutral-900 transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 focus:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
                >
                  {feedbackLoading ? "Generating feedback..." : "Get AI Feedback"}
                </button>
              )}
            </div>

            {feedbackError && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
              >
                <p>{feedbackError}</p>
                <p className="mt-1 text-xs text-red-200/80">
                  You can try again, wait a moment, or switch provider before
                  starting a new session.
                </p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleGetFeedback}
                    disabled={feedbackLoading}
                    className="rounded-lg border border-red-800/70 bg-red-950/60 px-3 py-1.5 text-xs font-medium text-red-100 transition-colors hover:bg-red-900/60 focus:outline-none focus:ring-2 focus:ring-red-500/60 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {feedbackLoading ? "Trying again..." : "Try Again"}
                  </button>
                </div>
              </div>
            )}

            {feedback && (
              <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950/60 p-5">
                <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-neutral-400">
                  Quick feedback
                </h3>
                <dl className="grid grid-cols-1 gap-x-8 gap-y-4">
                  <SummaryRow
                    label="Main Weakness"
                    value={feedback.mainWeakness}
                    multiline
                  />
                  <SummaryRow
                    label="Evidence"
                    value={feedback.evidence}
                    multiline
                  />
                  <SummaryRow
                    label="Better Phrase"
                    value={feedback.betterPhrase}
                    multiline
                  />
                  <SummaryRow
                    label="Retry Task"
                    value={feedback.retryTask}
                    multiline
                  />
                  <SummaryRow
                    label="Provider Used"
                    value={feedback.providerUsed}
                  />
                </dl>

                {activeSession && (
                  <div className="mt-5 border-t border-neutral-800 pt-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Scores
                    </p>
                    <ul className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
                      {scoreKeysForLevel(activeSession.level).map((key) => (
                        <li
                          key={key}
                          className="flex items-baseline justify-between text-sm"
                        >
                          <span className="text-neutral-400">
                            {SCORE_LABELS[key]}
                          </span>
                          <span className="font-mono tabular-nums text-neutral-100">
                            {safeScore(feedback.scores?.[key])}/5
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Diagnostic error and result (only shown in Diagnostic mode) */}
            {activeSession?.mode === "Diagnostic" && diagnosticError && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
              >
                <p>{diagnosticError}</p>
                <p className="mt-1 text-xs text-red-200/80">
                  You can try again, wait a moment, or switch provider.
                </p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleRunDiagnostic}
                    disabled={diagnosticLoading}
                    className="rounded-lg border border-red-800/70 bg-red-950/60 px-3 py-1.5 text-xs font-medium text-red-100 transition-colors hover:bg-red-900/60 focus:outline-none focus:ring-2 focus:ring-red-500/60 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {diagnosticLoading ? "Trying again..." : "Try Again"}
                  </button>
                </div>
              </div>
            )}

            {activeSession?.mode === "Diagnostic" && diagnosticResult && (
              <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950/60 p-5">
                <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-neutral-400">
                  Diagnostic result
                </h3>
                <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                  <SummaryRow
                    label="Recommended Level"
                    value={diagnosticResult.recommendedLevel}
                  />
                  <SummaryRow
                    label="Main Bottleneck"
                    value={diagnosticResult.mainBottleneck}
                    multiline
                  />
                  <div className="sm:col-span-2">
                    <SummaryRow
                      label="Summary"
                      value={diagnosticResult.summary}
                      multiline
                    />
                  </div>
                </dl>

                <div className="mt-5 border-t border-neutral-800 pt-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Scores
                  </p>
                  <ul className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
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
                        <span className="text-neutral-400">
                          {SCORE_LABELS[key]}
                        </span>
                        <span className="font-mono tabular-nums text-neutral-100">
                          {diagnosticResult.scores[key]}/5
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 border-t border-neutral-800 pt-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    7-Day Focus Plan
                  </p>
                  <ol className="list-none space-y-1 text-sm text-neutral-100">
                    {diagnosticResult.sevenDayFocusPlan.map((item, i) => (
                      <li key={i} className="break-words">
                        {item}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleApplyRecommendedLevel}
                    className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 transition-colors hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-500"
                  >
                    Apply Recommended Level
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Retry Attempt */}
        {feedback && !capturedRetry && (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm sm:p-8">
            <StepHeader step={6} title="Retry attempt" />

            <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Retry task
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-100">
                {feedback.retryTask}
              </p>
            </div>

            <div className="mt-6">
              <label
                htmlFor="retry-transcript"
                className="mb-2 block text-sm font-medium text-neutral-300"
              >
                Retry transcript
              </label>
              <textarea
                id="retry-transcript"
                value={retryTranscript}
                onChange={(e) => setRetryTranscript(e.target.value)}
                rows={8}
                placeholder="Type or paste your retry attempt here..."
                className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm leading-6 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
              />
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleSubmitRetry}
                disabled={!canSubmitRetry}
                className="w-full rounded-lg bg-neutral-100 px-4 py-3 text-base font-medium text-neutral-900 transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 focus:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
              >
                Submit Retry
              </button>
            </div>
          </section>
        )}

        {/* Retry Captured */}
        {capturedRetry && (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm sm:p-8">
            <StepHeader step={7} title="Retry captured" />

            <dl className="grid grid-cols-1 gap-x-8 gap-y-4">
              <SummaryRow
                label="Retry transcript preview"
                value={capturedRetry.transcript}
                multiline
              />
            </dl>

            <p className="mt-6 rounded-lg border border-dashed border-neutral-700 bg-neutral-950/60 px-4 py-3 text-sm text-neutral-400">
              Retry saved. You can now end the session.
            </p>

            {!sessionSummary && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleEndSession}
                  className="w-full rounded-lg bg-neutral-100 px-4 py-3 text-base font-medium text-neutral-900 transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 focus:ring-offset-neutral-950"
                >
                  End Session
                </button>
              </div>
            )}
          </section>
        )}

        {/* Session Summary */}
        {sessionSummary && (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm sm:p-8">
            <StepHeader step={8} title="Session summary" />
            <p className="mb-6 text-sm text-neutral-400">
              CSV row generated. Score columns are placeholders for the MVP.
            </p>

            <pre className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950 p-4 font-mono text-xs leading-6 text-neutral-100">
              {sessionSummary.csv}
            </pre>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleCopyCsv}
                className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 transition-colors hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-500"
              >
                Copy CSV
              </button>
              {csvCopied && (
                <span
                  role="status"
                  className="text-xs font-medium text-emerald-300"
                >
                  Copied to clipboard
                </span>
              )}
            </div>
          </section>
        )}

        {/* Recent Sessions (history) */}
        {sessions.length > 0 && (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950 font-mono text-xs text-neutral-300">
                  9
                </span>
                <div>
                  <h2 className="text-lg font-medium text-neutral-200">
                    Recent sessions
                  </h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    Showing the {Math.min(sessions.length, 5)} most recent of{" "}
                    {sessions.length} stored.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyLastCsv}
                  className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 transition-colors hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-500"
                >
                  Copy Last CSV
                </button>
                {lastCsvCopied && (
                  <span
                    role="status"
                    className="text-xs font-medium text-emerald-300"
                  >
                    Copied
                  </span>
                )}
              </div>
            </div>

            <ul className="flex flex-col gap-3">
              {sessions.slice(0, 5).map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-neutral-400">
                    <span className="font-mono text-neutral-300">{s.date}</span>
                    <span aria-hidden="true">·</span>
                    <span>{s.level}</span>
                    <span aria-hidden="true">·</span>
                    <span>{s.mode}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                    <SummaryRow
                      label="Main Weakness"
                      value={s.mainWeakness}
                      multiline
                    />
                    <SummaryRow
                      label="Next Target"
                      value={s.retryTask}
                      multiline
                    />
                  </dl>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="text-center text-xs text-neutral-500">
          Adaptive Academic Speaking App · Local-only practice tool
        </footer>
      </main>
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
      <label
        htmlFor={id}
        className="mb-2 text-sm font-medium text-neutral-300"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-neutral-950">
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
  multiline?: boolean;
};

function SummaryRow({ label, value, multiline = false }: SummaryRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd
        className={
          multiline
            ? "whitespace-pre-wrap break-words text-sm text-neutral-100"
            : "text-sm text-neutral-100"
        }
      >
        {value}
      </dd>
    </div>
  );
}

// Small step badge + heading row for the main flow panels.
// Uses a numbered chip on the left to make the flow easy to follow.
type StepHeaderProps = {
  step: number;
  title: string;
  className?: string;
};

function StepHeader({ step, title, className }: StepHeaderProps) {
  return (
    <div className={`mb-6 flex items-center gap-3 ${className ?? ""}`}>
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950 font-mono text-xs text-neutral-300">
        {step}
      </span>
      <h2 className="text-lg font-medium text-neutral-200">{title}</h2>
    </div>
  );
}
