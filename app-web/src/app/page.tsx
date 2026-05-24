"use client";

import { useEffect, useRef, useState } from "react";

// Option lists kept as plain string arrays so they are easy to edit later.
const LEVELS = ["Foundation", "Beginner", "Intermediate", "Advanced", "Expert"] as const;
const MODES = ["Fluency Sprint", "Argument Drill", "Reading-to-Speaking", "Debate"] as const;
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
};

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
  const score = "3"; // MVP placeholder; real scoring is a future batch.

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
      score,
      score,
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
      score,
      score,
      score,
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
    score,
    score,
    score,
    score,
    score,
    score,
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

  // --- Speaking attempt state ---
  const [transcript, setTranscript] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Captured attempt (after Submit) ---
  const [capturedAttempt, setCapturedAttempt] = useState<CapturedAttempt | null>(
    null,
  );

  // --- AI feedback state ---
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // --- Retry loop state ---
  const [retryTranscript, setRetryTranscript] = useState("");
  const [capturedRetry, setCapturedRetry] = useState<CapturedRetry | null>(null);

  // --- End session / CSV state ---
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(
    null,
  );
  const [csvCopied, setCsvCopied] = useState(false);

  // --- Session history (localStorage) ---
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [lastCsvCopied, setLastCsvCopied] = useState(false);

  // Hydrate sessions from localStorage on mount. Runs only on the client.
  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  const previousSession = sessions[0] ?? null;

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
    // Note: sessions history is intentionally NOT cleared on restart.
  };

  const handleStartTimer = () => setIsTimerRunning(true);
  const handleStopTimer = () => setIsTimerRunning(false);
  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setElapsedSeconds(0);
  };

  const trimmedTranscript = transcript.trim();
  const canSubmit = trimmedTranscript.length > 0 && capturedAttempt === null;

  const handleSubmitAttempt = () => {
    if (!canSubmit) return;
    setIsTimerRunning(false);
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

      setFeedback(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Network error while contacting the API.";
      setFeedbackError(sanitizeErrorMessage(message));
    } finally {
      setFeedbackLoading(false);
    }
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
    setSessions((prev) => {
      const next = [record, ...prev].slice(0, MAX_STORED_SESSIONS);
      saveSessions(next);
      return next;
    });
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

        {/* Speaking Attempt */}
        {activeSession && !capturedAttempt && (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm sm:p-8">
            <StepHeader step={3} title="Speaking attempt" />

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

            {/* Transcript */}
            <div className="mt-8">
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
            <StepHeader step={4} title="Attempt captured" />
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
              <button
                type="button"
                onClick={handleGetFeedback}
                disabled={feedbackLoading}
                className="w-full rounded-lg bg-neutral-100 px-4 py-3 text-base font-medium text-neutral-900 transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 focus:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
              >
                {feedbackLoading ? "Generating feedback..." : "Get AI Feedback"}
              </button>
            </div>

            {feedbackError && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
              >
                {feedbackError}
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
              </div>
            )}
          </section>
        )}

        {/* Retry Attempt */}
        {feedback && !capturedRetry && (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm sm:p-8">
            <StepHeader step={5} title="Retry attempt" />

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
            <StepHeader step={6} title="Retry captured" />

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
            <StepHeader step={7} title="Session summary" />
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
                  8
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
