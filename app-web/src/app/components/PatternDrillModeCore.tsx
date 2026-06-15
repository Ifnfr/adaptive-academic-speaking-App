import { useState, useRef, useEffect } from "react";
import { PatternDrillPressureTest, type PressureAttempt } from "./PatternDrillPressureTest";

// ─── Types ───────────────────────────────────────────────────────────────────

export type DrillModeContext = {
  briefId: string;
  targetPattern: string;
  targetSteps: string[];
  commonMistakes: string[];
  entryPhase: 1 | 3;
  quickCheck:
    | { status: "detected"; transcript: string }
    | { status: "not_detected_or_partial"; transcript: string }
    | { status: "skipped" };
};

type PatternDrillModeCoreProps = {
  context: DrillModeContext;
  onExit: () => void;
};

type DrillTurnResponse = {
  credit: "full" | "partial" | "none";
  missingSteps: string[];
  usedSteps: string[];
  shortFeedback: string;
};

export type Phase2Attempt = {
  topic: string;
  credit: "full" | "partial" | "none";
  missingSteps: string[];
  usedSteps: string[];
  attemptNumber: 1 | 2 | 3;
  simplifiedTopicUsed: boolean;
};

export type PatternDrillSessionSummary = {
  phase1BaselineCompleteness: "complete" | "partial" | "missing";
  phase2Accuracy: number;
  fullCreditCount: number;
  partialCreditCount: number;
  noCreditCount: number;
  evaluatedAttemptCount: number;
  finalFullCreditStreak: number;
  mostMissedSteps: string[];
  simplifiedTopicUsed: boolean;
  improvementSignal: "strong" | "emerging" | "needs_more_repetition";
  nextSessionRecommendation: string;
  weaknessUpdate: {
    category: "pattern_drill";
    label: string;
    practiceFocus: string;
  } | null;
  phase3PressureAccuracy: null;
  pressureFailRate: null;
  saved: boolean;
  sessionId?: string;
};

export type SummaryState =
  | { status: "idle" }
  | { status: "summarizing" }
  | { status: "ready"; summary: PatternDrillSessionSummary }
  | { status: "failed"; fallbackSummary: PatternDrillSessionSummary };

// ─── Constants ───────────────────────────────────────────────────────────────

const P1_PROMPTS = [
  "Formulate a sentence using the target pattern for the topic: 'Online Education'.",
  "Formulate a sentence using the target pattern for the topic: 'Renewable Energy'.",
];

const PHASE2_TOPICS = [
  "Explain how artificial intelligence impacts job roles.",
  "Discuss the pros and cons of remote work.",
];

const SIMPLIFIED_TOPICS = [
  "Explain why eating healthy is good.",
  "Discuss why people like to travel.",
];

// ─── Fallback Helper ─────────────────────────────────────────────────────────

function computeFallbackSummary(
  context: DrillModeContext,
  baselineAnswers: Array<{ prompt: string; transcript: string }>,
  attempts: Phase2Attempt[]
): PatternDrillSessionSummary {
  const fullCreditCount = attempts.filter((a) => a.credit === "full").length;
  const partialCreditCount = attempts.filter((a) => a.credit === "partial").length;
  const noCreditCount = attempts.filter((a) => a.credit === "none").length;
  const evaluatedAttemptCount = attempts.length;

  const phase2Accuracy = evaluatedAttemptCount > 0
    ? Math.round((fullCreditCount / evaluatedAttemptCount) * 100)
    : 0;

  // Final streak of full credits
  let finalFullCreditStreak = 0;
  for (let i = attempts.length - 1; i >= 0; i--) {
    if (attempts[i].credit === "full") {
      finalFullCreditStreak++;
    } else {
      break;
    }
  }

  // Most missed steps
  const stepCounts: Record<string, number> = {};
  attempts.forEach((a) => {
    a.missingSteps.forEach((step) => {
      stepCounts[step] = (stepCounts[step] || 0) + 1;
    });
  });
  const mostMissedSteps = Object.entries(stepCounts)
    .sort((a, b) => b[1] - a[1])
    .map((entry) => entry[0]);

  const simplifiedTopicUsed = attempts.some((a) => a.simplifiedTopicUsed);

  let improvementSignal: "strong" | "emerging" | "needs_more_repetition" = "needs_more_repetition";
  if (phase2Accuracy >= 75) {
    improvementSignal = "strong";
  } else if (phase2Accuracy >= 50) {
    improvementSignal = "emerging";
  }

  const nextSessionRecommendation = phase2Accuracy >= 75
    ? "Pattern mastered. Ready for faster pacing or full context speaking in next Podchat."
    : "Keep practicing. Focus on including all target slots in order.";

  return {
    phase1BaselineCompleteness: baselineAnswers.length >= 2 ? "complete" : baselineAnswers.length > 0 ? "partial" : "missing",
    phase2Accuracy,
    fullCreditCount,
    partialCreditCount,
    noCreditCount,
    evaluatedAttemptCount,
    finalFullCreditStreak,
    mostMissedSteps,
    simplifiedTopicUsed,
    improvementSignal,
    nextSessionRecommendation,
    weaknessUpdate: null,
    phase3PressureAccuracy: null,
    pressureFailRate: null,
    saved: false,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PatternDrillModeCore({ context, onExit }: PatternDrillModeCoreProps) {
  const [phase, setPhase] = useState<1 | 2 | 3>(context.entryPhase === 3 ? 3 : 1);
  const [p1PromptIndex, setP1PromptIndex] = useState<number>(0);
  const [p2TopicIndex, setP2TopicIndex] = useState<number>(0);
  const [attemptNumber, setAttemptNumber] = useState<1 | 2 | 3>(1);
  const [baselineAnswers, setBaselineAnswers] = useState<Array<{ prompt: string; transcript: string }>>([]);
  const [transcript, setTranscript] = useState<string>("");
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<DrillTurnResponse | null>(null);
  const [simplifiedActive, setSimplifiedActive] = useState<boolean>(false);
  const [showPatternRef, setShowPatternRef] = useState<boolean>(false);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Milestone 13 Phase 3 states
  const [showChoiceScreen, setShowChoiceScreen] = useState<boolean>(false);
  const [triggerP12Save, setTriggerP12Save] = useState<boolean>(false);
  const [pressureAttempts, setPressureAttempts] = useState<PressureAttempt[]>([]);
  const [isPressureComplete, setIsPressureComplete] = useState<boolean>(false);

  // Milestone 9 Summary States
  const [attempts, setAttempts] = useState<Phase2Attempt[]>([]);
  const [summaryState, setSummaryState] = useState<SummaryState>({ status: "idle" });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  // Request abort refs
  const abortRef = useRef<AbortController | null>(null);
  const summaryAbortRef = useRef<AbortController | null>(null);
  const hasCalledEvaluateRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      summaryAbortRef.current?.abort();
    };
  }, []);

  // Summary generation useEffect on completion
  useEffect(() => {
    if (context.entryPhase === 3) return;
    if (!isComplete && !triggerP12Save) return;
    if (hasCalledEvaluateRef.current) return;
    hasCalledEvaluateRef.current = true;

    let active = true;
    const controller = new AbortController();
    summaryAbortRef.current = controller;

    async function generateSummary() {
      setSummaryState({ status: "summarizing" });
      setSaveStatus("saving");

      try {
        const res = await fetch("/api/pattern-drill/evaluate-session", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            briefId: context.briefId,
            targetPattern: context.targetPattern,
            targetSteps: context.targetSteps,
            commonMistakes: context.commonMistakes,
            quickCheck: {
              status: context.quickCheck.status,
            },
            phase1: {
              baselineAnswerCount: baselineAnswers.length,
              completedPromptCount: baselineAnswers.length,
            },
            phase2: {
              attempts: attempts.map((a) => ({
                topic: a.topic,
                credit: a.credit,
                missingSteps: a.missingSteps,
                usedSteps: a.usedSteps,
                attemptNumber: a.attemptNumber,
                simplifiedTopicUsed: a.simplifiedTopicUsed,
              })),
            },
          }),
        });

        if (!res.ok) {
          throw new Error(`Summary API failed with status ${res.status}`);
        }

        const data = (await res.json()) as PatternDrillSessionSummary;
        if (active) {
          setSummaryState({ status: "ready", summary: data });
          setSaveStatus(data.saved ? "saved" : "failed");
        }
      } catch (err) {
        if (active && (err as Error)?.name !== "AbortError") {
          const fallback = computeFallbackSummary(context, baselineAnswers, attempts);
          setSummaryState({ status: "failed", fallbackSummary: fallback });
          setSaveStatus("failed");
        }
      }
    }

    generateSummary();

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, triggerP12Save]);

  const currentTopic = simplifiedActive
    ? SIMPLIFIED_TOPICS[p2TopicIndex]
    : PHASE2_TOPICS[p2TopicIndex];

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleP1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = transcript.trim();
    if (!trimmed) return;

    const currentPrompt = P1_PROMPTS[p1PromptIndex];
    setBaselineAnswers((prev) => [...prev, { prompt: currentPrompt, transcript: trimmed }]);
    setTranscript("");

    if (p1PromptIndex === 0) {
      setP1PromptIndex(1);
    } else {
      setPhase(2);
      setP2TopicIndex(0);
      setAttemptNumber(1);
    }
  };

  const handleP2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = transcript.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsEvaluating(true);
    setErrorText(null);

    try {
      const res = await fetch("/api/pattern-drill/drill-turn", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          phase: 2,
          briefId: context.briefId,
          targetPattern: context.targetPattern,
          targetSteps: context.targetSteps,
          commonMistakes: context.commonMistakes,
          promptTopic: currentTopic,
          transcript: trimmed,
          attemptNumber,
          previousCredit: lastResult ? lastResult.credit : undefined,
        }),
      });

      if (!res.ok) {
        let errData: { error?: string } = {};
        try {
          errData = await res.json();
        } catch {
          // ignore
        }
        setErrorText(errData.error || "Evaluation failed. Please try again.");
        setIsEvaluating(false);
        return;
      }

      const data = (await res.json()) as DrillTurnResponse;
      setIsEvaluating(false);
      setLastResult(data);

      // Milestone 9: Accumulate attempt metadata
      const newAttempt: Phase2Attempt = {
        topic: currentTopic,
        credit: data.credit,
        missingSteps: data.missingSteps,
        usedSteps: data.usedSteps,
        attemptNumber,
        simplifiedTopicUsed: simplifiedActive,
      };
      setAttempts((prev) => [...prev, newAttempt]);

      if (data.credit === "full") {
        // Full credit! The user can click Next to advance.
      } else if (data.credit === "partial") {
        // Partial credit: user must retry
        setAttemptNumber((prev) => (prev < 3 ? (prev + 1) as 1 | 2 | 3 : 3));
      } else {
        // No credit: check retry limits
        if (attemptNumber === 3) {
          // Switch to simpler topic
          setSimplifiedActive(true);
          setAttemptNumber(1);
          setLastResult(null); // Clear result for fresh start
          setTranscript("");
        } else {
          setAttemptNumber((prev) => (prev + 1) as 1 | 2 | 3);
        }
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setErrorText("Connection error. Please try again.");
      setIsEvaluating(false);
    }
  };

  const handleNextTopic = () => {
    setLastResult(null);
    setTranscript("");
    setAttemptNumber(1);
    setSimplifiedActive(false);

    if (p2TopicIndex + 1 < PHASE2_TOPICS.length) {
      setP2TopicIndex((prev) => prev + 1);
    } else {
      setShowChoiceScreen(true);
    }
  };

  // ── Render Choice Screen ─────────────────────────────────────────────────
  if (showChoiceScreen) {
    return (
      <div className="flex flex-col h-full overflow-y-auto p-6 lg:p-8 space-y-8 bg-[var(--brand-surface)] text-[var(--brand-ink)]">
        <div className="flex items-center justify-between border-b border-[var(--brand-border)] pb-4">
          <h3 className="text-lg font-semibold text-[var(--brand-teal-ink)]">Phase 2 Repetition Complete</h3>
          <button type="button" onClick={onExit} className="app-button-ghost px-3 py-1.5 text-sm">
            Exit
          </button>
        </div>

        <div className="ml-8 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 space-y-6">
          <div className="space-y-2">
            <h4 className="text-base font-semibold">Choose Your Next Step</h4>
            <p className="text-sm text-[var(--brand-ink-soft)]">
              You have successfully completed the practice rounds. You can now choose to test your recall speed in the Pressure Test, or finish the session and save your metrics.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <button
              type="button"
              data-testid="start-pressure-btn"
              onClick={() => {
                setTriggerP12Save(true);
                setPhase(3);
                setShowChoiceScreen(false);
              }}
              className="app-button px-5 py-3 text-sm font-semibold flex-1 min-h-[48px]"
            >
              Start Pressure Test
            </button>
            <button
              type="button"
              data-testid="finish-session-btn"
              onClick={() => {
                setIsComplete(true);
                setShowChoiceScreen(false);
              }}
              className="app-button-ghost border border-[var(--brand-border)] px-5 py-3 text-sm font-semibold flex-1 min-h-[48px]"
            >
              Finish Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render Pressure Complete / Final Summary ─────────────────────────────
  if (isPressureComplete) {
    const isSavingP12 = summaryState.status === "summarizing" || summaryState.status === "idle";
    const isFailedP12 = summaryState.status === "failed";
    const summary = summaryState.status === "ready"
      ? summaryState.summary
      : summaryState.status === "failed"
        ? summaryState.fallbackSummary
        : null;

    const pressureAccuracy = pressureAttempts.length > 0
      ? Math.round(
          (pressureAttempts.filter((a) => a.patternDetected).length / pressureAttempts.length) * 100
        )
      : 0;

    return (
      <div className="flex flex-col h-full overflow-y-auto p-6 lg:p-8 space-y-8 bg-[var(--brand-surface)] text-[var(--brand-ink)]">
        <div className="flex items-center justify-between border-b border-[var(--brand-border)] pb-4">
          <h3 className="text-lg font-semibold text-[var(--brand-teal-ink)]">Drill Session Complete</h3>
          <button
            type="button"
            onClick={onExit}
            data-testid="exit-drill-btn"
            className="app-button px-4 py-2 text-sm"
          >
            Exit to Podchat
          </button>
        </div>

        <div className="ml-8 space-y-6">
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 space-y-6">
            <h4 className="text-base font-semibold text-[var(--brand-teal-ink)]">Phase 3 — Pressure Test Results</h4>
            <div
              data-testid="pressure-local-only-notice"
              className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800"
            >
              This pressure result is local for now. Saved session metrics will be connected later.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-center">
                <span className="text-xs uppercase font-mono text-[var(--brand-muted)]">Pressure Accuracy</span>
                <p className="text-3xl font-bold mt-1 text-[var(--brand-teal-ink)]" data-testid="pressure-accuracy-val">
                  {pressureAccuracy}%
                </p>
              </div>
              <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-center">
                <span className="text-xs uppercase font-mono text-[var(--brand-muted)]">Pattern Detected</span>
                <p className="text-3xl font-bold mt-1 text-green-600" data-testid="pressure-detected-val">
                  {pressureAttempts.filter((a) => a.patternDetected).length}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-center">
                <span className="text-xs uppercase font-mono text-[var(--brand-muted)]">Timeouts / Misses</span>
                <p className="text-3xl font-bold mt-1 text-red-500" data-testid="pressure-missed-val">
                  {pressureAttempts.filter((a) => a.timedOut || !a.patternDetected).length}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-muted)]">Round Attempts Log</h5>
              <div className="space-y-3">
                {pressureAttempts.map((attempt, idx) => (
                  <div key={idx} className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 space-y-2">
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
          </div>

          {context.entryPhase !== 3 && (
            <div className="space-y-6">
              <hr className="border-[var(--brand-border)] my-8" />
              <h4 className="text-base font-semibold text-[var(--brand-teal-ink)] pl-2">Phase 1 & 2 Saved Session Metrics</h4>
              {isSavingP12 && (
                <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 flex flex-col items-center justify-center space-y-4">
                  <span className="animate-spin h-6 w-6 border-2 border-[var(--brand-teal)] border-t-transparent rounded-full" />
                  <p className="text-sm text-[var(--brand-ink-soft)]" data-testid="summary-summarizing">
                    Analyzing session and generating summary...
                  </p>
                </div>
              )}

              {summary && (
                <div className="space-y-6">
                  <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 flex justify-between items-center">
                    <span className="text-sm font-semibold">Persistence Status</span>
                    <span
                      data-testid="summary-save-status"
                      className={`text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${
                        saveStatus === "saving"
                          ? "bg-blue-100 text-blue-800"
                          : saveStatus === "saved"
                          ? "bg-green-100 text-green-800"
                          : saveStatus === "failed"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {saveStatus === "saving"
                        ? "Saving summary..."
                        : saveStatus === "saved"
                        ? "Saved to your practice history."
                        : saveStatus === "failed"
                        ? "Summary available, but saving failed."
                        : "Not saved yet"}
                    </span>
                  </div>

                  {isFailedP12 && (
                    <div
                      data-testid="summary-failed-notice"
                      className="rounded-lg border border-[var(--brand-danger)] bg-[var(--brand-danger)] bg-opacity-10 p-3 text-sm text-[var(--brand-danger)]"
                    >
                      Summary is available locally, but final summary generation failed.
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 space-y-3">
                      <h4 className="text-xs uppercase tracking-wider font-semibold text-[var(--brand-muted)]">
                        Performance Accuracy
                      </h4>
                      <div>
                        <span className="text-3xl font-bold" data-testid="summary-accuracy">
                          {summary.phase2Accuracy}%
                        </span>
                        <span className="text-xs text-[var(--brand-muted)] ml-2">Phase 2</span>
                      </div>
                      <div className="text-xs text-[var(--brand-ink-soft)] pt-2 border-t border-[var(--brand-border)]">
                        Final Full Credit Streak: <strong data-testid="summary-streak">{summary.finalFullCreditStreak}</strong>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 space-y-2">
                      <h4 className="text-xs uppercase tracking-wider font-semibold text-[var(--brand-muted)]">
                        Attempt Results
                      </h4>
                      <div className="grid grid-cols-3 gap-1 text-center pt-2">
                        <div className="bg-green-50 rounded p-1 border border-green-100">
                          <span className="block text-lg font-bold text-green-700" data-testid="summary-full-credit-count">
                            {summary.fullCreditCount}
                          </span>
                          <span className="text-[10px] text-green-600">Full</span>
                        </div>
                        <div className="bg-blue-50 rounded p-1 border border-blue-100">
                          <span className="block text-lg font-bold text-blue-700" data-testid="summary-partial-credit-count">
                            {summary.partialCreditCount}
                          </span>
                          <span className="text-[10px] text-blue-600">Partial</span>
                        </div>
                        <div className="bg-red-50 rounded p-1 border border-red-100">
                          <span className="block text-lg font-bold text-red-700" data-testid="summary-no-credit-count">
                            {summary.noCreditCount}
                          </span>
                          <span className="text-[10px] text-red-600">No</span>
                        </div>
                      </div>
                      <div className="text-[10px] text-[var(--brand-muted)] text-center pt-1">
                        Evaluated attempts: {summary.evaluatedAttemptCount}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 space-y-3">
                      <h4 className="text-xs uppercase tracking-wider font-semibold text-[var(--brand-muted)]">
                        Improvement Signal
                      </h4>
                      <div
                        data-testid="summary-improvement-signal"
                        className={`text-sm font-semibold capitalize px-2 py-1 rounded inline-block ${
                          summary.improvementSignal === "strong" ? "bg-green-100 text-green-800" :
                          summary.improvementSignal === "emerging" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {summary.improvementSignal.replace(/_/g, " ")}
                      </div>
                      <p className="text-xs text-[var(--brand-ink-soft)]">{summary.nextSessionRecommendation}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 space-y-3">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--brand-ink-soft)]">
                      Key Missing Steps
                    </h4>
                    {summary.mostMissedSteps.length > 0 ? (
                      <ul className="list-disc pl-5 text-sm space-y-1" data-testid="summary-missed-steps">
                        {summary.mostMissedSteps.map((step, idx) => (
                          <li key={idx} className="font-mono text-[var(--brand-teal-ink)]">
                            {step}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[var(--brand-muted)] italic" data-testid="summary-missed-steps">None</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 space-y-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--brand-ink-soft)]">
                      Baseline Answers (Phase 1 Recall)
                    </h4>
                    <div className="space-y-3">
                      {baselineAnswers.map((ans, idx) => (
                        <div key={idx} className="rounded bg-[var(--brand-bg)] border border-[var(--brand-border)] p-3 space-y-1">
                          <p className="text-xs font-mono text-[var(--brand-muted)]">{ans.prompt}</p>
                          <p className="text-sm">{ans.transcript}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Render Pressure Active ───────────────────────────────────────────────
  if (phase === 3 && !isPressureComplete) {
    return (
      <PatternDrillPressureTest
        context={context}
        onExit={onExit}
        onComplete={(attempts) => {
          setPressureAttempts(attempts);
          setIsPressureComplete(true);
        }}
      />
    );
  }

  // ── Render completion screen ─────────────────────────────────────────────

  if (isComplete) {
    const isSummarizing = summaryState.status === "summarizing" || summaryState.status === "idle";
    const isFailed = summaryState.status === "failed";
    const summary = summaryState.status === "ready"
      ? summaryState.summary
      : summaryState.status === "failed"
        ? summaryState.fallbackSummary
        : null;

    return (
      <div className="flex flex-col h-full overflow-y-auto p-6 lg:p-8 space-y-8 bg-[var(--brand-surface)] text-[var(--brand-ink)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--brand-border)] pb-4">
          <h3 className="text-lg font-semibold text-[var(--brand-teal-ink)]">Drill Session Complete</h3>
          <button
            type="button"
            onClick={onExit}
            data-testid="exit-drill-btn"
            className="app-button px-4 py-2 text-sm"
          >
            Exit to Podchat
          </button>
        </div>

        {/* Summarizing State */}
        {isSummarizing && (
          <div className="ml-8 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 flex flex-col items-center justify-center space-y-4">
            <span className="animate-spin h-6 w-6 border-2 border-[var(--brand-teal)] border-t-transparent rounded-full" />
            <p className="text-sm text-[var(--brand-ink-soft)]" data-testid="summary-summarizing">
              Analyzing session and generating summary...
            </p>
          </div>
        )}

        {/* Summary Ready / Fallback */}
        {summary && (
          <div className="ml-8 space-y-6">
            {/* Persistence Indicator */}
            <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 flex justify-between items-center">
              <span className="text-sm font-semibold">Persistence Status</span>
              <span
                data-testid="summary-save-status"
                className={`text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${
                  saveStatus === "saving"
                    ? "bg-blue-100 text-blue-800"
                    : saveStatus === "saved"
                    ? "bg-green-100 text-green-800"
                    : saveStatus === "failed"
                    ? "bg-red-100 text-red-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {saveStatus === "saving"
                  ? "Saving summary..."
                  : saveStatus === "saved"
                  ? "Saved to your practice history."
                  : saveStatus === "failed"
                  ? "Summary available, but saving failed."
                  : "Not saved yet"}
              </span>
            </div>

            {/* API Failure notice */}
            {isFailed && (
              <div
                data-testid="summary-failed-notice"
                className="rounded-lg border border-[var(--brand-danger)] bg-[var(--brand-danger)] bg-opacity-10 p-3 text-sm text-[var(--brand-danger)]"
              >
                Summary is available locally, but final summary generation failed.
              </div>
            )}

            {/* Dashboard grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Accuracy & Streak */}
              <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 space-y-3">
                <h4 className="text-xs uppercase tracking-wider font-semibold text-[var(--brand-muted)]">
                  Performance Accuracy
                </h4>
                <div>
                  <span className="text-3xl font-bold" data-testid="summary-accuracy">
                    {summary.phase2Accuracy}%
                  </span>
                  <span className="text-xs text-[var(--brand-muted)] ml-2">Phase 2</span>
                </div>
                <div className="text-xs text-[var(--brand-ink-soft)] pt-2 border-t border-[var(--brand-border)]">
                  Final Full Credit Streak: <strong data-testid="summary-streak">{summary.finalFullCreditStreak}</strong>
                </div>
              </div>

              {/* Card 2: Attempts breakdown */}
              <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 space-y-2">
                <h4 className="text-xs uppercase tracking-wider font-semibold text-[var(--brand-muted)]">
                  Attempt Results
                </h4>
                <div className="grid grid-cols-3 gap-1 text-center pt-2">
                  <div className="bg-green-50 rounded p-1 border border-green-100">
                    <span className="block text-lg font-bold text-green-700" data-testid="summary-full-credit-count">
                      {summary.fullCreditCount}
                    </span>
                    <span className="text-[10px] text-green-600">Full</span>
                  </div>
                  <div className="bg-blue-50 rounded p-1 border border-blue-100">
                    <span className="block text-lg font-bold text-blue-700" data-testid="summary-partial-credit-count">
                      {summary.partialCreditCount}
                    </span>
                    <span className="text-[10px] text-blue-600">Partial</span>
                  </div>
                  <div className="bg-red-50 rounded p-1 border border-red-100">
                    <span className="block text-lg font-bold text-red-700" data-testid="summary-no-credit-count">
                      {summary.noCreditCount}
                    </span>
                    <span className="text-[10px] text-red-600">No</span>
                  </div>
                </div>
                <div className="text-[10px] text-[var(--brand-muted)] text-center pt-1">
                  Evaluated attempts: {summary.evaluatedAttemptCount}
                </div>
              </div>

              {/* Card 3: Qualitative Signal */}
              <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 space-y-3">
                <h4 className="text-xs uppercase tracking-wider font-semibold text-[var(--brand-muted)]">
                  Improvement Signal
                </h4>
                <div
                  data-testid="summary-improvement-signal"
                  className={`text-sm font-semibold capitalize px-2 py-1 rounded inline-block ${
                    summary.improvementSignal === "strong" ? "bg-green-100 text-green-800" :
                    summary.improvementSignal === "emerging" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {summary.improvementSignal.replace(/_/g, " ")}
                </div>
                <p className="text-xs text-[var(--brand-ink-soft)]">{summary.nextSessionRecommendation}</p>
              </div>
            </div>

            {/* Missing steps details */}
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 space-y-3">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--brand-ink-soft)]">
                Key Missing Steps
              </h4>
              {summary.mostMissedSteps.length > 0 ? (
                <ul className="list-disc pl-5 text-sm space-y-1" data-testid="summary-missed-steps">
                  {summary.mostMissedSteps.map((step, idx) => (
                    <li key={idx} className="font-mono text-[var(--brand-teal-ink)]">
                      {step}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--brand-muted)] italic" data-testid="summary-missed-steps">None</p>
              )}
            </div>

            {/* Simplification banner */}
            {summary.simplifiedTopicUsed && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
                Topic simplification was used during the drill to help align with pattern targets.
              </div>
            )}

            {/* Weakness recommendation (if available) */}
            {summary.weaknessUpdate && (
              <div className="rounded-xl border border-dotted border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 space-y-2">
                <span className="text-xs font-mono uppercase tracking-wider text-[var(--brand-muted)]">
                  Recommended Focus for Next Time
                </span>
                <p className="text-sm font-semibold">{summary.weaknessUpdate.label}</p>
                <p className="text-xs text-[var(--brand-ink-soft)]">{summary.weaknessUpdate.practiceFocus}</p>
              </div>
            )}

            {/* Baseline recall responses */}
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 space-y-4">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--brand-ink-soft)]">
                Baseline Answers (Phase 1 Recall)
              </h4>
              <div className="space-y-3">
                {baselineAnswers.map((ans, idx) => (
                  <div key={idx} className="rounded bg-[var(--brand-bg)] border border-[var(--brand-border)] p-3 space-y-1">
                    <p className="text-xs font-mono text-[var(--brand-muted)]">{ans.prompt}</p>
                    <p className="text-sm">{ans.transcript}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Deferred Phase 3 details */}
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-5 space-y-2">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--brand-ink-soft)]">
                Phase 3 (Pressure Test) Metrics
              </h4>
              <div className="grid grid-cols-2 gap-4 text-center pt-2">
                <div className="rounded bg-[var(--brand-bg)] border border-[var(--brand-border)] p-2">
                  <span className="block text-lg font-bold text-[var(--brand-muted)]" data-testid="summary-pressure-accuracy">
                    not available yet
                  </span>
                  <span className="text-[10px] text-[var(--brand-muted)]">Pressure Accuracy</span>
                </div>
                <div className="rounded bg-[var(--brand-bg)] border border-[var(--brand-border)] p-2">
                  <span className="block text-lg font-bold text-[var(--brand-muted)]" data-testid="summary-pressure-fail-rate">
                    not available yet
                  </span>
                  <span className="text-[10px] text-[var(--brand-muted)]">Pressure Fail Rate</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Render Phase 1 ───────────────────────────────────────────────────────

  if (phase === 1) {
    const currentPrompt = P1_PROMPTS[p1PromptIndex];

    return (
      <div className="flex flex-col h-full overflow-y-auto p-6 lg:p-8 space-y-8 bg-[var(--brand-surface)] text-[var(--brand-ink)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--brand-border)] pb-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--brand-teal-ink)]" data-testid="phase-indicator">
              Phase 1 — Cold Recall
            </h3>
            <p className="text-sm text-[var(--brand-ink-soft)] mt-1">
              Attempt to formulate sentences from memory. Target pattern is hidden.
            </p>
          </div>
          <button type="button" onClick={onExit} className="app-button-ghost px-3 py-1.5 text-sm">
            Exit
          </button>
        </div>

        {/* Workspace */}
        <div className="ml-8 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 space-y-6">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wider text-[var(--brand-muted)] font-mono">
              Prompt {p1PromptIndex + 1} of 2
            </span>
            <p className="text-base font-semibold" data-testid="drill-prompt-text">
              {currentPrompt}
            </p>
          </div>

          <form onSubmit={handleP1Submit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="drill-transcript" className="block text-sm font-medium">
                Type your response sentence:
              </label>
              <textarea
                id="drill-transcript"
                data-testid="drill-transcript-input"
                rows={4}
                maxLength={500}
                placeholder="Type your sentence here..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                data-testid="drill-submit-btn"
                disabled={!transcript.trim()}
                className={`app-button px-5 py-2 text-sm ${!transcript.trim() ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                Submit Response
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── Render Phase 2 ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 lg:p-8 space-y-8 bg-[var(--brand-surface)] text-[var(--brand-ink)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--brand-border)] pb-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--brand-teal-ink)]" data-testid="phase-indicator">
            Phase 2 — Contrastive Repetition
          </h3>
          <p className="text-sm text-[var(--brand-ink-soft)] mt-1">
            Focus on matching the pattern target steps.
          </p>
        </div>
        <button type="button" onClick={onExit} className="app-button-ghost px-3 py-1.5 text-sm">
          Exit
        </button>
      </div>

      {/* Deferred Phase 3 Banner */}
      {context.entryPhase === 3 && p2TopicIndex === 0 && attemptNumber === 1 && !lastResult && (
        <div
          data-testid="phase3-deferred-notice"
          className="rounded-lg border border-[var(--brand-teal-soft)] bg-[var(--brand-teal-soft)] bg-opacity-20 p-3 text-sm text-[var(--brand-teal-ink)]"
        >
          Pressure Test is coming later. Starting from focused repetition now.
        </div>
      )}

      {/* Pattern Reference Disclosure */}
      <div className="ml-8 border border-[var(--brand-border)] bg-[var(--brand-surface-2)] rounded-lg p-3">
        <button
          type="button"
          data-testid="toggle-pattern-ref-btn"
          onClick={() => setShowPatternRef((prev) => !prev)}
          className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-teal-ink)] flex items-center gap-1 focus:outline-none"
        >
          {showPatternRef ? "▼ Hide Pattern Reference" : "▶ Show Pattern Reference"}
        </button>
        {showPatternRef && (
          <div className="mt-2 text-sm pl-4 space-y-1 border-t border-[var(--brand-border)] pt-2" data-testid="pattern-ref-steps">
            <p className="font-semibold">{context.targetPattern}</p>
            <ol className="list-decimal pl-5 text-xs font-mono text-[var(--brand-muted)]">
              {context.targetSteps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Simplified Topic Banner */}
      {simplifiedActive && (
        <div
          data-testid="simplified-notice"
          className="ml-8 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800"
        >
          Let&apos;s try a simpler topic to practice this pattern.
        </div>
      )}

      {/* Workspace */}
      <div className="ml-8 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 space-y-6">
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wider text-[var(--brand-muted)] font-mono">
            Topic {p2TopicIndex + 1} of 2 — Attempt {attemptNumber} of 3
          </span>
          <p className="text-base font-semibold" data-testid="drill-prompt-text">
            {currentTopic}
          </p>
        </div>

        {/* Evaluation Feedback */}
        {lastResult && (
          <div className="rounded bg-[var(--brand-bg)] border border-[var(--brand-border)] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${
                lastResult.credit === "full" ? "bg-green-100 text-green-800" :
                lastResult.credit === "partial" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"
              }`}>
                {lastResult.credit === "full" ? "Full Credit" :
                 lastResult.credit === "partial" ? "Partial Credit" : "No Credit"}
              </span>
            </div>

            <p className="text-sm font-medium" data-testid="drill-feedback-text">
              {lastResult.shortFeedback}
            </p>

            {lastResult.credit === "partial" && (
              <div className="text-xs text-[var(--brand-muted)] space-y-1" data-testid="drill-retry-prompt">
                <p><strong>Missing Steps:</strong> {lastResult.missingSteps.join(", ")}</p>
                <p className="italic">Please repeat using the pattern, making sure to include the missing step(s).</p>
              </div>
            )}

            {lastResult.credit === "none" && (
              <div className="text-xs text-[var(--brand-muted)] space-y-1" data-testid="drill-retry-prompt">
                <p className="italic">Please try again and follow the pattern structure.</p>
              </div>
            )}
          </div>
        )}

        {/* Error notification */}
        {errorText && (
          <p className="text-sm text-[var(--brand-danger)]" data-testid="drill-error-text">
            {errorText}
          </p>
        )}

        {/* Submit Form */}
        {lastResult?.credit === "full" ? (
          <div className="flex justify-end">
            <button
              type="button"
              data-testid="drill-next-btn"
              onClick={handleNextTopic}
              className="app-button px-5 py-2 text-sm"
            >
              Next
            </button>
          </div>
        ) : (
          <form onSubmit={handleP2Submit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="drill-transcript-p2" className="block text-sm font-medium">
                Type your response sentence:
              </label>
              <textarea
                id="drill-transcript-p2"
                data-testid="drill-transcript-input"
                rows={4}
                maxLength={500}
                placeholder="Type your sentence here..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                disabled={isEvaluating}
                className="w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] disabled:opacity-50"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                data-testid="drill-submit-btn"
                disabled={!transcript.trim() || isEvaluating}
                className={`app-button px-5 py-2 text-sm ${(!transcript.trim() || isEvaluating) ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isEvaluating ? "Evaluating..." : "Submit Response"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
