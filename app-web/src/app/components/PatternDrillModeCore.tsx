import { useState, useRef, useEffect } from "react";

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

// ─── Component ───────────────────────────────────────────────────────────────

export function PatternDrillModeCore({ context, onExit }: PatternDrillModeCoreProps) {
  const [phase, setPhase] = useState<1 | 2>(context.entryPhase === 3 ? 2 : 1);
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

  // Request abort ref
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

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
      setIsComplete(true);
    }
  };

  // ── Render completion screen ─────────────────────────────────────────────

  if (isComplete) {
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

        <div className="ml-8 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6 space-y-6">
          <p className="text-sm text-[var(--brand-ink)]">
            Congratulations! You have completed the structured repetition drill session.
          </p>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--brand-ink-soft)]">
              Your Cold Recall Answers (Phase 1)
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

          <div className="rounded border border-dashed border-[var(--brand-border)] p-3 text-xs text-[var(--brand-muted)]">
            Completion persistence is coming later. Your results are stored in local session memory for now.
          </div>
        </div>
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
