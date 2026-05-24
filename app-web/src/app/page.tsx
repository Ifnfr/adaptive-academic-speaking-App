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

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${mm}:${ss}`;
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
    setActiveSession({
      level,
      mode,
      feedbackType,
      sessionType,
      aiProvider,
      target,
    });
    // Reset attempt-related state so a fresh session starts clean.
    setTranscript("");
    setElapsedSeconds(0);
    setIsTimerRunning(false);
    setCapturedAttempt(null);
    setFeedback(null);
    setFeedbackError(null);
    setFeedbackLoading(false);
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
        const message =
          (data && "error" in data && data.error) ||
          `Request failed with status ${res.status}.`;
        setFeedbackError(message);
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
      setFeedbackError(message);
    } finally {
      setFeedbackLoading(false);
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
          <h2 className="mb-6 text-lg font-medium text-neutral-200">
            Session setup
          </h2>

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
            <button
              type="button"
              onClick={handleStart}
              className="w-full rounded-lg bg-neutral-100 px-4 py-3 text-base font-medium text-neutral-900 transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 focus:ring-offset-neutral-950"
            >
              {activeSession ? "Restart Session" : "Start Session"}
            </button>
          </div>
        </section>

        {/* Active Session Summary */}
        {activeSession && (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm sm:p-8">
            <h2 className="mb-6 text-lg font-medium text-neutral-200">
              Active session
            </h2>
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
          </section>
        )}

        {/* Speaking Attempt */}
        {activeSession && !capturedAttempt && (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm sm:p-8">
            <h2 className="mb-6 text-lg font-medium text-neutral-200">
              Speaking attempt
            </h2>

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
            <h2 className="mb-6 text-lg font-medium text-neutral-200">
              Attempt captured
            </h2>
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
            <p className="mt-6 rounded-lg border border-dashed border-neutral-700 bg-neutral-950/60 px-4 py-3 text-sm text-neutral-400">
              AI feedback will be added in the next batch.
            </p>

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

        <footer className="text-center text-xs text-neutral-500">
          MVP build · Local state only
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
