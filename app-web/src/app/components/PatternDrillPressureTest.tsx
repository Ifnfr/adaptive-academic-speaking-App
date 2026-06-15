import React, { useState, useRef, useEffect, useCallback } from "react";
import type { DrillModeContext } from "./PatternDrillModeCore";

export type PressureAttempt = {
  roundIndex: number;
  roundSeconds: 10 | 7 | 5 | 3;
  topic: string;
  transcript: string;
  patternDetected: boolean;
  usedSteps: string[];
  missingSteps: string[];
  timedOut: boolean;
  shortFeedback: string;
};

type RoundConfig = {
  seconds: 10 | 7 | 5 | 3;
  topic: string;
};

type PatternDrillPressureTestProps = {
  context: DrillModeContext;
  onExit: () => void;
  onComplete: (attempts: PressureAttempt[]) => void;
  roundConfigs?: RoundConfig[];
};

const DEFAULT_ROUNDS: RoundConfig[] = [
  { seconds: 10, topic: "Explain how artificial intelligence impacts job roles." },
  { seconds: 7, topic: "Discuss the pros and cons of remote work." },
  { seconds: 5, topic: "Explain why eating healthy is good." },
  { seconds: 3, topic: "Discuss why people like to travel." },
];

export function PatternDrillPressureTest({
  context,
  onExit,
  onComplete,
  roundConfigs = DEFAULT_ROUNDS,
}: PatternDrillPressureTestProps) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [gameState, setGameState] = useState<"intro" | "active" | "evaluating" | "feedback" | "summary">("intro");
  const [transcript, setTranscript] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentResult, setCurrentResult] = useState<{
    patternDetected: boolean;
    usedSteps: string[];
    missingSteps: string[];
    timedOut: boolean;
    shortFeedback: string;
  } | null>(null);
  const [completedAttempts, setCompletedAttempts] = useState<PressureAttempt[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Refs
  const intervalRef = useRef<number | null>(null);
  const deadlineRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const activeRound = roundConfigs[roundIndex];

  const isTimedOut = remainingSeconds === 0 && gameState === "active";
  const canSubmit = transcript.trim().length > 0 && !isTimedOut && !isEvaluating;
  const isFinalRound = roundIndex === roundConfigs.length - 1;

  // Derive pressure accuracy
  const pressureAccuracy = completedAttempts.length > 0
    ? Math.round(
        (completedAttempts.filter((a) => a.patternDetected).length / completedAttempts.length) * 100
      )
    : 0;

  // Timer callbacks
  const stopTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handleTimeout = useCallback(() => {
    setGameState("feedback");
    setCurrentResult({
      patternDetected: false,
      usedSteps: [],
      missingSteps: context.targetSteps,
      timedOut: true,
      shortFeedback: "Time expired! You did not submit in time.",
    });

    const newAttempt: PressureAttempt = {
      roundIndex,
      roundSeconds: activeRound.seconds,
      topic: activeRound.topic,
      transcript: "",
      patternDetected: false,
      usedSteps: [],
      missingSteps: context.targetSteps,
      timedOut: true,
      shortFeedback: "Time expired!",
    };

    setCompletedAttempts((prev) => [...prev, newAttempt]);
  }, [roundIndex, activeRound, context.targetSteps]);

  const startTimer = useCallback((seconds: number) => {
    stopTimer();
    const nowVal = performance.now();
    deadlineRef.current = nowVal + seconds * 1000;
    setRemainingSeconds(seconds);

    intervalRef.current = window.setInterval(() => {
      const now = performance.now();
      const left = Math.max(0, Math.ceil((deadlineRef.current - now) / 1000));
      setRemainingSeconds(left);

      if (now >= deadlineRef.current) {
        stopTimer();
        handleTimeout();
      }
    }, 100);
  }, [stopTimer, handleTimeout]);

  // Handle Mount/Unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopTimer();
      abortControllerRef.current?.abort();
    };
  }, [stopTimer]);
  const handleStartRound = () => {
    setTranscript("");
    setErrorText(null);
    setCurrentResult(null);
    setGameState("active");
    startTimer(activeRound.seconds);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    stopTimer();
    setIsEvaluating(true);
    setErrorText(null);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/pattern-drill/pressure-turn", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          briefId: context.briefId,
          targetPattern: context.targetPattern,
          targetSteps: context.targetSteps,
          commonMistakes: context.commonMistakes,
          promptTopic: activeRound.topic,
          transcript: transcript.trim(),
          roundSeconds: activeRound.seconds,
          roundIndex,
        }),
      });

      if (!res.ok) {
        throw new Error(`Evaluation failed with status ${res.status}`);
      }

      const data = (await res.json()) as {
        patternDetected: boolean;
        usedSteps: string[];
        missingSteps: string[];
        timedOut: boolean;
        shortFeedback: string;
      };

      if (!isMountedRef.current) return;

      setGameState("feedback");
      setCurrentResult({
        patternDetected: data.patternDetected,
        usedSteps: data.usedSteps,
        missingSteps: data.missingSteps,
        timedOut: false,
        shortFeedback: data.shortFeedback,
      });

      const newAttempt: PressureAttempt = {
        roundIndex,
        roundSeconds: activeRound.seconds,
        topic: activeRound.topic,
        transcript: transcript.trim(),
        patternDetected: data.patternDetected,
        usedSteps: data.usedSteps,
        missingSteps: data.missingSteps,
        timedOut: false,
        shortFeedback: data.shortFeedback,
      };

      setCompletedAttempts((prev) => [...prev, newAttempt]);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") {
        return; // Aborted, ignore
      }
      console.error("Pressure evaluation error:", err);
      setErrorText("Evaluation failed. Please try this round again.");
      // Resume the timer for user retry
      startTimer(remainingSeconds > 0 ? remainingSeconds : 5);
    } finally {
      if (isMountedRef.current) {
        setIsEvaluating(false);
      }
    }
  };

  const handleNext = () => {
    if (isFinalRound) {
      setGameState("summary");
    } else {
      setRoundIndex((prev) => prev + 1);
      setGameState("intro");
    }
  };

  // Render Intro State
  if (gameState === "intro") {
    return (
      <div className="flex flex-col h-full p-6 lg:p-8 space-y-8 bg-[var(--brand-surface)] text-[var(--brand-ink)]">
        <div className="flex items-center justify-between border-b border-[var(--brand-border)] pb-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--brand-teal-ink)]">
              Phase 3 — Pressure Test
            </h3>
            <p className="text-sm text-[var(--brand-ink-soft)] mt-1">
              Test your pattern mastery under time constraints.
            </p>
          </div>
          <button type="button" onClick={onExit} className="app-button-ghost px-3 py-1.5 text-sm">
            Exit
          </button>
        </div>

        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 space-y-6">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wider text-[var(--brand-muted)] font-mono">
              Ready for Round {roundIndex + 1} of {roundConfigs.length}
            </span>
            <h4 className="text-base font-semibold">
              Time limit: {activeRound.seconds} seconds
            </h4>
            <p className="text-sm text-[var(--brand-ink-soft)]">
              The pattern reference will be hidden. You must type a sentence matching the target pattern before the timer expires.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              data-testid="start-pressure-round-btn"
              onClick={handleStartRound}
              className="app-button px-5 py-2.5 text-sm font-semibold"
            >
              Start Round {roundIndex + 1}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Summary State
  if (gameState === "summary") {
    return (
      <div className="flex flex-col h-full p-6 lg:p-8 space-y-8 bg-[var(--brand-surface)] text-[var(--brand-ink)]">
        <div className="flex items-center justify-between border-b border-[var(--brand-border)] pb-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--brand-teal-ink)]">
              Phase 3 — Pressure Summary
            </h3>
            <p className="text-sm text-[var(--brand-ink-soft)] mt-1">
              Your results under time constraints.
            </p>
          </div>
          <button type="button" onClick={onExit} className="app-button-ghost px-3 py-1.5 text-sm">
            Exit
          </button>
        </div>

        <div className="space-y-6">
          {/* Direct phase notice if no other metrics saved */}
          <div
            data-testid="pressure-local-only-notice"
            className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800"
          >
            This pressure result is local for now. Saved session metrics will be connected later.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 text-center">
              <span className="text-xs uppercase font-mono text-[var(--brand-muted)]">Pressure Accuracy</span>
              <p className="text-3xl font-bold mt-1 text-[var(--brand-teal-ink)]" data-testid="pressure-accuracy-val">
                {pressureAccuracy}%
              </p>
            </div>
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 text-center">
              <span className="text-xs uppercase font-mono text-[var(--brand-muted)]">Pattern Detected</span>
              <p className="text-3xl font-bold mt-1 text-green-600" data-testid="pressure-detected-val">
                {completedAttempts.filter((a) => a.patternDetected).length}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 text-center">
              <span className="text-xs uppercase font-mono text-[var(--brand-muted)]">Timeouts / Misses</span>
              <p className="text-3xl font-bold mt-1 text-red-500" data-testid="pressure-missed-val">
                {completedAttempts.filter((a) => a.timedOut || !a.patternDetected).length}
              </p>
            </div>
          </div>

          {/* Attempts List */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--brand-muted)]">Round Attempts Log</h4>
            <div className="space-y-3">
              {completedAttempts.map((attempt, idx) => (
                <div key={idx} className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono text-[var(--brand-muted)]">Round {attempt.roundIndex + 1} ({attempt.roundSeconds}s)</span>
                    <span className={`font-semibold uppercase ${attempt.patternDetected ? "text-green-600" : "text-red-500"}`}>
                      {attempt.timedOut ? "Timed Out" : attempt.patternDetected ? "Detected" : "Not Detected"}
                    </span>
                  </div>
                  <p className="text-sm font-semibold">{attempt.topic}</p>
                  {attempt.transcript && (
                    <p className="text-xs italic bg-[var(--brand-bg)] p-2 rounded border border-[var(--brand-border)]">
                      &ldquo;{attempt.transcript}&rdquo;
                    </p>
                  )}
                  {attempt.shortFeedback && (
                    <p className="text-xs text-[var(--brand-ink-soft)] font-medium">
                      Feedback: {attempt.shortFeedback}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={() => onComplete(completedAttempts)}
              className="app-button px-5 py-2.5 text-sm font-semibold"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active / Feedback state
  return (
    <div className="flex flex-col h-full p-6 lg:p-8 space-y-8 bg-[var(--brand-surface)] text-[var(--brand-ink)]">
      {/* Header (No Pattern Reference) */}
      <div className="flex items-center justify-between border-b border-[var(--brand-border)] pb-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--brand-teal-ink)]">
            Phase 3 — Pressure Test
          </h3>
          <p className="text-sm text-[var(--brand-ink-soft)] mt-1">
            Round {roundIndex + 1} of {roundConfigs.length} (Time Limit: {activeRound.seconds}s)
          </p>
        </div>
        <button type="button" onClick={onExit} className="app-button-ghost px-3 py-1.5 text-sm">
          Exit
        </button>
      </div>

      <div className="ml-8 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 space-y-6">
        {/* Countdown Ticker - Polite ARIA live updates */}
        <div className="flex justify-between items-center">
          <span className="text-xs uppercase tracking-wider text-[var(--brand-muted)] font-mono">
            Topic Round {roundIndex + 1}
          </span>
          <div
            data-testid="pressure-countdown"
            className={`text-lg font-mono font-bold px-3 py-1 rounded ${
              remainingSeconds <= 3 ? "text-red-600 bg-red-100 animate-pulse" : "text-[var(--brand-teal-ink)] bg-[var(--brand-bg)]"
            }`}
          >
            {remainingSeconds}s
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-base font-semibold" data-testid="drill-prompt-text">
            {activeRound.topic}
          </p>
        </div>

        {/* Feedback display after round completes */}
        {currentResult && (
          <div
            data-testid="pressure-feedback-box"
            className={`rounded border p-4 text-sm font-medium ${
              currentResult.patternDetected ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
            }`}
            aria-live="polite"
          >
            <p>{currentResult.shortFeedback}</p>
            {currentResult.missingSteps.length > 0 && (
              <p className="text-xs text-red-600 mt-1">
                Missing steps: {currentResult.missingSteps.join(", ")}
              </p>
            )}
          </div>
        )}

        {/* Submit Form */}
        {gameState === "active" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="pressure-textarea" className="block text-sm font-medium">
                Type your response sentence matching the CRE structure:
              </label>
              <textarea
                id="pressure-textarea"
                aria-describedby="pressure-textarea-help"
                data-testid="drill-transcript-input"
                rows={4}
                maxLength={500}
                placeholder="Type your response here..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                disabled={isEvaluating || isTimedOut}
                className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] disabled:opacity-50"
              />
              <span id="pressure-textarea-help" className="text-xs text-[var(--brand-muted)] block">
                Type the sentence incorporating the hidden pattern target steps before time runs out.
              </span>
            </div>

            {errorText && (
              <p className="text-sm text-[var(--brand-danger)]" data-testid="drill-error-text">
                {errorText}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                data-testid="drill-submit-btn"
                disabled={!canSubmit}
                className={`app-button px-5 py-2 text-sm ${!canSubmit ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isEvaluating ? "Evaluating..." : "Submit Response"}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              data-testid="pressure-next-btn"
              onClick={handleNext}
              className="app-button px-5 py-2.5 text-sm font-semibold"
            >
              {isFinalRound ? "View Summary" : "Next Round"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
