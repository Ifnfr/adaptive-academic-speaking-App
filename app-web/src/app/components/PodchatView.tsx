"use client";

import { useMemo, useState } from "react";

type PodchatPhase =
  | "setup"
  | "speaking"
  | "evaluation";
type PodchatTopic = "Economics" | "Technology";
type PodchatDifficulty = "Beginner" | "Intermediate" | "Advanced";
type PodchatStatus = "host_turn" | "user_turn" | "submitting" | "complete";
type PodchatSpeaker = "host" | "learner";

type PodchatTurn = {
  id: string;
  speaker: PodchatSpeaker;
  text: string;
};

type PodchatCorrection = {
  original: string;
  improved: string;
  explanation: string;
};

type PodchatVocabularySuggestion = {
  originalOrBasic: string;
  suggestion: string;
  example: string;
};

type PodchatRecurringError = {
  label: string;
  evidence: string;
  practiceFocus: string;
};

type PodchatEvaluateResponse = {
  summary: string;
  corrections: PodchatCorrection[];
  betterSentences: string[];
  vocabularySuggestions: PodchatVocabularySuggestion[];
  recurringErrors: PodchatRecurringError[];
  nextPracticeFocus: string;
};

const TOPICS: readonly PodchatTopic[] = ["Economics", "Technology"];
const DIFFICULTIES: readonly PodchatDifficulty[] = [
  "Beginner",
  "Intermediate",
  "Advanced",
];

const DIFFICULTY_TURNS: Record<PodchatDifficulty, number> = {
  Beginner: 3,
  Intermediate: 5,
  Advanced: 7,
};

const HOST_OPENERS: Record<PodchatTopic, string> = {
  Economics:
    "Welcome to Podchat. Let's discuss how everyday prices influence the choices people make. What example from daily life would you like to start with?",
  Technology:
    "Welcome to Podchat. Let's explore how technology changes the way people study and work. Which technology trend feels most important to you right now?",
};

const LEARNER_REPLIES: Record<PodchatTopic, readonly string[]> = {
  Economics: [
    "I think prices affect daily decisions because people compare what they want with what they can afford.",
    "For example, when transport costs rise, students may choose cheaper routes or reduce non-essential spending.",
    "This shows a trade-off because limited income forces people to prioritize the most useful option.",
    "Businesses may also react by changing prices, offering discounts, or reducing costs in their operations.",
    "The main risk is that people with lower income have fewer choices when prices change quickly.",
    "In my opinion, economic pressure is not only about money but also about confidence and planning.",
    "Overall, small price changes can create large effects when many people adjust their behavior together.",
  ],
  Technology: [
    "I think technology changes learning because people can access information faster and practice more independently.",
    "For example, students can use online platforms to review lessons, record ideas, and receive quick feedback.",
    "However, technology can also distract learners if they use too many tools without a clear purpose.",
    "Workers may benefit from automation, but they also need new skills to stay relevant in their jobs.",
    "Privacy is important because learning tools may collect personal data and study habits.",
    "In the next few years, I think AI tools will become normal assistants for writing, speaking, and research.",
    "Overall, technology is most useful when people use it intentionally rather than depending on it completely.",
  ],
};

function speakerLabel(speaker: PodchatSpeaker): string {
  return speaker === "host" ? "AI host" : "Learner";
}

function statusLabel(status: PodchatStatus): string {
  if (status === "host_turn") return "Host speaking";
  if (status === "user_turn") return "Your turn";
  if (status === "submitting") return "Processing";
  return "Complete";
}

function nextTurnId(turns: ReadonlyArray<PodchatTurn>): string {
  return `podchat-turn-${turns.length + 1}`;
}

export function PodchatView() {
  const [phase, setPhase] = useState<PodchatPhase>("setup");
  const [topic, setTopic] = useState<PodchatTopic>("Technology");
  const [difficulty, setDifficulty] =
    useState<PodchatDifficulty>("Intermediate");
  const [status, setStatus] = useState<PodchatStatus>("host_turn");
  const [turns, setTurns] = useState<PodchatTurn[]>([]);
  const [submittedUserTurns, setSubmittedUserTurns] = useState(0);
  const [draftLearnerText, setDraftLearnerText] = useState("");

  // New API/Feedback Integration States
  const [turnError, setTurnError] = useState<string | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [evalData, setEvalData] = useState<PodchatEvaluateResponse | null>(null);

  const maxUserTurns = DIFFICULTY_TURNS[difficulty];
  const progressTurn = Math.min(submittedUserTurns + 1, maxUserTurns);
  const rollingTurns = turns.slice(-3);
  const fullTranscript = useMemo(
    () =>
      turns
        .map((turn) => `${speakerLabel(turn.speaker)}: ${turn.text}`)
        .join("\n\n"),
    [turns],
  );

  const buttonPrimary =
    "rounded-lg bg-[var(--brand-teal)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-teal-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] focus:ring-offset-2 focus:ring-offset-[var(--brand-bg)] disabled:cursor-not-allowed disabled:bg-[var(--brand-border-strong)] disabled:text-[var(--brand-muted)]";
  const buttonSecondary =
    "rounded-lg border border-[var(--brand-border-strong)] bg-[var(--brand-surface)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] disabled:cursor-not-allowed disabled:opacity-50";
  const labelClass =
    "mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]";
  const card =
    "rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm brand-grid";

  function startPodchat() {
    const opener: PodchatTurn = {
      id: "podchat-turn-1",
      speaker: "host",
      text: HOST_OPENERS[topic],
    };
    setTurns([opener]);
    setSubmittedUserTurns(0);
    setDraftLearnerText("");
    setStatus("user_turn");
    setPhase("speaking");
    setTurnError(null);
    setEvalError(null);
    setEvalData(null);
  }

  function resetPodchat() {
    setPhase("setup");
    setStatus("host_turn");
    setTurns([]);
    setSubmittedUserTurns(0);
    setDraftLearnerText("");
    setTurnError(null);
    setEvalError(null);
    setEvalData(null);
  }

  function mockLearnerAnswer() {
    const index = Math.min(submittedUserTurns, maxUserTurns - 1);
    setDraftLearnerText(LEARNER_REPLIES[topic][index]);
  }

  async function triggerEvaluation(finalTurns: PodchatTurn[]) {
    setEvalLoading(true);
    setEvalError(null);
    try {
      const response = await fetch("/api/podchat/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          difficulty,
          turns: finalTurns.map((t) => ({ speaker: t.speaker, text: t.text })),
        }),
      });
      if (!response.ok) {
        const errText = await response.json().catch(() => ({}));
        throw new Error(errText.error || "Failed to evaluate session.");
      }
      const data = await response.json();
      setEvalData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setEvalError(msg || "An error occurred during evaluation.");
    } finally {
      setEvalLoading(false);
    }
  }

  async function retryLastTurn() {
    setTurnError(null);
    setStatus("submitting");
    try {
      const response = await fetch("/api/podchat/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          difficulty,
          turnIndex: submittedUserTurns,
          maxUserTurns,
          turns: turns.map((t) => ({ speaker: t.speaker, text: t.text })),
        }),
      });
      if (!response.ok) {
        const errText = await response.json().catch(() => ({}));
        throw new Error(errText.error || "Failed to submit turn.");
      }
      const data = await response.json();
      const hostTurn: PodchatTurn = {
        id: `podchat-turn-${turns.length + 1}`,
        speaker: "host",
        text: `${data.hostText} ${data.followUpQuestion}`,
      };
      const updatedTurns = [...turns, hostTurn];
      setTurns(updatedTurns);
      const nextSubmittedCount = submittedUserTurns + 1;
      setSubmittedUserTurns(nextSubmittedCount);

      if (nextSubmittedCount >= maxUserTurns) {
        setStatus("complete");
        setPhase("evaluation");
        triggerEvaluation(updatedTurns);
      } else {
        setStatus("user_turn");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTurnError(msg || "An error occurred. Please try again.");
      setStatus("user_turn");
    }
  }

  async function submitTurn() {
    if (status !== "user_turn") return;
    const learnerText = draftLearnerText || LEARNER_REPLIES[topic][0];
    const learnerTurn: PodchatTurn = {
      id: nextTurnId(turns),
      speaker: "learner",
      text: learnerText,
    };
    const updatedTurns = [...turns, learnerTurn];
    setTurns(updatedTurns);
    setDraftLearnerText("");
    setTurnError(null);
    setStatus("submitting");

    try {
      const response = await fetch("/api/podchat/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          difficulty,
          turnIndex: submittedUserTurns,
          maxUserTurns,
          turns: updatedTurns.map((t) => ({ speaker: t.speaker, text: t.text })),
        }),
      });
      if (!response.ok) {
        const errText = await response.json().catch(() => ({}));
        throw new Error(errText.error || "Failed to submit turn.");
      }
      const data = await response.json();
      const hostTurn: PodchatTurn = {
        id: `podchat-turn-${updatedTurns.length + 1}`,
        speaker: "host",
        text: `${data.hostText} ${data.followUpQuestion}`,
      };
      const finalTurns = [...updatedTurns, hostTurn];
      setTurns(finalTurns);
      const nextSubmittedCount = submittedUserTurns + 1;
      setSubmittedUserTurns(nextSubmittedCount);

      if (nextSubmittedCount >= maxUserTurns) {
        setStatus("complete");
        setPhase("evaluation");
        triggerEvaluation(finalTurns);
      } else {
        setStatus("user_turn");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTurnError(msg || "An error occurred. Please try again.");
      setStatus("user_turn");
    }
  }

  function endSession() {
    const hasLearnerTurn = turns.some((t) => t.speaker === "learner");
    if (!hasLearnerTurn) {
      setTurnError("Complete at least one turn before evaluation.");
      return;
    }
    setStatus("complete");
    setPhase("evaluation");
    triggerEvaluation(turns);
  }

  if (phase === "setup") {
    return (
      <section className={card} data-testid="podchat-setup">
        <div className="border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
            Podchat Phase 1
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">
            Start a Podchat
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--brand-ink-soft)]">
            Choose a topic and difficulty, then practice a short local-only
            conversation. This Phase 1 preview uses deterministic mock turns and
            does not use microphone capture, audio recording, providers, or
            cloud storage.
          </p>
        </div>
        <div className="p-6">
          <fieldset>
            <legend className={labelClass}>Topic</legend>
            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              role="radiogroup"
              aria-label="Podchat topic"
            >
              {TOPICS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={topic === option}
                  onClick={() => setTopic(option)}
                  className={
                    "rounded-xl border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] " +
                    (topic === option
                      ? "border-[var(--brand-teal)] bg-[var(--brand-teal-soft)]/60 text-[var(--brand-teal-ink)]"
                      : "border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-ink)] hover:border-[var(--brand-border-strong)]")
                  }
                >
                  <span className="text-sm font-semibold">{option}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className={labelClass}>Difficulty</legend>
            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-3"
              role="radiogroup"
              aria-label="Podchat difficulty"
            >
              {DIFFICULTIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={difficulty === option}
                  onClick={() => setDifficulty(option)}
                  className={
                    "rounded-xl border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] " +
                    (difficulty === option
                      ? "border-[var(--brand-teal)] bg-[var(--brand-teal-soft)]/60 text-[var(--brand-teal-ink)]"
                      : "border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-ink)] hover:border-[var(--brand-border-strong)]")
                  }
                >
                  <span className="text-sm font-semibold">{option}</span>
                  <span className="mt-1 block text-xs text-[var(--brand-ink-soft)]">
                    {DIFFICULTY_TURNS[option]} learner turns
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={startPodchat}
              className={buttonPrimary}
            >
              Start a Podchat
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (phase === "evaluation") {
    return (
      <div className="flex flex-col gap-6" data-testid="podchat-evaluation">
        <section className={card}>
          <div className="border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
              Evaluation
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">
              Podchat transcript and AI feedback
            </h2>
          </div>
          <div className="p-6">
            <h3 className={labelClass}>Full transcript</h3>
            <pre
              className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 text-sm leading-6 text-[var(--brand-ink)]"
              data-testid="podchat-full-transcript"
            >
              {fullTranscript || "No turns were submitted before ending."}
            </pre>
          </div>
        </section>

        {evalLoading && (
          <section className={`${card} p-6 flex flex-col items-center justify-center min-h-[200px]`} data-testid="podchat-evaluation-loading">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-teal)]"></div>
            <p className="mt-4 text-sm text-[var(--brand-ink-soft)]">Evaluating transcript...</p>
          </section>
        )}

        {evalError && (
          <section className={`${card} p-6`} data-testid="podchat-evaluation-error">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <h3 className="text-sm font-semibold text-red-800">Evaluation Error</h3>
              <p className="mt-2 text-sm text-red-700">{evalError}</p>
              <button
                type="button"
                onClick={() => triggerEvaluation(turns)}
                className={`${buttonPrimary} mt-4`}
              >
                Retry Evaluation
              </button>
            </div>
            <div className="mt-6 border-t border-[var(--brand-border)] pt-5">
              <button
                type="button"
                onClick={resetPodchat}
                className={buttonSecondary}
              >
                Start New Podchat
              </button>
            </div>
          </section>
        )}

        {evalData && (
          <section className={card} data-testid="podchat-evaluation-success">
            <div className="p-6 flex flex-col gap-6">
              <div>
                <h3 className={labelClass}>Summary</h3>
                <p className="text-sm leading-6 text-[var(--brand-ink-soft)]">{evalData.summary}</p>
              </div>

              {evalData.corrections.length > 0 && (
                <div>
                  <h3 className={labelClass}>Corrections / Grammar Notes</h3>
                  <div className="mt-2 flex flex-col gap-3">
                    {evalData.corrections.map((c: PodchatCorrection, i: number) => (
                      <div key={i} className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
                        <p className="text-xs text-red-600 line-through">“{c.original}”</p>
                        <p className="mt-1 text-sm font-medium text-emerald-700">“{c.improved}”</p>
                        <p className="mt-2 text-xs text-[var(--brand-ink-soft)]">{c.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {evalData.betterSentences.length > 0 && (
                <div>
                  <h3 className={labelClass}>Better sentence examples</h3>
                  <ul className="mt-2 list-disc pl-5 text-sm text-[var(--brand-ink-soft)] space-y-2">
                    {evalData.betterSentences.map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {evalData.vocabularySuggestions.length > 0 && (
                <div>
                  <h3 className={labelClass}>Vocabulary suggestions</h3>
                  <div className="mt-2 flex flex-col gap-3">
                    {evalData.vocabularySuggestions.map((v: PodchatVocabularySuggestion, i: number) => (
                      <div key={i} className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
                        <p className="text-sm font-semibold text-[var(--brand-ink)]">
                          Instead of <span className="underline decoration-red-500">{v.originalOrBasic}</span>, try: <span className="text-[var(--brand-teal)]">{v.suggestion}</span>
                        </p>
                        <p className="mt-2 text-xs italic text-[var(--brand-ink-soft)]">Example: “{v.example}”</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {evalData.recurringErrors.length > 0 && (
                <div>
                  <h3 className={labelClass}>Recurring Errors</h3>
                  <div className="mt-2 flex flex-col gap-3">
                    {evalData.recurringErrors.map((re: PodchatRecurringError, i: number) => (
                      <div key={i} className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
                        <p className="text-sm font-semibold text-[var(--brand-ink)]">{re.label}</p>
                        <p className="mt-1 text-xs text-[var(--brand-ink-soft)]">Evidence: <span className="italic">“{re.evidence}”</span></p>
                        <p className="mt-2 text-xs text-[var(--brand-teal-ink)]">Practice: {re.practiceFocus}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className={labelClass}>Next practice focus</h3>
                <p className="text-sm leading-6 text-[var(--brand-ink-soft)]">{evalData.nextPracticeFocus}</p>
              </div>
            </div>
            <div className="border-t border-[var(--brand-border)] px-6 py-5">
              <button
                type="button"
                onClick={resetPodchat}
                className={buttonSecondary}
              >
                Start New Podchat
              </button>
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="podchat-speaking">
      <section className={card}>
        <div className="flex flex-col gap-4 border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-teal)]">
              Speaking screen
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">
              {topic} Podchat · {difficulty}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span
              className="rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-1 text-[var(--brand-ink)]"
              data-testid="podchat-turn-progress"
            >
              Turn {progressTurn} of {maxUserTurns}
            </span>
            <span
              className="rounded-full border border-[var(--brand-teal)]/40 bg-[var(--brand-teal-soft)] px-3 py-1 text-[var(--brand-teal-ink)]"
              data-testid="podchat-status"
            >
              {statusLabel(status)}
            </span>
          </div>
        </div>
        <div className="p-6">
          <div
            aria-live="polite"
            className="flex flex-col gap-3"
            data-testid="podchat-rolling-transcript"
          >
            {rollingTurns.map((turn, index) => {
              const isCurrent = index === rollingTurns.length - 1;
              const isPrevious = index === rollingTurns.length - 2;
              return (
                <article
                  key={turn.id}
                  className={
                    "rounded-xl border p-4 transition-opacity " +
                    (isCurrent
                      ? "border-[var(--brand-teal)] bg-[var(--brand-teal-soft)]/50"
                      : isPrevious
                        ? "border-[var(--brand-border)] bg-[var(--brand-surface-2)]"
                        : "border-[var(--brand-border)] bg-[var(--brand-surface-2)] opacity-45 blur-[1px]")
                  }
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]">
                    {speakerLabel(turn.speaker)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--brand-ink)]">
                    {turn.text}
                  </p>
                </article>
              );
            })}

            {status === "submitting" && (
              <div className="flex items-center gap-2 p-4 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] animate-pulse" data-testid="podchat-loading-turn">
                <div className="h-2 w-2 rounded-full bg-[var(--brand-teal)] animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="h-2 w-2 rounded-full bg-[var(--brand-teal)] animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="h-2 w-2 rounded-full bg-[var(--brand-teal)] animate-bounce" style={{ animationDelay: '300ms' }}></div>
                <span className="text-xs text-[var(--brand-muted)]">Host is thinking...</span>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4">
            <h3 className="text-sm font-semibold text-[var(--brand-ink)]">
              Local mock learner turn
            </h3>
            <p className="mt-1 text-xs leading-5 text-[var(--brand-ink-soft)]">
              Phase 1 uses deterministic local text only. No microphone, audio,
              provider route, or cloud write is used.
            </p>
            <div className="mt-4 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3 text-sm leading-6 text-[var(--brand-ink)]">
              {draftLearnerText || "Click Mock learner answer to prepare this turn."}
            </div>
            {turnError && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-800" data-testid="podchat-turn-error">
                {turnError}
              </div>
            )}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={mockLearnerAnswer}
                disabled={status !== "user_turn"}
                className={buttonSecondary}
              >
                Mock learner answer
              </button>
              <button
                type="button"
                onClick={submitTurn}
                disabled={status !== "user_turn" || !draftLearnerText}
                className={buttonPrimary}
              >
                Submit Turn
              </button>
              {turnError && (
                <button
                  type="button"
                  onClick={retryLastTurn}
                  disabled={status === "submitting"}
                  className={buttonPrimary}
                >
                  Retry Turn
                </button>
              )}
              <button
                type="button"
                onClick={endSession}
                disabled={status === "submitting"}
                className={buttonSecondary}
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
